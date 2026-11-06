'use strict';
/* CRM мастера маникюра — основа интерфейса (чистый JS, без сборки) */
const SH = window.NailShared;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rub = (n) => Math.round(+n || 0).toLocaleString('ru-RU') + ' ₽';
const num = (n) => Math.round(+n || 0).toLocaleString('ru-RU');
const pad = SH.pad, ymd = SH.ymd;
const DOW = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DOW_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const SOURCES = ['Рекомендация', 'Онлайн-запись', 'Сайт', 'ВКонтакте', 'Telegram', 'MAX', 'Instagram', 'Авито', '2ГИС', 'Яндекс Карты', 'Постоянная', 'Другое'];
const EXPENSE_CATS = ['Материалы', 'Инструмент', 'Аренда', 'Реклама', 'Обучение себя', 'Коммунальные', 'Связь и сервисы', 'Прочее'];

// время мастера (часовой пояс из настроек), независимо от часового пояса телефона
function now() {
  const tz = D.settings && D.settings.tz;
  if (!tz) return new Date();
  try {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const g = (t) => +p.find((x) => x.type === t).value;
    return new Date(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
  } catch { return new Date(); }
}
const today = () => ymd(now());
const dmy = (s) => (s ? s.slice(0, 10).split('-').reverse().join('.') : '');
const dLong = (s) => { const d = new Date(s + 'T12:00'); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const dWeek = (s) => { const d = new Date(s + 'T12:00'); return `${DOW_FULL[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const addDays = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return ymd(d); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
const ym = (s) => s.slice(0, 7);
const fmtDur = (m) => { m = +m || 0; const h = Math.floor(m / 60), mm = m % 60; return [h ? h + ' ч' : '', mm ? mm + ' мин' : ''].filter(Boolean).join(' ') || '0 мин'; };
const plural = (n, a, b, c) => { n = Math.abs(n) % 100; const n1 = n % 10; return n > 10 && n < 20 ? c : n1 > 1 && n1 < 5 ? b : n1 === 1 ? a : c; };
const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
const telHref = (p) => 'tel:+' + SH.normPhone(p);
const waHref = (p) => 'https://wa.me/' + SH.normPhone(p);
const mediaUrl = (f) => (!f ? '' : /^(data:|https?:|\/)/.test(f) ? f : '/media/' + f);
function debounce(fn, ms = 250) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ================= данные =================
const D = { settings: {}, integrations: {} };
const TABLES = ['clients', 'services', 'appointments', 'payments', 'expenses', 'courses', 'cohorts', 'students', 'leads', 'posts', 'works', 'reviews', 'time_off'];
TABLES.forEach((t) => (D[t] = []));
const byId = (t, id) => D[t].find((x) => x.id === +id);
const client = (id) => byId('clients', id);
const S = (k) => (D.settings[k] ?? '');

async function api(method, url, body) {
  if (window.DEMO_API) return window.DEMO_API(method, url, body);
  let res;
  try {
    res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  } catch { throw new Error('Нет связи с сервером'); }
  if (res.status === 401 && !url.startsWith('/api/login')) { renderLogin(); throw new Error('Требуется вход'); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || 'Ошибка ' + res.status);
  return j;
}
async function loadAll() { Object.assign(D, await api('GET', '/api/data')); }
async function save(t, obj) {
  const { id, ...rest } = obj;
  const row = id ? await api('PUT', `/api/t/${t}/${id}`, rest) : await api('POST', `/api/t/${t}`, rest);
  const i = D[t].findIndex((x) => x.id === row.id);
  if (i >= 0) D[t][i] = row; else D[t].push(row);
  return row;
}
async function del(t, id) { await api('DELETE', `/api/t/${t}/${id}`); D[t] = D[t].filter((x) => x.id !== +id); }
async function saveSettings(obj) {
  const r = await api('PUT', '/api/settings', obj);
  D.settings = r.settings; D.integrations = r.integrations; return r;
}

// ================= мелкие виджеты =================
function toast(msg, err = false) {
  const el = document.createElement('div'); el.className = 'toast' + (err ? ' err' : ''); el.textContent = msg;
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), err ? 5000 : 2600);
}
const fail = (e) => toast(e.message || String(e), true);
function opts(list, cur, empty) {
  return (empty !== undefined ? `<option value="">${esc(empty)}</option>` : '') +
    list.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${String(v) === String(cur ?? '') ? ' selected' : ''}>${esc(t)}</option>`; }).join('');
}
function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') o[el.name] = el.checked ? 1 : 0;
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value.trim();
  }
  return o;
}
const timeOpts = (cur, from = 7 * 60, to = 23 * 60, step = 15) => { let h = ''; for (let m = from; m <= to; m += step) { const t = SH.toHM(m); h += `<option${t === cur ? ' selected' : ''}>${t}</option>`; } return h; };

