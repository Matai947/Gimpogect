// Shared client registry for the whole network, stored in Supabase (Postgres) through its REST API.
// Tables clients / leads are private (RLS on, no policies); only this server holds the secret key.
const crypto = require('crypto');

// No defaults: the codes live only in the server's environment, and the API refuses to work without them.
const OWNER_CODE = process.env.OWNER_CODE;
const TOKEN_SECRET = process.env.TOKEN_SECRET; // signs client access tokens
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
// On our own server the database is Postgres behind PostgREST on localhost (DB_REST_URL); on Supabase it is SUPABASE_URL/rest/v1.
const REST = process.env.DB_REST_URL || (SUPABASE_URL ? `${SUPABASE_URL}/rest/v1` : '');
// On our own server uploaded photos are files in MEDIA_DIR, served at PUBLIC_URL/media/…
const MEDIA_DIR = process.env.MEDIA_DIR;
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const TOKEN_DAYS = 180;

// u_<phone digits> for people with a phone; x_<n> for cards imported without one (no app account).
const ID = /^(u_\d{10,12}|x_\d{1,6})$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayOf = (ts) => new Date(ts + 5 * 3600000).toISOString().slice(0, 10); // Almaty calendar day

const sb = async (path, init = {}) => {
  const r = await fetch(`${REST}/${path}`, { ...init, headers: { ...(SUPABASE_KEY ? { apikey: SUPABASE_KEY } : {}), ...(process.env.DB_REST_TOKEN ? { authorization: `Bearer ${process.env.DB_REST_TOKEN}` } : {}), 'content-type': 'application/json', ...init.headers } });
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
const CONTENT_SECTIONS = ['catalog', 'plans', 'trainers', 'rules', 'classes', 'promos', 'photos', 'onefit', 'stock'];
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
    num(p.freezeCount, 0, 10);
  };
  // Pictures that appear on public pages must be real https addresses, nothing else (no javascript: or data:).
  const https = (v) => {
    if (v == null || v === '') return;
    if (typeof v !== 'string' || !SAFE_URL.test(v)) throw new Error('url');
  };
  // Every section is an object (or a list for promotions); a bare number or string would break the app that reads it.
  if (!d || typeof d !== 'object') throw new Error('shape');
  // Stock: club id -> product id -> units on that club's shelf. Only the products listed are counted.
  if (section === 'stock') Object.entries(d).forEach(([club, shelf]) => {
    if (!/^c\d{1,3}$/.test(club) || !shelf || typeof shelf !== 'object') throw new Error('stock');
    Object.entries(shelf).forEach(([k, v]) => {
      if (!/^[A-Za-z0-9_-]{1,24}$/.test(k) || !Number.isInteger(v) || v < 0 || v > 100000) throw new Error('stock');
    });
  });
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
  if (section === 'onefit') Object.entries(d).forEach(([k, v]) => {
    if (!/^c\d{1,3}$/.test(k) || typeof v !== 'string' || v.length > 300 || /[<>"'`\s]/.test(v)) throw new Error('onefit');
  });
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
let occCache = { at: 0, inside: {} };
// The first counts were kept for one shelf (product -> units); they belong to the first club.
const normStock = (v) => (!v || typeof v !== 'object' ? {} : Object.values(v).some((x) => typeof x === 'number') ? { c1: v } : v);
/** Changes the stock row with `change(all)` (club -> product -> units), which answers the result or null to leave it.
    The write is conditional on the row's version (data->>at) and retried, so two registers at once never lose each other's units. */
async function editStock(change, by) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const row = (await sb('settings?key=eq.content:stock&select=data'))[0];
    if (!row) {
      await sb('settings?on_conflict=key', { method: 'POST', headers: { prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ key: 'content:stock', data: { v: {}, at: Date.now(), by } }) });
      continue;
    }
    const all = JSON.parse(JSON.stringify(normStock(row.data && row.data.v)));
    const out = change(all);
    if (!out) return null;
    const done = await sb(`settings?key=eq.content:stock&${enc('data->>at')}=eq.${row.data.at ?? ''}`, { method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify({ data: { v: all, at: Date.now(), by } }) });
    if (Array.isArray(done) && done.length === 1) {
      contentCache = { at: 0, data: {} };
      return out;
    }
  }
  return null;
}
/** Moves counted products on or off a club's shelf; products that club does not count are left alone.
    Answers what really left the shelf per item (never more than was there), so a refund puts back exactly that. */
async function adjustStock(items, sign, clubId) {
  return (
    (await editStock((all) => {
      const stock = (all[clubId] = all[clubId] || {});
      const moved = [];
      for (const { id, qty, taken } of items) {
        if (!(id in stock)) continue;
        const have = Number(stock[id]) || 0;
        const n = sign < 0 ? Math.min(qty, have) : Math.min(taken ?? qty, 100000 - have);
        stock[id] = have + sign * n;
        moved.push({ id, qty, taken: n });
      }
      return moved.length ? moved : null;
    }, 'register')) || []
  );
}

async function getContent() {
  if (Date.now() - contentCache.at < 15000) return contentCache.data;
  const data = {};
  try {
    (await sb('settings?key=like.content:*&select=key,data')).forEach((r) => (data[r.key.slice(8)] = r.data.v));
    if (data.stock) data.stock = normStock(data.stock);
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

// an entry or an exit shows in the occupancy at once: the count is worked out again on the next ask
const logVisit = (club, member, kind) => sb('visits', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ ts: Date.now(), club, member, kind }) }).then(() => (occCache.at = 0)).catch(() => {}); // best effort: a missing log must never block an entry

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

