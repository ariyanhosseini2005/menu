'use strict';
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { db, getSetting, setSetting, hashPassword, verifyPassword } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

// ===================== Helpers =====================
const now = () => Date.now();
const code = (prefix) => prefix + Date.now().toString(36).toUpperCase() + crypto.randomBytes(1).toString('hex').toUpperCase();
const isMobile = (p) => /^0?9\d{9}$/.test(String(p || '').trim());
const clean = (s) => String(s == null ? '' : s).trim();
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function publicMenu() {
  const cats = db.prepare('SELECT id, name, sort FROM categories ORDER BY sort, id').all();
  const itemsStmt = db.prepare('SELECT id, title, description, price, image, popular, available, sort FROM items WHERE category_id = ? ORDER BY sort, id');
  return cats.map(c => ({
    id: c.id, name: c.name,
    items: itemsStmt.all(c.id).map(i => ({
      id: i.id, title: i.title, description: i.description, price: i.price,
      image: i.image, popular: !!i.popular, available: !!i.available
    }))
  }));
}

// ===================== Auth =====================
function login(password) {
  const admin = getSetting('admin');
  if (!admin || !verifyPassword(password, admin.salt, admin.hash)) return null;
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions(token, created_at) VALUES(?, ?)').run(token, now());
  return token;
}
function authMiddleware(req, res, next) {
  const hdr = req.headers['authorization'] || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : (req.headers['x-admin-token'] || '');
  const row = token && db.prepare('SELECT token, created_at FROM sessions WHERE token = ?').get(token);
  // expire after 7 days
  if (!row || now() - row.created_at > 7 * 24 * 3600 * 1000) return res.status(401).json({ error: 'unauthorized' });
  req.token = token;
  next();
}

// ===================== Public API =====================
app.get('/api/health', (req, res) => res.json({ ok: true, time: now() }));

app.get('/api/menu', (req, res) => res.json({ categories: publicMenu() }));

app.get('/api/spots', (req, res) => {
  res.json({ spots: db.prepare('SELECT id, name, type, capacity, emoji, sort FROM spots WHERE active = 1 ORDER BY sort, id').all() });
});

app.get('/api/settings', (req, res) => {
  res.json({
    contact: getSetting('contact'),
    hours: getSetting('hours'),
    hero: getSetting('hero'),
    priceUnit: getSetting('priceUnit', 'تومان')
  });
});

app.get('/api/reviews', (req, res) => {
  res.json({ reviews: db.prepare('SELECT name, rating, text FROM reviews WHERE approved = 1 ORDER BY created_at DESC LIMIT 30').all() });
});

app.post('/api/reviews', (req, res) => {
  const name = clean(req.body.name), text = clean(req.body.text);
  const rating = Math.max(1, Math.min(5, parseInt(req.body.rating, 10) || 5));
  if (!name || !text) return res.status(400).json({ error: 'نام و متن نظر الزامی است.' });
  db.prepare('INSERT INTO reviews(name, rating, text, approved, created_at) VALUES(?, ?, ?, 0, ?)').run(name.slice(0, 40), rating, text.slice(0, 400), now());
  res.json({ ok: true, message: 'نظر شما ثبت شد و پس از تأیید نمایش داده می‌شود.' });
});

app.get('/api/availability', (req, res) => {
  const date = clean(req.query.date), slot = clean(req.query.slot);
  if (!date || !slot) return res.status(400).json({ error: 'date و slot الزامی است.' });
  const taken = db.prepare("SELECT spot_id FROM reservations WHERE date = ? AND slot = ? AND status = 'active'").all(date, slot).map(r => r.spot_id);
  res.json({ taken });
});

app.post('/api/reservations', (req, res) => {
  const date = clean(req.body.date), slot = clean(req.body.slot), spotId = clean(req.body.spotId);
  const guests = Math.max(1, Math.min(60, parseInt(req.body.guests, 10) || 1));
  const name = clean(req.body.name), phone = clean(req.body.phone), note = clean(req.body.note).slice(0, 300);
  if (!date || !slot || !spotId) return res.status(400).json({ error: 'تاریخ، ساعت و محل الزامی است.' });
  if (date < todayStr()) return res.status(400).json({ error: 'تاریخ نمی‌تواند گذشته باشد.' });
  if (!name) return res.status(400).json({ error: 'نام الزامی است.' });
  if (!isMobile(phone)) return res.status(400).json({ error: 'شماره موبایل معتبر وارد کنید.' });
  const spot = db.prepare('SELECT id FROM spots WHERE id = ? AND active = 1').get(spotId);
  if (!spot) return res.status(404).json({ error: 'محل انتخابی یافت نشد.' });
  const c = code('R');
  try {
    db.prepare('INSERT INTO reservations(code, date, slot, spot_id, guests, name, phone, note, status, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, \'active\', ?)')
      .run(c, date, slot, spotId, guests, name, phone, note, now());
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'این محل برای تاریخ و ساعت انتخابی قبلاً رزرو شده است.' });
    throw e;
  }
  res.json({ ok: true, code: c, message: 'رزرو با موفقیت ثبت شد.' });
});

