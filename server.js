'use strict';
// CRM мастера маникюра — сервер. Запуск: node server.js
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
process.env.TZ = process.env.CRM_TZ || process.env.TZ || 'Asia/Krasnoyarsk';
const { readBody, parseCookies, send, serveStatic, HttpError } = require('./lib/http');
const { get, run, getSetting, DATA_DIR } = require('./lib/db');
const auth = require('./lib/auth');
const { router, siteData } = require('./lib/api');
const landing = require('./lib/landing');

const PORT = +process.env.PORT || 3100;
const HOST = process.env.HOST || '127.0.0.1';
const PUB = path.join(__dirname, 'public');
const staticHandler = serveStatic(PUB);
const MEDIA = path.join(DATA_DIR, 'media');

// Первый запуск: создаём вход для мастера
if (get('SELECT COUNT(*) n FROM users').n === 0) {
  const pw = process.env.ADMIN_PASSWORD || require('node:crypto').randomBytes(6).toString('base64url');
  run("INSERT INTO users(login,name,pass_hash,role) VALUES('admin','Администратор',?,'admin')", auth.hashPassword(pw));
  console.log('==============================================');
  console.log(' Вход в CRM:  логин admin');
  console.log(' Пароль:      ' + pw);
  console.log('==============================================');
  fs.writeFileSync(path.join(DATA_DIR, 'FIRST_ADMIN_PASSWORD.txt'), `login: admin\npassword: ${pw}\n`, { mode: 0o600 });
}

// раньше вход admin назывался именем мастера — переименуем, чтобы не путать с учёткой мастера
if (!getSetting('admin_renamed')) { run("UPDATE users SET name='Администратор' WHERE login='admin' AND name=?", getSetting('master_name') || ''); require('./lib/db').setSetting('admin_renamed', '1'); }

const version = require('./package.json').version;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  try {
    const cookies = parseCookies(req);
    const user = auth.userFromToken(cookies.sid);
    if (user && user.renewed) res.setHeader('Set-Cookie', `sid=${cookies.sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${auth.SESSION_DAYS * 86400}${req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`);

    if (pathname.startsWith('/api/')) {
      if (pathname.startsWith('/api/public/')) res.setHeader('Access-Control-Allow-Origin', '*');
      if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key'); return send(res, 204, ''); }
      const m = router.match(req.method, pathname);
      if (!m) throw new HttpError(404, 'Не найдено');
      const opts = m.handlers.find((h) => typeof h === 'object') || {};
      const fns = m.handlers.filter((h) => typeof h === 'function');
      if (!opts.public && !user) throw new HttpError(401, 'Требуется вход');
      if (opts.admin && user.role !== 'admin') throw new HttpError(403, 'Это может только администратор');
      if (!opts.public && req.method !== 'GET') { // защита от CSRF
        const origin = req.headers.origin;
        if (origin && new URL(origin).hostname !== String(req.headers.host).split(':')[0]) throw new HttpError(403, 'Запрос с чужого сайта');
      }
      const ctx = { req, res, user, token: cookies.sid, params: m.params, query: Object.fromEntries(url.searchParams), body: {} };
      if (req.method !== 'GET') ctx.body = await readBody(req, pathname === '/api/upload' || pathname === '/api/update/upload' ? 30 * 1024 * 1024 : undefined);
      let result;
      for (const fn of fns) result = await fn(ctx);
      if (result !== undefined) send(res, 200, result);
      return;
    }
    // фото работ и постов
    if (req.method === 'GET' && pathname.startsWith('/media/')) {
      const f = path.basename(pathname);
      if (/^[\w.-]+$/.test(f) && fs.existsSync(path.join(MEDIA, f))) {
        res.writeHead(200, { 'Content-Type': /\.png$/.test(f) ? 'image/png' : /\.webp$/.test(f) ? 'image/webp' : 'image/jpeg', 'Cache-Control': 'public, max-age=2592000' });
        return require('node:stream').pipeline(fs.createReadStream(path.join(MEDIA, f)), res, () => {});
      }
      throw new HttpError(404, 'Нет файла');
    }
    // сайт мастера (можно выключить в Настройках)
    if (req.method === 'GET' && pathname === '/') {
      if (getSetting('site_on') === '0') { res.writeHead(302, { Location: '/crm' }); return res.end(); }
      return send(res, 200, landing.render(siteData(), { loggedIn: !!user, crmUrl: '/crm' }), { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    }
    if (req.method === 'GET' && (pathname === '/crm' || pathname.startsWith('/crm/'))) {
      const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8').replace(/(src|href)="\/(app\.js|style\.css|shared\.js)"/g, `$1="/$2?v=${version}"`);
      return send(res, 200, html, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    }
    if (req.method === 'GET' && pathname === '/shared.js') {
      return send(res, 200, fs.readFileSync(path.join(__dirname, 'lib', 'shared.js')), { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
    }
    if (req.method === 'GET' && pathname !== '/index.html' && staticHandler(req, res, pathname)) return;
    if (req.method === 'GET' && !path.extname(pathname)) { res.writeHead(302, { Location: '/' }); return res.end(); }
    throw new HttpError(404, 'Не найдено');
  } catch (e) {
    let status = e.status || 500, msg = e.message;
    if (status === 500) { console.error(new Date().toISOString(), req.method, pathname, e); msg = 'Внутренняя ошибка сервера'; }
    send(res, status, { error: msg });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`CRM запущена: http://${HOST}:${PORT}`);
  require('./lib/sms').start();
  require('./lib/social').start();
  require('./scripts/backup').schedule();
});
const shutdown = () => { server.close(); process.exit(0); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
