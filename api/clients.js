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
      // A plan with a visit counter loses one visit per calendar day (Almaty time) on the first check-in of that day.
      const day = (ts) => new Date(ts + 5 * 3600000).toISOString().slice(0, 10);
      let membership = prev.membership;
      if (op === 'checkin' && !(prev.session && day(prev.session.inTs) === day(Date.now()))) await logVisit(session.clubId, id, 'qr');
      if (op === 'checkin' && membership && membership.visitsLeft > 0 && !(prev.session && day(prev.session.inTs) === day(Date.now()))) membership = { ...membership, visitsLeft: membership.visitsLeft - 1 };
      await write(id, { ...prev, session, ...(membership ? { membership } : {}) });
      return res.status(200).json({ ok: true, visitsLeft: membership?.visitsLeft });
    }

    // Front desk: let in a 1Fit member. Finds the client by phone or creates a card, and records one 1Fit visit per day.
    if (req.method === 'POST' && op === 'onefit') {
      const name = str(body.name, 60);
      let d = digitsOf(body.phone);
      if (d.length === 10) d = '7' + d;
      else if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
      const phoneOk = d.length === 11;
      const clubId = ['c1', 'c2'].includes(body.clubId) ? body.clubId : 'c1';
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
      await write(id, { ...prev, membership });
      return res.status(200).json({ ok: true });
    }

    /* ---- payments and visits for the reports ---- */
    const SALE_KINDS = ['plan', 'shop', 'personal', 'debt', 'debt_payment', 'refund'];
    const METHODS = ['kaspi', 'card', 'cash', 'split', 'desk'];
    const int = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));

    // The register reports every payment here; a retry with the same id changes nothing.
    if (req.method === 'POST' && op === 'sale') {
      const id = str(body.id, 24);
      const kind = SALE_KINDS.includes(body.kind) ? body.kind : '';
      if (!/^[A-Za-z0-9]{3,24}$/.test(id) || !kind || !['c1', 'c2'].includes(body.clubId)) return res.status(400).json({ error: 'bad data' });
      const now = Date.now();
      const ts = Number(body.ts) > now - 30 * 86400000 && Number(body.ts) < now + 3600000 ? Math.round(Number(body.ts)) : now;
      const sale = { id, ts, kind, title: str(body.title, 120), name: str(body.name, 60), memberId: str(body.memberId, 20), amount: int(body.amount, 10000000), clubId: body.clubId, method: METHODS.includes(body.method) ? body.method : 'cash', staff: str(body.staff, 40) };
      if (/^t\d{1,3}$/.test(String(body.trainerId))) sale.trainerId = body.trainerId;
      if (kind === 'debt') sale.remaining = Math.min(sale.amount, int(body.remaining ?? body.amount, 10000000));
      if (body.refundOf) sale.refundOf = str(body.refundOf, 24);
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
      if (!isOwner(req)) return res.status(403).json({ error: 'owner only' });
      const saleId = str(body.saleId, 24);
      const rows = await sb(`sales?id=eq.${encodeURIComponent(saleId)}&select=data`);
      const sale = rows[0]?.data;
      if (!sale || !['plan', 'shop', 'personal'].includes(sale.kind)) return res.status(400).json({ error: 'bad data' });
      const left = sale.amount - (sale.refunded || 0);
      const amount = body.amount == null ? left : int(body.amount, 10000000);
      if (amount < 1 || amount > left) return res.status(400).json({ error: 'bad amount' });
      const now = Date.now();
      const ref = { id: 'F' + now.toString(36) + Math.random().toString(36).slice(2, 5), ts: now, kind: 'refund', title: 'Возврат: ' + sale.title, name: sale.name, memberId: sale.memberId, amount, clubId: sale.clubId, method: sale.method, staff: 'owner', refundOf: saleId, ...(sale.trainerId ? { trainerId: sale.trainerId } : {}) };
      await sb('sales', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ id: ref.id, ts: now, data: ref }) });
      await sb(`sales?id=eq.${encodeURIComponent(saleId)}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ data: { ...sale, refunded: (sale.refunded || 0) + amount } }) });
      return res.status(200).json({ ok: true });
    }

    return res.status(404).json({ error: 'unknown op' });
  } catch (e) {
    return res.status(500).json({ error: 'server' });
  }
};
