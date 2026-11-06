'use strict';
// SMS: с личного Android-телефона (приложение SMS Gateway for Android, облачный режим) или через SMS.ru.
// Очередь с паузой между SMS, дневным лимитом и тихими часами — чтобы оператор не заблокировал SIM.
// Автосообщения: напоминание накануне, подтверждение онлайн-записи, просьба об отзыве, «пора на коррекцию», день рождения.
const { all, get, run, getSetting, setSetting, normPhone } = require('./db');
const { fill: fillTpl, ymd } = require('./shared');
const { HttpError } = require('./http');

const S = (k) => getSetting(k) || '';
const provider = () => {
  const p = S('sms_provider');
  return p === 'gate' && S('sms_gate_user') && S('sms_gate_pass') ? 'gate' : p === 'smsru' && S('smsru_api_id') ? 'smsru' : '';
};
const settingsObj = () => Object.fromEntries(all('SELECT key,value FROM settings').map((r) => [r.key, r.value]));
const fill = (t, c) => fillTpl(t, c, settingsObj());

function enqueue({ phone, text, kind = 'manual', client_id = null, appointment_id = null, batch = null }) {
  const n = normPhone(phone);
  if (n.length !== 11 || !/^79/.test(n)) return { skipped: 'не мобильный номер' };
  if (client_id && get('SELECT no_sms FROM clients WHERE id=?', client_id)?.no_sms) return { skipped: 'клиентка отказалась от SMS' };
  if (!String(text || '').trim()) return { skipped: 'пустой текст' };
  try {
    const r = run('INSERT INTO sms_queue(phone,text,kind,client_id,appointment_id,batch) VALUES(?,?,?,?,?,?)', '+' + n, String(text).trim().slice(0, 1000), kind, client_id, appointment_id, batch);
    return { id: Number(r.lastInsertRowid) };
  } catch (e) { if (/UNIQUE/.test(e.message)) return { skipped: 'уже отправлялось' }; throw e; }
}

async function sendOne(phone, text) {
  const p = provider(); if (!p) throw new Error('SMS не настроены');
  if (p === 'gate') {
    const url = (S('sms_gate_url') || 'https://api.sms-gate.app/3rdparty/v1').replace(/\/$/, '') + '/messages';
    const auth = 'Basic ' + Buffer.from(S('sms_gate_user') + ':' + S('sms_gate_pass')).toString('base64');
    const res = await fetch(url, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ textMessage: { text }, phoneNumbers: [phone] }), signal: AbortSignal.timeout(20000) });
    const d = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Неверный логин/пароль SMS-шлюза (смотрите в приложении на телефоне, «Облачный сервер»)');
    if (!res.ok) throw new Error(`SMS-шлюз ответил ${res.status}: ${d.message || d.error || ''}`.trim());
    return {};
  }
  const q = new URLSearchParams({ api_id: S('smsru_api_id'), to: phone.replace(/\D/g, ''), msg: text, json: '1' });
  if (S('smsru_from')) q.set('from', S('smsru_from'));
  const res = await fetch('https://sms.ru/sms/send', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: q, signal: AbortSignal.timeout(20000) });
  const d = await res.json().catch(() => ({}));
  if (d.status !== 'OK') throw new Error('SMS.ru: ' + (d.status_text || d.status_code || res.status));
  const one = Object.values(d.sms || {})[0] || {};
  if (one.status !== 'OK') throw new Error('SMS.ru: ' + (one.status_text || one.status_code));
  if (d.balance !== undefined) setSetting('sms_balance', String(d.balance));
  return {};
}

