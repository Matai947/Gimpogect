// Self-check: a plan sold and a photo saved for the same client at the same moment must both survive;
// a new phone number moves the card with its pass, checks, visits and photo.
// Runs the real API against an in-memory database: node scripts/check-client-merge.js
const assert = require('assert');
Object.assign(process.env, { OWNER_CODE: 'owner-test', TOKEN_SECRET: 'x'.repeat(32), DB_REST_URL: 'http://db.test' });

const clients = new Map([['u_77010000000', { id: 'u_77010000000', name: 'Тест', phone: '+7 701 000 00 00', homeClubId: 'c1', since: '2026-11-01' }]]);
const settings = new Map();
const sales = new Map([['S1', { id: 'S1', memberId: 'u_77010000000', amount: 15000 }], ['S2', { id: 'S2', memberId: 'u_77020000000', amount: 500 }]]);
const visits = [{ member: 'u_77010000000' }, { member: 'u_77020000000' }];
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
    if (init.method === 'DELETE') return clients.delete(id), ok();
    const row = JSON.parse(init.body);
    clients.set(row.id, row.data);
    return ok();
  }
  if (path === 'sales') {
    const who = (q.get('data->>memberId') || '').replace(/^eq\./, '');
    if (!init.method) return ok(q.get('offset') && q.get('offset') !== '0' ? [] : [...sales.values()].filter((x) => !who || x.memberId === who).map((x) => ({ id: x.id, data: x })));
    if (init.method === 'PATCH') sales.set(q.get('id').replace(/^eq\./, ''), JSON.parse(init.body).data);
    return ok();
  }
  if (path === 'visits') {
    const who = (q.get('member') || '').replace(/^eq\./, '');
    if (init.method === 'POST') visits.push(JSON.parse(init.body));
    if (init.method === 'PATCH') visits.filter((v) => v.member === who).forEach((v) => (v.member = JSON.parse(init.body).member));
    return ok();
  }
  if (path === 'settings' && init.method === 'DELETE') {
    settings.delete((q.get('key') || '').replace(/^eq\./, ''));
    return ok();
  }
  if (path === 'settings') {
    const key = (q.get('key') || '').replace(/^eq\./, '');
    if (!init.method && key.startsWith('like.')) return ok([...settings].filter(([k]) => k.startsWith(key.slice(5, -1))).map(([, data]) => ({ data })));
    if (!init.method) return ok(settings.has(key) ? [{ data: settings.get(key) }] : []);
    if (init.method === 'POST') {
      const row = JSON.parse(init.body);
      settings.set(row.key, row.data);
      return ok(/representation/.test(init.headers?.prefer || '') ? [row] : undefined);
    }
    if (init.method === 'PATCH') {
      const data = JSON.parse(init.body).data;
      settings.set(key, data);
      return ok([{ key, data }]);
    }
    return ok([]);
  }
  return ok([]);
};

const handler = require('../api/clients.js');
const send = (method, op, body, headers, query = {}) =>
  new Promise((done) => {
    const res = { headers: {}, setHeader() {}, status(c) { this.code = c; return this; }, json(d) { done({ code: this.code, d }); }, end() { done({ code: this.code }); } };
    handler({ method, query: { op, ...query }, headers, body: JSON.stringify(body ?? {}) }, res);
  });
