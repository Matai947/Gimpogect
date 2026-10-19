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
/* ---- trainers: a PIN set by the administrators, a token that opens only that trainer's own data ---- */
const TRAINER_ID = /^t\d{1,3}$/;
const trainerToken = (id) => {
  const payload = 'T' + id + '.' + (Date.now() + 30 * 86400000);
  return payload + '.' + sign(payload);
};
/** The trainer id the token belongs to, or null. */
const trainerFrom = (req) => {
  const [who, exp, sig] = String(req.headers['x-trainer'] || '').split('.');
  if (!who || !exp || !sig || !/^Tt\d{1,3}$/.test(who) || Number(exp) < Date.now()) return null;
  const expect = sign(who + '.' + exp);
  return sig.length === expect.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect)) ? who.slice(1) : null;
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
      const lead = { name, phone, clubId: (await validClub(body.clubId)) ? body.clubId : '', lang: ['ru', 'kk', 'en'].includes(body.lang) ? body.lang : 'ru', ts: Date.now() };
      await sb('leads?on_conflict=id', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: `${day}-${digits}`, ts: lead.ts, data: lead }) });
      return res.status(200).json({ ok: true });
    }

    // The list of clubs is public (the site and the app show it); only the owner changes it.
    if (req.method === 'GET' && op === 'clubs') return res.status(200).json({ clubs: await getClubs() });

    // Editable content is public too: prices, plans, trainers, rules, schedule, promotions, photos.
    if (req.method === 'GET' && op === 'content') return res.status(200).json({ content: await getContent() });

    // A trainer signs in with the PIN the administrators set. Five wrong tries lock that trainer for 15 minutes.
    if (req.method === 'POST' && op === 'trainer-login') {
      const id = str(body.trainerId, 6);
      const pin = String(body.pin ?? '');
      if (!TRAINER_ID.test(id) || !/^\d{4,8}$/.test(pin)) return res.status(400).json({ error: 'bad data' });
      const key = 'trainerpin:' + id;
      const rec = (await sb(`settings?key=eq.${key}&select=data`))[0]?.data;
      if (!rec) return res.status(404).json({ error: 'no pin' });
      if (rec.lockUntil > Date.now()) return res.status(429).json({ error: 'locked' });
      const save = (data) => sb('settings?on_conflict=key', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key, data: { ...rec, ...data } }) });
      if (!checkPassword(pin, rec.hash)) {
        const fails = (rec.fails || 0) + 1;
        await save(fails >= 5 ? { fails: 0, lockUntil: Date.now() + 15 * 60000 } : { fails });
        return res.status(401).json({ error: 'wrong pin' });
      }
      if (rec.fails) await save({ fails: 0 });
      return res.status(200).json({ token: trainerToken(id), trainerId: id });
    }

    // A trainer's own data: their classes, the sessions the administrators recorded for them and their personal clients.
    if (req.method === 'GET' && op === 'trainer-me') {
      const id = trainerFrom(req);
      if (!id) return res.status(401).json({ error: 'auth' });
      const since = Date.now() - 60 * 86400000;
      const mine = encodeURIComponent('data->>trainerId') + '=eq.' + id;
      const sessions = await pageAll(`trainer_sessions?select=data&ts=gte.${since}&${mine}&order=ts.desc`);
      const paid = await pageAll(`sales?select=data&ts=gte.${since}&${encodeURIComponent('data->>kind')}=eq.personal&${mine}&order=ts.desc`);
      return res.status(200).json({
        classes: ((await getContent()).classes || []).filter((c) => c.trainerId === id),
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
      // The 3 free days are given once; the flag also tells the front desk the offer is used.
      if (membership.planId === 'trial' && prev.trialUsed) return res.status(409).json({ error: 'trial used' });
      await write(id, { ...prev, membership, ...(membership.planId === 'trial' ? { trialUsed: true } : {}) });
      return res.status(200).json({ ok: true });
    }

    /* ---- payments and visits for the reports ---- */
    // The register may only report what it sells; refunds and debt payments exist only through their own ops (refund is owner-only).
    const SALE_KINDS = ['plan', 'shop', 'personal', 'debt'];
    const METHODS = ['kaspi', 'card', 'cash', 'split', 'desk'];
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

    /* ---- trainer PINs: administrators set them, nobody can read them back ---- */
    if (req.method === 'POST' && op === 'trainer-pin') {
      const id = str(body.trainerId, 6);
      const pin = String(body.pin ?? '');
      if (!TRAINER_ID.test(id) || !/^\d{4,8}$/.test(pin)) return res.status(400).json({ error: 'bad data' });
      await sb('settings?on_conflict=key', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: 'trainerpin:' + id, data: { hash: hashPassword(pin), fails: 0, lockUntil: 0, at: Date.now(), by: isOwner(req) ? 'owner' : 'staff' } }) });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'GET' && op === 'trainer-pins') {
      const rows = await sb('settings?key=like.trainerpin:*&select=key');
      return res.status(200).json({ set: rows.map((r) => r.key.slice(11)) });
    }

    /* ---- editable content: administrators ---- */
    if (req.method === 'POST' && op === 'content-save') {
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
