'use strict';
// API CRM. Данные небольшие (один мастер), поэтому CRM загружает всё разом (/api/data),
// а изменения идут через общие операции с таблицами (/api/t/:table) плюс специальные действия.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { db, all, get, run, getSetting, setSetting, normPhone, DATA_DIR } = require('./db');
const { createRouter, HttpError } = require('./http');
const auth = require('./auth');
const shared = require('./shared');
const sms = require('./sms');
const ai = require('./ai');
const social = require('./social');

const r = createRouter();
const PUBLIC = { public: true };
const ADMIN = { admin: true };

// ---------- таблицы ----------
const TABLES = ['clients', 'services', 'appointments', 'payments', 'expenses', 'courses', 'cohorts', 'students', 'leads', 'posts', 'works', 'reviews', 'time_off'];
const JSON_COLS = { appointments: ['items'], posts: ['channels', 'media', 'results'] };
const colsCache = {};
const cols = (t) => (colsCache[t] = colsCache[t] || all(`PRAGMA table_info(${t})`).map((c) => c.name));
function out(t, row) {
  if (!row) return row;
  for (const c of JSON_COLS[t] || []) { try { row[c] = JSON.parse(row[c] || 'null'); } catch { row[c] = null; } }
  return row;
}
function clean(t, body) {
  const allowed = cols(t).filter((c) => c !== 'id');
  const o = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (!allowed.includes(k)) continue;
    o[k] = (JSON_COLS[t] || []).includes(k) ? (v == null ? null : JSON.stringify(v)) : typeof v === 'boolean' ? (v ? 1 : 0) : v === '' ? null : v;
  }
  if (t === 'clients' && 'phone' in o) o.phone_norm = normPhone(o.phone) || null;
  return o;
}
const SECRET_SETTINGS = ['sms_gate_pass', 'smsru_api_id', 'tg_token', 'max_token', 'vk_token', 'gigachat_key', 'yandex_key', 'link_code'];
function settingsPublic() {
  const s = Object.fromEntries(all('SELECT key,value FROM settings').map((x) => [x.key, x.value]));
  for (const k of SECRET_SETTINGS) { s['has_' + k] = !!s[k]; delete s[k]; }
  return s;
}
function data() {
  const o = {};
  for (const t of TABLES) o[t] = all(`SELECT * FROM ${t} ORDER BY id`).map((x) => out(t, x));
  o.settings = settingsPublic();
  o.integrations = { ...social.status(), sms: sms.provider(), ai: ai.provider() };
  return o;
}

// ---------- вход ----------
const cookie = (ctx, token, age) => `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${ctx.req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`;
r.post('/api/login', PUBLIC, (ctx) => {
  const ip = ctx.req.headers['x-real-ip'] || ctx.req.socket.remoteAddress;
  auth.checkRate(ip);
  const u = get('SELECT * FROM users WHERE login=? AND active=1', String(ctx.body.login || '').trim().toLowerCase());
  if (!u || !auth.verifyPassword(ctx.body.password || '', u.pass_hash)) throw new HttpError(401, 'Неверный логин или пароль');
  ctx.res.setHeader('Set-Cookie', cookie(ctx, auth.createSession(u.id), auth.SESSION_DAYS * 86400));
  return { ok: true };
});
r.post('/api/logout', PUBLIC, (ctx) => { if (ctx.token) run('DELETE FROM sessions WHERE token=?', ctx.token); ctx.res.setHeader('Set-Cookie', cookie(ctx, '', 0)); return { ok: true }; });
r.get('/api/me', PUBLIC, (ctx) => ({ user: ctx.user || null }));
r.post('/api/password', (ctx) => {
  const u = get('SELECT * FROM users WHERE id=?', ctx.user.id);
  if (!auth.verifyPassword(ctx.body.old || '', u.pass_hash)) throw new HttpError(400, 'Текущий пароль неверный');
  if (String(ctx.body.new || '').length < 6) throw new HttpError(400, 'Новый пароль — минимум 6 символов');
  if (String(ctx.body.new) === String(ctx.body.old)) throw new HttpError(400, 'Новый пароль должен отличаться от текущего');
  run('UPDATE users SET pass_hash=?, must_change=0 WHERE id=?', auth.hashPassword(ctx.body.new), u.id);
  run('DELETE FROM sessions WHERE user_id=? AND token<>?', u.id, ctx.token);
  return { ok: true };
});