const call = (op, body) => send('POST', op, body, { 'x-code': 'owner-test' });

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

  // a new phone number: the card, its pass, checks, visits and photo move; another client's are not touched
  const moved = await call('client-rephone', { id: 'u_77010000000', phone: '8 705 111 22 33' });
  assert.equal(moved.code, 200, JSON.stringify(moved));
  assert.equal(clients.has('u_77010000000'), false, 'the old card is still there');
  const n = clients.get('u_77051112233');
  assert.equal(n?.membership?.endDate, '2026-12-16', 'the pass did not move');
  assert.equal(n.phone, '+7 705 111 22 33');
  assert.equal(sales.get('S1').memberId, 'u_77051112233', 'the check did not move');
  assert.equal(sales.get('S2').memberId, 'u_77020000000', 'another client was touched');
  assert.deepEqual(visits.map((v) => v.member), ['u_77051112233', 'u_77020000000']);
  assert.ok(settings.has('photo:u_77051112233') && !settings.has('photo:u_77010000000'), 'the photo did not move');
  const taken = await call('client-rephone', { id: 'u_77051112233', phone: '+7 705 111 22 33' });
  assert.equal(taken.code, 400, 'the same number must be refused');
  console.log('ok: phone change moves the card with everything');

  // the old number's token stops working after the move (a phone kept by someone else cannot open its next owner)
  const reg = await send('POST', 'register', { id: 'u_77030000000', name: 'Старый', phone: '+7 703 000 00 00', homeClubId: 'c1', password: 'secret1' }, {});
  assert.ok(reg.d?.token, JSON.stringify(reg));
  assert.equal((await send('GET', 'qr', null, { 'x-token': reg.d.token }, { id: 'u_77030000000' })).code, 200, 'the token should work before the move');
  assert.equal((await call('client-rephone', { id: 'u_77030000000', phone: '8 705 999 88 77' })).code, 200);
  assert.equal((await send('GET', 'qr', null, { 'x-token': reg.d.token }, { id: 'u_77030000000' })).code, 401, 'the old token still works');
  // two moves to one free number at the same moment: one wins, the other is refused
  clients.set('u_77040000000', { id: 'u_77040000000', name: 'A', phone: '' });
  clients.set('u_77050000000', { id: 'u_77050000000', name: 'B', phone: '' });
  const both = await Promise.all([call('client-rephone', { id: 'u_77040000000', phone: '8 777 123 45 67' }), call('client-rephone', { id: 'u_77050000000', phone: '8 777 123 45 67' })]);
  assert.deepEqual(both.map((r) => r.code).sort(), [200, 409], JSON.stringify(both));
  console.log('ok: old token revoked, one number cannot be taken twice');

  // a sign-up and a card moved to the same number at the same moment: one wins, and the moved card is never taken over
  clients.set('u_77060000000', { id: 'u_77060000000', name: 'Владелец абонемента', phone: '', membership: { planId: 'i2', endDate: '2026-12-31' } });
  const [moveRes, signUp] = await Promise.all([
    call('client-rephone', { id: 'u_77060000000', phone: '8 701 555 66 77' }),
    send('POST', 'register', { id: 'u_77015556677', name: 'Чужой', phone: '+7 701 555 66 77', homeClubId: 'c1', password: 'secret2' }, {}),
  ]);
  assert.deepEqual([moveRes.code, signUp.code].sort(), [200, 409], JSON.stringify([moveRes, signUp]));
  const won = clients.get('u_77015556677');
  if (moveRes.code === 200) assert.equal(won.name, 'Владелец абонемента', 'the sign-up took over the moved card');
  else assert.ok(!won.membership, 'the moved pass landed on the stranger');
  console.log('ok: a sign-up never takes over a card moved to its number');

  // entry without a pass: only the manager or the owner allows it, and the entry is logged as 'free'
  clients.set('u_77070000000', { id: 'u_77070000000', name: 'Без абонемента', phone: '' });
  assert.notEqual((await send('POST', 'free-entry', { id: 'u_77070000000', on: true }, {})).code, 200, 'anyone may allow free entry');
  assert.equal((await call('free-entry', { id: 'u_77070000000', on: true })).code, 200);
  assert.ok(clients.get('u_77070000000').freeEntry, 'free entry not saved');
  assert.equal((await call('checkin', { id: 'u_77070000000', clubId: 'c1' })).code, 200);
  assert.equal(visits[visits.length - 1].kind, 'free', 'the entry was not logged as free');
  assert.equal((await call('free-entry', { id: 'u_77070000000', on: false })).code, 200);
  assert.ok(!clients.get('u_77070000000').freeEntry, 'free entry not taken back');
  console.log('ok: entry without a pass is allowed by the manager only and logged');

  // goods received at the desk are added to the shelf; the count after the shift works out the shortage
  const line = { id: 'p1', name: 'Батончик', price: 800 };
  assert.equal((await call('stock-receive', { clubId: 'c1', staff: 'Тест', counts: [{ ...line, n: 10 }] })).code, 200);
  assert.equal(settings.get('content:stock').v.c1.p1, 10, 'the delivery was not added');
  assert.equal((await call('stock-receive', { clubId: 'c1', staff: 'Тест', counts: [{ ...line, n: 5 }] })).code, 200);
  assert.equal(settings.get('content:stock').v.c1.p1, 15, 'the second delivery was not added');
  const counted = await call('stock-revision', { clubId: 'c1', staff: 'Тест', counts: [{ ...line, n: 12 }] });
  assert.equal(counted.code, 200);
  assert.deepEqual([counted.d.revision.lines[0].was, counted.d.revision.lines[0].n], [15, 12], 'the shortage was not worked out');
  assert.equal(settings.get('content:stock').v.c1.p1, 12, 'the shelf was not set to the count');
  // a delivery typed as what is in the hall now: the server works out how many came, never takes any away
  assert.equal((await call('stock-receive', { clubId: 'c1', staff: 'Тест', counts: [{ ...line, has: 20 }] })).code, 200);
  assert.equal(settings.get('content:stock').v.c1.p1, 20, 'the hall count was not set');
  assert.equal([...settings].filter(([k]) => k.startsWith('stockin:')).map(([, d]) => d.lines[0].n).pop(), 8, 'the delivery was not worked out');
  assert.equal((await call('stock-receive', { clubId: 'c1', staff: 'Тест', counts: [{ ...line, has: 3 }] })).code, 400, 'a delivery took goods away');
  assert.equal(settings.get('content:stock').v.c1.p1, 20, 'a smaller hall count changed the shelf');
  const opened = await call('stock-revision', { clubId: 'c1', staff: 'Тест', kind: 'start', counts: [{ ...line, n: 20 }] });
  assert.equal(opened.d.revision.kind, 'start', 'the shift start count is not marked');
  console.log('ok: receiving adds to the shelf, the count shows the shortage');

  // the manager sets a new code for an ordinary admin, but cannot touch another manager or remove anyone
  const mk = async (name, code, role) => (await call('admin-save', { name, code, role })).d.id;
  const desk = await mk('Админ', '111111', 'admin');
  const boss = await mk('Управ', '222222', 'manager');
  const token = async (code) => (await call('staff-login', { code })).d.token;
  const bossT = await token('222222');
  const asBoss = (op, b) => send('POST', op, b, { 'x-code': bossT });
  assert.equal((await asBoss('admin-save', { id: desk, name: 'Взлом', code: '333333', role: 'manager' })).code, 200);
  const deskNow = settings.get('admin:' + desk);
  assert.deepEqual([deskNow.name, deskNow.role], ['Админ', 'admin'], 'the manager changed more than the code');
  assert.equal(deskNow.codeBy, 'Управ', 'the owner cannot see who set the code');
  assert.equal((await send('POST', 'admin-save', { id: desk, name: 'Админ', code: '444444' }, { 'x-code': await token('333333') })).code, 403, 'an admin changed codes');
  assert.equal((await asBoss('admin-save', { id: boss, name: 'Управ', code: '555555' })).code, 403, 'the manager changed a manager');
  assert.equal((await asBoss('admin-save', { name: 'Новый', code: '666666' })).code, 403, 'the manager added an admin');
  assert.equal((await asBoss('admin-del', { id: desk })).code, 403, 'the manager removed an admin');
  console.log('ok: the manager changes only ordinary admins\' codes');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