app.post('/api/reservations/cancel', (req, res) => {
  const c = clean(req.body.code), phone = clean(req.body.phone);
  const r = db.prepare('SELECT * FROM reservations WHERE code = ?').get(c);
  if (!r) return res.status(404).json({ error: 'رزرو یافت نشد.' });
  if (clean(r.phone) !== phone) return res.status(403).json({ error: 'شماره تماس با این رزرو مطابقت ندارد.' });
  db.prepare("UPDATE reservations SET status = 'cancelled' WHERE code = ?").run(c);
  res.json({ ok: true, message: 'رزرو لغو شد.' });
});

app.post('/api/orders', (req, res) => {
  const list = Array.isArray(req.body.items) ? req.body.items : [];
  if (!list.length) return res.status(400).json({ error: 'سبد خرید خالی است.' });
  const getItem = db.prepare('SELECT id, title, price FROM items WHERE id = ? AND available = 1');
  let total = 0; const resolved = [];
  for (const row of list) {
    const it = getItem.get(parseInt(row.id, 10));
    const qty = Math.max(1, Math.min(99, parseInt(row.qty, 10) || 1));
    if (!it) continue;
    total += (it.price || 0) * qty;
    resolved.push({ id: it.id, title: it.title, price: it.price, qty });
  }
  if (!resolved.length) return res.status(400).json({ error: 'هیچ آیتم معتبری در سفارش نبود.' });
  const type = ['dinein', 'takeaway', 'delivery'].includes(req.body.type) ? req.body.type : 'dinein';
  const name = clean(req.body.name), phone = clean(req.body.phone);
  if (!name) return res.status(400).json({ error: 'نام الزامی است.' });
  if (!isMobile(phone)) return res.status(400).json({ error: 'شماره موبایل معتبر وارد کنید.' });
  const c = code('O');
  db.prepare('INSERT INTO orders(code, items, total, type, table_no, address, name, phone, note, status, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, \'new\', ?)')
    .run(c, JSON.stringify(resolved), total, type, clean(req.body.table).slice(0, 20), clean(req.body.address).slice(0, 300), name, phone, clean(req.body.note).slice(0, 300), now());
  res.json({ ok: true, code: c, total, message: 'سفارش شما ثبت شد.' });
});

// ===================== Admin API =====================
app.post('/api/admin/login', (req, res) => {
  const token = login(clean(req.body.password));
  if (!token) return res.status(401).json({ error: 'رمز عبور اشتباه است.' });
  res.json({ ok: true, token });
});
app.post('/api/admin/logout', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
  res.json({ ok: true });
});
app.get('/api/admin/me', authMiddleware, (req, res) => res.json({ ok: true }));

app.post('/api/admin/password', authMiddleware, (req, res) => {
  const np = clean(req.body.password);
  if (np.length < 6) return res.status(400).json({ error: 'رمز باید حداقل ۶ کاراکتر باشد.' });
  setSetting('admin', hashPassword(np));
  db.prepare('DELETE FROM sessions WHERE token != ?').run(req.token);
  res.json({ ok: true });
});

// --- Menu management ---
app.get('/api/admin/menu', authMiddleware, (req, res) => res.json({ categories: publicMenu() }));

