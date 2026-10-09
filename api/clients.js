// Shared client registry for the whole network, stored in Supabase (Postgres) through its REST API.
// Tables clients / leads are private (RLS on, no policies); only this server holds the secret key.
const crypto = require('crypto');

// No defaults: the codes live only in the Vercel environment, and the API refuses to work without them.
const STAFF_CODE = process.env.STAFF_CODE;
const OWNER_CODE = process.env.OWNER_CODE;
const TOKEN_SECRET = process.env.TOKEN_SECRET; // signs client access tokens
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const TOKEN_DAYS = 180;

// u_<phone digits> for people with a phone; x_<n> for cards imported without one (no app account).
const ID = /^(u_\d{10,12}|x_\d{1,6})$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const sb = async (path, init = {}) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json', ...init.headers } });
  if (!r.ok) throw new Error('db ' + r.status);
  const text = await r.text(); // writes with return=minimal come back empty
  return text ? JSON.parse(text) : null;
};

async function read(id) {
  const rows = await sb(`clients?id=eq.${id}&select=data`);
  return rows[0]?.data ?? null;
}

const write = (id, data) => sb('clients?on_conflict=id', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id, data, updated_at: new Date().toISOString() }) });

/** Every client, paged because PostgREST returns at most 1000 rows per request. */
async function readAll() {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const rows = await sb(`clients?select=data&order=id&limit=1000&offset=${from}`);
    all.push(...rows.map((r) => r.data));
    if (rows.length < 1000) return all;
  }
}

const authed = (req) => {
  const code = String(req.headers['x-code'] || '');
  return !!code && (code === STAFF_CODE || code === OWNER_CODE);
};

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const digitsOf = (v) => String(v ?? '').replace(/[^0-9]/g, '');

/* ---- client passwords and access tokens ---- */
const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => salt + ':' + crypto.scryptSync(password, salt, 32).toString('hex');
const checkPassword = (password, stored) => {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const probe = crypto.scryptSync(password, salt, 32).toString('hex');
  return hash.length === probe.length && crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(probe));
};
const sign = (payload) => crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
const issueToken = (id) => {
  const payload = id + '.' + (Date.now() + TOKEN_DAYS * 86400000);
  return payload + '.' + sign(payload);
};
/** Returns the client id the token belongs to, or null. */
const tokenOwner = (req) => {
  const t = String(req.headers['x-token'] || '');
  const [id, exp, sig] = t.split('.');
  if (!id || !exp || !sig || !ID.test(id) || Number(exp) < Date.now()) return null;
  const expect = sign(id + '.' + exp);
  return sig.length === expect.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect)) ? id : null;
};
const account = (c) => (c ? { membership: c.membership ?? null, name: c.name ?? null, homeClubId: c.homeClubId ?? null, profile: c.profile ?? null } : null);
const publicClient = ({ passHash: _p, passReset: _r, ...c }) => c;

function cleanMembership(m) {
  if (!m || typeof m !== 'object') return null;
  const out = { planId: str(m.planId, 12), startDate: str(m.startDate, 10), endDate: str(m.endDate, 10), freezeDaysLeft: Math.max(0, Math.min(365, Number(m.freezeDaysLeft) || 0)) };
  if (!out.planId || !DAY.test(out.startDate) || !DAY.test(out.endDate)) return null;
  if (m.frozenUntil && DAY.test(String(m.frozenUntil))) out.frozenUntil = String(m.frozenUntil);
  return out;
}

