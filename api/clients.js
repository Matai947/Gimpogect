// Shared client registry for the whole network, stored in Supabase (Postgres) through its REST API.
// Tables clients / leads are private (RLS on, no policies); only this server holds the secret key.
const crypto = require('crypto');

// No defaults: the codes live only in the Vercel environment, and the API refuses to work without them.
const OWNER_CODE = process.env.OWNER_CODE;
const TOKEN_SECRET = process.env.TOKEN_SECRET; // signs client access tokens
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const TOKEN_DAYS = 180;

// u_<phone digits> for people with a phone; x_<n> for cards imported without one (no app account).
const ID = /^(u_\d{10,12}|x_\d{1,6})$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayOf = (ts) => new Date(ts + 5 * 3600000).toISOString().slice(0, 10); // Almaty calendar day

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

/** Pages through any REST query: PostgREST returns at most 1000 rows per request. */
async function pageAll(query, cap = 30000) {
  const all = [];
  for (let from = 0; from < cap; from += 1000) {
    const rows = await sb(`${query}&limit=1000&offset=${from}`);
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return all;
}

// Editable content (prices, plans, trainers, rules, schedule, promotions, photos), one settings row per section.
// Everyone reads it; only the administrators write it. Text that ends up on public pages may not carry markup.
const CONTENT_SECTIONS = ['catalog', 'plans', 'trainers', 'rules', 'classes', 'promos', 'photos'];
const SAFE_URL = /^https:\/\/[\w.\-\/%?=&:~+@]+$/;
function cleanDeep(v, depth = 0) {
  if (depth > 7) throw new Error('deep');
  if (typeof v === 'string') {
    if (/[<>]/.test(v)) throw new Error('markup');
    if (/^https?:/i.test(v) && !SAFE_URL.test(v)) throw new Error('url');
    return v.slice(0, 3000);
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'boolean' || v === null) return v;
  if (Array.isArray(v)) {
    if (v.length > 400) throw new Error('long');
    return v.map((x) => cleanDeep(x, depth + 1));
  }
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    if (keys.length > 80) throw new Error('wide');
    const out = {};
    for (const k of keys) {
      if (!/^[\w\-:.]{1,60}$/.test(k) || ['__proto__', 'constructor', 'prototype'].includes(k)) throw new Error('key');
      if (v[k] !== undefined) out[k] = cleanDeep(v[k], depth + 1);
    }
    return out;
  }
  throw new Error('type');
}
/** Sanity bounds per section, so a typo or a leaked code cannot publish a free plan or a 1000% discount. */
function checkSection(section, d) {
  const num = (v, lo, hi) => {
    if (v == null) return;
    if (typeof v !== 'number' || v < lo || v > hi) throw new Error('range');
  };
  const planFields = (p) => {
    num(p.price, 0, 5000000);
    num(p.oldPrice, 0, 5000000);
    num(p.days, 1, 800);
    num(p.visits, 0, 1000);
    num(p.freezeDays, 0, 365);
  };
  // Pictures that appear on public pages must be real https addresses, nothing else (no javascript: or data:).
  const https = (v) => {
    if (v == null || v === '') return;
    if (typeof v !== 'string' || !SAFE_URL.test(v)) throw new Error('url');
  };
  // Every section is an object (or a list for promotions); a bare number or string would break the app that reads it.
  if (!d || typeof d !== 'object') throw new Error('shape');
  if (section === 'rules') Object.values(d).forEach((lines) => {
    if (!Array.isArray(lines) || lines.some((l) => typeof l !== 'string')) throw new Error('shape');
  });
  if (section === 'photos') Object.values(d).forEach((list) => (Array.isArray(list) ? list : [list]).forEach(https));
  if (section === 'trainers') {
    Object.values(d.overrides || {}).forEach((t) => https(t.photoUrl));
    (d.custom || []).forEach((t) => https(t.photoUrl));
  }
  if (section === 'plans') {
    Object.values(d.overrides || {}).forEach(planFields);
    (d.custom || []).forEach(planFields);
  }
  if (section === 'promos') {
    (Array.isArray(d) ? d : d.list || []).forEach((p) => {
      if (p.kind === 'percent') num(p.value, 0, 100);
      else num(p.value, 0, 1000000);
      if (!DAY.test(String(p.start)) || !DAY.test(String(p.end)) || p.start > p.end) throw new Error('dates');
      if (p.code != null && !/^[A-Z0-9_-]{0,20}$/.test(String(p.code))) throw new Error('code');
      https(p.image);
    });
  }
  if (section === 'catalog') {
    (d.custom || []).forEach((p) => num(p.price, 0, 5000000));
    Object.values(d.overrides || {}).forEach((p) => num(p.price, 0, 5000000));
  }
  if (section === 'trainers') {
    Object.values(d.overrides || {}).forEach((t) => num(t.pricePerSession, 0, 5000000));
    (d.custom || []).forEach((t) => num(t.pricePerSession, 0, 5000000));
  }
}
let contentCache = { at: 0, data: {} };
async function getContent() {
  if (Date.now() - contentCache.at < 15000) return contentCache.data;
  const data = {};
  try {
    (await sb('settings?key=like.content:*&select=key,data')).forEach((r) => (data[r.key.slice(8)] = r.data.v));
  } catch {
    // table not created yet: no custom content
  }
  contentCache = { at: Date.now(), data };
  return data;
}

// The network's clubs live in the settings table so the owner can add a branch without a deploy.
// Until the owner saves a list, the two original clubs are valid.
let clubCache = { at: 0, list: [] };
async function getClubs() {
  if (Date.now() - clubCache.at < 30000) return clubCache.list;
  let list = [];
  try {
    list = (await sb('settings?key=eq.clubs&select=data'))[0]?.data?.clubs ?? [];
  } catch {
    // table not created yet: fall back to the defaults
  }
  clubCache = { at: Date.now(), list };
  return list;
}
async function validClub(id) {
  const list = await getClubs();
  return list.length ? list.some((c) => c.id === id && c.active !== false) : ['c1', 'c2'].includes(id);
}

const logVisit = (club, member, kind) => sb('visits', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ ts: Date.now(), club, member, kind }) }).catch(() => {}); // best effort: a missing log must never block an entry

