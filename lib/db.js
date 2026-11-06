'use strict';
// База данных: встроенный SQLite в Node.js (без внешних зависимостей)
process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'ExperimentalWarning') console.warn(w); });

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const { normPhone } = require('./shared');

const DATA_DIR = process.env.CRM_DATA || path.join(__dirname, '..', 'data');
fs.mkdirSync(path.join(DATA_DIR, 'media'), { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'crm.sqlite');

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
db.function('ulower', { deterministic: true }, (s) => (s == null ? null : String(s).toLowerCase().replace(/ё/g, 'е')));

db.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, login TEXT UNIQUE NOT NULL, name TEXT NOT NULL, pass_hash TEXT NOT NULL,
  active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT, phone_norm TEXT, birthday TEXT,
  source TEXT, notes TEXT, discount REAL DEFAULT 0, no_sms INTEGER DEFAULT 0, is_student INTEGER DEFAULT 0, last_visit_import TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone_norm);

CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT, price REAL DEFAULT 0, price_from INTEGER DEFAULT 0,
  duration INTEGER DEFAULT 60, note TEXT, on_site INTEGER DEFAULT 1, sort INTEGER DEFAULT 0, active INTEGER DEFAULT 1);

-- записи календаря: client — клиентка, lesson — занятие обучения, block — личное время
CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY, kind TEXT DEFAULT 'client', client_id INTEGER, cohort_id INTEGER,
  date TEXT NOT NULL, start TEXT NOT NULL, duration INTEGER DEFAULT 60, items TEXT, total REAL DEFAULT 0, discount REAL DEFAULT 0,
  status TEXT DEFAULT 'booked', source TEXT, note TEXT, created_at TEXT DEFAULT (datetime('now','localtime')), done_at TEXT, review_at TEXT);
CREATE INDEX IF NOT EXISTS idx_appt_date ON appointments(date);

CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY, date TEXT NOT NULL, amount REAL NOT NULL, method TEXT DEFAULT 'card',
  kind TEXT DEFAULT 'service', payer TEXT DEFAULT 'person', appointment_id INTEGER, student_id INTEGER, client_id INTEGER,
  comment TEXT, receipt INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY, date TEXT NOT NULL, amount REAL NOT NULL, category TEXT, comment TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')));

CREATE TABLE IF NOT EXISTS courses (id INTEGER PRIMARY KEY, title TEXT NOT NULL, tag TEXT, price REAL DEFAULT 0, price_from INTEGER DEFAULT 1,
  hours INTEGER, program TEXT, on_site INTEGER DEFAULT 1, sort INTEGER DEFAULT 0, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS cohorts (id INTEGER PRIMARY KEY, course_id INTEGER, title TEXT, start_date TEXT, end_date TEXT, schedule TEXT,
  seats INTEGER DEFAULT 4, status TEXT DEFAULT 'open', note TEXT);
CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY, client_id INTEGER, course_id INTEGER, cohort_id INTEGER, price REAL DEFAULT 0,
  status TEXT DEFAULT 'enrolled', cert_no TEXT, note TEXT, created_at TEXT DEFAULT (datetime('now','localtime')));

CREATE TABLE IF NOT EXISTS leads (id INTEGER PRIMARY KEY, name TEXT, phone TEXT, kind TEXT DEFAULT 'service', subject TEXT, message TEXT,
  source TEXT, status TEXT DEFAULT 'new', appointment_id INTEGER, created_at TEXT DEFAULT (datetime('now','localtime')));

CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY, date TEXT, time TEXT, title TEXT, text TEXT, channels TEXT, status TEXT DEFAULT 'idea',
  media TEXT, results TEXT, created_at TEXT DEFAULT (datetime('now','localtime')), published_at TEXT);