// Модальное окно: на телефоне — шторка снизу
let modalStack = 0;
function modal(title, body, { submit = 'Сохранить', wide = false, onSubmit, footer, onOpen, danger } = {}) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<form class="modal${wide ? ' wide' : ''}" novalidate><div class="modal-h"><h2>${title}</h2><button type="button" class="ghost icon" data-x aria-label="Закрыть">${ic('x')}</button></div>
    <div class="modal-b">${body}</div>${footer !== false ? `<div class="modal-f">${footer || ''}<span class="sp"></span><button type="button" data-x>Отмена</button>${onSubmit ? `<button type="submit" class="primary">${submit}</button>` : ''}</div>` : ''}</form>`;
  document.body.appendChild(bg); modalStack++; document.body.style.overflow = 'hidden';
  const form = $('form', bg);
  const close = () => { bg.remove(); modalStack--; if (!modalStack) document.body.style.overflow = ''; };
  $$('[data-x]', bg).forEach((b) => b.addEventListener('click', close));
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); if (!onSubmit) return;
    const btn = $('button[type=submit]', form); btn.disabled = true;
    try { if ((await onSubmit(formData(form), form)) !== false) close(); } catch (er) { fail(er); } finally { btn.disabled = false; }
  });
  if (onOpen) onOpen(form, close);
  const first = $('input:not([type=hidden]):not([type=checkbox]),textarea', form); if (first && matchMedia('(min-width:861px)').matches) first.focus();
  return { el: form, close };
}
function confirmBox(text, okText = 'Да') {
  return new Promise((ok) => {
    let done = false;
    const m = modal('Подтвердите', `<p style="font-size:15px;margin:4px 0 8px">${text}</p>`, { submit: okText, onSubmit: () => { done = true; ok(true); } });
    const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!done) ok(false); } });
    obs.observe(document.body, { childList: true });
  });
}
function copyText(t) {
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => toast('Скопировано'), () => fallbackCopy(t));
  else fallbackCopy(t);
}
function fallbackCopy(t) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); toast('Скопировано'); } catch {} a.remove(); }
// сжатие фото перед загрузкой
function shrinkImage(file, maxSide = 1600, q = 0.85) {
  return new Promise((ok, no) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => no(new Error('Не удалось прочитать фото'));
    img.src = url;
  });
}
async function uploadPhotos(files, as) {
  const out = [];
  for (const f of files) { const data = await shrinkImage(f, window.DEMO_API ? 1000 : 1800, window.DEMO_API ? 0.78 : 0.86); out.push(await api('POST', '/api/upload', { data, as })); }
  return out;
}
function pickFiles(multiple = true) {
  return new Promise((ok) => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = multiple;
    i.onchange = () => ok([...i.files]); i.click();
  });
}
// автодополнение (поиск клиенток)
function autocomplete(input, { search, render, onPick }) {
  const wrap = input.parentElement; wrap.classList.add('ac');
  let list = null, items = [], idx = -1;
  const close = () => { if (list) list.remove(); list = null; };
  const show = () => {
    items = search(input.value.trim()); close(); if (!items.length) return;
    list = document.createElement('div'); list.className = 'ac-list';
    list.innerHTML = items.map((x, i) => `<div data-i="${i}">${render(x)}</div>`).join('');
    wrap.appendChild(list);
    $$('div', list).forEach((d) => d.addEventListener('mousedown', (e) => { e.preventDefault(); onPick(items[+d.dataset.i]); close(); }));
  };
  input.addEventListener('input', debounce(show, 120));
  input.addEventListener('focus', show);
  input.addEventListener('blur', () => setTimeout(close, 150));
  input.addEventListener('keydown', (e) => {
    if (!list) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, Math.min(items.length - 1, idx + (e.key === 'ArrowDown' ? 1 : -1))); $$('div', list).forEach((d, i) => d.classList.toggle('on', i === idx)); }
    if (e.key === 'Enter' && idx >= 0) { e.preventDefault(); onPick(items[idx]); close(); }
  });
}
const findClients = (q) => {
  if (!q) return D.clients.slice().sort((a, b) => lastVisit(b.id).localeCompare(lastVisit(a.id))).slice(0, 8);
  const ql = q.toLowerCase().replace(/ё/g, 'е'); const qd = q.replace(/\D/g, '');
  return D.clients.filter((c) => String(c.name).toLowerCase().replace(/ё/g, 'е').includes(ql) || (qd.length >= 3 && String(c.phone_norm || '').includes(qd))).slice(0, 10);
};

// ================= иконки =================
const I = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  cal: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5.5 5h13L21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6z"/>',
  cap: '<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>',
  wallet: '<rect x="2.5" y="6" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M16.5 15h2"/><path d="M5 6l11-3 1 3"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', back: '<path d="m15 18-6-6 6-6"/>', next: '<path d="m9 18 6-6-6-6"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  msg: '<path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', check: '<path d="M20 6 9 17l-5-5"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  photo: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="m21 15-5-5L5 21"/>',
  send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v9H5v-9M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  site: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>', receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>', download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>', upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
  wand: '<path d="m15 4 5 5L9 20l-5-5zM14 9l1 1M4 4l1.5 1.5M19 15l1.5 1.5M10 3v2M3 10h2"/>',
};
const ic = (n) => I(ICONS[n] || '');

// ================= каркас и навигация =================
const NAV = [
  ['/', 'Главная', 'home'], ['/calendar', 'Календарь', 'cal'], ['/clients', 'Клиентки', 'users'], ['/leads', 'Заявки', 'inbox'],
  ['/training', 'Обучение', 'cap'], ['/finance', 'Финансы', 'wallet'], ['/marketing', 'Маркетинг', 'spark'],
  ['/services', 'Услуги и цены', 'list'], ['/settings', 'Настройки', 'gear'],
];
const TABS = ['/', '/calendar', '/clients', '/leads'];
const pendingCount = () => D.leads.filter((l) => l.status === 'new').length + D.appointments.filter((a) => a.status === 'request').length;
function renderShell() {
  const c = pendingCount();
  const badge = (p) => (p === '/leads' && c ? `<span class="cnt">${c}</span>` : '');
  $('#root').innerHTML = `${window.DEMO_API ? '<div class="demo-band">Демо-версия: данные хранятся только в этом браузере. <a href="#" id="demoSite">Открыть сайт</a> · <a href="#" id="demoReset">Сбросить демо</a></div>' : ''}
  <div class="app">
    <aside class="side">
      <a class="brand" href="#/"><span class="mark">${esc(initials(S('master_name')).slice(0, 2))}</span><span><b>${esc(S('master_name') || 'Мастер')}</b><span>nail studio</span></span></a>
      <nav class="nav">${NAV.map(([p, t, i]) => `<a href="#${p}" data-p="${p}">${ic(i)}<span>${t}</span>${badge(p)}</a>`).join('')}</nav>
      <div class="foot">
        <a class="btn ghost sm" href="${window.DEMO_API ? '#' : '/'}" ${window.DEMO_API ? 'data-site' : 'target="_blank"'} style="justify-content:flex-start">${ic('site')}Мой сайт</a>
        <button class="ghost sm" id="logout" style="justify-content:flex-start">${ic('logout')}Выйти${D.me ? ` <span class="muted small">· ${esc(D.me.name)}</span>` : ''}</button>
      </div>
    </aside>
    <div class="mobilebar"><span class="mark" style="width:32px;height:32px;font-size:16px">${esc(initials(S('master_name')).slice(0, 2))}</span><span class="t" id="mtitle"></span><button class="primary icon" id="mPlus" aria-label="Новая запись">${ic('plus')}</button></div>
    <main class="main" id="page"></main>
    <nav class="tabbar">${TABS.map((p) => { const n = NAV.find((x) => x[0] === p); return `<a href="#${p}" data-p="${p}">${ic(n[2])}<span>${n[1]}</span>${badge(p)}</a>`; }).join('')}<a href="#" id="moreBtn" data-p="more">${ic('more')}<span>Ещё</span></a></nav>
  </div>`;
  $('#logout').onclick = async () => { await api('POST', '/api/logout').catch(() => {}); if (window.DEMO_API) location.hash = '#/'; renderLogin(); };
  $('#mPlus').onclick = () => apptModal({ date: currentDay || today() });
  $('#moreBtn').onclick = (e) => { e.preventDefault(); moreMenu(); };
  $$('[data-site], #demoSite').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); window.demoOpenSite && window.demoOpenSite(); }));
  const dr = $('#demoReset'); if (dr) dr.onclick = async (e) => { e.preventDefault(); if (await confirmBox('Вернуть демо-данные к началу? Все изменения в демо удалятся.', 'Сбросить')) { window.demoReset(); } };
}
function moreMenu() {
  const items = NAV.filter(([p]) => !TABS.includes(p));
  const m = modal('Разделы', `<div class="list">${items.map(([p, t, i]) => `<a class="item click" href="#${p}" style="color:var(--text)"><span class="av" style="background:var(--panel2)">${ic(i)}</span><span class="main-t"><b>${t}</b></span>${ic('next')}</a>`).join('')}
    <a class="item click" href="${window.DEMO_API ? '#' : '/'}" ${window.DEMO_API ? 'data-site' : 'target="_blank"'} style="color:var(--text)"><span class="av" style="background:var(--panel2)">${ic('site')}</span><span class="main-t"><b>Мой сайт</b></span>${ic('next')}</a></div>`, { footer: false });
  $$('a', m.el).forEach((a) => a.addEventListener('click', (e) => { if (a.hasAttribute('data-site')) { e.preventDefault(); window.demoOpenSite && window.demoOpenSite(); } m.close(); }));
}
function setActive(path) {
  const top = '/' + (path.split('/')[1] || '');
  $$('.nav a, .tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.p === top || (a.dataset.p === 'more' && !TABS.includes(top))));
  const n = NAV.find((x) => x[0] === top); $('#mtitle').textContent = n ? n[1] : '';
}
function refreshBadges() {
  const c = pendingCount();
  $$('a[data-p="/leads"]').forEach((a) => { let b = $('.cnt', a); if (!c) { if (b) b.remove(); return; } if (!b) { b = document.createElement('span'); b.className = 'cnt'; a.appendChild(b); } b.textContent = c; });
}
function topbar(title, right = '', sub = '') {
  return `<div class="topbar"><h1>${title}</h1><span class="sp"></span>${right}${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
}