// ---------- пользователи (только администратор) ----------
const userOut = (u) => ({ id: u.id, login: u.login, name: u.name, role: u.role || 'admin', active: u.active, created_at: u.created_at });
r.get('/api/users', ADMIN, () => all('SELECT * FROM users ORDER BY id').map(userOut));
r.post('/api/users', ADMIN, (ctx) => {
  const b = ctx.body || {}; const login = String(b.login || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(login)) throw new HttpError(400, 'Логин: латиница, цифры, точка, дефис — от 3 символов');
  if (get('SELECT 1 FROM users WHERE login=?', login)) throw new HttpError(400, 'Такой логин уже есть');
  if (String(b.password || '').length < 6) throw new HttpError(400, 'Пароль — минимум 6 символов');
  const role = b.role === 'admin' ? 'admin' : 'master';
  const id = Number(run('INSERT INTO users(login,name,pass_hash,role,must_change) VALUES(?,?,?,?,1)', login, String(b.name || login).trim().slice(0, 60), auth.hashPassword(b.password), role).lastInsertRowid);
  return userOut(get('SELECT * FROM users WHERE id=?', id));
});
r.put('/api/users/:id', ADMIN, (ctx) => {
  const id = +ctx.params.id; const u = get('SELECT * FROM users WHERE id=?', id); if (!u) throw new HttpError(404, 'Нет пользователя');
  const b = ctx.body || {};
  if (id === ctx.user.id && (b.role === 'master' || b.active === 0)) throw new HttpError(400, 'Нельзя снять права или отключить самого себя');
  if (b.name != null) run('UPDATE users SET name=? WHERE id=?', String(b.name).trim().slice(0, 60) || u.login, id);
  if (b.role) run('UPDATE users SET role=? WHERE id=?', b.role === 'admin' ? 'admin' : 'master', id);
  if (b.active != null) { run('UPDATE users SET active=? WHERE id=?', b.active ? 1 : 0, id); if (!b.active) run('DELETE FROM sessions WHERE user_id=?', id); }
  if (b.password) {
    if (String(b.password).length < 6) throw new HttpError(400, 'Пароль — минимум 6 символов');
    run('UPDATE users SET pass_hash=?, must_change=? WHERE id=?', auth.hashPassword(b.password), id === ctx.user.id ? 0 : 1, id);
    if (id !== ctx.user.id) run('DELETE FROM sessions WHERE user_id=?', id);
  }
  if (!get("SELECT 1 FROM users WHERE role='admin' AND active=1")) throw new HttpError(400, 'Должен остаться хотя бы один администратор');
  return userOut(get('SELECT * FROM users WHERE id=?', id));
});

