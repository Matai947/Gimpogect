// Shared client registry for the whole network, stored as one private Blob per client.
// ponytail: one file per client avoids write races between registrations; the list endpoint
// reads them all, fine up to a few thousand clients, move to a real database after that.
const { get, list, put } = require('@vercel/blob');

// No defaults: the codes live only in the Vercel environment, and the API refuses to work without them.
const STAFF_CODE = process.env.STAFF_CODE;
const OWNER_CODE = process.env.OWNER_CODE;

const ID = /^u_\d{10,12}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const path = (id) => `clients/${id}.json`;

async function read(id) {
  const r = await get(path(id), { access: 'private', useCache: false }).catch(() => null);
  if (!r || r.statusCode !== 200) return null;
  return new Response(r.stream).json();
}

const write = (id, data) => put(path(id), JSON.stringify(data), { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json' });

const authed = (req) => {
  const code = String(req.headers['x-code'] || '');
  return !!code && (code === STAFF_CODE || code === OWNER_CODE);
};

const str = (v, max) => String(v ?? '').trim().slice(0, max);

function cleanMembership(m) {
  if (!m || typeof m !== 'object') return null;
  const out = { planId: str(m.planId, 12), startDate: str(m.startDate, 10), endDate: str(m.endDate, 10), freezeDaysLeft: Math.max(0, Math.min(365, Number(m.freezeDaysLeft) || 0)) };
  if (!out.planId || !DAY.test(out.startDate) || !DAY.test(out.endDate)) return null;
  if (m.frozenUntil && DAY.test(String(m.frozenUntil))) out.frozenUntil = String(m.frozenUntil);
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-code');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!STAFF_CODE || !OWNER_CODE) return res.status(503).json({ error: 'not configured' });
  const op = String(req.query.op || '');
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

  try {
    if (req.method === 'POST' && op === 'lead') {
      const name = str(body.name, 60);
      const phone = str(body.phone, 20);
      const digits = phone.replace(/\D/g, '');
      if (name.length < 2 || digits.length < 10 || digits.length > 12) return res.status(400).json({ error: 'bad data' });
      const day = new Date().toISOString().slice(0, 10);
      const lead = { name, phone, clubId: ['c1', 'c2', 'c3', 'c4'].includes(body.clubId) ? body.clubId : '', lang: ['ru', 'kk', 'en'].includes(body.lang) ? body.lang : 'ru', ts: Date.now() };
      await put(`leads/${day}-${digits}.json`, JSON.stringify(lead), { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json' });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST' && op === 'register') {
      const id = str(body.id, 20);
      // The id is derived from the phone number, so they must agree.
      if (!ID.test(id) || str(body.phone, 20).replace(/\D/g, '') !== id.slice(2)) return res.status(400).json({ error: 'bad id' });
      const prev = (await read(id)) || { id, since: new Date().toISOString().slice(0, 10) };
      const next = { ...prev, name: str(body.name, 60) || prev.name || 'Гость', phone: str(body.phone, 20), homeClubId: str(body.homeClubId, 8) || prev.homeClubId || 'c1' };
      if (body.profile && typeof body.profile === 'object') {
        const num = (v, lo, hi) => (Number.isFinite(Number(v)) && Number(v) >= lo && Number(v) <= hi ? Math.round(Number(v)) : undefined);
        const goal = ['lose', 'gain', 'tone', 'strength', 'flex'].includes(body.profile.goal) ? body.profile.goal : undefined;
        next.profile = { age: num(body.profile.age, 10, 100), goal, heightCm: num(body.profile.heightCm, 100, 250), weightKg: num(body.profile.weightKg, 30, 300) };
      }
      await write(id, next);
      return res.status(200).json({ ok: true, membership: next.membership ?? null });
    }

    if (req.method === 'GET' && op === 'me') {
      const id = str(req.query.id, 20);
      if (!ID.test(id)) return res.status(400).json({ error: 'bad id' });
      const c = await read(id);
      return res.status(200).json({ membership: c?.membership ?? null });
    }

    if (!authed(req)) return res.status(401).json({ error: 'code' });

    if (req.method === 'GET' && op === 'leads') {
      const page = await list({ prefix: 'leads/', limit: 200 });
      const all = await Promise.all(page.blobs.map(async (b) => {
        const r = await get(b.pathname, { access: 'private', useCache: false }).catch(() => null);
        return r && r.statusCode === 200 ? new Response(r.stream).json() : null;
      }));
      return res.status(200).json({ leads: all.filter(Boolean).sort((a, b) => b.ts - a.ts) });
    }

    if (req.method === 'GET' && op === 'list') {
      const blobs = [];
      let cursor;
      do {
        const page = await list({ prefix: 'clients/', cursor, limit: 500 });
        blobs.push(...page.blobs);
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor && blobs.length < 2000);
      const all = await Promise.all(blobs.map((b) => read(b.pathname.slice(8, -5))));
      return res.status(200).json({ clients: all.filter(Boolean).sort((a, b) => String(b.since).localeCompare(String(a.since))) });
    }

    // Entry/exit of a client at a club. The server clock is the source of truth for the 3-hour visit.
    if (req.method === 'POST' && (op === 'checkin' || op === 'checkout')) {
      const id = str(body.id, 20);
      if (!ID.test(id)) return res.status(400).json({ error: 'bad id' });
      const prev = await read(id);
      if (!prev) return res.status(404).json({ error: 'unknown client' });
      const session = op === 'checkin' ? { clubId: str(body.clubId, 8) || 'c1', inTs: Date.now() } : prev.session ? { ...prev.session, outTs: Date.now() } : undefined;
      await write(id, { ...prev, session });
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