const hourNow = () => new Date().getHours() + new Date().getMinutes() / 60;
const sentToday = () => get("SELECT COUNT(*) n FROM sms_queue WHERE status='sent' AND sent_at>=date('now','localtime')").n;
let busy = false, lastSent = 0;
async function tick() {
  if (busy || !provider()) return; busy = true;
  try {
    const h = hourNow();
    if (h < +(S('sms_from_hour') || 10) || h >= +(S('sms_to_hour') || 20)) return;
    if (sentToday() >= +(S('sms_daily_limit') || 100)) return;
    const gap = (provider() === 'smsru' ? 2 : Math.max(10, +(S('sms_interval') || 40))) * 1000;
    if (Date.now() - lastSent < gap) return;
    const m = get("SELECT * FROM sms_queue WHERE status='queued' ORDER BY CASE kind WHEN 'bulk' THEN 2 WHEN 'manual' THEN 1 ELSE 0 END, id LIMIT 1");
    if (!m) return;
    lastSent = Date.now();
    try {
      await sendOne(m.phone, m.text);
      run("UPDATE sms_queue SET status='sent', error=NULL, sent_at=datetime('now','localtime') WHERE id=?", m.id);
      if (m.kind === 'review' && m.appointment_id) run("UPDATE appointments SET review_at=COALESCE(review_at, datetime('now','localtime')) WHERE id=?", m.appointment_id);
      setSetting('sms_error', '');
    } catch (e) {
      run("UPDATE sms_queue SET status='error', error=? WHERE id=?", e.message.slice(0, 300), m.id);
      setSetting('sms_error', e.message.slice(0, 300));
    }
  } finally { busy = false; }
}

const Q = `SELECT a.*, c.name client_name, c.phone client_phone FROM appointments a JOIN clients c ON c.id=a.client_id WHERE a.kind='client' AND c.phone IS NOT NULL`;
const svc = (a) => { try { return JSON.parse(a.items || '[]').map((i) => i.name).join(', ').toLowerCase() || 'процедуру'; } catch { return 'процедуру'; } };
const apptCtx = (a) => ({ name: a.client_name, date: a.date, time: a.start, service: svc(a) });

function confirmBooking(apptId) {
  if (!provider() || S('sms_auto_confirm') !== '1') return;
  const a = get(`${Q} AND a.id=?`, apptId); if (!a) return;
  enqueue({ phone: a.client_phone, text: fill(S('sms_tpl_confirm'), apptCtx(a)), kind: 'confirm', client_id: a.client_id, appointment_id: a.id });
}

function autos() {
  if (!provider()) return;
  const now = new Date(); const hm = now.toTimeString().slice(0, 5);
  if (S('sms_auto_remind') === '1' && hm >= (S('sms_remind_time') || '18:00')) {
    const t = new Date(now); t.setDate(t.getDate() + 1);
    for (const a of all(`${Q} AND a.status IN ('booked','confirmed') AND a.date=?`, ymd(t)))
      enqueue({ phone: a.client_phone, text: fill(S('sms_tpl_remind'), apptCtx(a)), kind: 'remind', client_id: a.client_id, appointment_id: a.id });
  }
  if (hm < '11:00') return; // остальное — днём
  if (S('sms_auto_review') === '1') {
    for (const a of all(`${Q} AND a.status='done' AND a.review_at IS NULL AND a.done_at < datetime('now','localtime','-3 hours') AND a.done_at >= datetime('now','localtime','-3 days')`))
      enqueue({ phone: a.client_phone, text: fill(S('sms_tpl_review'), apptCtx(a)), kind: 'review', client_id: a.client_id, appointment_id: a.id });
  }
  if (S('sms_auto_correction') === '1') {
    const days = Math.max(7, +(S('sms_correction_days') || 21));
    const rows = all(`SELECT c.id, c.name, c.phone, MAX(a.date) last FROM clients c JOIN appointments a ON a.client_id=c.id AND a.status='done'
      WHERE c.phone IS NOT NULL GROUP BY c.id HAVING last BETWEEN date('now','localtime',?) AND date('now','localtime',?)`, `-${days + 3} days`, `-${days} days`);
    for (const c of rows) {
      if (get("SELECT 1 FROM appointments WHERE client_id=? AND date>=date('now','localtime') AND status IN ('request','booked','confirmed')", c.id)) continue;
      if (get("SELECT 1 FROM sms_queue WHERE client_id=? AND kind='correction' AND created_at>=datetime('now','localtime','-14 days')", c.id)) continue;
      enqueue({ phone: c.phone, text: fill(S('sms_tpl_correction'), { name: c.name }), kind: 'correction', client_id: c.id });
    }
  }
  if (S('sms_auto_birthday') === '1') {
    const md = ymd(now).slice(5);
    for (const c of all("SELECT id,name,phone FROM clients WHERE phone IS NOT NULL AND birthday IS NOT NULL AND substr(birthday,-5)=?", md)) {
      if (get("SELECT 1 FROM sms_queue WHERE client_id=? AND kind='birthday' AND created_at>=date('now','localtime','start of year')", c.id)) continue;
      enqueue({ phone: c.phone, text: fill(S('sms_tpl_birthday'), { name: c.name }), kind: 'birthday', client_id: c.id });
    }
  }
}