// ---------- данные ----------
r.get('/api/data', () => data());
const need = (t) => { if (!TABLES.includes(t)) throw new HttpError(404, 'Нет такой таблицы'); return t; };
r.post('/api/t/:table', (ctx) => {
  const t = need(ctx.params.table); const o = clean(t, ctx.body);
  const keys = Object.keys(o);
  const res = keys.length ? run(`INSERT INTO ${t}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`, ...keys.map((k) => o[k]))
    : run(`INSERT INTO ${t} DEFAULT VALUES`);
  const id = Number(res.lastInsertRowid);
  hooks(t, id, ctx.body, null);
  return out(t, get(`SELECT * FROM ${t} WHERE id=?`, id));
});
r.put('/api/t/:table/:id', (ctx) => {
  const t = need(ctx.params.table); const id = +ctx.params.id;
  const before = get(`SELECT * FROM ${t} WHERE id=?`, id); if (!before) throw new HttpError(404, 'Запись не найдена');
  const o = clean(t, ctx.body); const keys = Object.keys(o);
  if (keys.length) run(`UPDATE ${t} SET ${keys.map((k) => k + '=?').join(',')} WHERE id=?`, ...keys.map((k) => o[k]), id);
  hooks(t, id, ctx.body, before);
  return out(t, get(`SELECT * FROM ${t} WHERE id=?`, id));
});
r.delete('/api/t/:table/:id', (ctx) => {
  const t = need(ctx.params.table); const id = +ctx.params.id;
  if (t === 'clients') {
    run('DELETE FROM appointments WHERE client_id=?', id); run('UPDATE payments SET client_id=NULL WHERE client_id=?', id);
    run('DELETE FROM students WHERE client_id=?', id); run("UPDATE sms_queue SET status='cancelled' WHERE client_id=? AND status='queued'", id);
  }
  if (t === 'cohorts') { run('UPDATE students SET cohort_id=NULL WHERE cohort_id=?', id); run('DELETE FROM appointments WHERE cohort_id=? AND kind=\'lesson\'', id); }
  if (t === 'appointments') run('UPDATE payments SET appointment_id=NULL WHERE appointment_id=?', id);
  if (t === 'works') { const w = get('SELECT photo FROM works WHERE id=?', id); run('DELETE FROM works WHERE id=?', id); if (w) dropMedia([w.photo]); return { ok: true }; }
  if (t === 'posts') { const p = get('SELECT media FROM posts WHERE id=?', id); run('DELETE FROM posts WHERE id=?', id); try { dropMedia(JSON.parse(p.media || '[]')); } catch {} return { ok: true }; }
  run(`DELETE FROM ${t} WHERE id=?`, id);
  return { ok: true };
});
// после изменений: SMS-подтверждение записи
function hooks(t, id, body, before) {
  if (t === 'appointments' && body && body._sms_confirm) sms.confirmBooking(id);
  if (t === 'appointments' && body && body.status === 'done' && (!before || before.status !== 'done')) run("UPDATE appointments SET done_at=COALESCE(done_at, datetime('now','localtime')) WHERE id=?", id);
}
// файл удаляется, только если больше нигде не используется
function dropMedia(list) {
  for (const f of list || []) {
    if (!/^[\w.-]+$/.test(String(f))) continue;
    if (get('SELECT 1 FROM works WHERE photo=?', f) || get('SELECT 1 FROM posts WHERE media LIKE ?', `%"${f}"%`)) continue;
    try { fs.unlinkSync(path.join(social.MEDIA, f)); } catch {}
  }
}

// ---------- настройки ----------
const SETTING_KEYS = ['master_name', 'studio_name', 'city', 'phone', 'address', 'hours_text', 'tagline', 'social_tg', 'social_wa', 'social_vk', 'social_max',
  'review_url', 'site_url', 'work_days', 'work_from', 'work_to', 'slot_step', 'booking_on', 'booking_auto', 'booking_min_hours', 'booking_days_ahead',
  'site_bg', 'site_bg_opacity', 'tax_on', 'tax_person', 'tax_company', 'npd_limit', 'site_on', 'hero_photo', 'summary_time',
  'sms_provider', 'sms_gate_url', 'sms_gate_user', 'smsru_from', 'sms_from_hour', 'sms_to_hour', 'sms_interval', 'sms_daily_limit', 'sms_remind_time',
  'sms_correction_days', 'sms_auto_remind', 'sms_auto_confirm', 'sms_auto_review', 'sms_auto_correction', 'sms_auto_birthday',
  'sms_tpl_remind', 'sms_tpl_confirm', 'sms_tpl_review', 'sms_tpl_correction', 'sms_tpl_birthday',
  'update_repo', 'update_branch', 'tg_post_chat', 'max_content_chat', 'vk_group_id', 'ai_provider', 'gigachat_scope', 'yandex_folder', 'yandex_model', ...SECRET_SETTINGS.filter((k) => k !== 'link_code')];
