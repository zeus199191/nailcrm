'use strict';
/* Календарь записи, карточка записи, приём оплаты */
let currentDay = null;
const ROW = 36; // высота 30 минут

function dayRange(dates) {
  let from = SH.toMin(S('work_from') || '10:00'), to = SH.toMin(S('work_to') || '20:00');
  for (const a of D.appointments) if (dates.includes(a.date) && a.status !== 'cancelled') { from = Math.min(from, SH.toMin(a.start)); to = Math.max(to, SH.toMin(a.start) + (+a.duration || 60)); }
  return [Math.floor(from / 60) * 60, Math.ceil(to / 60) * 60];
}
function evHtml(a, from) {
  const top = (SH.toMin(a.start) - from) / 30 * ROW, h = Math.max(ROW - 4, (+a.duration || 60) / 30 * ROW - 4);
  const c = client(a.client_id);
  const sub = a.kind === 'client' ? apptServices(a) : a.kind === 'lesson' ? fmtDur(a.duration) : '';
  return `<div class="ev st-${a.status} k-${a.kind}" style="top:${top + 2}px;height:${h}px" data-ev="${a.id}">
    <b>${a.start} ${esc(a.kind === 'client' ? (c?.name || 'Клиентка') : apptTitle(a))}</b>${h > 40 && sub ? `<span>${esc(sub)}</span>` : ''}${h > 62 && a.kind === 'client' && a.total ? `<span>${rub(a.total)}${a.status === 'request' ? ' · ждёт подтверждения' : ''}</span>` : ''}</div>`;
}