// ================= маршруты =================
const ROUTES = [];
const route = (re, fn) => ROUTES.push([re, fn]);
let currentPath = '';
async function navigate() {
  if (!D.__loaded) return;
  const h = location.hash.slice(1) || '/';
  const [pa, q] = h.split('?');
  const path = pa.split('#')[0];
  const query = Object.fromEntries(new URLSearchParams(q || ''));
  if (!$('#page')) renderShell();
  setActive(path); refreshBadges();
  for (const [re, fn] of ROUTES) {
    const m = re.exec(path);
    if (m) {
      const page = $('#page');
      if (currentPath !== path) window.scrollTo(0, 0);
      currentPath = path;
      try { await fn(page, m, query); } catch (e) { console.error(e); page.innerHTML = `<div class="card empty">Ошибка: ${esc(e.message)}</div>`; }
      return;
    }
  }
  location.hash = '#/';
}
const go = (p) => { if (location.hash === '#' + p) navigate(); else location.hash = '#' + p; };
const rerender = () => navigate();

function renderLogin() {
  D.__loaded = false;
  $('#root').innerHTML = `<div class="login"><form class="box" id="lf">
    <span class="mark" style="width:54px;height:54px;font-size:24px">${esc(initials(S('master_name') || 'А М'))}</span>
    <h1>Вход в CRM</h1><p class="muted" style="margin:0 0 18px">${esc(S('master_name') || 'Мастер маникюра')}</p>
    <div class="form"><label class="f">Логин<input name="login" autocomplete="username" value="${window.DEMO_API ? 'admin' : ''}" autocapitalize="none"></label>
    <label class="f">Пароль<input name="password" type="password" autocomplete="current-password" value="${window.DEMO_API ? 'demo' : ''}"></label>
    <button class="primary" style="min-height:48px">Войти</button>
    ${window.DEMO_API ? '<p class="hint" style="text-align:center;margin:0">Демо: логин admin, пароль demo</p><a href="#" class="btn ghost sm" data-site>← Вернуться на сайт</a>' : '<a href="/" class="btn ghost sm">← На сайт</a>'}</div>
  </form></div>`;
  const ds = $('[data-site]'); if (ds) ds.onclick = (e) => { e.preventDefault(); window.demoOpenSite(); };
  $('#lf').onsubmit = async (e) => {
    e.preventDefault();
    try { await api('POST', '/api/login', formData(e.target)); await boot(); } catch (er) { fail(er); }
  };
}
const isAdmin = () => !D.me || D.me.role === 'admin';
// пароль, выданный администратором, нужно сменить при первом входе
function forcePassword() {
  D.__loaded = false;
  $('#root').innerHTML = `<div class="login"><form class="box" id="fp">
    <span class="mark" style="width:54px;height:54px;font-size:24px">${esc(initials(D.me.name))}</span>
    <h1>Придумайте пароль</h1><p class="muted" style="margin:0 0 18px">${esc(D.me.name)}, это ваш первый вход. Задайте свой пароль — дальше входите с ним.</p>
    <div class="form"><label class="f">Текущий (выданный) пароль<input name="old" type="password" autocomplete="current-password" required></label>
    <label class="f">Новый пароль, от 6 символов<input name="new" type="password" autocomplete="new-password" required></label>
    <label class="f">Новый пароль ещё раз<input name="new2" type="password" autocomplete="new-password" required></label>
    <button class="primary" style="min-height:48px">Сохранить и войти</button></div></form></div>`;
  $('#fp').onsubmit = async (e) => {
    e.preventDefault(); const f = formData(e.target);
    if (f.new.length < 6) return toast('Пароль — минимум 6 символов', true);
    if (f.new !== f.new2) return toast('Пароли не совпадают', true);
    try { await api('POST', '/api/password', { old: f.old, new: f.new }); toast('Пароль сохранён'); await boot(); } catch (er) { fail(er); }
  };
}
async function boot() {
  try {
    const me = await api('GET', '/api/me');
    if (!me.user) { if (!window.DEMO_API) { try { Object.assign(D.settings, { master_name: '' }); } catch {} } return renderLogin(); }
    D.me = me.user;
    if (me.user.must_change) return forcePassword();
    await loadAll(); D.__loaded = true; renderShell(); navigate();
  } catch (e) { if (!/Требуется вход/.test(e.message)) { $('#root').innerHTML = `<div class="login"><div class="box"><h1>Нет связи</h1><p class="muted">${esc(e.message)}</p><button class="primary" onclick="location.reload()">Повторить</button></div></div>`; } }
}
window.addEventListener('hashchange', navigate);

