// Общие функции: работают и на сервере (Node), и в браузере (CRM, сайт, демо-версия)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NailShared = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const toMin = (hm) => { const [h, m] = String(hm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const toHM = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

  function normPhone(p) {
    let d = String(p || '').replace(/\D/g, '');
    if (d.length === 10) d = '7' + d;
    if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
    return d;
  }
  function fmtPhone(p) {
    const d = normPhone(p);
    if (d.length !== 11) return String(p || '');
    return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
  }

  const STATUS = {
    request: 'Ждёт подтверждения', booked: 'Записана', confirmed: 'Подтвердила', done: 'Пришла',
    noshow: 'Не пришла', cancelled: 'Отменена',
  };
  const ACTIVE = ['request', 'booked', 'confirmed'];

  // Свободные окна для онлайн-записи
  // s — настройки (work_days "1,2,3,4,5,6", work_from, work_to, slot_step, booking_min_hours, booking_days_ahead)
  function freeSlots({ date, duration, s, appts, timeOff, now }) {
    duration = Math.max(15, +duration || 60);
    const d = new Date(date + 'T12:00:00');
    if (isNaN(d)) return [];
    const days = String(s.work_days || '1,2,3,4,5,6').split(',').map(Number);
    if (!days.includes(d.getDay())) return [];
    if ((timeOff || []).some((t) => date >= t.date_from && date <= (t.date_to || t.date_from))) return [];
    const now0 = now || new Date();
    const ahead = +s.booking_days_ahead || 30;
    const maxD = new Date(now0); maxD.setDate(maxD.getDate() + ahead);
    if (date > ymd(maxD)) return [];
    const from = toMin(s.work_from || '10:00'), to = toMin(s.work_to || '20:00'), step = Math.max(15, +s.slot_step || 30);
    const busy = (appts || []).filter((a) => a.date === date && a.status !== 'cancelled' && a.status !== 'noshow')
      .map((a) => [toMin(a.start), toMin(a.start) + (+a.duration || 60)]);
    const minStart = date === ymd(now0) ? now0.getHours() * 60 + now0.getMinutes() + (+s.booking_min_hours || 0) * 60
      : date < ymd(now0) ? 1e9 : -1;
    const out = [];
    for (let t = from; t + duration <= to; t += step) {
      if (t < minStart) continue;
      if (busy.some(([a, b]) => t < b && t + duration > a)) continue;
      out.push(toHM(t));
    }
    return out;
  }

  // Подстановка в шаблон SMS: {имя} {дата} {время} {услуга} {телефон} {адрес} {мастер} {2гис} {ссылка}
  function fill(t, c, s) {
    c = c || {}; s = s || {};
    const first = !c.name || /^клиент/i.test(c.name) ? '' : String(c.name).trim().split(/\s+/)[0];
    return String(t || '')
      .replace(/\{имя\}/g, first || '\u0001').replace(/Здравствуйте, \u0001!/g, 'Здравствуйте!')
      .replace(/^\u0001,\s*(.)/, (m, ch) => ch.toUpperCase()).replace(/\u0001/g, 'добрый день')
      .replace(/\{дата\}/g, c.date ? c.date.slice(8, 10) + '.' + c.date.slice(5, 7) : '')
      .replace(/\{время\}/g, c.time || '').replace(/\{услуга\}/g, c.service || 'процедура')
      .replace(/\{телефон\}/g, s.phone || '').replace(/\{адрес\}/g, s.address || '')
      .replace(/\{мастер\}/g, s.master_name || '').replace(/\{2гис\}/g, s.review_url || '')
      .replace(/\{ссылка\}/g, s.site_url || '')
      .replace(/[ \t]+\n/g, '\n').trim();
  }

  // Длина SMS в сегментах (кириллица: 70 / 67 символов)
  function smsParts(text) {
    const n = String(text || '').length; if (!n) return 0;
    const cyr = /[^\x00-\x7F]/.test(text);
    const one = cyr ? 70 : 160, many = cyr ? 67 : 153;
    return n <= one ? 1 : Math.ceil(n / many);
  }

  return { pad, ymd, toMin, toHM, normPhone, fmtPhone, STATUS, ACTIVE, freeSlots, fill, smsParts };
});