route(/^\/calendar$/, async (page, m, q) => {
  const wide = matchMedia('(min-width:861px)').matches;
  const view = q.v || (wide ? 'week' : 'day');
  const day = q.d || currentDay || today(); currentDay = day;
  const t = today();
  let dates;
  if (view === 'week') { const d = new Date(day + 'T12:00'); const mon = addDays(day, -((d.getDay() + 6) % 7)); dates = Array.from({ length: 7 }, (_, i) => addDays(mon, i)); }
  else dates = [day];
  const [from, to] = dayRange(dates);
  const rows = (to - from) / 30;
  const dd = new Date(day + 'T12:00');
  const title = view === 'week' ? `${dLong(dates[0])} — ${dLong(dates[6])}` : `${DOW_FULL[dd.getDay()][0].toUpperCase() + DOW_FULL[dd.getDay()].slice(1)}, ${dLong(day)}`;
  const strip = view === 'day' ? (() => {
    const s0 = addDays(day, -3);
    return `<div class="strip" id="strip">${Array.from({ length: 21 }, (_, i) => addDays(s0, i)).map((ds) => {
      const x = new Date(ds + 'T12:00'); const n = D.appointments.filter((a) => a.date === ds && SH.ACTIVE.concat('done').includes(a.status) && a.kind !== 'block').length;
      return `<button class="${ds === day ? 'on' : ''} ${ds === t ? 'today' : ''} ${isWorkDay(ds) ? '' : 'off'}" data-d="${ds}"><small>${DOW[x.getDay()]}</small><b>${x.getDate()}</b>${n ? '<i></i>' : '<i style="visibility:hidden"></i>'}</button>`;
    }).join('')}</div>`;
  })() : '';
  const dayList = view === 'day' ? D.appointments.filter((a) => a.date === day && a.status !== 'cancelled').sort((a, b) => a.start.localeCompare(b.start)) : [];
  const income = dates.reduce((s, ds) => s + D.payments.filter((p) => p.date === ds).reduce((x, p) => x + (+p.amount || 0), 0), 0);
  const planned = D.appointments.filter((a) => dates.includes(a.date) && a.kind === 'client' && SH.ACTIVE.includes(a.status)).reduce((s, a) => s + (+a.total || 0), 0);

  page.innerHTML = topbar('Календарь', `<button class="primary hide-m" id="add">${ic('plus')}Запись</button>`) + `
  <div class="cal-head">
    <button class="icon" id="prev" aria-label="Назад">${ic('back')}</button><button class="icon" id="next" aria-label="Вперёд">${ic('next')}</button>
    <button class="sm" id="today">Сегодня</button>
    <span class="title">${title}</span><span class="sp"></span>
    <div class="seg"><button type="button" class="${view === 'day' ? 'on' : ''}" data-v="day">День</button><button type="button" class="${view === 'week' ? 'on' : ''}" data-v="week">Неделя</button></div>
  </div>
  ${strip}
  <div class="row small muted" style="margin:-4px 0 10px">${isWorkDay(day) || view === 'week' ? '' : '<span class="badge b-warn">Выходной</span>'}${planned ? `<span>Запланировано: <b class="acc">${rub(planned)}</b></span>` : ''}${income ? `<span>· Получено: <b class="ok">${rub(income)}</b></span>` : ''}</div>
  <div class="tl ${view === 'week' ? 'week' : ''}" id="tl">
    ${view === 'week' ? `<div class="corner"></div>${dates.map((ds) => { const x = new Date(ds + 'T12:00'); return `<div class="colhead ${ds === t ? 'today' : ''}" data-day="${ds}">${DOW[x.getDay()]}<b>${x.getDate()}</b></div>`; }).join('')}` : ''}
    <div class="hours">${Array.from({ length: rows }, (_, i) => `<div>${i % 2 === 0 ? SH.toHM(from + i * 30) : ''}</div>`).join('')}</div>
    ${dates.map((ds) => `<div class="colbody ${isWorkDay(ds) ? '' : 'off'}" data-d="${ds}">${Array.from({ length: rows }, (_, i) => `<div class="slot" data-t="${SH.toHM(from + i * 30)}"></div>`).join('')}
      ${D.appointments.filter((a) => a.date === ds && a.status !== 'cancelled').map((a) => evHtml(a, from)).join('')}
      ${ds === t ? (() => { const n = now(); const mm = n.getHours() * 60 + n.getMinutes(); return mm >= from && mm <= to ? `<div class="nowline" style="top:${(mm - from) / 30 * ROW}px"></div>` : ''; })() : ''}</div>`).join('')}
  </div>
  ${view === 'day' && dayList.length ? `<div class="card only-m" style="margin-top:14px"><h3>Список на день</h3><div class="list">${dayList.map(apptRow).join('')}</div></div>` : ''}`;

  const setQ = (o) => go('/calendar?' + new URLSearchParams({ v: view, d: day, ...o }).toString());
  $('#prev').onclick = () => setQ({ d: addDays(day, view === 'week' ? -7 : -1) });
  $('#next').onclick = () => setQ({ d: addDays(day, view === 'week' ? 7 : 1) });
  $('#today').onclick = () => setQ({ d: t });
  $$('.seg button[data-v]', page).forEach((b) => (b.onclick = () => setQ({ v: b.dataset.v })));
  $$('#strip button').forEach((b) => (b.onclick = () => setQ({ d: b.dataset.d })));
  $$('.colhead').forEach((b) => (b.onclick = () => setQ({ v: 'day', d: b.dataset.day })));
  const add = $('#add'); if (add) add.onclick = () => apptModal({ date: day });
  $$('.colbody .slot', page).forEach((s) => (s.onclick = () => apptModal({ date: s.parentElement.dataset.d, start: s.dataset.t })));
  $$('[data-ev]', page).forEach((e) => (e.onclick = (ev) => { ev.stopPropagation(); apptModal(byId('appointments', e.dataset.ev)); }));
  $$('[data-appt]', page).forEach((e) => (e.onclick = () => apptModal(byId('appointments', e.dataset.appt))));
  const st = $('#strip .on'); if (st) st.scrollIntoView({ inline: 'center', block: 'nearest' });
  // прокрутка к текущему часу
  if (day === t && !q.d) { const nl = $('.nowline'); if (nl) setTimeout(() => window.scrollTo({ top: Math.max(0, nl.getBoundingClientRect().top + window.scrollY - 220) }), 30); }
});

function apptRow(a) {
  const c = client(a.client_id);
  return `<div class="item click" data-appt="${a.id}"><span class="time">${a.start}</span><span class="main-t"><b>${esc(a.kind === 'client' ? c?.name || 'Клиентка' : apptTitle(a))}</b>
    <span class="muted">${esc(a.kind === 'client' ? apptServices(a) || '—' : fmtDur(a.duration))}${a.kind === 'client' && a.total ? ' · ' + rub(a.total) : ''}</span></span>${a.kind === 'client' ? statusBadge(a.status) : ''}</div>`;
}