// источник обновлений меняет только администратор; всё остальное доступно и мастеру
const ADMIN_KEYS = ['update_repo', 'update_branch'];
r.put('/api/settings', (ctx) => {
  let restart = false;
  const isAdmin = ctx.user.role === 'admin';
  for (const [k, v] of Object.entries(ctx.body || {})) {
    if (!SETTING_KEYS.includes(k)) continue;
    if (!isAdmin && ADMIN_KEYS.includes(k)) continue;
    if (SECRET_SETTINGS.includes(k) && !String(v ?? '').trim() && !ctx.body['clear_' + k]) continue;
    let val = typeof v === 'boolean' ? (v ? '1' : '0') : String(v ?? '').trim();
    if (k === 'tg_post_chat') val = val.replace(/^https?:\/\/t\.me\//, '@').replace(/^@?([A-Za-z]\w{3,})$/, '@$1');
    if (k === 'vk_group_id') val = val.replace(/^https?:\/\/vk\.(com|ru)\/(club|public)?/, '');
    if (k === 'tg_token' || k === 'max_token') { restart = true; if (k === 'tg_token') setSetting('tg_master_chat', ''); else setSetting('max_master_chat', ''); }
    setSetting(k, val);
  }
  for (const k of SECRET_SETTINGS) if (ctx.body['clear_' + k]) setSetting(k, '');
  if (restart) social.restart();
  return { settings: settingsPublic(), integrations: { ...social.status(), sms: sms.provider(), ai: ai.provider() } };
});
r.post('/api/link-code', () => { const c = String(crypto.randomInt(100000, 999999)); setSetting('link_code', c); return { code: c }; });
r.get('/api/integrations', () => ({ ...social.status(), sms: sms.provider(), ai: ai.provider() }));
r.post('/api/notify-test', () => { social.notify('Проверка: уведомления CRM работают ✨'); return { ok: true }; });

// ---------- фото ----------
r.post('/api/upload', (ctx) => {
  const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/s.exec(String(ctx.body.data || ''));
  if (!m) throw new HttpError(400, 'Можно загрузить фото JPG, PNG или WebP');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 200) throw new HttpError(400, 'Пустой файл');
  const file = Date.now().toString(36) + crypto.randomBytes(3).toString('hex') + (m[1] === 'png' ? '.png' : m[1] === 'webp' ? '.webp' : '.jpg');
  fs.writeFileSync(path.join(social.MEDIA, file), buf);
  if (ctx.body.as === 'hero') setSetting('hero_photo', '/media/' + file);
  if (ctx.body.as === 'bg') setSetting('site_bg', '/media/' + file);
  return { file, url: '/media/' + file };
});

// ---------- ИИ ----------
r.post('/api/ai', async (ctx) => ({ text: await ai.run(String(ctx.body.preset || 'free'), ctx.body.prompt) }));
r.post('/api/ai/test', async () => ({ text: await ai.complete('Отвечай одним коротким предложением.', 'Скажи, что готов помогать мастеру маникюра с текстами.') }));

// ---------- публикации ----------
r.post('/api/posts/:id/publish', async (ctx) => {
  try { return out('posts', await social.publish(+ctx.params.id, ctx.body.channels)); }
  catch (e) { throw new HttpError(400, e.message); }
});

// ---------- SMS ----------
sms.register(r);

