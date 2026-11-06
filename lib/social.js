'use strict';
// Telegram и MAX: уведомления мастеру (новая запись, заявка, сводка на завтра) и публикация постов.
// ВКонтакте: публикация на стену сообщества. «Сайт» — фото поста попадают в «Портфолио» на лендинге.
const fs = require('node:fs');
const path = require('node:path');
const { all, get, run, getSetting, setSetting, DATA_DIR } = require('./db');
const MEDIA = path.join(DATA_DIR, 'media');
const S = (k) => getSetting(k) || '';
const state = { tg: { ok: false, error: '', bot: '' }, max: { ok: false, error: '', bot: '' } };

// ---------------- Telegram ----------------
async function tg(method, payload, isForm = false) {
  const token = S('tg_token'); if (!token) return { ok: false, description: 'Не указан токен Telegram-бота' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, isForm
      ? { method: 'POST', body: payload, signal: AbortSignal.timeout(120000) }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}), signal: AbortSignal.timeout(40000) });
    return await res.json();
  } catch (e) { return { ok: false, description: String(e.cause?.code || e.message) }; }
}
let tgOffset = 0, tgPolling = false;
async function tgPoll() {
  if (tgPolling) return; tgPolling = true;
  const me = await tg('getMe'); state.tg.bot = me.ok ? me.result.username : ''; state.tg.ok = !!me.ok; state.tg.error = me.ok ? '' : me.description;
  while (S('tg_token')) {
    const r = await tg('getUpdates', { offset: tgOffset, timeout: 25, allowed_updates: ['message'] });
    if (!r.ok) { state.tg.ok = false; state.tg.error = r.description; await sleep(r.error_code === 401 ? 60000 : 10000); continue; }
    state.tg.ok = true; state.tg.error = '';
    for (const u of r.result || []) {
      tgOffset = u.update_id + 1;
      const m = u.message; if (!m || !m.text) continue;
      const text = m.text.trim().replace(/^\/start\s*/, '');
      if (text && text === S('link_code')) { setSetting('tg_master_chat', String(m.chat.id)); setSetting('link_code', ''); tgSend(m.chat.id, 'Готово! Telegram подключён к CRM: сюда будут приходить новые записи, заявки и план на завтра.'); continue; }
      if (String(m.chat.id) !== S('tg_master_chat')) { tgSend(m.chat.id, 'Это служебный бот CRM. Для подключения отправьте код из CRM (Настройки → Telegram).'); continue; }
      if (/^\/?(сегодня|today)/i.test(text)) tgSend(m.chat.id, dayPlan(0));
      else if (/^\/?(завтра|tomorrow)/i.test(text)) tgSend(m.chat.id, dayPlan(1));
      else tgSend(m.chat.id, 'Команды: «сегодня», «завтра» — план записей.');
    }
  }
  tgPolling = false;
}
const tgSend = (chat, text) => tg('sendMessage', { chat_id: chat, text: String(text).slice(0, 4000), disable_web_page_preview: true });