// ================= расчёты по данным =================
const apptItems = (a) => (Array.isArray(a.items) ? a.items : []);
const apptTitle = (a) => (a.kind === 'block' ? (a.note || 'Личное время') : a.kind === 'lesson' ? 'Занятие: ' + (byId('cohorts', a.cohort_id)?.title || cohortTitle(byId('cohorts', a.cohort_id)) || 'обучение') : client(a.client_id)?.name || 'Клиентка');
const apptServices = (a) => apptItems(a).map((i) => i.name).join(', ');
const visitsOf = (cid) => D.appointments.filter((a) => a.client_id === cid && a.kind === 'client');
const doneVisits = (cid) => visitsOf(cid).filter((a) => a.status === 'done');
function lastVisit(cid) { const v = doneVisits(cid).map((a) => a.date).sort().pop(); const c = client(cid); return [v || '', c?.last_visit_import || ''].sort().pop(); }
const nextVisit = (cid) => visitsOf(cid).filter((a) => SH.ACTIVE.includes(a.status) && a.date >= today()).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0];
const spentBy = (cid) => D.payments.filter((p) => p.client_id === cid).reduce((s, p) => s + (+p.amount || 0), 0);
const paidFor = (apptId) => D.payments.filter((p) => p.appointment_id === apptId).reduce((s, p) => s + (+p.amount || 0), 0);
const paidStudent = (sid) => D.payments.filter((p) => p.student_id === sid).reduce((s, p) => s + (+p.amount || 0), 0);
const cohortTitle = (h) => (!h ? '' : h.title || ((byId('courses', h.course_id)?.title || 'Поток') + (h.start_date ? ' · с ' + dmy(h.start_date) : '')));
const isWorkDay = (ds) => String(S('work_days') || '1,2,3,4,5,6').split(',').map(Number).includes(new Date(ds + 'T12:00').getDay()) && !D.time_off.some((t) => ds >= t.date_from && ds <= (t.date_to || t.date_from));
// учёт налога самозанятой выключен до отдельного подключения (настройка tax_on = 1)
const TAX = () => S('tax_on') === '1';
const taxRate = (p) => (p.payer === 'company' ? +S('tax_company') || 6 : +S('tax_person') || 4);
function birthdaySoon(c, days = 7) {
  if (!c.birthday) return null;
  const md = c.birthday.slice(-5); const t = today(); const y = +t.slice(0, 4);
  for (const yy of [y, y + 1]) { const d = `${yy}-${md}`; const n = daysBetween(t, d); if (n >= 0 && n <= days) return n; }
  return null;
}
const statusBadge = (st) => `<span class="badge b-${st}">${esc(SH.STATUS[st] || st)}</span>`;