// ---------- обновление CRM одной кнопкой ----------
// CRM кладёт заявку в DATA_DIR/update.request, системная служба nailcrm-update (root) скачивает
// новую версию, ставит её через install.sh и при сбое возвращает прежнюю.
const VERSION = require('../package.json').version;
const UPD_REQ = path.join(DATA_DIR, 'update.request');
const UPD_LOG = path.join(DATA_DIR, 'update.log');
const UPD_PKG = path.join(DATA_DIR, 'update-upload.tar.gz');
const updRepo = () => (getSetting('update_repo') || 'zeus199191/nailcrm').replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
const verCmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
function updLog() { try { return fs.readFileSync(UPD_LOG, 'utf8').slice(-6000); } catch { return ''; } }
const updState = () => {
  const log = updLog();
  const running = fs.existsSync(UPD_REQ) || (/=== Старт/.test(log) && !/=== (Готово|Ошибка|Откат)/.test(log));
  return { version: VERSION, repo: updRepo(), branch: getSetting('update_branch') || 'main', running, log, enabled: fs.existsSync('/usr/local/bin/nailcrm-update') };
};
r.get('/api/update/status', ADMIN, () => updState());
r.get('/api/update/check', ADMIN, async () => {
  const repo = updRepo(); const br = getSetting('update_branch') || 'main';
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new HttpError(400, 'Укажите репозиторий в виде владелец/название');
  let res;
  try { res = await fetch(`https://raw.githubusercontent.com/${repo}/${br}/package.json?t=${Date.now()}`, { signal: AbortSignal.timeout(15000) }); }
  catch (e) { throw new HttpError(502, 'GitHub недоступен с сервера: ' + (e.cause?.code || e.message)); }
  if (res.status === 404) throw new HttpError(404, `В репозитории ${repo} (ветка ${br}) нет package.json — проверьте название и что репозиторий публичный`);
  if (!res.ok) throw new HttpError(502, 'GitHub ответил ' + res.status);
  const pkg = await res.json().catch(() => ({}));
  if (pkg.name !== 'nailcrm') throw new HttpError(400, 'Это не репозиторий CRM мастера (в package.json другое имя)');
  return { current: VERSION, latest: pkg.version, available: verCmp(pkg.version, VERSION) > 0, notes: pkg.releaseNotes || '' };
});
function requestUpdate(line) {
  if (!fs.existsSync('/usr/local/bin/nailcrm-update')) throw new HttpError(400, 'Обновление из CRM ещё не включено на сервере. Один раз запустите новый install.sh вручную.');
  if (updState().running) throw new HttpError(409, 'Обновление уже идёт');
  fs.writeFileSync(UPD_LOG, `=== Старт: ${new Date().toLocaleString('ru-RU')} ===\nЗаявка принята, ждём службу обновления…\n`);
  fs.writeFileSync(UPD_REQ, line + '\n');
}
r.post('/api/update/run', ADMIN, () => {
  const repo = updRepo(); const br = (getSetting('update_branch') || 'main').replace(/[^\w.\/-]/g, '');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new HttpError(400, 'Укажите репозиторий');
  requestUpdate(`github ${repo} ${br}`);
  return updState();
});
// ---------- домен ----------
async function serverIps() {
  const ips = new Set();
  for (const list of Object.values(require('node:os').networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) ips.add(a.address);
  try { const t = (await (await fetch('https://api.ipify.org', { signal: AbortSignal.timeout(5000) })).text()).trim(); if (/^\d+\.\d+\.\d+\.\d+$/.test(t)) ips.add(t); } catch {}
  return [...ips].filter((ip) => !/^(10|127|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(ip));
}
const cleanDomain = (d) => String(d || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
r.get('/api/domain', ADMIN, async () => {
  let domain = '', email = '';
  try { [domain, email] = fs.readFileSync(path.join(DATA_DIR, 'domain.conf'), 'utf8').split('\n'); } catch {}
  let https = false;
  if (domain) { try { https = (await fetch(`https://${domain}/api/me`, { signal: AbortSignal.timeout(8000) })).ok; } catch {} }
  return { domain: domain || '', email: email || '', https, ips: await serverIps() };
});
r.post('/api/domain/check', ADMIN, async (ctx) => {
  const d = cleanDomain(ctx.body.domain);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) && !/^xn--/.test(d.split('.').pop())) throw new HttpError(400, 'Введите домен, например nails-kansk.ru');
  const ips = await serverIps();
  let found = [];
  try { found = await require('node:dns').promises.resolve4(d); } catch (e) { return { domain: d, ok: false, ips, found: [], reason: 'Домен пока не найден в DNS. Добавьте у регистратора A-запись и подождите 15–60 минут.' }; }
  const ok = found.some((ip) => ips.includes(ip));
  return { domain: d, ok, ips, found, reason: ok ? '' : `Домен указывает на ${found.join(', ')}, а адрес сервера — ${ips.join(', ') || 'не определён'}. Исправьте A-запись у регистратора.` };
});
r.post('/api/domain/connect', ADMIN, async (ctx) => {
  const d = cleanDomain(ctx.body.domain);
  const email = String(ctx.body.email || '').trim();
  if (email && !/^[\w.%+-]+@[\w.-]+\.[a-z]{2,}$/i.test(email)) throw new HttpError(400, 'Неверная почта');
  const ips = await serverIps();
  let found = [];
  try { found = await require('node:dns').promises.resolve4(d); } catch {}
  if (!found.some((ip) => ips.includes(ip)) && !ctx.body.force) throw new HttpError(400, `Домен ${d} ещё не указывает на этот сервер (${ips.join(', ')}). Добавьте A-запись и подождите.`);
  requestUpdate(`domain ${d} ${email}`);
  setSetting('site_url', 'https://' + d);
  return updState();
});

r.post('/api/update/upload', ADMIN, (ctx) => {
  const m = /^data:[^;]*;base64,(.+)$/s.exec(String(ctx.body.data || ''));
  if (!m) throw new HttpError(400, 'Выберите файл архива nailcrm.tar.gz');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length < 1000 || buf[0] !== 0x1f || buf[1] !== 0x8b) throw new HttpError(400, 'Это не архив .tar.gz');
  fs.writeFileSync(UPD_PKG, buf);
  requestUpdate('file');
  return updState();
});