// ---------------- MAX ----------------
const MAX_BASES = ['https://platform-api.max.ru', 'https://platform-api2.max.ru'];
let maxBase = MAX_BASES[0];
async function mx(method, p, { query, body, timeout = 15000 } = {}) {
  const t = S('max_token'); if (!t) return { ok: false, error: 'Не указан токен бота MAX' };
  const url = new URL(p, maxBase);
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  try {
    const res = await fetch(url, { method, headers: { Authorization: t, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout) });
    let data = null; try { data = await res.json(); } catch {}
    if (!res.ok) return { ok: false, status: res.status, error: (data && (data.message || data.code)) || 'HTTP ' + res.status };
    return { ok: true, data };
  } catch (e) {
    const msg = String(e.cause?.code || e.message);
    if (/certificate|CERT_|self.signed|unable to/i.test(msg) && maxBase === MAX_BASES[0]) { maxBase = MAX_BASES[1]; return mx(method, p, { query, body, timeout }); }
    return { ok: false, error: msg };
  }
}
const maxSend = (to, text, attachments) => mx('POST', '/messages', { query: to, body: { text: String(text || '').slice(0, 3990), ...(attachments ? { attachments } : {}) }, timeout: 30000 });
function maxChats() { try { return JSON.parse(S('max_chats') || '[]'); } catch { return []; } }
function rememberChat(id, title) { const l = maxChats().filter((c) => String(c.id) !== String(id)); l.push({ id: String(id), title: title || '' }); setSetting('max_chats', JSON.stringify(l.slice(-30))); }
let maxMarker = null, maxPolling = false;
async function maxPoll() {
  if (maxPolling) return; maxPolling = true;
  const me = await mx('GET', '/me'); state.max.ok = me.ok; state.max.bot = me.ok ? (me.data?.username || me.data?.name || '') : ''; state.max.error = me.ok ? '' : me.error;
  while (S('max_token')) {
    const r = await mx('GET', '/updates', { query: { marker: maxMarker, timeout: 30, limit: 100 }, timeout: 40000 });
    if (!r.ok) { state.max.ok = false; state.max.error = r.error; await sleep(r.status === 401 ? 60000 : 10000); continue; }
    state.max.ok = true; state.max.error = '';
    if (r.data?.marker != null) maxMarker = r.data.marker;
    for (const u of r.data?.updates || []) {
      try {
        if (u.update_type === 'bot_added') { rememberChat(u.chat_id, u.chat?.title || ''); continue; }
        const text = u.update_type === 'bot_started' ? String(u.payload || '') : u.update_type === 'message_created' ? String(u.message?.body?.text || '').trim() : '';
        const chatId = u.chat_id || u.message?.recipient?.chat_id;
        if (u.message?.recipient?.chat_type && u.message.recipient.chat_type !== 'dialog') continue;
        if (!chatId) continue;
        if (text && text === S('link_code')) { setSetting('max_master_chat', String(chatId)); setSetting('link_code', ''); maxSend({ chat_id: chatId }, 'Готово! MAX подключён к CRM: сюда будут приходить новые записи, заявки и план на завтра.'); continue; }
        if (String(chatId) !== S('max_master_chat')) { if (u.update_type !== 'bot_started' || !text) maxSend({ chat_id: chatId }, 'Это служебный бот CRM. Для подключения отправьте код из CRM (Настройки → MAX).'); continue; }
        if (/сегодня/i.test(text)) maxSend({ chat_id: chatId }, dayPlan(0));
        else if (/завтра/i.test(text)) maxSend({ chat_id: chatId }, dayPlan(1));
      } catch (e) { console.error('MAX update', e.message); }
    }
  }
  maxPolling = false;
}
async function maxUpload(file, mime) {
  const r = await mx('POST', '/uploads', { query: { type: 'image' } });
  if (!r.ok || !r.data?.url) return { ok: false, error: r.error || 'MAX не выдал адрес загрузки' };
  const fd = new FormData(); fd.append('data', await fs.openAsBlob(file, { type: mime }), path.basename(file));
  const res = await fetch(r.data.url, { method: 'POST', headers: { Authorization: S('max_token') }, body: fd, signal: AbortSignal.timeout(60000) });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: 'загрузка: HTTP ' + res.status };
  const tok = r.data.token || data?.token;
  const payload = tok ? { token: tok } : data?.photos ? { photos: data.photos } : null;
  return payload ? { ok: true, att: { type: 'image', payload } } : { ok: false, error: 'MAX не вернул файл' };
}