/** Counts one attempt at a guessable code atomically (`limit` misses lock it for 15 minutes); null = locked or busy. */
async function codeGate(key, limit = 3) {
  await sb('settings?on_conflict=key', { method: 'POST', headers: { prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ key, data: { fails: 0, lockUntil: 0 } }) });
  const lock = (await sb(`settings?key=eq.${key}&select=data`))[0].data;
  if (lock.lockUntil > Date.now()) return null;
  const tries = lock.lockUntil ? 0 : lock.fails || 0; // an expired lock starts the count over
  const counted = await sb(`settings?key=eq.${key}&${enc('data->>fails')}=eq.${lock.fails || 0}&${enc('data->>lockUntil')}=eq.${lock.lockUntil || 0}`, { method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify({ data: { fails: tries + 1, lockUntil: 0 } }) });
  if (counted.length !== 1) return null;
  const settle = (data) => sb(`settings?key=eq.${key}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ data }) });
  return { miss: () => (tries + 1 >= limit ? settle({ fails: 0, lockUntil: Date.now() + 15 * 60000 }) : Promise.resolve()), hit: () => settle({ fails: 0, lockUntil: 0 }) };
}
/** Every gate a guess must pass: misses from one address, on one account, and a ceiling across everyone, so rotating devices does not help.
 * The whole gym sits behind one Wi-Fi address: 3 misses there locked every client in the club for 15 minutes, so a client address allows 10. */
async function guessGates(req, kind, account) {
  // Only Cloudflare's own header counts: it is set by the edge and cannot be sent by the client. Without it (local runs) the device gate is shared.
  // On Vercel the platform sets x-real-ip the same way; on either host the client cannot forge the header the host itself writes.
  // the address the proxy in front wrote itself: Vercel's or our nginx (X-Real-IP, overwritten there), else Cloudflare's
  const ip = String((process.env.VERCEL || process.env.BEHIND_NGINX ? req.headers['x-real-ip'] : req.headers['cf-connecting-ip']) || '').trim();
  const client = kind === 'client';
  const keys = [[kind + ':ip:' + (ip ? crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16) : 'any'), client ? 10 : 3], [kind + ':all', client ? 100 : 30]];
  if (account) keys.push([kind + ':' + account, client ? 5 : 3]);
  const gates = [];
  for (const [key, limit] of keys) {
    const g = await codeGate(key, limit);
    if (!g) return null;
    gates.push(g);
  }
  return { miss: () => Promise.all(gates.map((g) => g.miss())), hit: () => Promise.all(gates.map((g) => g.hit())) };
}

const BONUS_CATEGORIES = ['Протеин', 'Креатин и амино', 'Бады', 'Витамины'];
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
  return rec && String(rec.at) === version ? { id: rec.id, name: rec.name, role: rec.role === 'manager' ? 'manager' : rec.role === 'accountant' ? 'accountant' : 'admin' } : null;
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

// Freeze rule of the built-in plans (days in one freeze, freezes per pass); edited and custom plans come from the content.
const BUILTIN_FREEZE = { i1: [5, 1], i2: [5, 1], i3: [5, 1], i4: [5, 1], i5: [5, 1], i6: [7, 1], i7: [10, 1], i8: [7, 2] };
async function freezeRules() {
  const p = (await getContent()).plans || {};
  return (id) => {
    const o = (p.overrides && p.overrides[id]) || {};
    const c = (p.custom || []).find((x) => x.id === id) || {};
    const b = BUILTIN_FREEZE[id] || [];
    // clamped like a stored pass: at most 365 days in all and 10 freezes
    const days = Math.max(0, Math.min(365, Math.round(Number(o.freezeDays ?? c.freezeDays ?? b[0] ?? 0) || 0)));
    const count = Math.max(1, Math.min(10, Math.round(Number(o.freezeCount ?? c.freezeCount ?? b[1] ?? 1) || 1)));
    return days > 0 ? [days, Math.max(1, Math.min(count, Math.floor(365 / days)))] : null;
  };
}
/** A pass that never froze and carries no freeze days (set by hand, brought from the old base) gets its plan's rule. Nothing is written here. */
function withFreeze(m, rule) {
  if (!m || m.freezesLeft !== undefined || m.freezeDaysLeft || m.frozenUntil) return m;
  const r = rule(m.planId);
  return r ? { ...m, freezeDaysLeft: r[0] * r[1], freezesLeft: r[1], freezeMax: r[0] } : m;
}

// The plans' lengths and counts, so the server can prolong a pass itself (edited and custom plans come from the content).
const BUILTIN_PLANS = {
  guest: { days: 1, staffOnly: true }, i9: { days: 1, visits: 1 }, i10: { days: 1, visits: 1 },
  i3: { days: 31, visits: 12, freezeDays: 5, dayOnly: true }, i4: { days: 31, freezeDays: 5, dayOnly: true },
  i1: { days: 31, visits: 12, freezeDays: 5 }, i2: { days: 31, freezeDays: 5 }, i5: { days: 31, freezeDays: 5 },
  i6: { days: 90, freezeDays: 7 }, i7: { days: 180, freezeDays: 10 }, i8: { days: 365, freezeDays: 7, freezeCount: 2 },
};
async function planRule(id) {
  if (!/^[A-Za-z0-9_-]{1,24}$/.test(id)) return null;
  const own = (o, k) => (o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : null);
  const p = (await getContent()).plans || {};
  const c = (p.custom || []).find((x) => x && x.id === id);
  const base = c || own(BUILTIN_PLANS, id);
  if (!base || (p.hidden || []).includes(id)) return null;
  const r = { ...base, ...(own(p.overrides, id) || {}) };
  const days = Math.max(1, Math.min(400, Math.round(Number(r.days) || (Number(r.months) || 1) * 30)));
  return { days, months: Number(r.days) ? 0 : Math.max(0, Math.round(Number(r.months) || 0)), visits: Number(r.visits) > 0 ? Math.min(1000, Math.round(Number(r.visits))) : 0, freezeDays: r.trial ? 0 : Math.max(0, Math.min(365, Math.round(Number(r.freezeDays) || 0))), freezeCount: Math.max(1, Math.min(10, Math.round(Number(r.freezeCount) || 1))), dayOnly: !!r.dayOnly, staffOnly: !!r.staffOnly };
}
/** A running pass prolonged by a plan, the way the desk's app does it; null for a plan the server does not know. */
async function prolong(cur, planId) {
  const r = await planRule(String(planId || ''));
  if (!r) return null;
  if (r.staffOnly) {
    const { frozenUntil: _f, ...rest } = cur; // a guest pass on a running plan only lifts the freeze
    return rest;
  }
  const plus = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  const count = r.freezeDays ? r.freezeCount : 0;
  return {
    planId: String(planId),
    startDate: cur.startDate,
    endDate: plus(cur.endDate, r.days),
    freezeDaysLeft: Math.min(365, (cur.freezeDaysLeft || 0) + r.freezeDays * count),
    freezesLeft: Math.min(10, (cur.freezesLeft || 0) + count),
    freezeMax: r.freezeDays || cur.freezeMax || 0,
    ...(r.visits ? { visitsLeft: Math.min(1000, (cur.visitsLeft || 0) + r.visits) } : {}),
    ...(r.dayOnly ? { dayOnly: true } : {}),
    ...(cur.frozenUntil ? { frozenUntil: cur.frozenUntil } : {}),
  };
}

/** A plan check cancelled: the pass loses what that plan gave (length, visits, freezes); a pass that was only this plan is gone. */
async function unprolong(cur, planId) {
  const r = await planRule(String(planId || ''));
  if (!r || r.staffOnly || !cur || !cur.endDate || cur.planId !== planId) return cur;
  const d = new Date(cur.endDate + 'T00:00:00Z');
  if (r.months) d.setUTCMonth(d.getUTCMonth() - r.months);
  else d.setUTCDate(d.getUTCDate() - r.days);
  const endDate = d.toISOString().slice(0, 10);
  if (endDate <= cur.startDate) return null;
  const count = r.freezeDays ? r.freezeCount : 0;
  return {
    ...cur,
    endDate,
    freezeDaysLeft: Math.max(0, (cur.freezeDaysLeft || 0) - r.freezeDays * count),
    freezesLeft: Math.max(0, (cur.freezesLeft || 0) - count),
    ...(r.visits && cur.visitsLeft != null ? { visitsLeft: Math.max(0, cur.visitsLeft - r.visits) } : {}),
  };
}

function cleanMembership(m) {
  if (!m || typeof m !== 'object') return null;
  const out = { planId: str(m.planId, 12), startDate: str(m.startDate, 10), endDate: str(m.endDate, 10), freezeDaysLeft: Math.max(0, Math.min(365, Number(m.freezeDaysLeft) || 0)) };
  if (!out.planId || !DAY.test(out.startDate) || !DAY.test(out.endDate)) return null;
  if (m.frozenUntil && DAY.test(String(m.frozenUntil))) out.frozenUntil = String(m.frozenUntil);
  if (m.dayOnly === true) out.dayOnly = true;
  if (m.freezesLeft != null && Number.isFinite(Number(m.freezesLeft))) out.freezesLeft = Math.max(0, Math.min(10, Math.round(Number(m.freezesLeft))));
  if (m.freezeMax != null && Number.isFinite(Number(m.freezeMax))) out.freezeMax = Math.max(0, Math.min(365, Math.round(Number(m.freezeMax))));
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

  if (!OWNER_CODE || !TOKEN_SECRET || !REST || (!process.env.DB_REST_URL && !SUPABASE_KEY)) return res.status(503).json({ error: 'not configured' });
  const op = String(req.query.op || '');
  const admin = req.headers['x-code'] ? await adminFrom(req) : null;
  // The accountant only reads the money (and keeps the expenses): never the desk, the clients' passes or the settings.
  const isAcc = admin?.role === 'accountant';
  const authed = () => isOwner(req) || (!!admin && !isAcc);
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
    /* ---- push messages (Web Push): a phone subscribes once; the manager's news reaches it with the app closed ---- */
    const VAPID_PUBLIC = process.env.VAPID_PUBLIC;
    const pushKey = (endpoint) => 'push:' + crypto.createHash('sha256').update(String(endpoint)).digest('hex').slice(0, 32);
    if (req.method === 'GET' && op === 'push-key') {
      return VAPID_PUBLIC ? res.status(200).json({ key: VAPID_PUBLIC }) : res.status(503).json({ error: 'push off' });
    }
    if (req.method === 'POST' && op === 'push-sub') {
      const sub = body.sub || {};
      // the Android app: an Expo push token, sent on through Expo's push service
      if (typeof sub.expo === 'string') {
        if (!/^Expo(nent)?PushToken\[[\w-]{10,100}\]$/.test(sub.expo)) return res.status(400).json({ error: 'bad token' });
        const memberId = str(body.memberId, 20);
        const member = memberId && ID.test(memberId) && tokenOwner(req) === memberId ? memberId : '';
        const clubId = (await validClub(body.clubId)) ? body.clubId : '';
        await sb('settings?on_conflict=key', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: pushKey(sub.expo), data: { expo: sub.expo, member, clubId, at: Date.now() } }) });
        return res.status(200).json({ ok: true });
      }
      const endpoint = String(sub.endpoint || '');
      const keys = sub.keys || {};
      // only the browsers' own push services: the server never posts to an address a visitor made up
      let host = '';
      try {
        host = new URL(endpoint).hostname;
      } catch {
        host = '';
      }
      const PUSH_HOSTS = /(^|\.)(fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/;
      if (!endpoint.startsWith('https://') || !PUSH_HOSTS.test(host) || endpoint.length > 600 || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string' || keys.p256dh.length > 200 || keys.auth.length > 100) return res.status(400).json({ error: 'bad sub' });
      const memberId = str(body.memberId, 20);
      // a client's phone is tied to the client only with the client's own token
      const member = memberId && ID.test(memberId) && tokenOwner(req) === memberId ? memberId : '';
      const clubId = (await validClub(body.clubId)) ? body.clubId : '';
      await sb('settings?on_conflict=key', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: pushKey(endpoint), data: { sub: { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }, member, clubId, at: Date.now() } }) });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'POST' && op === 'push-unsub') {
      await sb(`settings?key=eq.${pushKey(body.endpoint)}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } });
      return res.status(200).json({ ok: true });
    }
    // the last messages, for the app's own news list (also for phones without push)
    if (req.method === 'GET' && op === 'news') {
      const rows = await sb(`settings?select=data&key=like.pushlog:*&order=key.desc&limit=15`);
      return res.status(200).json({ news: rows.map((r) => ({ ts: r.data.ts, title: r.data.title, body: r.data.body, url: r.data.url, clubId: r.data.clubId || '' })) });
    }

    // People inside each club now: an entry in the last 2 hours with no exit marked after it. Counts only.
    if (req.method === 'GET' && op === 'occupancy') {
      if (Date.now() - occCache.at > 10000) {
        const rows = await sb(`visits?select=ts,club,member,kind&ts=gte.${Date.now() - 2 * 3600000}&order=ts.asc&limit=2000`);
        const last = new Map();
        for (const v of rows) {
          if (v.kind === 'out') {
            const was = last.get(v.member);
            if (was && was.club === v.club) last.delete(v.member);
          } else last.set(v.member, v);
        }
        const inside = {};
        for (const v of last.values()) inside[v.club] = (inside[v.club] || 0) + 1;
        occCache = { at: Date.now(), inside };
      }
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ inside: occCache.inside });
    }
    if (req.method === 'GET' && op === 'clubs') return res.status(200).json({ clubs: await getClubs() });

    // Editable content is public too: prices, plans, trainers, rules, schedule, promotions, photos.
    // The clubs' 1Fit codes go to signed-in staff only: in public anyone could check in to 1Fit without coming to the club.
    if (req.method === 'GET' && op === 'content') {
      const { onefit, ...open } = await getContent();
      return res.status(200).json({ content: authed() && onefit ? { ...open, onefit } : open });
    }

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
        if (tries + 1 >= 3) await settle({ fails: 0, lockUntil: Date.now() + 15 * 60000 });
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
        const gate = await guessGates(req, 'client', id);
        if (!gate) return res.status(429).json({ error: 'locked' });
        if (!checkPassword(password, c.passHash)) {
          await gate.miss();
          return res.status(401).json({ error: 'wrong password' });
        }
        await gate.hit();
      } else if (c.passReset) {
        // The front desk confirmed the person; the next sign-in sets the password.
        const { passReset: _r, ...rest } = c;
        await write(id, { ...rest, passHash: hashPassword(password) });
      } else {
        // An account without a password (created at the desk or before passwords existed) must be unlocked by staff first,
        // otherwise anyone who knows the phone number could claim it.
        return res.status(409).json({ error: 'reset required' });
      }
      const rule = await freezeRules();
      return res.status(200).json({ token: issueToken(id), account: account(c && { ...c, membership: withFreeze(c.membership, rule) }) });
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
        // After +7 a Kazakh number begins with 7: «+7 8…» is «8 7xx» typed into the +7 field, a card nobody would find by the real number.
        if (/^u_78\d{9}$/.test(id)) return res.status(400).json({ error: 'bad phone' });
        // A new account must set its password right away.
        const password = String(body.password ?? '');
        if (password.length < 6) return res.status(400).json({ error: 'short password' });
        prev = { id, since: new Date().toISOString().slice(0, 10), passHash: hashPassword(password) };
      }
      const given = str(body.name, 60);
      // A placeholder name must not overwrite the real one saved earlier.
      // A name the manager corrected stays: the client's app re-sends its own copy on every launch.
      const name = prev.nameByStaff && !authed() ? prev.name : given && given !== 'Гость' && given !== 'Guest' && given !== 'Қонақ' ? given : prev.name || given || 'Гость';
      const next = { ...prev, name, phone: str(body.phone, 20), homeClubId: str(body.homeClubId, 8) || prev.homeClubId || 'c1' };
      const profile = cleanProfile(body.profile);
      if (profile) next.profile = profile;
      // Blob writes are the scarce quota: skip the write when nothing changed (the app re-sends on every launch).
      if (!existing || JSON.stringify(next) !== JSON.stringify(existing)) await write(id, next);
      return res.status(200).json({ ok: true, membership: next.membership ? withFreeze(next.membership, await freezeRules()) : null, token: existing ? undefined : issueToken(id) });
    }

    // The days a client came (a year back): their own app with their token, or the staff.
    if (req.method === 'GET' && op === 'member-visits') {
      const id = str(req.query.id, 20);
      if (!ID.test(id)) return res.status(400).json({ error: 'bad id' });
      if (tokenOwner(req) !== id && !authed()) return res.status(401).json({ error: 'auth' });
      const rows = await pageAll(`visits?select=ts,club,kind&member=eq.${encodeURIComponent(id)}&kind=neq.out&ts=gte.${Date.now() - 400 * 86400000}&order=ts.desc`);
      return res.status(200).json({ visits: rows.map((v) => ({ d: dayOf(v.ts), c: v.club, ts: v.ts, onefit: v.kind === 'onefit' })) });
    }
    if (req.method === 'GET' && op === 'me') {
      const id = str(req.query.id, 20);
      if (!ID.test(id)) return res.status(400).json({ error: 'bad id' });
      if (tokenOwner(req) !== id && !authed()) return res.status(401).json({ error: 'auth' });
      const c = await read(id);
      const rule = await freezeRules();
      return res.status(200).json(account(c && { ...c, membership: withFreeze(c.membership, rule) }) ?? { membership: null, name: null, homeClubId: null, profile: null });
    }

    // Freeze: the client on their own phone (token) or the desk (staff code). Days come out of the plan's freeze days and the end date moves.
    // Unfreezing early gives back the days not used and pulls the end date in again. Days are counted on the clubs' clock (UTC+5).
    if (req.method === 'POST' && (op === 'freeze' || op === 'unfreeze')) {
      const id = str(body.id, 20);
      if (!ID.test(id)) return res.status(400).json({ error: 'bad id' });
      if (tokenOwner(req) !== id && !authed()) return res.status(401).json({ error: 'auth' });
      const c = await read(id);
      const m = c && withFreeze(c.membership, await freezeRules());
      const almaty = (ts) => new Date(ts + 5 * 3600000).toISOString().slice(0, 10);
      const today = almaty(Date.now());
      const plusDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
      if (!m || m.endDate < today) return res.status(409).json({ error: 'no active plan' });
      const frozen = !!m.frozenUntil && m.frozenUntil >= today;
      // Passes issued before the rule carry no count: a year pass (over 300 days) gets 2 freezes, the rest 1; one freeze is the days split evenly.
      const span = (Date.parse(m.endDate) - Date.parse(m.startDate)) / 86400000;
      const freezesLeft = m.freezesLeft ?? (span > 300 ? 2 : 1);
      const freezeMax = m.freezeMax || Math.ceil((m.freezeDaysLeft || 0) / Math.max(1, m.freezesLeft ?? (span > 300 ? 2 : 1)));
      let next;
      if (op === 'freeze') {
        const days = Math.round(Number(body.days));
        if (frozen) return res.status(409).json({ error: 'already frozen' });
        if (freezesLeft < 1) return res.status(409).json({ error: 'no freezes left' });
        if (!(days >= 1 && days <= Math.min(freezeMax, m.freezeDaysLeft || 0))) return res.status(400).json({ error: 'not enough freeze days' });
        next = { ...m, endDate: plusDays(m.endDate, days), frozenUntil: plusDays(today, days - 1), freezeDaysLeft: (m.freezeDaysLeft || 0) - days, freezesLeft: freezesLeft - 1, freezeMax };
      } else {
        if (!frozen) return res.status(409).json({ error: 'not frozen' });
        // the client trains from today on, so today and every day after it come back: freeze-and-unfreeze changes nothing
        const back = Math.max(0, Math.round((Date.parse(m.frozenUntil) - Date.parse(today)) / 86400000) + 1);
        const { frozenUntil: _f, ...rest } = m;
        next = { ...rest, endDate: plusDays(m.endDate, -back), freezeDaysLeft: (m.freezeDaysLeft || 0) + back, freezesLeft, freezeMax };
      }
      await write(id, { ...c, membership: next });
      return res.status(200).json({ ok: true, membership: next });
    }

    // Staff mode: the owner's code opens the CRM; an administrator's personal code opens the desk under their own name.
    if (req.method === 'POST' && op === 'staff-login') {
      const code = String(body.code || '');
      if (!/^\d{4,8}$/.test(code)) return res.status(400).json({ error: 'bad code' });
      const gate = await guessGates(req, 'staff');
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
      return res.status(200).json({ role: who.role === 'manager' ? 'manager' : who.role === 'accountant' ? 'accountant' : 'admin', token: adminToken(who.id, who.at), name: who.name, id: who.id });
    }

    const ACC_READ = ['list', 'sales', 'visits', 'shifts', 'cash', 'cashes', 'withdrawals', 'cash-moves', 'expenses', 'safe', 'loads', 'revisions'];
    const ACC_WRITE = ['exp-pay', 'exp-del', 'exp-tpl-save', 'exp-tpl-del'];
    const accOk = isAcc && ((req.method === 'GET' && ACC_READ.includes(op)) || (req.method === 'POST' && ACC_WRITE.includes(op)));
    if (!authed() && !accOk) return res.status(isAcc ? 403 : 401).json({ error: isAcc ? 'accountant reads only' : 'code' });

    // The name the server keeps for this staff code: a phone signed in before a rename picks up the new one.
    if (req.method === 'GET' && op === 'whoami') return res.status(200).json({ name: admin ? admin.name : 'owner' });

    if (req.method === 'GET' && op === 'leads') {
      const rows = await sb('leads?select=data&order=ts.desc&limit=200');
      return res.status(200).json({ leads: rows.map((r) => r.data) });
    }

    if (req.method === 'GET' && op === 'list') {
      const rule = await freezeRules();
      // the accountant gets only what the money screens count: no phones, profiles or sessions
      const slim = (c) => ({ id: c.id, name: c.name, homeClubId: c.homeClubId, since: c.since, phone: '', ...(c.membership ? { membership: { planId: c.membership.planId, startDate: c.membership.startDate, endDate: c.membership.endDate } } : {}), ...(c.onefit ? { onefit: c.onefit } : {}) });
      return res.status(200).json({ clients: (await readAll()).map((c) => (isAcc ? slim(c) : publicClient(c.membership ? { ...c, membership: withFreeze(c.membership, rule) } : c))).sort((a, b) => String(b.since).localeCompare(String(a.since))) });
    }

    // Entry/exit of a client at a club. The server clock is the source of truth for the visit.
    if (req.method === 'POST' && (op === 'checkin' || op === 'checkout')) {
      const id = str(body.id, 20);
      if (!ID.test(id)) return res.status(400).json({ error: 'bad id' });
      // An administrator lets a client in only with the QR from the client's app; letting in by hand is the manager's.
      if (op === 'checkin' && !body.qr && !manages()) return res.status(403).json({ error: 'qr only' });
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

      // A frozen pass does not open the door: unfreeze it first (the client in the app, or the desk on the card).
      if (op === 'checkin' && prev.membership?.frozenUntil && prev.membership.frozenUntil >= day(now)) return res.status(403).json({ error: 'frozen' });
      // A daytime plan is not let in from 17:00 (Almaty time), whatever the front desk's screen says.
      if (op === 'checkin' && prev.membership?.dayOnly && !manages() && new Date(now + 5 * 3600000).getUTCHours() >= 17) return res.status(403).json({ error: 'day only' });
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
      if (op === 'checkout' && session) await logVisit(session.clubId, id, 'out');
      // A plan with a visit counter loses one visit per calendar day on the first check-in of that day.
      if (op === 'checkin' && membership && membership.visitsLeft > 0 && firstToday) membership = { ...membership, visitsLeft: membership.visitsLeft - 1 };
      await write(id, { ...prev, session, ...(membership ? { membership } : {}), ...(proofExp ? { qrUsed: proofExp } : {}) });
      // the desk's card is refreshed from this answer: it carries the freeze rule like the list does
      return res.status(200).json({ ok: true, visitsLeft: membership?.visitsLeft, membership: membership ? withFreeze(membership, await freezeRules()) : null });
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
      // a client locked out by wrong tries can sign in right after the desk unlocks them
      await sb(`settings?key=eq.${enc('client:' + id)}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ data: { fails: 0, lockUntil: 0 } }) });
      return res.status(200).json({ ok: true });
    }

    // grant: a plan sold at the desk; membership-edit: the manager corrects a running pass (dates, visits, freezes)
    if (req.method === 'POST' && (op === 'grant' || op === 'membership-edit')) {
      if (op === 'membership-edit' && !manages()) return res.status(403).json({ error: 'manager only' });
      const id = str(body.id, 20);
      const membership = cleanMembership(body.membership);
      if (!ID.test(id) || !membership) return res.status(400).json({ error: 'bad data' });
      const prev = (await read(id)) || { id, name: str(body.name, 60) || 'Гость', phone: str(body.phone, 20), homeClubId: 'c1', since: new Date().toISOString().slice(0, 10) };
      // The desk retries a grant until it hears back: a grant already applied (same id) changes nothing, so a plan is never prolonged twice.
      const gid = /^G[0-9a-z]{6,24}$/.test(String(body.gid ?? '')) ? String(body.gid) : '';
      if (op === 'grant' && gid && (prev.grantIds || []).includes(gid)) return res.status(200).json({ ok: true, repeat: true });
      // An administrator's grant on a running pass is a prolongation: the server works it out from the plan's rules
      // and the stored pass, so no dates, visits or freezes sent by the desk are taken on trust.
      const was = prev.membership;
      if (op === 'grant' && !manages()) {
        // a running pass is prolonged; otherwise a new one starts today with the plan's own length and counts
        const today = dayOf(Date.now());
        const running = was && (!was.endDate || was.endDate >= today);
        const next = await prolong(running ? was : { startDate: today, endDate: today, freezeDaysLeft: 0, freezesLeft: 0 }, membership.planId);
        if (!next) return res.status(403).json({ error: 'only the manager changes a running pass' });
        Object.keys(membership).forEach((k) => delete membership[k]);
        Object.assign(membership, next);
      }
      // The free trial no longer exists: no client and no old app version can be given it.
      if (membership.planId === 'trial') return res.status(410).json({ error: 'trial removed' });
      // A plan given at the desk replaces a pass that was waiting for its first entry.
      const { pending: _waiting, ...current } = prev;
      await write(id, { ...current, membership, ...(membership.planId === 'trial' ? { trialUsed: true } : {}), ...(gid ? { grantIds: [gid, ...(prev.grantIds || [])].slice(0, 30) } : {}) });
      return res.status(200).json({ ok: true });
    }

    // A plan added by mistake is swapped for the right one by the manager or the owner; who, when, from what and why is kept on the client.
    if (req.method === 'POST' && op === 'plan-fix') {
      if (!manages()) return res.status(403).json({ error: 'manager only' });
      const id = str(body.id, 20);
      const membership = cleanMembership(body.membership);
      const reason = str(body.reason, 120);
      if (!ID.test(id) || !membership || reason.length < 3 || /[<>]/.test(reason)) return res.status(400).json({ error: 'bad data' });
      const prev = await read(id);
      if (!prev || !prev.membership) return res.status(404).json({ error: 'no plan' });
      const fix = { ts: Date.now(), by: staffName(''), from: prev.membership.planId, to: membership.planId, fromEnd: prev.membership.endDate, toEnd: membership.endDate, reason };
      await write(id, { ...prev, membership, planFixes: [fix, ...(prev.planFixes || [])].slice(0, 20) });
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
      if (kind === 'plan' && /^[A-Za-z0-9_-]{1,24}$/.test(String(body.planId ?? ''))) sale.planId = String(body.planId);
      if (kind === 'plan' && /^G[0-9a-z]{6,24}$/.test(String(body.gid ?? ''))) sale.gid = String(body.gid);
      // the desk discount is the manager's: an administrator's check with one is refused
      if (body.disc != null && Number(body.disc) > 0 && !manages()) return res.status(403).json({ error: 'manager discount only' });
      if ([10, 20, 30, 50, 100].includes(Number(body.disc))) sale.disc = Number(body.disc);
      if (sale.disc && body.off != null) sale.off = int(body.off, 10000000);
      if (kind === 'debt') sale.remaining = Math.min(sale.amount, int(body.remaining ?? body.amount, 10000000));
      const items = Array.isArray(body.items) ? body.items.slice(0, 50).map((i) => ({ id: str(i && i.id, 24), qty: int(i && i.qty, 100000) })).filter((i) => /^[A-Za-z0-9_-]{1,24}$/.test(i.id) && i.qty >= 1) : [];
      // the same product twice in one check is one line, so what leaves and what comes back are counted once
      const merged = Object.values(items.reduce((m, i) => ((m[i.id] = { id: i.id, qty: (m[i.id] ? m[i.id].qty : 0) + i.qty }), m), {}));
      items.length = 0;
      items.push(...merged);
      if (items.length) sale.items = items;
      // The administrators' premium: 1000 ₸ a jar or pack of sports nutrition sold (portions under 3000 ₸ and free checks earn none).
      // It goes to whoever made the sale: the one who rang the check, or the person the desk names.
      if (kind === 'shop' && items.length && sale.amount >= 1) {
        const cat = (await getContent()).catalog || {};
        const known = new Map([...(cat.custom || []), ...Object.values(cat.overrides || {})].map((p) => [p.id, p]));
        const packs = items.reduce((n, i) => {
          const p = known.get(i.id);
          return n + (p && BONUS_CATEGORIES.includes(p.category) && !p.byWeight && Number(p.price) >= 3000 ? i.qty : 0);
        }, 0);
        // the premium comes out of the money taken: the check shows what is left (the client still pays the full price)
        const cut = Math.min(packs * 1000, sale.amount - 1);
        if (packs && cut > 0) {
          sale.bonusSum = cut;
          sale.paid = sale.amount;
          sale.amount -= cut;
          sale.bonusTo = (!/[<>]/.test(String(body.bonusTo ?? '')) && str(body.bonusTo, 40)) || staffName(body.staff);
        }
      }
      // One plan grant is one sale: the grant's id is claimed first, so a second row of the same grant (an older phone
      // posting the same plan twice) is dropped, even when both arrive at the same moment.
      if (sale.gid && sale.planId) {
        const claim = await sb('settings?on_conflict=key', { method: 'POST', headers: { prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify({ key: 'gidsale:' + sale.gid, data: { id, ts } }) });
        if (Array.isArray(claim) && !claim.length) {
          const first = (await sb(`settings?key=eq.gidsale:${sale.gid}&select=data`))[0]?.data;
          if (first && first.id !== id) return res.status(200).json({ ok: true, dup: true });
        }
      }
      // return=representation: an empty answer means this id was already stored, so the shelf is not charged twice
      const stored = await sb('sales?on_conflict=id', { method: 'POST', headers: { prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify({ id, ts, data: sale }) });
      // a zero-amount "sale" cannot write stock off: units leave the shelf only with money (a write-off is the manager's count on the product card)
      if (kind === 'shop' && items.length && (sale.amount >= 1 || sale.disc === 100) && Array.isArray(stored) && stored.length) {
        const moved = await adjustStock(items, -1, sale.clubId);
        if (moved.length) await sb(`sales?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ data: { ...sale, items: items.map((i) => ({ ...i, taken: (moved.find((m) => m.id === i.id) || {}).taken ?? 0 })) } }) });
      }
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

    // Only a plan the server really applied to this client (its grant id is on the client) is taken back, and only once:
    // a made-up plan sale cancelled later cannot shorten anyone's pass.
    const takePlanBack = async (sale) => {
      const c = await read(sale.memberId);
      if (!c || !c.membership || !sale.gid || !(c.grantIds || []).includes(sale.gid)) return;
      const next = await unprolong(c.membership, sale.planId);
      if (next === c.membership) return;
      const { membership: _m, ...rest } = c;
      const grantIds = c.grantIds.filter((g) => g !== sale.gid);
      await write(sale.memberId, next ? { ...rest, grantIds, membership: next } : { ...rest, grantIds });
    };

    // Only the manager and the owner return or cancel a check; administrators cannot.
    if (req.method === 'POST' && op === 'refund') {
      if (!manages()) return res.status(403).json({ error: 'manager only' });
      const saleId = str(body.saleId, 24);
      const reason = str(body.reason, 80);
      if (reason.length < 3 || /[<>]/.test(reason)) return res.status(400).json({ error: 'reason required' });
      const rows = await sb(`sales?id=eq.${encodeURIComponent(saleId)}&select=data`);
      const sale = rows[0]?.data;
      if (!sale || !['plan', 'shop', 'personal'].includes(sale.kind)) return res.status(400).json({ error: 'bad data' });
      // A check given free (100%) has no money to return, but a mistake is still cancelled: once, and its goods go back on the shelf.
      if (sale.disc === 100 && !sale.amount) {
        const marked = await sb(`sales?id=eq.${encodeURIComponent(saleId)}&${encodeURIComponent('data->>cancelled')}=is.null`, { method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify({ data: { ...sale, cancelled: true } }) });
        if (!Array.isArray(marked) || marked.length !== 1) return res.status(409).json({ error: 'already changed' });
        const now = Date.now();
        const rid = 'F' + now.toString(36) + Math.random().toString(36).slice(2, 5);
        await sb('sales', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ id: rid, ts: now, data: { id: rid, ts: now, kind: 'refund', title: 'Возврат: ' + sale.title, name: sale.name, memberId: sale.memberId, amount: 0, clubId: sale.clubId, method: sale.method, staff: staffName(''), reason, refundOf: saleId } }) });
        if (sale.kind === 'shop' && Array.isArray(sale.items)) await adjustStock(sale.items.filter((i) => (i.taken ?? 0) > 0), 1, sale.clubId);
        if (sale.kind === 'plan' && sale.planId && ID.test(String(sale.memberId || ''))) await takePlanBack(sale);
        return res.status(200).json({ ok: true });
      }
      const left = sale.amount - (sale.refunded || 0);
      const amount = body.amount == null ? left : int(body.amount, 10000000);
      if (amount < 1 || amount > left) return res.status(400).json({ error: 'bad amount' });
      const now = Date.now();
      const ref = { id: 'F' + now.toString(36) + Math.random().toString(36).slice(2, 5), ts: now, kind: 'refund', title: 'Возврат: ' + sale.title, name: sale.name, memberId: sale.memberId, amount, clubId: sale.clubId, method: sale.method, staff: staffName(''), reason, refundOf: saleId, ...(sale.trainerId ? { trainerId: sale.trainerId } : {}) };
      // The sale is marked first, and only while it still reads what we read: of two cancellations racing for the same check exactly one goes through.
      const was = sale.refunded ? `eq.${sale.refunded}` : 'is.null';
      const marked = await sb(`sales?id=eq.${encodeURIComponent(saleId)}&${encodeURIComponent('data->>refunded')}=${was}`, { method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify({ data: { ...sale, refunded: (sale.refunded || 0) + amount } }) });
      if (!Array.isArray(marked) || marked.length !== 1) return res.status(409).json({ error: 'already changed' });
      await sb('sales', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ id: ref.id, ts: now, data: ref }) });
      // a full refund puts back exactly what the sale took off the shelf
      if (sale.kind === 'shop' && Array.isArray(sale.items) && amount === sale.amount) await adjustStock(sale.items.filter((i) => (i.taken ?? 0) > 0), 1, sale.clubId);
      // a plan check cancelled whole: the client's pass loses that plan too
      if (sale.kind === 'plan' && sale.planId && amount === sale.amount && ID.test(String(sale.memberId || ''))) await takePlanBack(sale);
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
        if (x.trainerId) continue; // personal training money is the trainers' till, kept apart from this drawer
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

    /* ---- moving between clubs: cash, goods and clients ---- */
    const clubIdOk = (v) => typeof v === 'string' && /^c\d{1,3}$/.test(v);
    // The manager counts a product on one club's shelf (empty = stop counting it there).
    if (req.method === 'POST' && op === 'stock-set') {
      if (!manages()) return res.status(403).json({ error: 'manager only' });
      const id = str(body.id, 24);
      const n = body.n == null || body.n === '' ? null : int(body.n, 100000);
      if (!/^[A-Za-z0-9_-]{1,24}$/.test(id) || !(await validClub(body.clubId))) return res.status(400).json({ error: 'bad data' });
      const ok = await editStock((all) => {
        const shelf = (all[body.clubId] = all[body.clubId] || {});
        if (n == null) delete shelf[id];
        else shelf[id] = n;
        return true;
      }, 'staff ' + staffName(''));
      return ok ? res.status(200).json({ ok: true, stock: (await getContent()).stock || {} }) : res.status(409).json({ error: 'busy' });
    }
    // The month-end count: every product counted is set to what is on the shelf in one write; what the books said
    // and what was found are kept as a revision, so the shortage of the month can be looked at and exported later.
    if (req.method === 'POST' && op === 'stock-revision') {
      if (!manages()) return res.status(403).json({ error: 'manager only' });
      const rows = Array.isArray(body.counts) ? body.counts.slice(0, 1000) : [];
      const counts = rows.map((r) => ({ id: str(r && r.id, 24), n: int(r && r.n, 100000), name: str(r && r.name, 120), price: int(r && r.price, 100000000) })).filter((r) => /^[A-Za-z0-9_-]{1,24}$/.test(r.id) && !/[<>]/.test(r.name));
      if (!counts.length || !(await validClub(body.clubId))) return res.status(400).json({ error: 'bad data' });
      const lines = [];
      const ok = await editStock((all) => {
        const shelf = (all[body.clubId] = all[body.clubId] || {});
        lines.length = 0;
        for (const r of counts) {
          lines.push({ id: r.id, name: r.name, price: r.price, was: r.id in shelf ? Number(shelf[r.id]) || 0 : null, n: r.n });
          shelf[r.id] = r.n;
        }
        return true;
      }, 'revision ' + staffName(''));
      if (!ok) return res.status(409).json({ error: 'busy' });
      const now = Date.now();
      await sb('settings', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ key: `revision:${now}${Math.random().toString(36).slice(2, 5)}`, data: { ts: now, clubId: body.clubId, staff: staffName(body.staff), lines } }) });
      return res.status(200).json({ ok: true, stock: (await getContent()).stock || {} });
    }
    if (req.method === 'GET' && op === 'revisions') {
      if (!manages() && !isAcc) return res.status(403).json({ error: 'manager only' });
      const rows = await sb(`settings?select=data&key=like.revision:*&order=key.desc&limit=24`);
      return res.status(200).json({ revisions: rows.map((r) => r.data) });
    }
    // Goods driven from one club to another: off one shelf and onto the other in one write, never more than is there.
    if (req.method === 'POST' && op === 'stock-move') {
      if (!manages()) return res.status(403).json({ error: 'manager only' });
      const id = str(body.id, 24);
      const qty = int(body.qty, 100000);
      const { from, to } = body;
      if (!/^[A-Za-z0-9_-]{1,24}$/.test(id) || qty < 1 || from === to || !(await validClub(from)) || !(await validClub(to))) return res.status(400).json({ error: 'bad data' });
      let short = false;
      const ok = await editStock((all) => {
        const a = (all[from] = all[from] || {});
        const b = (all[to] = all[to] || {});
        if (!(id in a) || a[id] < qty || (b[id] || 0) + qty > 100000) return ((short = true), null);
        a[id] -= qty;
        b[id] = (b[id] || 0) + qty;
        return true;
      }, 'staff ' + staffName(''));
      if (!ok) return res.status(short ? 400 : 409).json({ error: short ? 'not enough' : 'busy' });
      const now = Date.now();
      await sb('settings', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ key: `smove:${now}${Math.random().toString(36).slice(2, 5)}`, data: { ts: now, id, qty, from, to, staff: staffName(body.staff) } }) });
      return res.status(200).json({ ok: true, stock: (await getContent()).stock || {} });
    }
    // A client changes their home club: from then on they are in that club's list.
    if (req.method === 'POST' && op === 'client-move') {
      if (!manages()) return res.status(403).json({ error: 'manager only' });
      const id = str(body.id, 20);
      if (!/^[A-Za-z0-9_-]{2,20}$/.test(id) || !(await validClub(body.clubId))) return res.status(400).json({ error: 'bad data' });
      const c = await read(id);
      if (!c) return res.status(404).json({ error: 'no client' });
      const from = c.homeClubId || 'c1';
      await write(id, { ...c, homeClubId: body.clubId, moves: [...(c.moves || []).slice(-19), { ts: Date.now(), from, to: body.clubId, staff: staffName('') }] });
      return res.status(200).json({ ok: true });
    }
    // The manager corrects a client's name (a typo, a nickname typed at registration).
    if (req.method === 'POST' && op === 'client-rename') {
      if (!manages()) return res.status(403).json({ error: 'manager only' });
      const id = str(body.id, 20);
      const name = str(body.name, 60);
      if (!/^[A-Za-z0-9_-]{2,20}$/.test(id) || name.length < 2 || /[<>�]/.test(name)) return res.status(400).json({ error: 'bad data' });
      const c = await read(id);
      if (!c) return res.status(404).json({ error: 'no client' });
      await write(id, { ...c, name, nameByStaff: true });
      return res.status(200).json({ ok: true });
    }
    // A client card made by mistake or twice: off the lists. The card is kept aside (deleted:<id>) so it can be brought back; the payments stay in the books.
    if (req.method === 'POST' && op === 'client-del') {
      if (!manages()) return res.status(403).json({ error: 'manager only' });
      const id = str(body.id, 20);
      if (!/^[A-Za-z0-9_-]{2,20}$/.test(id)) return res.status(400).json({ error: 'bad data' });
      const c = await read(id);
      if (!c) return res.status(404).json({ error: 'no client' });
      await sb('settings?on_conflict=key', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: 'deleted:' + id, data: { id, ts: Date.now(), by: staffName(''), client: c } }) });
      await sb(`clients?id=eq.${id}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } });
      return res.status(200).json({ ok: true });
    }
    // Cash taken to another club: out of this drawer now, waiting until the other desk counts it in and accepts it.
    if (req.method === 'POST' && op === 'cash-move') {
      const d = await cashGet(str(body.id, 20));
      const amount = int(body.amount, 100000000);
      const responsible = str(body.responsible, 40);
      const note = str(body.note, 80);
      if (!d || d.close || amount < 1 || !clubIdOk(body.to) || body.to === d.clubId || !(await validClub(body.to)) || responsible.length < 2 || [responsible, note].some((v) => /[<>]/.test(v))) return res.status(400).json({ error: 'bad data' });
      if (amount > (await cashSummary(d)).expected) return res.status(400).json({ error: 'more than in the drawer' });
      if (d.outs.length >= 200) return res.status(400).json({ error: 'too many' });
      const now = Date.now();
      const id = String(now) + Math.random().toString(36).slice(2, 5).padEnd(3, '0');
      const staff = staffName(body.staff);
      await sb('settings', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ key: 'cmove:' + id, data: { id, ts: now, from: d.clubId, fromDrawer: d.id, to: body.to, amount, responsible, note, staff, status: 'pending' } }) });
      d.outs.push({ ts: now, amount, reason: 'Перемещение', note, staff, responsible, confirmed: false, move: id, toClubId: body.to });
      await cashPut(d);
      return res.status(200).json({ ok: true, drawer: { ...d, ...(await cashSummary(d)) } });
    }
    // The receiving desk counts the money in: it goes into that club's open drawer; a move is accepted once.
    if (req.method === 'POST' && op === 'cash-accept') {
      const d = await cashGet(str(body.id, 20));
      const moveId = str(body.move, 20);
      const m = /^\d{13}[a-z0-9]{3}$/.test(moveId) ? (await sb(`settings?key=eq.cmove:${moveId}&select=data`))[0]?.data : undefined;
      if (!d || d.close || !m || m.to !== d.clubId) return res.status(400).json({ error: 'bad data' });
      const staff = staffName(body.staff);
      const now = Date.now();
      const taken = await sb(`settings?key=eq.cmove:${moveId}&${enc('data->>status')}=eq.pending`, { method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify({ data: { ...m, status: 'accepted', acceptedBy: staff, acceptedAt: now } }) });
      if (!Array.isArray(taken) || taken.length !== 1) return res.status(409).json({ error: 'already accepted' });
      d.ins = d.ins || [];
      d.ins.push({ ts: now, amount: m.amount, note: `Перемещение • ${m.responsible}`, staff, move: moveId, fromClubId: m.from });
      await cashPut(d);
      const src = m.fromDrawer ? await cashGet(m.fromDrawer) : undefined;
      const out = src && src.outs.find((o) => o.move === moveId);
      if (out) {
        Object.assign(out, { confirmed: true, confirmedBy: staff });
        await cashPut(src);
      }
      return res.status(200).json({ ok: true, drawer: { ...d, ...(await cashSummary(d)) } });
    }
    // Moves of the last days: the desk sees what is on its way to it, the manager sees them all.
    if (req.method === 'GET' && op === 'cash-moves') {
      const days = Math.max(1, Math.min(400, Number(req.query.days) || 30));
      const rows = await pageAll(`settings?select=data&key=like.cmove:*&${enc('data->>ts')}=gte.${Date.now() - days * 86400000}&order=key.desc`);
      return res.status(200).json({ moves: rows.map((r) => r.data) });
    }

    if (req.method === 'POST' && op === 'push-send') {
      if (!manages()) return res.status(403).json({ error: 'manager only' });
      const webOn = !!(process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE);
      const title = str(body.title, 60);
      const text = str(body.body, 240);
      const url = ['/', '/shop', '/membership'].includes(String(body.url)) ? body.url : '/';
      const audience = ['all', 'active', 'expired'].includes(body.audience) ? body.audience : 'all';
      const clubId = (await validClub(body.clubId)) ? body.clubId : '';
      if (title.length < 2 || /[<>]/.test(title + text)) return res.status(400).json({ error: 'bad data' });
      const webpush = webOn ? require('web-push') : null;
      if (webpush) webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:info@7gym.kz', process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);
      const subs = (await pageAll('settings?select=key,data&key=like.push:*')).map((r) => ({ key: r.key, ...r.data }));
      // who gets it: a club (by the client's club, or where the phone subscribed) and whether the pass is running
      const people = new Map((await readAll()).map((c) => [c.id, c]));
      const today = dayOf(Date.now());
      const pick = subs.filter((x) => {
        const c = x.member ? people.get(x.member) : null;
        if (clubId && (c ? (c.homeClubId || 'c1') : x.clubId) !== clubId) return false;
        if (audience === 'all') return true;
        const live = !!(c && c.membership && c.membership.endDate >= today);
        return audience === 'active' ? live : !!c && !live;
      });
      const payload = JSON.stringify({ title, body: text, url });
      let sent = 0;
      let failed = 0;
      const forget = (key) => sb(`settings?key=eq.${key}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } });
      // the Android app's phones: Expo's push service, 100 at a time
      const native = pick.filter((x) => x.expo);
      for (let i = 0; i < native.length; i += 100) {
        const batch = native.slice(i, i + 100);
        try {
          const r = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(batch.map((x) => ({ to: x.expo, title, body: text, data: { url }, sound: 'default', channelId: 'news', priority: 'high' }))), signal: AbortSignal.timeout(15000) });
          const tickets = (await r.json()).data || [];
          for (let k = 0; k < batch.length; k++) {
            const tk = tickets[k] || {};
            if (tk.status === 'ok') sent += 1;
            else {
              failed += 1;
              if (tk.details && tk.details.error === 'DeviceNotRegistered') await forget(batch[k].key);
            }
          }
        } catch {
          failed += batch.length;
        }
      }
      const web = webpush ? pick.filter((x) => x.sub) : [];
      for (let i = 0; i < web.length; i += 20) {
        await Promise.all(
          web.slice(i, i + 20).map(async (x) => {
            try {
              await webpush.sendNotification(x.sub, payload, { TTL: 86400, timeout: 10000 });
              sent += 1;
            } catch (e) {
              failed += 1;
              // the phone unsubscribed or the browser dropped it: forget it
              if (e && (e.statusCode === 404 || e.statusCode === 410)) await sb(`settings?key=eq.${x.key}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } });
            }
          }),
        );
      }
      const now = Date.now();
      const id = String(now) + Math.random().toString(36).slice(2, 5).padEnd(3, '0');
      await sb('settings', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ key: 'pushlog:' + id, data: { id, ts: now, title, body: text, url, audience, clubId, sent, failed, by: staffName('owner') } }) });
      return res.status(200).json({ ok: true, sent, failed, total: subs.length });
    }
    if (req.method === 'GET' && op === 'push-log') {
      if (!manages()) return res.status(403).json({ error: 'manager only' });
      const rows = await sb(`settings?select=data&key=like.pushlog:*&order=key.desc&limit=30`);
      const subs = await pageAll('settings?select=key&key=like.push:*');
      return res.status(200).json({ log: rows.map((r) => r.data), subscribers: subs.length });
    }

    /* ---- club expenses: the manager keeps the monthly must-pays (rent, utilities, salaries) and records what was paid; the owner sees it all ---- */
    const newId = () => String(Date.now()) + Math.random().toString(36).slice(2, 5).padEnd(3, '0');
    const plainText = (v) => v.length >= 2 && !/[<>]/.test(v);
    // the day a payment counts on: its own day in its own month, else the last day of the month it is for
    const expDay = (month, ts) => {
      if (new Date(ts + 5 * 3600000).toISOString().slice(0, 7) === month) return '';
      const [y, m] = month.split('-').map(Number);
      return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    };
    if (req.method === 'GET' && op === 'expenses') {
      if (!manages() && !isAcc) return res.status(403).json({ error: 'manager only' });
      const [tpl, pays] = await Promise.all([pageAll('settings?select=data&key=like.exptpl:*'), pageAll(`settings?select=data&key=like.expense:*&${enc('data->>ts')}=gte.${Date.now() - 400 * 86400000}`)]);
      return res.status(200).json({ templates: tpl.map((r) => r.data), payments: pays.map((r) => r.data) });
    }
    if (req.method === 'POST' && op === 'exp-tpl-save') {
      if (!manages() && !isAcc) return res.status(403).json({ error: 'manager only' });
      const title = str(body.title, 60);
      const amount = int(body.amount, 100000000);
      const day = Math.max(1, Math.min(31, int(body.day, 31) || 1));
      const id = /^\d{13}[a-z0-9]{3}$/.test(String(body.id)) ? body.id : newId();
      if (!plainText(title) || amount < 1 || !(await validClub(body.clubId))) return res.status(400).json({ error: 'bad data' });
      // an edit keeps the month the must-pay started in, so earlier months do not change
      const was = (await sb(`settings?key=eq.exptpl:${id}&select=data`))[0]?.data;
      await sb('settings?on_conflict=key', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: 'exptpl:' + id, data: { id, clubId: body.clubId, title, amount, day, by: staffName('owner'), at: was?.at ?? Date.now() } }) });
      return res.status(200).json({ ok: true, id });
    }
    if (req.method === 'POST' && op === 'exp-tpl-del') {
      if (!manages() && !isAcc) return res.status(403).json({ error: 'manager only' });
      const id = str(body.id, 20);
      if (!/^\d{13}[a-z0-9]{3}$/.test(id)) return res.status(400).json({ error: 'bad id' });
      await sb(`settings?key=eq.exptpl:${id}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } });
      return res.status(200).json({ ok: true });
    }
    // A payment: of a must-pay for a month (tplId + month) or a one-off expense. Cash or non-cash.
    if (req.method === 'POST' && op === 'exp-pay') {
      if (!manages() && !isAcc) return res.status(403).json({ error: 'manager only' });
      const title = str(body.title, 60);
      const note = str(body.note, 80);
      const amount = int(body.amount, 100000000);
      const month = /^\d{4}-\d{2}$/.test(String(body.month)) ? body.month : new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 7);
      const tplId = /^\d{13}[a-z0-9]{3}$/.test(String(body.tplId)) ? body.tplId : undefined;
      if (!plainText(title) || /[<>]/.test(note) || amount < 1 || !['cash', 'noncash'].includes(body.method) || !(await validClub(body.clubId))) return res.status(400).json({ error: 'bad data' });
      const id = newId();
      const day = expDay(month, Date.now());
      await sb('settings', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ key: 'expense:' + id, data: { id, ts: Date.now(), clubId: body.clubId, month, ...(day ? { day } : {}), ...(tplId ? { tplId } : {}), title, amount, method: body.method, note, staff: staffName('owner') } }) });
      return res.status(200).json({ ok: true, id });
    }
    // A payment made for another month (the October bills paid in early November) is moved there, dated that month's last day.
    if (req.method === 'POST' && op === 'exp-move') {
      if (!manages() && !isAcc) return res.status(403).json({ error: 'manager only' });
      const id = str(body.id, 20);
      const month = String(body.month);
      const thisMonth = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 7);
      if (!/^\d{13}[a-z0-9]{3}$/.test(id) || !/^\d{4}-\d{2}$/.test(month) || month > thisMonth) return res.status(400).json({ error: 'bad data' });
      const p = (await sb(`settings?key=eq.expense:${id}&select=data`))[0]?.data;
      if (!p) return res.status(404).json({ error: 'no payment' });
      const { day: _d, ...rest } = p;
      const day = expDay(month, p.ts);
      await sb(`settings?key=eq.expense:${id}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ data: { ...rest, month, ...(day ? { day } : {}), movedBy: staffName('owner') } }) });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'POST' && op === 'exp-del') {
      if (!manages() && !isAcc) return res.status(403).json({ error: 'manager only' });
      const id = str(body.id, 20);
      if (!/^\d{13}[a-z0-9]{3}$/.test(id)) return res.status(400).json({ error: 'bad id' });
      await sb(`settings?key=eq.expense:${id}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } });
      return res.status(200).json({ ok: true });
    }

    /* ---- the owner's safe: money the owner takes out or puts in by hand; what the desks put in comes from their withdrawals ---- */
    if (req.method === 'GET' && op === 'safe') {
      if (!isOwner(req) && !isAcc && !manages()) return res.status(403).json({ error: 'owner only' });
      const rows = await pageAll('settings?select=data&key=like.safe:*&order=key.desc');
      return res.status(200).json({ entries: rows.map((r) => r.data) });
    }
    if (req.method === 'POST' && op === 'safe-op') {
      if (!manages()) return res.status(403).json({ error: 'owner or manager only' });
      const amount = int(body.amount, 100000000);
      const note = str(body.note, 80);
      if (!['in', 'out'].includes(body.kind) || amount < 1 || note.length < 2 || /[<>]/.test(note) || !(await validClub(body.clubId))) return res.status(400).json({ error: 'bad data' });
      const now = Date.now();
      const id = String(now) + Math.random().toString(36).slice(2, 5).padEnd(3, '0');
      await sb('settings', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ key: 'safe:' + id, data: { id, ts: now, clubId: body.clubId, kind: body.kind, amount, note, staff: staffName('owner') } }) });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET' && op === 'cash') {
      const clubId = str(req.query.clubId, 6);
      if (!(await validClub(clubId))) return res.status(400).json({ error: 'bad club' });
      const rows = (await cashRows(30)).filter((x) => x.clubId === clubId);
      const d = rows.find((x) => !x.close);
      // the last closed drawer: its report stays on screen until the next one opens
      const last = d ? null : rows.find((x) => x.close);
      return res.status(200).json({ drawer: d ? { ...d, ...(await cashSummary(d)) } : null, last: last ? { ...last, ...(await cashSummary(last)) } : null });
    }
    if (req.method === 'POST' && op === 'cash-open') {
      const staff = staffName(body.staff);
      if (staff.length < 2 || /[<>]/.test(staff) || !(await validClub(body.clubId))) return res.status(400).json({ error: 'bad data' });
      const rows = (await cashRows(30)).filter((x) => x.clubId === body.clubId);
      const have = rows.find((x) => !x.close);
      // no amount typed: the drawer opens with what the last shift counted at closing
      const amount = body.amount === '' || body.amount == null ? (rows.find((x) => x.close)?.counted ?? 0) : int(body.amount, 100000000);
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
        const gate = await guessGates(req, 'staff'); // the same codes as at the staff login, so the same counters
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
        // U+FFFD = text that arrived in a broken encoding; it would show as question marks everywhere.
        if (name.length < 2 || /[<>�]/.test(name) || (id && !ADMIN_ID.test(id)) || (code && !/^\d{6,8}$/.test(code)) || (!id && !code)) return res.status(400).json({ error: 'bad data' });
        if (code && code.length === OWNER_CODE.length && code === OWNER_CODE) return res.status(400).json({ error: 'bad data' });
        const all = await listAdmins();
        if (code && all.some((a) => a.id !== id && checkPassword(code, a.hash))) return res.status(409).json({ error: 'code taken' });
        if (!id && all.length >= 30) return res.status(400).json({ error: 'too many' });
        const old = id ? all.find((a) => a.id === id) : null;
        if (id && !old) return res.status(404).json({ error: 'unknown' });
        const now = Date.now();
        const role = ['manager', 'accountant', 'admin'].includes(body.role) ? body.role : old ? old.role : 'admin';
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
      if (MEDIA_DIR) {
        const fs = require('fs');
        const nodePath = require('path');
        await fs.promises.mkdir(nodePath.join(MEDIA_DIR, 'p'), { recursive: true });
        await fs.promises.writeFile(nodePath.join(MEDIA_DIR, path), bytes);
        return res.status(200).json({ ok: true, url: `${PUBLIC_URL}/media/${path}` });
      }
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