function register(r) {
  r.post('/api/sms/test', async (ctx) => {
    const n = normPhone(ctx.body.phone); if (n.length !== 11) throw new HttpError(400, 'Укажите номер для проверки');
    const text = String(ctx.body.text || 'Проверка SMS из CRM');
    try { await sendOne('+' + n, text); run("INSERT INTO sms_queue(phone,text,kind,status,sent_at) VALUES(?,?,'test','sent',datetime('now','localtime'))", '+' + n, text); return { ok: true }; }
    catch (e) { throw new HttpError(502, e.message); }
  });
  // поставить в очередь: одной клиентке или списку
  r.post('/api/sms/send', (ctx) => {
    const b = ctx.body || {}; if (!provider()) throw new HttpError(400, 'SMS не настроены: Настройки → «SMS»');
    const list = Array.isArray(b.to) ? b.to.slice(0, 3000) : [{ phone: b.phone, client_id: b.client_id, name: b.name, appointment_id: b.appointment_id }];
    const batch = list.length > 1 ? 'b' + Date.now().toString(36) : null;
    let queued = 0; const skipped = {};
    for (const x of list) {
      const res = enqueue({ phone: x.phone, text: fill(b.text, x), kind: list.length > 1 ? 'bulk' : (b.kind || 'manual'), client_id: x.client_id || null, appointment_id: x.appointment_id || null, batch });
      if (res.id) queued++; else skipped[res.skipped] = (skipped[res.skipped] || 0) + 1;
    }
    const gap = provider() === 'smsru' ? 2 : Math.max(10, +(S('sms_interval') || 40));
    return { queued, skipped, est_minutes: Math.ceil(queued * gap / 60) };
  });
  r.get('/api/sms/queue', () => ({
    rows: all("SELECT q.*, c.name client FROM sms_queue q LEFT JOIN clients c ON c.id=q.client_id ORDER BY CASE q.status WHEN 'queued' THEN 0 ELSE 1 END, q.id DESC LIMIT 300"),
    stats: get("SELECT SUM(status='queued') queued, SUM(status='sent' AND sent_at>=date('now','localtime')) today, SUM(status='error' AND created_at>=date('now','localtime','-7 days')) errors FROM sms_queue"),
    active: provider(), error: S('sms_error'), balance: S('sms_balance'),
  }));
  r.post('/api/sms/cancel', (ctx) => {
    const b = ctx.body || {};
    const n = b.id ? run("UPDATE sms_queue SET status='cancelled' WHERE id=? AND status='queued'", +b.id).changes
      : run("UPDATE sms_queue SET status='cancelled' WHERE status='queued'").changes;
    return { cancelled: n };
  });
  r.post('/api/sms/retry', () => ({ n: run("UPDATE sms_queue SET status='queued', error=NULL WHERE status='error'").changes }));
}

let t1 = null;
function start() {
  if (t1) return;
  t1 = setInterval(() => { tick().catch(() => {}); }, 5000); t1.unref?.();
  const t2 = setInterval(() => { try { autos(); } catch (e) { console.error('SMS autos:', e.message); } }, 60000); t2.unref?.();
}
module.exports = { register, start, enqueue, fill, provider, confirmBooking, autos, tick };
