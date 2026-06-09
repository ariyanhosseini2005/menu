'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'sandton.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ===================== Schema =====================
db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  price INTEGER DEFAULT 0,
  image TEXT DEFAULT '',
  popular INTEGER DEFAULT 0,
  available INTEGER DEFAULT 1,
  sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS spots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'gazebo',
  capacity TEXT DEFAULT '',
  emoji TEXT DEFAULT '🛖',
  sort INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  date TEXT NOT NULL,
  slot TEXT NOT NULL,
  spot_id TEXT NOT NULL,
  guests INTEGER DEFAULT 1,
  name TEXT,
  phone TEXT,
  note TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  created_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_booking
  ON reservations(date, slot, spot_id) WHERE status = 'active';
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  items TEXT NOT NULL,
  total INTEGER DEFAULT 0,
  type TEXT DEFAULT 'dinein',
  table_no TEXT DEFAULT '',
  address TEXT DEFAULT '',
  name TEXT,
  phone TEXT,
  note TEXT DEFAULT '',
  status TEXT DEFAULT 'new',
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  rating INTEGER DEFAULT 5,
  text TEXT NOT NULL,
  approved INTEGER DEFAULT 0,
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  created_at INTEGER
);
`);

// ===================== Settings helpers =====================
function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return row.value; }
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value));
}

// ===================== Password hashing =====================
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, salt, hash) {
  const cand = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(cand, 'hex'), Buffer.from(hash, 'hex'));
}

// ===================== Seed =====================
const POPULAR = new Set(['شیشلیک', 'پیتزا اسپیشیال سندتن', 'برگر مخصوص', 'استیک گوشت', 'اسپیشل کراش اسنیکرز', 'موهیتو']);

function seed(force = false) {
  const count = db.prepare('SELECT COUNT(*) c FROM categories').get().c;
  if (count > 0 && !force) return;

  if (force) {
    db.exec('DELETE FROM items; DELETE FROM categories; DELETE FROM spots;');
  }

  // Menu from extracted JSON
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-menu.json'), 'utf8'));
  const insCat = db.prepare('INSERT INTO categories(name, sort) VALUES(?, ?)');
  const insItem = db.prepare('INSERT INTO items(category_id, title, price, image, popular, available, sort) VALUES(?, ?, ?, ?, ?, 1, ?)');
  const seedMenu = db.transaction(() => {
    raw.categories.forEach((cat, ci) => {
      const catId = insCat.run(cat.category, ci).lastInsertRowid;
      cat.items.forEach((it, ii) => {
        const price = parseInt(String(it.price || '').replace(/[^\d]/g, ''), 10) || 0;
        const image = raw.images[it.title] || '';
        insItem.run(catId, it.title, price, image, POPULAR.has(it.title) ? 1 : 0, ii);
      });
    });
  });
  seedMenu();

  // Spots: 14 gazebos + dining hall
  const insSpot = db.prepare('INSERT INTO spots(id, name, type, capacity, emoji, sort, active) VALUES(?, ?, ?, ?, ?, ?, 1)');
  const faDigits = n => n.toLocaleString('fa-IR');
  const seedSpots = db.transaction(() => {
    for (let i = 1; i <= 14; i++) insSpot.run('g' + i, 'آلاچیق ' + faDigits(i), 'gazebo', '۴ تا ۸ نفر', '🛖', i);
    insSpot.run('hall', 'سالن غذاخوری', 'hall', 'مناسب جمع‌های بزرگ', '🏛️', 99);
  });
  if (force) db.exec("DELETE FROM spots");
  seedSpots();

  // Reviews
  if (db.prepare('SELECT COUNT(*) c FROM reviews').get().c === 0) {
    const insRev = db.prepare('INSERT INTO reviews(name, rating, text, approved, created_at) VALUES(?, ?, ?, 1, ?)');
    const now = Date.now();
    [
      ['نگار م.', 5, 'فضای آلاچیق‌ها فوق‌العاده دنج بود، شیشلیک‌شون هم عالی بود!'],
      ['امیر ر.', 5, 'رزرو آنلاین خیلی راحت بود و پیتزا اسپیشیال واقعاً محشره.'],
      ['سارا ک.', 4, 'قهوه و دسر عالی، پرسنل خوش‌برخورد. حتماً دوباره میایم.'],
      ['حسین ط.', 5, 'بهترین جا برای دورهمی خانوادگی؛ محیط آروم و تمیز.']
    ].forEach(r => insRev.run(r[0], r[1], r[2], now));
  }
}

function seedSettings() {
  if (getSetting('contact') === null) {
    setSetting('contact', {
      phone: '09378938200',
      phoneDisplay: '0937 893 8200',
      instagram: 'sandton.garden',
      whatsapp: '989378938200',
      address: 'به‌زودی تکمیل می‌شود',
      mapUrl: 'https://www.google.com/maps/search/sandton+garden'
    });
  }
  if (getSetting('hours') === null) {
    setSetting('hours', {
      defaultStart: 18, fridayStart: 12, end: 24,
      text: [
        { day: 'یکشنبه تا پنجشنبه', time: '۱۸:۰۰ تا ۲۴:۰۰' },
        { day: 'جمعه', time: '۱۲:۰۰ تا ۲۴:۰۰' },
        { day: 'شنبه', time: '۱۸:۰۰ تا ۲۴:۰۰' }
      ]
    });
  }
  if (getSetting('hero') === null) {
    setSetting('hero', {
      title: 'طعمی که ماندگار می‌شود',
      subtitle: 'تجربه‌ای متفاوت از غذا، نوشیدنی و فضای دنج آلاچیق‌ها در دل طبیعت.',
      kicker: 'به سندتن گاردن خوش آمدید'
    });
  }
  if (getSetting('priceUnit') === null) setSetting('priceUnit', 'تومان');

  if (getSetting('admin') === null) {
    const pwd = process.env.ADMIN_PASSWORD || 'sandton1234';
    setSetting('admin', hashPassword(pwd));
  }
}

seed(false);
seedSettings();

if (require.main === module && process.argv.includes('--reseed')) {
  seed(true);
  console.log('Database reseeded.');
}

module.exports = { db, getSetting, setSetting, hashPassword, verifyPassword };