// ---------------- уведомления мастеру ----------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function notify(text) {
  if (S('tg_token') && S('tg_master_chat')) tgSend(S('tg_master_chat'), text).catch(() => {});
  if (S('max_token') && S('max_master_chat')) maxSend({ chat_id: S('max_master_chat') }, text).catch(() => {});
}
function dayPlan(offset) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  const ds = require('./shared').ymd(d);
  const rows = all(`SELECT a.*, c.name, c.phone, h.title cohort FROM appointments a LEFT JOIN clients c ON c.id=a.client_id LEFT JOIN cohorts h ON h.id=a.cohort_id
    WHERE a.date=? AND a.status IN ('request','booked','confirmed') ORDER BY a.start`, ds);
  const head = `${offset ? 'Завтра' : 'Сегодня'}, ${ds.slice(8, 10)}.${ds.slice(5, 7)}`;
  if (!rows.length) return `${head}: записей нет.`;
  return head + ':\n' + rows.map((a) => {
    let items = ''; try { items = JSON.parse(a.items || '[]').map((i) => i.name).join(', '); } catch {}
    if (a.kind === 'block') return `${a.start} — личное время${a.note ? ': ' + a.note : ''}`;
    if (a.kind === 'lesson') return `${a.start} — занятие${a.cohort ? ' «' + a.cohort + '»' : ''}`;
    return `${a.start} — ${a.name || 'клиентка'}${items ? ' · ' + items : ''}${a.phone ? ' · ' + a.phone : ''}${a.status === 'request' ? ' (ждёт подтверждения)' : ''}`;
  }).join('\n');
}

// ---------------- публикации ----------------
const MIME = (f) => (/\.png$/i.test(f) ? 'image/png' : /\.webp$/i.test(f) ? 'image/webp' : 'image/jpeg');
async function postTg(text, files) {
  const chat = S('tg_post_chat'); if (!chat) return { ok: false, error: 'Не указан Telegram-канал' };
  const capOk = text.length <= 1024; let r;
  if (files.length === 1) {
    const f = new FormData(); f.append('chat_id', chat); if (capOk) f.append('caption', text);
    f.append('photo', await fs.openAsBlob(files[0], { type: MIME(files[0]) }), path.basename(files[0]));
    r = await tg('sendPhoto', f, true);
  } else {
    const f = new FormData(); f.append('chat_id', chat);
    f.append('media', JSON.stringify(files.slice(0, 10).map((x, i) => ({ type: 'photo', media: `attach://f${i}`, ...(i === 0 && capOk ? { caption: text } : {}) }))));
    for (const [i, x] of files.slice(0, 10).entries()) f.append(`f${i}`, await fs.openAsBlob(x, { type: MIME(x) }), path.basename(x));
    r = await tg('sendMediaGroup', f, true);
  }
  if (!r || !r.ok) return { ok: false, error: 'Telegram: ' + ((r && r.description) || 'ошибка') };
  if (!capOk) { const t = await tg('sendMessage', { chat_id: chat, text: text.slice(0, 4096) }); if (!t.ok) return { ok: false, error: 'Telegram (текст): ' + t.description }; }
  return { ok: true };
}
async function postMax(text, files) {
  const chat = S('max_content_chat'); if (!chat) return { ok: false, error: 'Не выбран чат/канал MAX для публикаций' };
  const att = [];
  for (const f of files.slice(0, 10)) { const u = await maxUpload(f, MIME(f)); if (!u.ok) return { ok: false, error: 'MAX: ' + u.error }; att.push(u.att); }
  let r;
  for (let i = 0; i < 5; i++) { r = await maxSend({ chat_id: chat }, text, att); if (r.ok || !/not.ready/i.test(String(r.error))) break; await sleep(1000 * (i + 1)); }
  return r.ok ? { ok: true } : { ok: false, error: 'MAX: ' + r.error };
}
async function vk(method, params) {
  const body = new URLSearchParams({ ...params, access_token: S('vk_token'), v: '5.199' });
  const j = await (await fetch('https://api.vk.com/method/' + method, { method: 'POST', body, signal: AbortSignal.timeout(60000) })).json();
  if (j.error) throw new Error(`${method}: ${j.error.error_msg}`);
  return j.response;
}
async function postVk(text, files) {
  const gid = S('vk_group_id').replace(/\D/g, '');
  if (!gid || !S('vk_token')) return { ok: false, error: 'ВКонтакте не подключён' };
  try {
    const att = [];
    for (const f of files.slice(0, 10)) {
      const s = await vk('photos.getWallUploadServer', { group_id: gid });
      const fd = new FormData(); fd.append('photo', await fs.openAsBlob(f, { type: MIME(f) }), path.basename(f));
      const up = await (await fetch(s.upload_url, { method: 'POST', body: fd, signal: AbortSignal.timeout(120000) })).json();
      const saved = await vk('photos.saveWallPhoto', { group_id: gid, server: up.server, photo: up.photo, hash: up.hash });
      att.push(`photo${saved[0].owner_id}_${saved[0].id}`);
    }
    const r = await vk('wall.post', { owner_id: '-' + gid, from_group: 1, message: text, attachments: att.join(',') });
    return { ok: true, url: `https://vk.com/wall-${gid}_${r.post_id}` };
  } catch (e) { return { ok: false, error: 'ВКонтакте: ' + e.message }; }
}
const parse = (s, d) => { try { return JSON.parse(s || '') ?? d; } catch { return d; } };
async function publish(id, only) {
  const p = get('SELECT * FROM posts WHERE id=?', id); if (!p) throw new Error('Пост не найден');
  const media = parse(p.media, []).filter((f) => /^[\w.-]+$/.test(f) && fs.existsSync(path.join(MEDIA, f)));
  const text = String(p.text || '').trim();
  if (!text) throw new Error('Напишите текст поста');
  if (!media.length) throw new Error('Добавьте хотя бы одно фото');
  const files = media.map((f) => path.join(MEDIA, f));
  const res = parse(p.results, {});
  for (const ch of (only && only.length ? only : parse(p.channels, []))) {
    let r;
    try {
      if (ch === 'tg') r = await postTg(text, files);
      else if (ch === 'max') r = await postMax(text, files);
      else if (ch === 'vk') r = await postVk(text, files);
      else if (ch === 'site') {
        if (!get('SELECT 1 FROM works WHERE post_id=?', p.id)) for (const f of media) run('INSERT INTO works(photo,caption,category,post_id) VALUES(?,?,?,?)', f, p.title || '', 'Маникюр', p.id);
        r = { ok: true };
      } else continue;
    } catch (e) { r = { ok: false, error: e.message }; }
    res[ch] = { ...r, at: new Date().toISOString() };
  }
  const vals = Object.values(res); const okAll = vals.length && vals.every((x) => x.ok);
  run("UPDATE posts SET results=?, status=?, published_at=COALESCE(published_at, datetime('now','localtime')) WHERE id=?",
    JSON.stringify(res), okAll ? 'published' : vals.some((x) => x.ok) ? 'partial' : 'error', p.id);
  return get('SELECT * FROM posts WHERE id=?', p.id);
}

