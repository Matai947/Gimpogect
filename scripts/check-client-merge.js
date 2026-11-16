// Self-check: a plan sold and a photo saved for the same client at the same moment must both survive.
// Runs the real API against an in-memory database: node scripts/check-client-merge.js
const assert = require('assert');
Object.assign(process.env, { OWNER_CODE: 'owner-test', TOKEN_SECRET: 'x'.repeat(32), DB_REST_URL: 'http://db.test' });

const clients = new Map([['u_77010000000', { id: 'u_77010000000', name: 'Тест', phone: '+7 701 000 00 00', homeClubId: 'c1', since: '2026-11-01' }]]);
const settings = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
global.fetch = async (url, init = {}) => {
  const u = new URL(url);
  const path = u.pathname.slice(1);
  const q = u.searchParams;
  const ok = (body) => ({ ok: true, status: 200, text: async () => (body === undefined ? '' : JSON.stringify(body)) });
  await sleep(20); // every round trip takes time, so two requests interleave
  if (path === 'clients') {
    const id = (q.get('id') || '').replace(/^eq\./, '');
    if (!init.method) return ok(clients.has(id) ? [{ data: clients.get(id) }] : []);
    const row = JSON.parse(init.body);
    clients.set(row.id, row.data);
    return ok();
  }
  if (path === 'settings') {
    const key = (q.get('key') || '').replace(/^eq\./, '');
    if (!init.method) return ok(settings.has(key) ? [{ data: settings.get(key) }] : []);
    if (init.method === 'POST') {
      const row = JSON.parse(init.body);
      settings.set(row.key, row.data);
      return ok(/representation/.test(init.headers?.prefer || '') ? [row] : undefined);
    }
    return ok([]);
  }
  return ok([]);
};

const handler = require('../api/clients.js');
const call = (op, body) =>
  new Promise((done) => {
    const res = { headers: {}, setHeader() {}, status(c) { this.code = c; return this; }, json(d) { done({ code: this.code, d }); }, end() { done({ code: this.code }); } };
    handler({ method: 'POST', query: { op }, headers: { 'x-code': 'owner-test' }, body: JSON.stringify(body) }, res);
  });

(async () => {
  const membership = { planId: 'i2', startDate: '2026-11-16', endDate: '2026-12-16', freezeDaysLeft: 5, freezesLeft: 1 };
  const [grant, photo] = await Promise.all([
    call('grant', { id: 'u_77010000000', membership, gid: 'Gtest000001' }),
    call('photo-set', { id: 'u_77010000000', photo: 'data:image/jpeg;base64,AAAA' }),
  ]);
  assert.equal(grant.code, 200, JSON.stringify(grant));
  assert.equal(photo.code, 200, JSON.stringify(photo));
  const c = clients.get('u_77010000000');
  assert.equal(c.membership?.endDate, '2026-12-16', 'the plan was lost under the photo');
  assert.ok(c.photoAt, 'the photo mark was lost under the plan');
  assert.deepEqual(c.grantIds, ['Gtest000001']);
  console.log('ok: plan and photo both kept');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