app.post('/api/admin/categories', authMiddleware, (req, res) => {
  const name = clean(req.body.name);
  if (!name) return res.status(400).json({ error: 'نام دسته الزامی است.' });
  const maxSort = db.prepare('SELECT COALESCE(MAX(sort), 0) m FROM categories').get().m;
  const id = db.prepare('INSERT INTO categories(name, sort) VALUES(?, ?)').run(name, maxSort + 1).lastInsertRowid;
  res.json({ ok: true, id });
});
app.put('/api/admin/categories/:id', authMiddleware, (req, res) => {
  const { name, sort } = req.body;
  db.prepare('UPDATE categories SET name = COALESCE(?, name), sort = COALESCE(?, sort) WHERE id = ?')
    .run(name != null ? clean(name) : null, sort != null ? parseInt(sort, 10) : null, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/categories/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/admin/items', authMiddleware, (req, res) => {
  const categoryId = parseInt(req.body.categoryId, 10);
  const title = clean(req.body.title);
  if (!categoryId || !title) return res.status(400).json({ error: 'دسته و نام آیتم الزامی است.' });
  const maxSort = db.prepare('SELECT COALESCE(MAX(sort), 0) m FROM items WHERE category_id = ?').get(categoryId).m;
  const id = db.prepare('INSERT INTO items(category_id, title, description, price, image, popular, available, sort) VALUES(?, ?, ?, ?, ?, ?, ?, ?)')
    .run(categoryId, title, clean(req.body.description), parseInt(req.body.price, 10) || 0, clean(req.body.image),
      req.body.popular ? 1 : 0, req.body.available === false ? 0 : 1, maxSort + 1).lastInsertRowid;
  res.json({ ok: true, id });
});
app.put('/api/admin/items/:id', authMiddleware, (req, res) => {
  const b = req.body;
  const cur = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'آیتم یافت نشد.' });
  db.prepare('UPDATE items SET title=?, description=?, price=?, image=?, popular=?, available=?, category_id=?, sort=? WHERE id=?')
    .run(
      b.title != null ? clean(b.title) : cur.title,
      b.description != null ? clean(b.description) : cur.description,
      b.price != null ? (parseInt(b.price, 10) || 0) : cur.price,
      b.image != null ? clean(b.image) : cur.image,
      b.popular != null ? (b.popular ? 1 : 0) : cur.popular,
      b.available != null ? (b.available ? 1 : 0) : cur.available,
      b.categoryId != null ? parseInt(b.categoryId, 10) : cur.category_id,
      b.sort != null ? parseInt(b.sort, 10) : cur.sort,
      req.params.id
    );
  res.json({ ok: true });
});
app.delete('/api/admin/items/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- Spots management ---
app.get('/api/admin/spots', authMiddleware, (req, res) => {
  res.json({ spots: db.prepare('SELECT * FROM spots ORDER BY sort, id').all() });
});
app.put('/api/admin/spots/:id', authMiddleware, (req, res) => {
  const b = req.body;
  const cur = db.prepare('SELECT * FROM spots WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'محل یافت نشد.' });
  db.prepare('UPDATE spots SET name=?, capacity=?, emoji=?, active=? WHERE id=?')
    .run(b.name != null ? clean(b.name) : cur.name, b.capacity != null ? clean(b.capacity) : cur.capacity,
      b.emoji != null ? clean(b.emoji) : cur.emoji, b.active != null ? (b.active ? 1 : 0) : cur.active, req.params.id);
  res.json({ ok: true });
});

// --- Reservations / Orders / Reviews ---
app.get('/api/admin/reservations', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM reservations ORDER BY created_at DESC LIMIT 500').all();
  const spotName = {}; db.prepare('SELECT id, name FROM spots').all().forEach(s => spotName[s.id] = s.name);
  res.json({ reservations: rows.map(r => ({ ...r, spotName: spotName[r.spot_id] || r.spot_id })) });
});
app.patch('/api/admin/reservations/:id', authMiddleware, (req, res) => {
  const status = ['active', 'cancelled', 'done'].includes(req.body.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: 'وضعیت نامعتبر.' });
  try {
    db.prepare('UPDATE reservations SET status = ? WHERE id = ?').run(status, req.params.id);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'تداخل با رزرو فعال دیگر.' });
    throw e;
  }
  res.json({ ok: true });
});

app.get('/api/admin/orders', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 500').all();
  res.json({ orders: rows.map(o => ({ ...o, items: JSON.parse(o.items) })) });
});
app.patch('/api/admin/orders/:id', authMiddleware, (req, res) => {
  const status = ['new', 'preparing', 'ready', 'done', 'cancelled'].includes(req.body.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: 'وضعیت نامعتبر.' });
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/reviews', authMiddleware, (req, res) => {
  res.json({ reviews: db.prepare('SELECT * FROM reviews ORDER BY created_at DESC LIMIT 200').all() });
});
app.patch('/api/admin/reviews/:id', authMiddleware, (req, res) => {
  db.prepare('UPDATE reviews SET approved = ? WHERE id = ?').run(req.body.approved ? 1 : 0, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/reviews/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- Settings ---
app.put('/api/admin/settings', authMiddleware, (req, res) => {
  const allowed = ['contact', 'hours', 'hero', 'priceUnit'];
  for (const k of allowed) if (req.body[k] !== undefined) setSetting(k, req.body[k]);
  res.json({ ok: true });
});

app.get('/api/admin/stats', authMiddleware, (req, res) => {
  res.json({
    items: db.prepare('SELECT COUNT(*) c FROM items').get().c,
    reservationsActive: db.prepare("SELECT COUNT(*) c FROM reservations WHERE status='active'").get().c,
    ordersNew: db.prepare("SELECT COUNT(*) c FROM orders WHERE status='new'").get().c,
    reviewsPending: db.prepare('SELECT COUNT(*) c FROM reviews WHERE approved=0').get().c
  });
});

// ===================== Static frontend =====================
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
  res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'), (e) => { if (e) res.end('Not found'); });
});

app.listen(PORT, () => console.log(`Sandton Garden running at http://localhost:${PORT}`));

module.exports = app;