function cleanProfile(p) {
  if (!p || typeof p !== 'object') return undefined;
  const num = (v, lo, hi) => (Number.isFinite(Number(v)) && Number(v) >= lo && Number(v) <= hi ? Math.round(Number(v)) : undefined);
  const goal = ['lose', 'gain', 'tone', 'strength', 'flex'].includes(p.goal) ? p.goal : undefined;
  const gender = ['male', 'female'].includes(p.gender) ? p.gender : undefined;
  const level = ['beginner', 'intermediate', 'advanced'].includes(p.level) ? p.level : undefined;
  return { age: num(p.age, 10, 100), goal, heightCm: num(p.heightCm, 100, 250), weightKg: num(p.weightKg, 30, 300), targetWeightKg: num(p.targetWeightKg, 30, 300), gender, level, daysPerWeek: num(p.daysPerWeek, 1, 7) };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-code, x-token');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!STAFF_CODE || !OWNER_CODE || !TOKEN_SECRET || !SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ error: 'not configured' });
  const op = String(req.query.op || '');
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

  try {
    if (req.method === 'POST' && op === 'lead') {
      const name = str(body.name, 60);
      const phone = str(body.phone, 20);
      const digits = digitsOf(phone);
      if (name.length < 2 || digits.length < 10 || digits.length > 12) return res.status(400).json({ error: 'bad data' });
      const day = new Date().toISOString().slice(0, 10);
      const lead = { name, phone, clubId: ['c1', 'c2'].includes(body.clubId) ? body.clubId : '', lang: ['ru', 'kk', 'en'].includes(body.lang) ? body.lang : 'ru', ts: Date.now() };
      await sb('leads?on_conflict=id', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: `${day}-${digits}`, ts: lead.ts, data: lead }) });
      return res.status(200).json({ ok: true });
    }

    // Sign in with phone + password. Accounts created before passwords existed take the first password offered.
    if (req.method === 'POST' && op === 'login') {
      const id = str(body.id, 20);
      const password = String(body.password ?? '');
      if (!ID.test(id)) return res.status(400).json({ error: 'bad id' });
      const c = await read(id);
      if (!c) return res.status(404).json({ error: 'unknown' });
      if (password.length < 6) return res.status(400).json({ error: 'short password' });
      if (c.passHash) {
        if (!checkPassword(password, c.passHash)) return res.status(401).json({ error: 'wrong password' });
      } else if (c.passReset) {
        // The front desk confirmed the person; the next sign-in sets the password.
        const { passReset: _r, ...rest } = c;
        await write(id, { ...rest, passHash: hashPassword(password) });
      } else {
        // An account without a password (created at the desk or before passwords existed) must be unlocked by staff first,
        // otherwise anyone who knows the phone number could claim it.
        return res.status(409).json({ error: 'reset required' });
      }
      return res.status(200).json({ token: issueToken(id), account: account(c) });
    }

    if (req.method === 'POST' && op === 'register') {
      const id = str(body.id, 20);
      // The id is derived from the phone number, so they must agree.
      if (!ID.test(id) || digitsOf(body.phone) !== id.slice(2)) return res.status(400).json({ error: 'bad id' });
      const existing = await read(id);
      let prev;
      if (existing) {
        // Updating an existing account needs its token (or the front desk code).
        if (tokenOwner(req) !== id && !authed(req)) return res.status(401).json({ error: 'auth' });
        prev = existing;
      } else {
        // A new account must set its password right away.
        const password = String(body.password ?? '');
        if (password.length < 6) return res.status(400).json({ error: 'short password' });
        prev = { id, since: new Date().toISOString().slice(0, 10), passHash: hashPassword(password) };
      }
      const given = str(body.name, 60);
      // A placeholder name must not overwrite the real one saved earlier.
      const name = given && given !== 'Гость' && given !== 'Guest' && given !== 'Қонақ' ? given : prev.name || given || 'Гость';
      const next = { ...prev, name, phone: str(body.phone, 20), homeClubId: str(body.homeClubId, 8) || prev.homeClubId || 'c1' };
      const profile = cleanProfile(body.profile);
      if (profile) next.profile = profile;
      // Blob writes are the scarce quota: skip the write when nothing changed (the app re-sends on every launch).
      if (!existing || JSON.stringify(next) !== JSON.stringify(existing)) await write(id, next);
      return res.status(200).json({ ok: true, membership: next.membership ?? null, token: existing ? undefined : issueToken(id) });
    }

    if (req.method === 'GET' && op === 'me') {
      const id = str(req.query.id, 20);
      if (!ID.test(id)) return res.status(400).json({ error: 'bad id' });
      if (tokenOwner(req) !== id && !authed(req)) return res.status(401).json({ error: 'auth' });
      const c = await read(id);
      return res.status(200).json(account(c) ?? { membership: null, name: null, homeClubId: null, profile: null });
    }

    if (!authed(req)) return res.status(401).json({ error: 'code' });

    if (req.method === 'GET' && op === 'leads') {
      const rows = await sb('leads?select=data&order=ts.desc&limit=200');
      return res.status(200).json({ leads: rows.map((r) => r.data) });
    }

    if (req.method === 'GET' && op === 'list') {
      return res.status(200).json({ clients: (await readAll()).map(publicClient).sort((a, b) => String(b.since).localeCompare(String(a.since))) });
    }

    // Entry/exit of a client at a club. The server clock is the source of truth for the visit.
    if (req.method === 'POST' && (op === 'checkin' || op === 'checkout')) {
      const id = str(body.id, 20);
      if (!ID.test(id)) return res.status(400).json({ error: 'bad id' });
      const prev = await read(id);
      if (!prev) return res.status(404).json({ error: 'unknown client' });
      const session = op === 'checkin' ? { clubId: str(body.clubId, 8) || 'c1', inTs: Date.now() } : prev.session ? { ...prev.session, outTs: Date.now() } : undefined;
      await write(id, { ...prev, session });
      return res.status(200).json({ ok: true });
    }

    // Front desk: drop a forgotten password; the client sets a new one at the next sign-in.
    if (req.method === 'POST' && op === 'reset-password') {
      const id = str(body.id, 20);
      if (!ID.test(id)) return res.status(400).json({ error: 'bad id' });
      const prev = await read(id);
      if (!prev) return res.status(404).json({ error: 'unknown client' });
      const { passHash: _p, ...rest } = prev;
      await write(id, { ...rest, passReset: true });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST' && op === 'grant') {
      const id = str(body.id, 20);
      const membership = cleanMembership(body.membership);
      if (!ID.test(id) || !membership) return res.status(400).json({ error: 'bad data' });
      const prev = (await read(id)) || { id, name: str(body.name, 60) || 'Гость', phone: str(body.phone, 20), homeClubId: 'c1', since: new Date().toISOString().slice(0, 10) };
      await write(id, { ...prev, membership });
      return res.status(200).json({ ok: true });
    }

    return res.status(404).json({ error: 'unknown op' });
  } catch (e) {
    return res.status(500).json({ error: 'server' });
  }
};