// ---------- копия базы ----------
r.get('/api/backup', (ctx) => {
  const f = path.join(DATA_DIR, 'backup-download.sqlite');
  try { fs.unlinkSync(f); } catch {}
  db.exec(`VACUUM INTO '${f.replace(/'/g, "''")}'`);
  const buf = fs.readFileSync(f); fs.unlinkSync(f);
  ctx.res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="crm-${shared.ymd(new Date())}.sqlite"` });
  ctx.res.end(buf);
});

// ---------- сайт: онлайн-запись и заявки ----------
const hits = new Map();
function limit(ctx, n = 20) {
  const ip = ctx.req.headers['x-real-ip'] || ctx.req.socket.remoteAddress; const now = Date.now();
  const a = (hits.get(ip) || []).filter((t) => now - t < 3600e3); a.push(now); hits.set(ip, a);
  if (a.length > n) throw new HttpError(429, 'Слишком много запросов. Позвоните, пожалуйста.');
}
const S = () => Object.fromEntries(all('SELECT key,value FROM settings').map((x) => [x.key, x.value]));
const slotArgs = (date, duration) => ({ date, duration, s: S(), now: new Date(),
  appts: all("SELECT date,start,duration,status FROM appointments WHERE date=? AND status NOT IN ('cancelled','noshow')", date),
  timeOff: all('SELECT * FROM time_off') });
r.get('/api/public/days', PUBLIC, (ctx) => {
  if (getSetting('booking_on') !== '1') return { days: [] };
  const dur = Math.max(15, +ctx.query.duration || 60); const n = Math.min(60, +getSetting('booking_days_ahead') || 30);
  const days = []; const d = new Date();
  for (let i = 0; i <= n; i++) { const ds = shared.ymd(d); days.push({ date: ds, free: shared.freeSlots(slotArgs(ds, dur)).length }); d.setDate(d.getDate() + 1); }
  return { days };
});
r.get('/api/public/slots', PUBLIC, (ctx) => {
  if (getSetting('booking_on') !== '1') return { slots: [] };
  return { slots: shared.freeSlots(slotArgs(String(ctx.query.date || ''), +ctx.query.duration || 60)) };
});
function findClient(name, phone, source) {
  const pn = normPhone(phone);
  if (pn.length !== 11) throw new HttpError(400, 'Укажите номер телефона полностью');
  let c = get('SELECT * FROM clients WHERE phone_norm=?', pn);
  if (!c) { const id = Number(run('INSERT INTO clients(name,phone,phone_norm,source) VALUES(?,?,?,?)', String(name || 'Клиентка').trim().slice(0, 80), shared.fmtPhone(pn), pn, source).lastInsertRowid); c = get('SELECT * FROM clients WHERE id=?', id); }
  return c;
}
r.post('/api/public/book', PUBLIC, (ctx) => {
  limit(ctx, 10);
  if (getSetting('booking_on') !== '1') throw new HttpError(400, 'Онлайн-запись сейчас выключена — позвоните, пожалуйста');
  const b = ctx.body || {};
  if (b.website) return { ok: true }; // ловушка для ботов
  const ids = (Array.isArray(b.services) ? b.services : [b.services]).map(Number).filter(Boolean).slice(0, 6);
  const items = ids.map((id) => get('SELECT id,name,price,duration FROM services WHERE id=? AND active=1', id)).filter(Boolean);
  if (!items.length) throw new HttpError(400, 'Выберите услугу');
  const duration = items.reduce((s, i) => s + (+i.duration || 0), 0) || 60;
  const date = String(b.date || ''), start = String(b.start || '');
  if (!shared.freeSlots(slotArgs(date, duration)).includes(start)) throw new HttpError(409, 'Это время уже заняли — выберите другое, пожалуйста');
  const c = findClient(b.name, b.phone, 'Сайт');
  const auto = getSetting('booking_auto') === '1';
  const total = items.reduce((s, i) => s + (+i.price || 0), 0);
  const id = Number(run('INSERT INTO appointments(kind,client_id,date,start,duration,items,total,status,source,note) VALUES(?,?,?,?,?,?,?,?,?,?)',
    'client', c.id, date, start, duration, JSON.stringify(items.map((i) => ({ service_id: i.id, name: i.name, price: i.price, duration: i.duration }))), total,
    auto ? 'booked' : 'request', 'Онлайн-запись', String(b.comment || '').slice(0, 500) || null).lastInsertRowid);
  if (auto) sms.confirmBooking(id);
  social.notify(`🗓 Онлайн-запись${auto ? '' : ' — нужно подтвердить'}\n${c.name}, ${c.phone}\n${date.slice(8, 10)}.${date.slice(5, 7)} в ${start} · ${items.map((i) => i.name).join(', ')}${b.comment ? '\n💬 ' + b.comment : ''}`);
  return { ok: true, status: auto ? 'booked' : 'request' };
});
r.post('/api/public/lead', PUBLIC, (ctx) => {
  limit(ctx, 10);
  const b = ctx.body || {};
  if (b.website) return { ok: true };
  const key = ctx.req.headers['x-api-key'] || ctx.query.key;
  const pn = normPhone(b.phone);
  if (pn.length < 10) throw new HttpError(400, 'Укажите телефон');
  const kind = ['service', 'course', 'other'].includes(b.kind) ? b.kind : 'service';
  run('INSERT INTO leads(name,phone,kind,subject,message,source) VALUES(?,?,?,?,?,?)', String(b.name || '').slice(0, 80) || null, shared.fmtPhone(pn), kind,
    String(b.subject || '').slice(0, 120) || null, String(b.message || '').slice(0, 1000) || null, key && key === getSetting('api_key') ? String(b.source || 'API') : 'Сайт');
  social.notify(`✨ Новая заявка с сайта${kind === 'course' ? ' на обучение' : ''}\n${b.name || ''} ${shared.fmtPhone(pn)}${b.subject ? '\n' + b.subject : ''}${b.message ? '\n💬 ' + b.message : ''}`);
  return { ok: true };
});
// данные для лендинга
function siteData() {
  const all_ = S();
  const KEYS = ['master_name', 'studio_name', 'city', 'phone', 'address', 'hours_text', 'tagline', 'social_tg', 'social_wa', 'social_vk', 'social_max',
    'review_url', 'hero_photo', 'site_bg', 'site_bg_opacity', 'booking_on', 'booking_auto', 'work_days'];
  return {
    settings: Object.fromEntries(KEYS.map((k) => [k, all_[k] || ''])),
    services: all('SELECT id,name,category,price,price_from,duration,note FROM services WHERE active=1 AND on_site=1 ORDER BY sort,id'),
    courses: all('SELECT id,title,tag,price,price_from,hours,program FROM courses WHERE active=1 AND on_site=1 ORDER BY sort,id'),
    works: all('SELECT id,photo,caption,category FROM works WHERE on_site=1 ORDER BY sort DESC, id DESC LIMIT 24').map((w) => ({ ...w, url: '/media/' + w.photo })),
    reviews: all('SELECT name,text,rating,date FROM reviews WHERE on_site=1 ORDER BY id DESC LIMIT 12'),
  };
}

module.exports = { router: r, siteData };