CREATE TABLE IF NOT EXISTS works (id INTEGER PRIMARY KEY, photo TEXT, caption TEXT, category TEXT, on_site INTEGER DEFAULT 1, sort INTEGER DEFAULT 0,
  post_id INTEGER, created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY, name TEXT, text TEXT, rating INTEGER DEFAULT 5, date TEXT, on_site INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS time_off (id INTEGER PRIMARY KEY, date_from TEXT NOT NULL, date_to TEXT, note TEXT);

CREATE TABLE IF NOT EXISTS sms_queue (id INTEGER PRIMARY KEY, phone TEXT NOT NULL, text TEXT NOT NULL, kind TEXT DEFAULT 'manual',
  client_id INTEGER, appointment_id INTEGER, status TEXT DEFAULT 'queued', error TEXT, batch TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')), sent_at TEXT);
CREATE INDEX IF NOT EXISTS idx_sms_status ON sms_queue(status, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_auto ON sms_queue(kind, appointment_id) WHERE kind IN ('remind','confirm','review') AND appointment_id IS NOT NULL;
`);

// роли: admin — владелец системы (обновления, домен, ключи, пользователи), master — мастер (вся работа)
if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'role')) db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'admin'");
// must_change — пароль выдан администратором, при первом входе его нужно сменить
if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'must_change')) db.exec('ALTER TABLE users ADD COLUMN must_change INTEGER DEFAULT 0');

const all = (sql, ...p) => db.prepare(sql).all(...p);
const get = (sql, ...p) => db.prepare(sql).get(...p);
const run = (sql, ...p) => db.prepare(sql).run(...p);
const getSetting = (k) => get('SELECT value FROM settings WHERE key=?', k)?.value;
const setSetting = (k, v) => run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, v == null ? '' : String(v));

// Настройки по умолчанию (не перезаписывают уже сохранённые)
const DEFAULTS = {
  master_name: 'Алена Макарова', studio_name: 'Алена Макарова · nail studio', city: 'Канск',
  phone: '+7 (900) 000-00-00', address: 'г. Канск, [адрес студии]', hours_text: 'ежедневно, 10:00–20:00',
  tagline: 'Мастер-инструктор по маникюру',
  social_tg: '', social_wa: '', social_vk: '', social_max: '', review_url: '', site_url: '',
  work_days: '1,2,3,4,5,6', work_from: '10:00', work_to: '20:00', slot_step: '30',
  booking_on: '1', booking_auto: '0', booking_min_hours: '3', booking_days_ahead: '30',
  tax_person: '4', tax_company: '6', npd_limit: '2400000',
  site_on: '1', hero_photo: '/img/alena.jpg', tz: process.env.CRM_TZ || 'Asia/Krasnoyarsk',
  sms_from_hour: '10', sms_to_hour: '20', sms_interval: '40', sms_daily_limit: '100', sms_remind_time: '18:00', sms_correction_days: '21',
  sms_tpl_remind: '{имя}, напоминаю: жду вас {дата} в {время} на {услуга}. Алена, {телефон}',
  sms_tpl_confirm: '{имя}, вы записаны {дата} в {время} на {услуга}. Адрес: {адрес}. Алена',
  sms_tpl_review: '{имя}, спасибо, что были у меня! Буду рада вашему отзыву: {2гис}',
  sms_tpl_correction: '{имя}, прошло 3 недели — самое время обновить маникюр. Записаться: {телефон}. Алена',
  sms_tpl_birthday: '{имя}, с днём рождения! Дарю скидку 10% на любую услугу в течение месяца. Алена, {телефон}',
};
for (const [k, v] of Object.entries(DEFAULTS)) if (getSetting(k) === undefined) setSetting(k, v);
if (!getSetting('api_key')) setSetting('api_key', require('node:crypto').randomBytes(12).toString('hex'));

// Стартовый прайс и курсы (только в пустой базе)
if (get('SELECT COUNT(*) n FROM services').n === 0) {
  const S = [
    ['Маникюр', 'Маникюр без покрытия', 700, 0, 60, 'комбинированный или аппаратный'],
    ['Маникюр', 'Маникюр + гель-лак', 1500, 0, 120, 'укрепление базой, однотон'],
    ['Маникюр', 'Маникюр + выравнивание + гель-лак', 1800, 0, 150, 'ровная архитектура, стойкость'],
    ['Маникюр', 'Наращивание ногтей', 2500, 0, 180, 'длина до 2, однотон'],
    ['Маникюр', 'Коррекция наращивания', 2200, 0, 150, 'с покрытием'],
    ['Маникюр', 'Снятие покрытия', 200, 0, 20, 'работа другого мастера'],
    ['Педикюр', 'Педикюр без покрытия', 1200, 0, 60, 'пальцы и стопы'],
    ['Педикюр', 'Педикюр + гель-лак', 1500, 0, 90, 'обработка пальцев, покрытие'],
    ['Педикюр', 'Полный педикюр + гель-лак', 2000, 0, 120, 'пальцы, стопы, покрытие'],
    ['Педикюр', 'Гель-лак без обработки', 900, 0, 60, 'на чистые ногти'],
    ['Дизайн и ремонт', 'Френч или лунки', 300, 1, 20, 'на все ногти'],
    ['Дизайн и ремонт', 'Втирка, градиент', 300, 0, 15, 'на все ногти'],
    ['Дизайн и ремонт', 'Дизайн одного ногтя', 100, 1, 10, 'роспись, стемпинг, декор'],
    ['Дизайн и ремонт', 'Ремонт одного ногтя', 150, 0, 15, 'восстановление формы'],
  ];
  S.forEach(([c, n, p, pf, d, note], i) => run('INSERT INTO services(category,name,price,price_from,duration,note,sort) VALUES(?,?,?,?,?,?,?)', c, n, p, pf, d, note, i));
}
if (get('SELECT COUNT(*) n FROM courses').n === 0) {
  run('INSERT INTO courses(title,tag,price,hours,program,sort) VALUES(?,?,?,?,?,?)', 'Базовый курс маникюра', 'С нуля', 15000, 40, 'Анатомия и гигиена\nКомбинированный маникюр\nПокрытие гель-лаком\nПрактика на моделях', 1);
  run('INSERT INTO courses(title,tag,price,hours,program,sort) VALUES(?,?,?,?,?,?)', 'Выравнивание и архитектура', 'Повышение', 8000, 16, 'Идеальные блики\nРабота с проблемными ногтями\nСкорость без потери качества', 2);
  run('INSERT INTO courses(title,tag,price,hours,program,sort) VALUES(?,?,?,?,?,?)', 'Мастер-класс один на один', 'Индивидуально', 5000, 6, 'Программа под ваш запрос\nРазбор ваших работ\nГибкий график', 3);
}

module.exports = { db, all, get, run, getSetting, setSetting, normPhone, DATA_DIR, DB_FILE };