// ================= карточка записи =================
function apptModal(a = {}) {
  const isNew = !a.id;
  const st = { kind: a.kind || 'client', items: apptItems(a).map((i) => ({ ...i })), clientId: a.client_id || null, durTouched: !isNew, totalTouched: !isNew };
  const c = client(a.client_id);
  const cats = [...new Set(D.services.filter((s) => s.active).map((s) => s.category || 'Услуги'))];
  const smsOn = !!D.integrations.sms;
  const body = `
  <div class="form">
    <div class="seg" id="kind">${[['client', 'Клиентка'], ['lesson', 'Занятие'], ['block', 'Личное время']].map(([k, t]) => `<button type="button" data-k="${k}" class="${st.kind === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div data-for="client">
      <label class="f">Клиентка<div><input id="cq" placeholder="Имя или телефон" value="${esc(c ? c.name : '')}" autocomplete="off"></div></label>
      <div id="cinfo" class="hint" style="margin-top:6px"></div>
      <div class="two hidden" id="newc" style="margin-top:8px"><label class="f">Имя<input id="ncName"></label><label class="f">Телефон<input id="ncPhone" type="tel" inputmode="tel" placeholder="+7"></label></div>
    </div>
    <div data-for="client"><label class="f">Услуги</label><div class="svc-pick" id="svcs">${cats.map((cat) => `<div class="cat">${esc(cat)}</div>` + D.services.filter((s) => s.active && (s.category || 'Услуги') === cat).map((s) => `<label><input type="checkbox" value="${s.id}" ${st.items.some((i) => i.service_id === s.id) ? 'checked' : ''}><span>${esc(s.name)}</span><em>${fmtDur(s.duration)} · ${s.price_from ? 'от ' : ''}${rub(s.price)}</em></label>`).join('')).join('')}</div></div>
    <div data-for="lesson"><label class="f">Поток обучения<select name="cohort_id">${opts(D.cohorts.filter((h) => h.status !== 'done').map((h) => [h.id, cohortTitle(h)]), a.cohort_id, '— выберите поток —')}</select></label></div>
    <div class="three">
      <label class="f">Дата<input type="date" name="date" value="${a.date || today()}" required></label>
      <label class="f">Начало<select name="start">${timeOpts(a.start || S('work_from') || '10:00')}</select></label>
      <label class="f">Длительность<select name="duration">${opts([15, 20, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360, 480].map((m) => [m, fmtDur(m)]), a.duration || 60)}</select></label>
    </div>
    <div data-for="client" class="two">
      <label class="f">Стоимость, ₽<input name="total" type="number" inputmode="numeric" min="0" step="10" value="${a.total || ''}"></label>
      <label class="f">Статус<select name="status">${opts(Object.entries(SH.STATUS), a.status || 'booked')}</select></label>
    </div>
    <div id="clash"></div>
    <label class="f"><span data-for-text>Заметка</span><textarea name="note" rows="2" placeholder="Дизайн, пожелания, что сделать в следующий раз">${esc(a.note || '')}</textarea></label>
    ${smsOn ? `<label class="chk" data-for="client"><input type="checkbox" id="smsConf" ${isNew && S('sms_auto_confirm') === '1' ? 'checked' : ''}> Отправить SMS с подтверждением записи</label>` : ''}
    ${!isNew && a.source ? `<div class="hint">Источник: ${esc(a.source)} · создана ${esc(dmy(a.created_at))}</div>` : ''}
  </div>`;
  const paid = a.id ? paidFor(a.id) : 0;
  const footer = isNew ? '' : `<button type="button" class="danger icon" id="aDel" title="Удалить">${ic('trash')}</button>
    ${a.kind === 'client' && a.status !== 'done' ? `<button type="button" id="aDone" class="primary">${ic('check')}Пришла · оплата</button>` : ''}
    ${a.kind === 'client' && a.status === 'done' && paid < (+a.total || 0) ? `<button type="button" id="aPay">${ic('wallet')}Доплата</button>` : ''}
    ${a.kind === 'client' && SH.ACTIVE.includes(a.status) ? `<button type="button" id="aNo" class="sm">Не пришла</button>` : ''}
    ${c ? `<a class="btn icon" href="${telHref(c.phone)}" title="Позвонить">${ic('phone')}</a>` : ''}`;
  const m = modal(isNew ? 'Новая запись' : a.kind === 'client' ? (c?.name || 'Запись') : apptTitle(a), body, {
    footer, submit: isNew ? 'Записать' : 'Сохранить',
    onSubmit: async (f) => {
      const o = { id: a.id, kind: st.kind, date: f.date, start: f.start, duration: +f.duration, note: f.note || null };
      if (st.kind === 'client') {
        let cid = st.clientId;
        if (!cid) {
          const name = $('#ncName', m.el).value.trim() || $('#cq', m.el).value.trim(); const phone = $('#ncPhone', m.el).value.trim();
          if (!name) throw new Error('Укажите клиентку');
          const ex = phone && D.clients.find((x) => x.phone_norm && x.phone_norm === SH.normPhone(phone));
          cid = ex ? ex.id : (await save('clients', { name, phone: phone ? SH.fmtPhone(phone) : null, source: 'Другое' })).id;
        }
        Object.assign(o, { client_id: cid, items: st.items, total: +f.total || 0, status: f.status });
        if ($('#smsConf', m.el)?.checked) o._sms_confirm = 1;
      } else if (st.kind === 'lesson') { if (!f.cohort_id) throw new Error('Выберите поток'); Object.assign(o, { cohort_id: +f.cohort_id, client_id: null, items: [], total: 0, status: 'booked' }); }
      else Object.assign(o, { client_id: null, items: [], total: 0, status: 'booked' });
      const saved = await save('appointments', o);
      toast(isNew ? 'Записано' : 'Сохранено'); currentDay = saved.date; rerender();
    },
    onOpen: (form, close) => {
      const showKind = () => {
        $$('[data-for]', form).forEach((el) => el.classList.toggle('hidden', el.dataset.for !== st.kind));
        $('[data-for-text]', form).textContent = st.kind === 'block' ? 'Что за время (видно только вам)' : 'Заметка';
        $$('#kind button', form).forEach((b) => b.classList.toggle('on', b.dataset.k === st.kind));
        clash();
      };
      $$('#kind button', form).forEach((b) => (b.onclick = () => { st.kind = b.dataset.k; showKind(); }));
      const cq = $('#cq', form);
      const info = () => {
        const cc = client(st.clientId);
        $('#newc', form).classList.toggle('hidden', !!st.clientId || !cq.value.trim());
        if (!st.clientId && cq.value.trim()) { $('#ncName', form).value = cq.value.trim(); $('#cinfo', form).innerHTML = 'Новая клиентка — укажите телефон'; return; }
        if (!cc) { $('#cinfo', form).innerHTML = ''; return; }
        const lv = lastVisit(cc.id); const n = doneVisits(cc.id).length;
        $('#cinfo', form).innerHTML = `${esc(SH.fmtPhone(cc.phone) || 'без телефона')} · ${n ? n + ' ' + plural(n, 'визит', 'визита', 'визитов') + (lv ? ', последний ' + dmy(lv) : '') : 'первый визит'}${cc.notes ? `<br>📝 ${esc(cc.notes)}` : ''}${cc.discount ? ` · скидка ${cc.discount}%` : ''}`;
      };
      autocomplete(cq, { search: findClients, render: (x) => `<b>${esc(x.name)}</b> <span class="muted small">${esc(SH.fmtPhone(x.phone))}</span>`, onPick: (x) => { st.clientId = x.id; cq.value = x.name; info(); recalc(); } });
      cq.addEventListener('input', () => { st.clientId = null; info(); });
      const recalc = () => {
        st.items = $$('#svcs input:checked', form).map((i) => { const s = byId('services', i.value); const old = st.items.find((x) => x.service_id === s.id); return old || { service_id: s.id, name: s.name, price: s.price, duration: s.duration }; });
        const disc = client(st.clientId)?.discount || 0;
        if (!st.totalTouched || isNew) { const sum = st.items.reduce((x, i) => x + (+i.price || 0), 0); form.total.value = sum ? Math.round(sum * (1 - disc / 100)) : ''; }
        if (!st.durTouched && st.items.length) {
          const d = st.items.reduce((x, i) => x + (+i.duration || 0), 0);
          const sel = form.duration; if (![...sel.options].some((o) => +o.value === d)) sel.insertAdjacentHTML('beforeend', `<option value="${d}">${fmtDur(d)}</option>`);
          sel.value = d;
        }
        clash();
      };
      $$('#svcs input', form).forEach((i) => (i.onchange = () => { st.totalTouched = false; recalc(); }));
      form.total.oninput = () => (st.totalTouched = true);
      form.duration.onchange = () => { st.durTouched = true; clash(); };
      form.date.onchange = clash; form.start.onchange = clash;
      function clash() {
        const s0 = SH.toMin(form.start.value), e0 = s0 + +form.duration.value;
        const hit = D.appointments.filter((x) => x.id !== a.id && x.date === form.date.value && !['cancelled', 'noshow'].includes(x.status) && SH.toMin(x.start) < e0 && SH.toMin(x.start) + (+x.duration || 60) > s0);
        $('#clash', form).innerHTML = (hit.length ? `<div class="notice warn">Пересекается: ${hit.map((x) => `${x.start} ${esc(apptTitle(x))}`).join(', ')}</div>` : '') +
          (!isWorkDay(form.date.value) ? '<div class="notice" style="margin-top:6px">Это выходной день по графику</div>' : '');
      }
      showKind(); info();
      const btn = (id, fn) => { const b = $(id, form); if (b) b.onclick = fn; };
      btn('#aDel', async () => { if (!(await confirmBox('Удалить запись?', 'Удалить'))) return; await del('appointments', a.id); close(); toast('Удалено'); rerender(); });
      btn('#aNo', async () => { await save('appointments', { id: a.id, status: 'noshow' }); close(); toast('Отмечено: не пришла'); rerender(); });
      btn('#aDone', () => { close(); payModal({ appt: { ...a, total: +form.total.value || a.total } }); });
      btn('#aPay', () => { close(); payModal({ appt: a, amount: (+a.total || 0) - paid }); });
    },
  });
}

// ================= оплата =================
function payModal({ appt, student, amount, kind, onDone } = {}) {
  const sum = amount ?? (appt ? (+appt.total || 0) - paidFor(appt.id) : student ? Math.max(0, (+student.price || 0) - paidStudent(student.id)) : '');
  const cid = appt?.client_id || student?.client_id || null;
  const c = client(cid);
  const what = appt ? apptServices(appt) || 'Услуги' : student ? 'Обучение: ' + (byId('courses', student.course_id)?.title || 'курс') : '';
  modal('Оплата', `<div class="form">
    ${c ? `<div class="sum-line"><span>${esc(c.name)}<br><span class="small muted">${esc(what)}</span></span></div>` : ''}
    <label class="f">Сумма, ₽<input name="amount" type="number" inputmode="numeric" min="0" step="10" value="${sum || ''}" required style="font-size:22px;font-family:var(--serif)"></label>
    <div class="two"><label class="f">Способ<select name="method">${opts([['card', 'Перевод на карту'], ['cash', 'Наличные']], 'card')}</select></label>
    <label class="f">Плательщик<select name="payer">${opts([['person', `Физлицо — налог ${S('tax_person') || 4}%`], ['company', `ИП или компания — ${S('tax_company') || 6}%`]], 'person')}</select></label></div>
    <label class="f">Дата<input name="date" type="date" value="${appt && appt.date <= today() ? appt.date : today()}"></label>
    <label class="chk"><input type="checkbox" name="receipt"> Чек в «Мой налог» уже выдан</label>
    <div class="hint">Самозанятой нужно выдать чек на каждую оплату. Неотмеченные оплаты собраны в «Финансах» — их удобно пробить разом в приложении «Мой налог».</div>
  </div>`, {
    submit: 'Принять оплату',
    onSubmit: async (f) => {
      const a = +f.amount; if (!(a > 0) && !appt) throw new Error('Укажите сумму');
      if (a > 0) await save('payments', { date: f.date, amount: a, method: f.method, payer: f.payer, receipt: f.receipt, kind: kind || (student ? 'course' : 'service'), appointment_id: appt?.id || null, student_id: student?.id || null, client_id: cid, comment: what || null });
      if (appt && appt.status !== 'done') await save('appointments', { id: appt.id, status: 'done', total: appt.total });
      if (student && student.status === 'enrolled' && paidStudent(student.id) >= (+student.price || 0)) await save('students', { id: student.id, status: 'learning' });
      toast(a > 0 ? `Оплата ${rub(a)} принята` : 'Визит отмечен'); onDone ? onDone() : rerender();
    },
  });
}
