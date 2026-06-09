'use strict';
/* Boots the app on a test port and exercises the main endpoints. Run: npm run smoke */
process.env.PORT = process.env.SMOKE_PORT || '3210';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sandton1234';
require('./server');

const BASE = `http://localhost:${process.env.PORT}`;
const results = [];
const ok = (name, cond, extra = '') => { results.push({ name, cond, extra }); };

async function j(path, opts) { const r = await fetch(BASE + path, opts); let d = null; try { d = await r.json(); } catch {} return { status: r.status, d }; }

(async () => {
  await new Promise(r => setTimeout(r, 600));
  try {
    let r = await j('/api/health'); ok('health', r.status === 200 && r.d.ok);
    r = await j('/api/menu'); ok('menu has items', r.status === 200 && r.d.categories.reduce((a, c) => a + c.items.length, 0) > 0, 'items=' + r.d.categories.reduce((a, c) => a + c.items.length, 0));
    r = await j('/api/spots'); ok('15 spots', r.d.spots.length === 15, 'spots=' + r.d.spots.length);
    r = await j('/api/settings'); ok('settings', !!r.d.contact && !!r.d.hours);

    const date = '2030-01-01', slot = '20:00';
    r = await j('/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, slot, spotId: 'g1', guests: 3, name: 'تست', phone: '09120000000' }) });
    ok('reservation create', r.status === 200 && r.d.ok, r.d && r.d.code);
    r = await j('/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, slot, spotId: 'g1', guests: 3, name: 'تست۲', phone: '09120000001' }) });
    ok('double-booking blocked (409)', r.status === 409);

    r = await j('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ id: 1, qty: 2 }], name: 'تست', phone: '09120000000', type: 'dinein' }) });
    ok('order create', r.status === 200 && r.d.ok, 'total=' + (r.d && r.d.total));

    r = await j('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'wrong' }) });
    ok('bad login rejected', r.status === 401);
    r = await j('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }) });
    ok('admin login', r.status === 200 && !!r.d.token);
    const token = r.d.token;
    r = await j('/api/admin/stats', { headers: { Authorization: 'Bearer ' + token } });
    ok('admin stats (authed)', r.status === 200 && typeof r.d.items === 'number');
    r = await j('/api/admin/stats'); ok('admin stats blocked (401)', r.status === 401);
  } catch (e) { ok('exception', false, e.message); }

  let pass = true;
  results.forEach(r => { console.log((r.cond ? 'PASS' : 'FAIL') + ' - ' + r.name + (r.extra ? ' [' + r.extra + ']' : '')); if (!r.cond) pass = false; });
  console.log('\n' + (pass ? 'ALL SMOKE TESTS PASSED' : 'SOME SMOKE TESTS FAILED'));
  process.exit(pass ? 0 : 1);
})();