/** Every client, paged because PostgREST returns at most 1000 rows per request. */
async function readAll() {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const rows = await sb(`clients?select=data&order=id&limit=1000&offset=${from}`);
    all.push(...rows.map((r) => r.data));
    if (rows.length < 1000) return all;
  }
}

const isOwner = (req) => !!OWNER_CODE && String(req.headers['x-code'] || '') === OWNER_CODE;
const enc = encodeURIComponent;

/** Counts one attempt at a guessable code atomically (5 misses lock the code for 15 minutes); null = locked or busy. */
async function codeGate(key) {
  await sb('settings?on_conflict=key', { method: 'POST', headers: { prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ key, data: { fails: 0, lockUntil: 0 } }) });
  const lock = (await sb(`settings?key=eq.${key}&select=data`))[0].data;
  if (lock.lockUntil > Date.now()) return null;
  const tries = lock.lockUntil ? 0 : lock.fails || 0; // an expired lock starts the count over
  const counted = await sb(`settings?key=eq.${key}&${enc('data->>fails')}=eq.${lock.fails || 0}&${enc('data->>lockUntil')}=eq.${lock.lockUntil || 0}`, { method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify({ data: { fails: tries + 1, lockUntil: 0 } }) });
  if (counted.length !== 1) return null;
  const settle = (data) => sb(`settings?key=eq.${key}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ data }) });
  return { miss: () => (tries + 1 >= 5 ? settle({ fails: 0, lockUntil: Date.now() + 15 * 60000 }) : Promise.resolve()), hit: () => settle({ fails: 0, lockUntil: 0 }) };
}

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
/* ---- administrators: a personal code given by the owner; the token carries the code's version, so a changed or removed code revokes it ---- */
const ADMIN_ID = /^a[a-z0-9]{4,12}$/;
const adminToken = (id, version) => {
  const payload = 'A' + id + '.' + version + '.' + (Date.now() + 30 * 86400000);
  return payload + '.' + sign(payload);
};
/** The administrator the x-code token belongs to ({ id, name }), or null. */
const adminFrom = async (req) => {
  const [who, version, exp, sig] = String(req.headers['x-code'] || '').split('.');
  if (!who || !version || !exp || !sig || who[0] !== 'A' || !ADMIN_ID.test(who.slice(1)) || Number(exp) < Date.now()) return null;
  const expect = sign(who + '.' + version + '.' + exp);
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  const rec = (await sb(`settings?key=eq.admin:${who.slice(1)}&select=data`))[0]?.data;
  return rec && String(rec.at) === version ? { id: rec.id, name: rec.name, role: rec.role === 'manager' ? 'manager' : 'admin' } : null;
};
const listAdmins = async () => (await sb('settings?key=like.admin:*&select=data&order=key')).map((r) => r.data);

/* ---- trainers: a PIN set by the administrators, a token that opens only that trainer's own data ---- */
const TRAINER_ID = /^t\d{1,3}$/;
// The token carries the version (time) of the PIN it was issued for: changing or removing the PIN revokes every earlier token.
const trainerToken = (id, version) => {
  const payload = 'T' + id + '.' + version + '.' + (Date.now() + 14 * 86400000);
  return payload + '.' + sign(payload);
};
/** The trainer id the token belongs to, or null (bad signature, expired, or the PIN was changed or removed since). */
const trainerFrom = async (req) => {
  const [who, version, exp, sig] = String(req.headers['x-trainer'] || '').split('.');
  if (!who || !version || !exp || !sig || !/^Tt\d{1,3}$/.test(who) || Number(exp) < Date.now()) return null;
  const expect = sign(who + '.' + version + '.' + exp);
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  const rec = (await sb(`settings?key=eq.trainerpin:${who.slice(1)}&select=data`))[0]?.data;
  return rec && String(rec.at) === version ? who.slice(1) : null;
};

const account = (c) => (c ? { membership: c.membership ?? null, name: c.name ?? null, homeClubId: c.homeClubId ?? null, profile: c.profile ?? null } : null);
const publicClient = ({ passHash: _p, passReset: _r, ...c }) => c;

function cleanMembership(m) {
  if (!m || typeof m !== 'object') return null;
  const out = { planId: str(m.planId, 12), startDate: str(m.startDate, 10), endDate: str(m.endDate, 10), freezeDaysLeft: Math.max(0, Math.min(365, Number(m.freezeDaysLeft) || 0)) };
  if (!out.planId || !DAY.test(out.startDate) || !DAY.test(out.endDate)) return null;
  if (m.frozenUntil && DAY.test(String(m.frozenUntil))) out.frozenUntil = String(m.frozenUntil);
  if (m.dayOnly === true) out.dayOnly = true;
  if (m.visitsLeft != null && Number.isFinite(Number(m.visitsLeft))) out.visitsLeft = Math.max(0, Math.min(1000, Math.round(Number(m.visitsLeft))));
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

  if (!OWNER_CODE || !TOKEN_SECRET || !SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ error: 'not configured' });
  const op = String(req.query.op || '');
  const admin = req.headers['x-code'] ? await adminFrom(req) : null;
  const authed = () => isOwner(req) || !!admin;
  // Three roles: the administrator runs the desk; the manager also edits goods, prices and the rest of the content and confirms refunds and withdrawals; the owner sees everything.
  const manages = () => isOwner(req) || admin?.role === 'manager';
  const staffName = (fallback) => (admin ? admin.name : isOwner(req) ? 'owner' : str(fallback, 40));
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

  try {
    if (req.method === 'POST' && op === 'lead') {
      const name = str(body.name, 60);
      const phone = str(body.phone, 20);
      const digits = digitsOf(phone);
      if (name.length < 2 || digits.length < 10 || digits.length > 12) return res.status(400).json({ error: 'bad data' });
      const day = new Date().toISOString().slice(0, 10);
      const lead = { name, phone, clubId: (await validClub(body.clubId)) ? body.clubId : '', lang: ['ru', 'kk', 'en'].includes(body.lang) ? body.lang : 'ru', ts: Date.now() };
      await sb('leads?on_conflict=id', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: `${day}-${digits}`, ts: lead.ts, data: lead }) });
      return res.status(200).json({ ok: true });
    }

    // The list of clubs is public (the site and the app show it); only the owner changes it.
    if (req.method === 'GET' && op === 'clubs') return res.status(200).json({ clubs: await getClubs() });

    // Editable content is public too: prices, plans, trainers, rules, schedule, promotions, photos.
    if (req.method === 'GET' && op === 'content') return res.status(200).json({ content: await getContent() });

    // A fresh single-use proof for the client's own QR (valid 90 seconds). The scanner sends it back with the check-in,
    // so a screenshot, a guessed phone number or a hand-made QR cannot open the door automatically.
    if (req.method === 'GET' && op === 'qr') {
      const id = str(req.query.id, 20);
      if (!ID.test(id) || tokenOwner(req) !== id) return res.status(401).json({ error: 'auth' });
      const exp = Date.now() + 90000;
      return res.status(200).json({ code: id + '.' + exp + '.' + sign('Q' + id + '.' + exp) });
    }

    // A trainer signs in with the PIN the administrators set. Five wrong tries lock that trainer for 15 minutes.
    if (req.method === 'POST' && op === 'trainer-login') {
      const id = str(body.trainerId, 6);
      const pin = String(body.pin ?? '');
      if (!TRAINER_ID.test(id) || !/^\d{6,8}$/.test(pin)) return res.status(400).json({ error: 'bad data' });
      const key = 'trainerpin:' + id;
      const rec = (await sb(`settings?key=eq.${key}&select=data`))[0]?.data;
      if (!rec) return res.status(404).json({ error: 'no pin' });
      if (rec.lockUntil > Date.now()) return res.status(429).json({ error: 'locked' });
      const tries = rec.fails || 0;
      // The try is counted BEFORE the PIN is checked, and only one request can move the counter from this state
      // (the update matches only while it still reads what we read), so parallel guesses cannot dodge the lockout.
      // Every write also requires the PIN version we read (data->>at): if an administrator changed or removed the PIN
      // meanwhile, our stale copy is never written back and no token is issued for the old PIN.
      const sameVersion = `settings?key=eq.${key}&${encodeURIComponent('data->>at')}=eq.${rec.at}`;
      const counted = await sb(`${sameVersion}&${encodeURIComponent('data->>fails')}=eq.${tries}&${encodeURIComponent('data->>lockUntil')}=eq.${rec.lockUntil || 0}`, { method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify({ data: { ...rec, fails: tries + 1 } }) });
      if (counted.length !== 1) return res.status(429).json({ error: 'busy' });
      const settle = (patch) => sb(sameVersion, { method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify({ data: { ...rec, ...patch } }) });
      if (!checkPassword(pin, rec.hash)) {
        if (tries + 1 >= 5) await settle({ fails: 0, lockUntil: Date.now() + 15 * 60000 });
        return res.status(401).json({ error: 'wrong pin' });
      }
      if ((await settle({ fails: 0 })).length !== 1) return res.status(409).json({ error: 'pin changed' });
      return res.status(200).json({ token: trainerToken(id, rec.at), trainerId: id });
    }

    // A trainer's own data: their classes, the sessions the administrators recorded for them and their personal clients.
    if (req.method === 'GET' && op === 'trainer-me') {
      const id = await trainerFrom(req);
      if (!id) return res.status(401).json({ error: 'auth' });
      const since = Date.now() - 60 * 86400000;
      const mine = encodeURIComponent('data->>trainerId') + '=eq.' + id;
      const sessions = await pageAll(`trainer_sessions?select=data&ts=gte.${since}&${mine}&order=ts.desc`);
      const paid = await pageAll(`sales?select=data&ts=gte.${since}&${encodeURIComponent('data->>kind')}=eq.personal&${mine}&order=ts.desc`);
      return res.status(200).json({
        classes: ((await getContent()).classes || []).filter((c) => c.trainerId === id),
        // this trainer's own clients and times, with a phone so they can reach them
        appointments: (await pageAll(`settings?key=like.appt:*&${mine}&select=data`)).map((r) => r.data).filter((a) => a.active),
        sessions: sessions.map((r) => r.data),
        // names and dates only: what a client paid is the owner's business
        clients: paid.map((r) => ({ name: r.data.name, ts: r.data.ts, club: r.data.clubId })),
      });
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
        if (tokenOwner(req) !== id && !authed()) return res.status(401).json({ error: 'auth' });
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
      if (tokenOwner(req) !== id && !authed()) return res.status(401).json({ error: 'auth' });
      const c = await read(id);
      return res.status(200).json(account(c) ?? { membership: null, name: null, homeClubId: null, profile: null });
    }

    // Staff mode: the owner's code opens the CRM; an administrator's personal code opens the desk under their own name.
    if (req.method === 'POST' && op === 'staff-login') {
      const code = String(body.code || '');
      if (!/^\d{4,8}$/.test(code)) return res.status(400).json({ error: 'bad code' });
      // Locked per device address, so a stranger's guesses never lock the owner or the staff out of their own phones.
      const ip = String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      const gate = await codeGate('stafflock:' + (ip ? crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16) : 'any'));
      if (!gate) return res.status(429).json({ error: 'locked' });
      if (code.length === OWNER_CODE.length && crypto.timingSafeEqual(Buffer.from(code), Buffer.from(OWNER_CODE))) {
        await gate.hit();
        return res.status(200).json({ role: 'owner' });
      }
      const who = (await listAdmins()).find((a) => checkPassword(code, a.hash));
      if (!who) {
        await gate.miss();
        return res.status(401).json({ error: 'wrong code' });
      }
      await gate.hit();
      return res.status(200).json({ role: who.role === 'manager' ? 'manager' : 'admin', token: adminToken(who.id, who.at), name: who.name, id: who.id });
    }

    if (!authed()) return res.status(401).json({ error: 'code' });

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
      const loaded = await read(id);
      if (!loaded) return res.status(404).json({ error: 'unknown client' });
      const now = Date.now();
      const day = (ts) => new Date(ts + 5 * 3600000).toISOString().slice(0, 10);
      const firstToday = !(loaded.session && day(loaded.session.inTs) === day(now));

      // Automatic entry carries the proof from the client's own QR: a short-lived, single-use code signed by the server.
      let proofExp = 0;
      if (op === 'checkin' && body.qr) {
        const [qid, qexp, qsig] = String(body.qr).split('.');
        const expect = qid && qexp ? sign('Q' + qid + '.' + qexp) : '';
        const valid = qid === id && Number(qexp) > now && !!qsig && qsig.length === expect.length && crypto.timingSafeEqual(Buffer.from(qsig), Buffer.from(expect)) && Number(qexp) > (loaded.qrUsed || 0);
        if (!valid) return res.status(403).json({ error: 'bad qr' });
        proofExp = Number(qexp);
      }

      // A pass imported without dates starts at the first entry: today for as many days as the plan lasts.
      let prev = loaded;
      if (op === 'checkin' && !loaded.membership && loaded.pending) {
        const p = loaded.pending;
        const { pending: _p, ...rest } = loaded;
        prev = { ...rest, membership: { planId: p.planId, startDate: day(now), endDate: day(now + (p.days || 31) * 86400000), freezeDaysLeft: p.freezeDays || 0, ...(p.visitsLeft !== undefined ? { visitsLeft: p.visitsLeft } : {}), ...(p.dayOnly ? { dayOnly: true } : {}) } };
      }

      // A daytime plan is not let in from 17:00 (Almaty time), whatever the front desk's screen says.
      if (op === 'checkin' && prev.membership?.dayOnly && new Date(now + 5 * 3600000).getUTCHours() >= 17) return res.status(403).json({ error: 'day only' });
      // With no visits left the next day's entry is refused here too (coming back the same day, after the last visit, is still fine).
      if (op === 'checkin' && prev.membership?.visitsLeft !== undefined && prev.membership.visitsLeft <= 0 && firstToday) return res.status(403).json({ error: 'no visits' });
      // Use up the proof atomically: the update matches only while qrUsed still has the value we read, so of two
      // scans racing with the same code exactly one gets through.
      if (proofExp) {
        const seen = loaded.qrUsed === undefined ? 'is.null' : `eq.${loaded.qrUsed}`;
        const claimed = await sb(`clients?id=eq.${id}&${encodeURIComponent('data->>qrUsed')}=${seen}`, { method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify({ data: { ...loaded, qrUsed: proofExp } }) });
        if (claimed.length !== 1) return res.status(403).json({ error: 'qr used' });
      }
      const session = op === 'checkin' ? { clubId: str(body.clubId, 8) || 'c1', inTs: now } : prev.session ? { ...prev.session, outTs: now } : undefined;
      let membership = prev.membership;
      if (op === 'checkin' && firstToday) await logVisit(session.clubId, id, 'qr');
      // A plan with a visit counter loses one visit per calendar day on the first check-in of that day.
      if (op === 'checkin' && membership && membership.visitsLeft > 0 && firstToday) membership = { ...membership, visitsLeft: membership.visitsLeft - 1 };
      await write(id, { ...prev, session, ...(membership ? { membership } : {}), ...(proofExp ? { qrUsed: proofExp } : {}) });
      return res.status(200).json({ ok: true, visitsLeft: membership?.visitsLeft, membership: membership ?? null });
    }

    // Front desk: let in a 1Fit member. Finds the client by phone or creates a card, and records one 1Fit visit per day.
    if (req.method === 'POST' && op === 'onefit') {
      const name = str(body.name, 60);
      let d = digitsOf(body.phone);
      if (d.length === 10) d = '7' + d;
      else if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
      const phoneOk = d.length === 11;
      const clubId = (await validClub(body.clubId)) ? body.clubId : 'c1';
      let id = phoneOk ? 'u_' + d : '';
      let c = id ? await read(id) : null;
      const now = Date.now();
      if (!c) {
        if (name.length < 2) return res.status(400).json({ error: 'name' });
        if (!id) {
          do id = 'x_' + (100000 + Math.floor(Math.random() * 899999));
          while (await read(id));
        }
        c = { id, name, phone: phoneOk ? `+7 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}` : '', homeClubId: clubId, since: dayOf(now), note: '1Fit' };
      }
      const visits = Array.isArray(c.onefit) ? c.onefit : [];
      if (visits.some((v) => v.d === dayOf(now))) return res.status(200).json({ ok: true, duplicate: true, id, name: c.name });
      await logVisit(clubId, id, 'onefit');
      await write(id, { ...c, onefit: [...visits, { d: dayOf(now), c: clubId, ts: now }].slice(-300), session: { clubId, inTs: now } });
      return res.status(200).json({ ok: true, id, name: c.name });
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
      // The free trial no longer exists: no client and no old app version can be given it.
      if (membership.planId === 'trial') return res.status(410).json({ error: 'trial removed' });
      // A plan given at the desk replaces a pass that was waiting for its first entry.
      const { pending: _waiting, ...current } = prev;
      await write(id, { ...current, membership, ...(membership.planId === 'trial' ? { trialUsed: true } : {}) });
      return res.status(200).json({ ok: true });
    }

    /* ---- payments and visits for the reports ---- */
    // The register may only report what it sells; refunds and debt payments exist only through their own ops (refund is owner-only).
    const SALE_KINDS = ['plan', 'shop', 'personal', 'debt'];
    const METHODS = ['kaspi', 'card', 'cash', 'transfer', 'split', 'desk'];
    const int = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));

    // The register reports every payment here; a retry with the same id changes nothing.
    if (req.method === 'POST' && op === 'sale') {
      const id = str(body.id, 24);
      const kind = SALE_KINDS.includes(body.kind) ? body.kind : '';
      if (!/^[A-Za-z0-9]{3,24}$/.test(id) || !kind || !(await validClub(body.clubId))) return res.status(400).json({ error: 'bad data' });
      const now = Date.now();
      const ts = Number(body.ts) > now - 30 * 86400000 && Number(body.ts) < now + 3600000 ? Math.round(Number(body.ts)) : now;
      const sale = { id, ts, kind, title: str(body.title, 120), name: str(body.name, 60), memberId: str(body.memberId, 20), amount: int(body.amount, 10000000), clubId: body.clubId, method: METHODS.includes(body.method) ? body.method : 'cash', staff: str(body.staff, 40) };
      if (/^t\d{1,3}$/.test(String(body.trainerId))) sale.trainerId = body.trainerId;
      if (kind === 'debt') sale.remaining = Math.min(sale.amount, int(body.remaining ?? body.amount, 10000000));
      await sb('sales?on_conflict=id', { method: 'POST', headers: { prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ id, ts, data: sale }) });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET' && op === 'sales') {
      const days = Math.max(1, Math.min(400, Number(req.query.days) || 120));
      const rows = await pageAll(`sales?select=data&ts=gte.${Date.now() - days * 86400000}&order=ts.desc`);
      return res.status(200).json({ sales: rows.map((r) => r.data) });
    }

    if (req.method === 'GET' && op === 'visits') {
      const days = Math.max(1, Math.min(400, Number(req.query.days) || 60));
      return res.status(200).json({ visits: await pageAll(`visits?select=ts,club,member,kind&ts=gte.${Date.now() - days * 86400000}&order=ts.desc`) });
    }

    // Client pays (part of) a debt at the desk. The cash counts as income on the day it arrives.
    if (req.method === 'POST' && op === 'settle') {
      const debtId = str(body.debtId, 24);
      const rows = await sb(`sales?id=eq.${encodeURIComponent(debtId)}&select=data`);
      const debt = rows[0]?.data;
      const amount = int(body.amount, 10000000);
      if (!debt || debt.kind !== 'debt' || amount < 1 || amount > debt.remaining) return res.status(400).json({ error: 'bad data' });
      const now = Date.now();
      const pay = { id: 'P' + now.toString(36) + Math.random().toString(36).slice(2, 5), ts: now, kind: 'debt_payment', title: 'Оплата долга', name: debt.name, memberId: debt.memberId, amount, clubId: debt.clubId, method: METHODS.includes(body.method) ? body.method : 'cash', staff: str(body.staff, 40), refundOf: debtId };
      await sb('sales', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ id: pay.id, ts: now, data: pay }) });
      await sb(`sales?id=eq.${encodeURIComponent(debtId)}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ data: { ...debt, remaining: debt.remaining - amount } }) });
      return res.status(200).json({ ok: true });
    }

    // Only the owner returns money.
    if (req.method === 'POST' && op === 'refund') {
      if (!manages()) return res.status(403).json({ error: 'manager only' });
      const saleId = str(body.saleId, 24);
      const reason = str(body.reason, 80);
      if (reason.length < 3 || /[<>]/.test(reason)) return res.status(400).json({ error: 'reason required' });
      const rows = await sb(`sales?id=eq.${encodeURIComponent(saleId)}&select=data`);
      const sale = rows[0]?.data;
      if (!sale || !['plan', 'shop', 'personal'].includes(sale.kind)) return res.status(400).json({ error: 'bad data' });
      const left = sale.amount - (sale.refunded || 0);
      const amount = body.amount == null ? left : int(body.amount, 10000000);
      if (amount < 1 || amount > left) return res.status(400).json({ error: 'bad amount' });
      const now = Date.now();
      const ref = { id: 'F' + now.toString(36) + Math.random().toString(36).slice(2, 5), ts: now, kind: 'refund', title: 'Возврат: ' + sale.title, name: sale.name, memberId: sale.memberId, amount, clubId: sale.clubId, method: sale.method, staff: staffName(''), reason, refundOf: saleId, ...(sale.trainerId ? { trainerId: sale.trainerId } : {}) };
      await sb('sales', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ id: ref.id, ts: now, data: ref }) });
      await sb(`sales?id=eq.${encodeURIComponent(saleId)}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ data: { ...sale, refunded: (sale.refunded || 0) + amount } }) });
      return res.status(200).json({ ok: true });
    }

    /* ---- trainer PINs: administrators set them, nobody can read them back ---- */
    if (req.method === 'POST' && op === 'trainer-pin') {
      if (!manages()) return res.status(403).json({ error: 'manager only' });
      const id = str(body.trainerId, 6);
      const pin = String(body.pin ?? '');
      if (!TRAINER_ID.test(id) || !/^\d{6,8}$/.test(pin)) return res.status(400).json({ error: 'bad data' });
      await sb('settings?on_conflict=key', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: 'trainerpin:' + id, data: { hash: hashPassword(pin), fails: 0, lockUntil: 0, at: Date.now(), by: isOwner(req) ? 'owner' : 'staff' } }) });
      return res.status(200).json({ ok: true });
    }
    /* ---- personal sessions: which client a trainer trains, when ----
       Kept in private settings rows (never in the public content), seen only by the administrators and by that trainer. */
    if (req.method === 'POST' && op === 'appt-save') {
      if (!manages()) return res.status(403).json({ error: 'manager only' });
      const now = Date.now();
      const id = str(body.id, 24) || 'A' + now.toString(36) + Math.random().toString(36).slice(2, 5);
      const plain = (v) => !/[<>]/.test(v);
      const a = {
        id,
        trainerId: str(body.trainerId, 6),
        clubId: str(body.clubId, 6),
        clientId: str(body.clientId, 20),
        clientName: str(body.clientName, 60),
        clientPhone: str(body.clientPhone, 25),
        kind: body.kind === 'once' ? 'once' : 'weekly',
        weekdays: Array.isArray(body.weekdays) ? [...new Set(body.weekdays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))] : [],
        date: String(body.date || ''),
        time: str(body.time, 5),
        durationMin: Math.max(10, Math.min(240, Math.round(Number(body.durationMin) || 60))),
        note: str(body.note, 200),
        active: body.active !== false,
      };
      const okTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(a.time);
      const okWhen = a.kind === 'weekly' ? a.weekdays.length > 0 : DAY.test(a.date);
      if (!/^[A-Za-z0-9]{3,24}$/.test(id) || !TRAINER_ID.test(a.trainerId) || !(await validClub(a.clubId)) || a.clientName.length < 2 || !plain(a.clientName) || !plain(a.note) || !/^[+\d()\-\s]*$/.test(a.clientPhone) || !okTime || !okWhen) return res.status(400).json({ error: 'bad data' });
      await sb('settings?on_conflict=key', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: 'appt:' + id, data: { ...a, at: now, by: isOwner(req) ? 'owner' : 'staff' } }) });
      return res.status(200).json({ ok: true, id });
    }
    if (req.method === 'GET' && op === 'appts') {
      const rows = await pageAll('settings?key=like.appt:*&select=data');
      return res.status(200).json({ appts: rows.map((r) => r.data) });
    }
    if (req.method === 'POST' && op === 'appt-del') {
      if (!manages()) return res.status(403).json({ error: 'manager only' });
      const id = str(body.id, 24);
      if (!/^[A-Za-z0-9]{3,24}$/.test(id)) return res.status(400).json({ error: 'bad id' });
      await sb(`settings?key=eq.appt:${id}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } });
      return res.status(200).json({ ok: true });
    }

    /* ---- administrators' shifts: "I have arrived" / "I finish my shift" ----
       One private settings row per shift; the key sorts by start time. */
    if (req.method === 'POST' && op === 'shift-start') {
      const staff = staffName(body.staff);
      if (staff.length < 2 || /[<>]/.test(staff) || !(await validClub(body.clubId))) return res.status(400).json({ error: 'bad data' });
      const now = Date.now();
      // A shift the person forgot to close is marked as such, not given an invented end.
      const recent = await pageAll(`settings?select=key,data&key=like.shift:*&${encodeURIComponent('data->>start')}=gte.${now - 3 * 86400000}`);
      for (const r of recent) {
        if (!r.data.end && !r.data.auto && r.data.staff.toLowerCase() === staff.toLowerCase()) {
          await sb(`settings?key=eq.${encodeURIComponent(r.key)}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ data: { ...r.data, auto: true } }) });
        }
      }
      const id = String(now) + Math.random().toString(36).slice(2, 5).padEnd(3, '0');
      await sb('settings', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ key: 'shift:' + id, data: { id, staff, clubId: body.clubId, start: now, end: null } }) });
      return res.status(200).json({ ok: true, id, start: now });
    }
    if (req.method === 'POST' && op === 'shift-end') {
      const id = str(body.id, 20);
      if (!/^\d{13}[a-z0-9]{3}$/.test(id)) return res.status(400).json({ error: 'bad id' });
      const rows = await sb(`settings?key=eq.shift:${id}&select=data`);
      const shift = rows[0]?.data;
      if (!shift) return res.status(404).json({ error: 'unknown shift' });
      const end = shift.end || Date.now();
      if (!shift.end) await sb(`settings?key=eq.shift:${id}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ data: { ...shift, end, auto: false } }) });
      return res.status(200).json({ ok: true, end });
    }
    if (req.method === 'GET' && op === 'shifts') {
      const days = Math.max(1, Math.min(400, Number(req.query.days) || 30));
      const rows = await pageAll(`settings?select=data&key=like.shift:*&${encodeURIComponent('data->>start')}=gte.${Date.now() - days * 86400000}&order=key.desc`);
      return res.status(200).json({ shifts: rows.map((r) => r.data) });
    }

    /* ---- the cash drawer: opened with a count, money taken out, closed with a count ----
       One private settings row per drawer. What should be in it is worked out from the register's cash payments. */
    const cashSummary = async (d) => {
      const rows = await pageAll(`sales?select=data&ts=gte.${d.open}&ts=lte.${d.close || Date.now() + 1000}&${enc('data->>clubId')}=eq.${d.clubId}&${enc('data->>method')}=eq.cash`);
      let cashIn = 0;
      let refunds = 0;
      for (const { data: x } of rows) {
        if (['plan', 'shop', 'personal', 'debt_payment'].includes(x.kind)) cashIn += x.amount;
        else if (x.kind === 'debt') cashIn -= x.amount; // the unpaid part of a check was never handed over
        else if (x.kind === 'refund') refunds += x.amount;
      }
      const taken = d.outs.reduce((n, o) => n + o.amount, 0);
      const added = (d.ins || []).reduce((n, o) => n + o.amount, 0);
      return { cashIn, refunds, taken, added, expected: d.openCash + added + cashIn - refunds - taken };
    };
    const cashRows = async (days) => (await pageAll(`settings?select=data&key=like.cash:*&${enc('data->>open')}=gte.${Date.now() - days * 86400000}&order=key.desc`)).map((r) => r.data);
    const cashPut = (d) => sb(`settings?key=eq.cash:${d.id}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ data: d }) });
    const cashGet = async (id) => (/^\d{13}[a-z0-9]{3}$/.test(id) ? (await sb(`settings?key=eq.cash:${id}&select=data`))[0]?.data : undefined);

    if (req.method === 'GET' && op === 'cash') {
      const clubId = str(req.query.clubId, 6);
      if (!(await validClub(clubId))) return res.status(400).json({ error: 'bad club' });
      const d = (await cashRows(30)).find((x) => x.clubId === clubId && !x.close);
      return res.status(200).json({ drawer: d ? { ...d, ...(await cashSummary(d)) } : null });
    }
    if (req.method === 'POST' && op === 'cash-open') {
      const staff = staffName(body.staff);
      const amount = int(body.amount, 100000000);
      if (staff.length < 2 || /[<>]/.test(staff) || !(await validClub(body.clubId)) || body.amount === '' || body.amount == null) return res.status(400).json({ error: 'bad data' });
      const have = (await cashRows(30)).find((x) => x.clubId === body.clubId && !x.close);
      if (have) return res.status(409).json({ error: 'already open', drawer: { ...have, ...(await cashSummary(have)) } });
      const now = Date.now();
      const id = String(now) + Math.random().toString(36).slice(2, 5).padEnd(3, '0');
      const d = { id, clubId: body.clubId, staff, open: now, openCash: amount, outs: [], close: null };
      await sb('settings', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ key: 'cash:' + id, data: d }) });
      return res.status(200).json({ ok: true, drawer: { ...d, ...(await cashSummary(d)) } });
    }
    // Withdrawal: a reason and the responsible person are required; the owner's code typed by the owner confirms it.
    if (req.method === 'POST' && op === 'cash-out') {
      const d = await cashGet(str(body.id, 20));
      const amount = int(body.amount, 100000000);
      const reason = str(body.reason, 40);
      const note = str(body.note, 80);
      const responsible = str(body.responsible, 40);
      if (!d || d.close || amount < 1 || reason.length < 3 || responsible.length < 2 || [reason, note, responsible].some((v) => /[<>]/.test(v))) return res.status(400).json({ error: 'bad data' });
      if (amount > (await cashSummary(d)).expected) return res.status(400).json({ error: 'more than in the drawer' });
      // Confirmation: a manager or the owner confirms by doing it; an administrator types the owner's or a manager's code (locked like a PIN: 5 misses, 15 minutes).
      const code = String(body.ownerCode || '');
      let confirmedBy = manages() ? staffName('') : '';
      if (!confirmedBy && code) {
        const gate = await codeGate('ownerlock');
        if (!gate) return res.status(429).json({ error: 'locked' });
        const h = (v) => crypto.createHmac('sha256', TOKEN_SECRET).update(v).digest();
        if (crypto.timingSafeEqual(h(code), h(OWNER_CODE))) confirmedBy = 'owner';
        else confirmedBy = (await listAdmins()).find((x) => x.role === 'manager' && checkPassword(code, x.hash))?.name || '';
        if (!confirmedBy) {
          await gate.miss();
          return res.status(403).json({ error: 'wrong code' });
        }
        await gate.hit();
      }
      const confirmed = !!confirmedBy;
      if (d.outs.length >= 200) return res.status(400).json({ error: 'too many' });
      d.outs.push({ ts: Date.now(), amount, reason, note, staff: staffName(body.staff), responsible, confirmed, confirmedBy });
      await cashPut(d);
      return res.status(200).json({ ok: true, drawer: { ...d, ...(await cashSummary(d)) } });
    }
    // Cash put into the drawer: change money at the start, a top-up from the safe. Appended, never removed.
    if (req.method === 'POST' && op === 'cash-in') {
      const d = await cashGet(str(body.id, 20));
      const amount = int(body.amount, 100000000);
      const note = str(body.note, 80);
      if (!d || d.close || amount < 1 || /[<>]/.test(note)) return res.status(400).json({ error: 'bad data' });
      d.ins = d.ins || [];
      if (d.ins.length >= 200) return res.status(400).json({ error: 'too many' });
      d.ins.push({ ts: Date.now(), amount, note, staff: staffName(body.staff) });
      await cashPut(d);
      return res.status(200).json({ ok: true, drawer: { ...d, ...(await cashSummary(d)) } });
    }
    // Every withdrawal of the period, newest first, for the owner's history and report.
    if (req.method === 'GET' && op === 'withdrawals') {
      const days = Math.max(1, Math.min(400, Number(req.query.days) || 30));
      const list = (await cashRows(days)).flatMap((d) => d.outs.map((o) => ({ ...o, clubId: d.clubId, drawer: d.id })));
      return res.status(200).json({ withdrawals: list.sort((x, y) => y.ts - x.ts) });
    }
    if (req.method === 'POST' && op === 'cash-close') {
      const d = await cashGet(str(body.id, 20));
      if (!d || d.close || body.counted === '' || body.counted == null) return res.status(400).json({ error: 'bad data' });
      const counted = int(body.counted, 100000000);
      d.close = Date.now();
      const sum = await cashSummary(d);
      Object.assign(d, { counted, expected: sum.expected, cashIn: sum.cashIn, refunds: sum.refunds, closedBy: staffName(body.staff) });
      await cashPut(d);
      return res.status(200).json({ ok: true, drawer: { ...d, ...sum } });
    }
    if (req.method === 'GET' && op === 'cashes') {
      const days = Math.max(1, Math.min(400, Number(req.query.days) || 30));
      return res.status(200).json({ cashes: await cashRows(days) });
    }

    // Switch a trainer's access off: the PIN is deleted and every token already issued stops working.
    if (req.method === 'POST' && op === 'trainer-pin-clear') {
      if (!manages()) return res.status(403).json({ error: 'manager only' });
      const id = str(body.trainerId, 6);
      if (!TRAINER_ID.test(id)) return res.status(400).json({ error: 'bad data' });
      await sb(`settings?key=eq.trainerpin:${id}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'GET' && op === 'trainer-pins') {
      const rows = await sb('settings?key=like.trainerpin:*&select=key');
      return res.status(200).json({ set: rows.map((r) => r.key.slice(11)) });
    }

    /* ---- administrators: the owner creates them, changes their codes and removes them ---- */
    if (op === 'admins' || op === 'admin-save' || op === 'admin-del') {
      if (!isOwner(req)) return res.status(403).json({ error: 'owner only' });
      if (req.method === 'GET' && op === 'admins') return res.status(200).json({ admins: (await listAdmins()).map(({ hash: _h, ...a }) => a) });
      if (req.method === 'POST' && op === 'admin-save') {
        const name = str(body.name, 40);
        const code = String(body.code ?? '');
        const id = str(body.id, 13);
        if (name.length < 2 || /[<>]/.test(name) || (id && !ADMIN_ID.test(id)) || (code && !/^\d{6,8}$/.test(code)) || (!id && !code)) return res.status(400).json({ error: 'bad data' });
        if (code && code.length === OWNER_CODE.length && code === OWNER_CODE) return res.status(400).json({ error: 'bad data' });
        const all = await listAdmins();
        if (code && all.some((a) => a.id !== id && checkPassword(code, a.hash))) return res.status(409).json({ error: 'code taken' });
        if (!id && all.length >= 30) return res.status(400).json({ error: 'too many' });
        const old = id ? all.find((a) => a.id === id) : null;
        if (id && !old) return res.status(404).json({ error: 'unknown' });
        const now = Date.now();
        const role = body.role === 'manager' ? 'manager' : body.role === 'admin' || !old ? 'admin' : old.role;
        const rec = { id: id || 'a' + now.toString(36) + Math.random().toString(36).slice(2, 5), name, role, hash: code ? hashPassword(code) : old.hash, at: code ? now : old.at, since: old ? old.since : now };
        await sb('settings?on_conflict=key', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: 'admin:' + rec.id, data: rec }) });
        return res.status(200).json({ ok: true, id: rec.id });
      }
      if (req.method === 'POST' && op === 'admin-del') {
        const id = str(body.id, 13);
        if (!ADMIN_ID.test(id)) return res.status(400).json({ error: 'bad id' });
        await sb(`settings?key=eq.admin:${id}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } });
        return res.status(200).json({ ok: true });
      }
    }

    /* ---- editable content: administrators ---- */
    if (req.method === 'POST' && op === 'content-save') {
      if (!manages()) return res.status(403).json({ error: 'manager only' });
      const section = String(body.section);
      if (!CONTENT_SECTIONS.includes(section)) return res.status(400).json({ error: 'bad section' });
      let data;
      try {
        data = cleanDeep(body.data);
        checkSection(section, data);
      } catch (e) {
        return res.status(400).json({ error: 'bad content: ' + e.message });
      }
      if (JSON.stringify(data).length > 300000) return res.status(400).json({ error: 'too big' });
      await sb('settings?on_conflict=key', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: 'content:' + section, data: { v: data, at: Date.now(), by: isOwner(req) ? 'owner' : 'staff ' + str(body.by, 30) } }) });
      contentCache = { at: 0, data: {} };
      return res.status(200).json({ ok: true });
    }

    // A photo from an administrator's phone, stored in the public media bucket; the answer is its address.
    if (req.method === 'POST' && op === 'upload') {
      if (!manages()) return res.status(403).json({ error: 'manager only' });
      const kind = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[String(body.ext).toLowerCase()];
      const bytes = kind && typeof body.data === 'string' ? Buffer.from(body.data, 'base64') : null;
      if (!bytes || bytes.length < 200 || bytes.length > 2500000) return res.status(400).json({ error: 'bad image' });
      const path = `p/${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}.${String(body.ext).toLowerCase()}`;
      const up = await fetch(`${SUPABASE_URL}/storage/v1/object/media/${path}`, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'content-type': kind, 'cache-control': '31536000' }, body: bytes });
      if (!up.ok) return res.status(502).json({ error: 'storage' });
      return res.status(200).json({ ok: true, url: `${SUPABASE_URL}/storage/v1/object/public/media/${path}` });
    }

    /* ---- the network's clubs: owner only ---- */
    if (req.method === 'POST' && op === 'clubs-save') {
      if (!isOwner(req)) return res.status(403).json({ error: 'owner only' });
      const input = Array.isArray(body.clubs) ? body.clubs.slice(0, 30) : [];
      const list = input.map((c) => ({ id: str(c?.id, 6), name: str(c?.name, 60), city: str(c?.city, 40), address: str(c?.address, 120), hours: str(c?.hours, 40), phone: str(c?.phone, 25), active: c?.active !== false }));
      // This text goes into public pages: no markup or quote characters, and the phone is only digits and phone punctuation.
      const plain = (v) => !/[<>"'`]/.test(v);
      if (!list.length || list.some((c) => !/^c\d{1,3}$/.test(c.id) || c.name.length < 2 || !plain(c.name) || !plain(c.city) || !plain(c.address) || !plain(c.hours) || !/^[+\d()\-\s]*$/.test(c.phone)) || new Set(list.map((c) => c.id)).size !== list.length) return res.status(400).json({ error: 'bad data' });
      // A club is never deleted, only switched off, so old payments keep their branch.
      const old = await getClubs();
      const required = old.length ? old.map((o) => o.id) : ['c1', 'c2'];
      if (required.some((id) => !list.some((c) => c.id === id))) return res.status(400).json({ error: 'cannot remove a club' });
      await sb('settings?on_conflict=key', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: 'clubs', data: { clubs: list } }) });
      clubCache = { at: Date.now(), list };
      return res.status(200).json({ ok: true });
    }

    /* ---- trainer load, entered by the administrators ---- */
    if (req.method === 'POST' && op === 'load') {
      if (!manages()) return res.status(403).json({ error: 'manager only' });
      const trainerId = /^t\d{1,3}$/.test(String(body.trainerId)) ? String(body.trainerId) : '';
      const date = DAY.test(String(body.date)) ? String(body.date) : '';
      const sessions = Math.round(Number(body.sessions));
      const now = Date.now();
      const ts = date ? Date.parse(date + 'T12:00:00+05:00') : NaN;
      if (!trainerId || !(await validClub(body.clubId)) || !(sessions >= 1 && sessions <= 30) || !(ts > now - 120 * 86400000 && ts < now + 86400000)) return res.status(400).json({ error: 'bad data' });
      const id = 'L' + now.toString(36) + Math.random().toString(36).slice(2, 5);
      await sb('trainer_sessions', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ id, ts, data: { id, trainerId, clubId: body.clubId, date, sessions, note: str(body.note, 120), staff: str(body.staff, 40), at: now } }) });
      return res.status(200).json({ ok: true, id });
    }

    if (req.method === 'GET' && op === 'loads') {
      const days = Math.max(1, Math.min(400, Number(req.query.days) || 60));
      const rows = await pageAll(`trainer_sessions?select=data&ts=gte.${Date.now() - days * 86400000}&order=ts.desc`);
      return res.status(200).json({ loads: rows.map((r) => r.data) });
    }

    if (req.method === 'POST' && op === 'load-del') {
      if (!manages()) return res.status(403).json({ error: 'manager only' });
      const id = str(body.id, 24);
      if (!/^L[a-z0-9]{3,23}$/.test(id)) return res.status(400).json({ error: 'bad id' });
      // Staff may only undo a fresh entry (a typo); older entries are the owner's records and only the owner removes them.
      const rows = await sb(`trainer_sessions?id=eq.${id}&select=data`);
      const entry = rows[0]?.data;
      if (!entry) return res.status(404).json({ error: 'unknown entry' });
      if (!isOwner(req) && !(entry.at && Date.now() - entry.at < 86400000)) return res.status(403).json({ error: 'too old' });
      await sb(`trainer_sessions?id=eq.${id}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } });
      return res.status(200).json({ ok: true });
    }

    return res.status(404).json({ error: 'unknown op' });
  } catch (e) {
    return res.status(500).json({ error: 'server' });
  }
};