// ---------------- расписание ----------------
let publishing = false;
async function scheduler() {
  const now = new Date(); const ds = require('./shared').ymd(now); const hm = now.toTimeString().slice(0, 5);
  // запланированные посты
  if (!publishing) {
    publishing = true;
    try {
      for (const p of all("SELECT id FROM posts WHERE status='ready' AND date IS NOT NULL AND (date<? OR (date=? AND COALESCE(time,'10:00')<=?))", ds, ds, hm)) {
        try { await publish(p.id); } catch (e) { run("UPDATE posts SET status='error', results=? WHERE id=?", JSON.stringify({ error: { ok: false, error: e.message } }), p.id); }
      }
    } finally { publishing = false; }
  }
  // вечерняя сводка
  const at = S('summary_time') || '20:00';
  if (hm >= at && S('summary_sent') !== ds && (S('tg_master_chat') || S('max_master_chat'))) { setSetting('summary_sent', ds); notify(dayPlan(1)); }
}

function restart() {
  if (S('tg_token')) tgPoll().catch(() => { tgPolling = false; });
  if (S('max_token')) maxPoll().catch(() => { maxPolling = false; });
}
function start() {
  restart();
  const t = setInterval(() => { scheduler().catch((e) => console.error('scheduler', e.message)); }, 60000); t.unref?.();
}
const status = () => ({ tg: { ...state.tg, linked: !!S('tg_master_chat'), token: !!S('tg_token'), post_chat: S('tg_post_chat') },
  max: { ...state.max, linked: !!S('max_master_chat'), token: !!S('max_token'), chats: maxChats(), content_chat: S('max_content_chat') },
  vk: { token: !!S('vk_token'), group: S('vk_group_id') } });
module.exports = { start, restart, notify, publish, status, dayPlan, MEDIA };
