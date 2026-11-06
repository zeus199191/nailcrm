'use strict';
/* Обучение и финансы самозанятой */
const STUDENT_ST = { enrolled: 'Записана', learning: 'Учится', graduated: 'Окончила', dropped: 'Отказалась' };
const COHORT_ST = { open: 'Набор', running: 'Идёт', done: 'Завершён' };

route(/^\/training$/, (page, m, q) => {
  const tab = q.tab || 'students';
  const tabs = `<div class="tabs">${[['students', 'Ученицы'], ['cohorts', 'Потоки'], ['courses', 'Курсы']].map(([k, t]) => `<a href="#/training?tab=${k}" class="${k === tab ? 'on' : ''}">${t}</a>`).join('')}</div>`;
  const btn = tab === 'students' ? `<button class="primary" id="add">${ic('plus')}Ученица</button>` : tab === 'cohorts' ? `<button class="primary" id="add">${ic('plus')}Поток</button>` : `<button class="primary" id="add">${ic('plus')}Курс</button>`;
  const income = D.payments.filter((p) => p.kind === 'course' && ym(p.date) === ym(today())).reduce((s, p) => s + +p.amount, 0);
  const active = D.students.filter((s) => ['enrolled', 'learning'].includes(s.status));
  const debt = active.reduce((s, x) => s + Math.max(0, (+x.price || 0) - paidStudent(x.id)), 0);
  let html = topbar('Обучение', btn) + `<div class="grid g4" style="margin-bottom:14px">
    <div class="kpi"><div class="l">Учатся сейчас</div><div class="v">${active.length}</div></div>
    <div class="kpi"><div class="l">Окончили</div><div class="v">${D.students.filter((s) => s.status === 'graduated').length}</div></div>
    <div class="kpi"><div class="l">Доход за месяц</div><div class="v ok">${rub(income)}</div></div>
    <div class="kpi"><div class="l">Ожидается оплат</div><div class="v ${debt ? 'warn' : ''}">${rub(debt)}</div></div></div>` + tabs;

  if (tab === 'students') {
    const rows = D.students.slice().sort((a, b) => (a.status === 'dropped') - (b.status === 'dropped') || b.id - a.id);
    html += `<div class="card" style="padding:6px 12px"><div class="list">${rows.length ? rows.map((s) => {
      const c = client(s.client_id), cr = byId('courses', s.course_id), h = byId('cohorts', s.cohort_id), paid = paidStudent(s.id);
      return `<div class="item" style="flex-wrap:wrap"><span class="av" style="background:var(--violetbg);color:var(--violet)">${esc(initials(c?.name))}</span>
        <span class="main-t" style="min-width:200px"><b>${esc(c?.name || 'Ученица')} <span class="badge ${s.status === 'graduated' ? 'b-ok' : s.status === 'dropped' ? 'b-bad' : 'b-violet'}">${STUDENT_ST[s.status]}</span></b>
        <span class="muted">${esc(cr?.title || 'Курс')}${h ? ' · ' + esc(cohortTitle(h)) : ''} · оплачено ${rub(paid)} из ${rub(s.price)}${s.cert_no ? ' · сертификат №' + esc(s.cert_no) : ''}</span>
        <div class="meter" style="margin-top:6px;max-width:260px"><i style="width:${Math.min(100, s.price ? paid / s.price * 100 : 0)}%"></i></div></span>
        <div class="row">${paid < s.price && s.status !== 'dropped' ? `<button class="sm primary" data-pay="${s.id}">${ic('wallet')}Оплата</button>` : ''}
        ${s.status === 'learning' || s.status === 'graduated' ? `<button class="sm" data-cert="${s.id}">${ic('print')}Сертификат</button>` : ''}
        <button class="sm icon" data-ed="${s.id}" title="Изменить">${ic('edit')}</button></div></div>`;
    }).join('') : '<div class="empty">Учениц пока нет. Добавьте вручную или из заявки на обучение.</div>'}</div></div>`;
  } else if (tab === 'cohorts') {
    const rows = D.cohorts.slice().sort((a, b) => (a.status === 'done') - (b.status === 'done') || String(b.start_date).localeCompare(String(a.start_date)));
    html += rows.length ? `<div class="grid g2">${rows.map((h) => {
      const st = D.students.filter((s) => s.cohort_id === h.id && s.status !== 'dropped');
      const lessons = D.appointments.filter((a) => a.kind === 'lesson' && a.cohort_id === h.id).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
      return `<div class="card"><div class="row"><b style="font:500 22px var(--serif);flex:1">${esc(cohortTitle(h))}</b><span class="badge ${h.status === 'open' ? 'b-warn' : h.status === 'running' ? 'b-violet' : 'b-ok'}">${COHORT_ST[h.status]}</span></div>
        <div class="muted small" style="margin:4px 0 10px">${h.start_date ? dmy(h.start_date) : '—'}${h.end_date ? ' — ' + dmy(h.end_date) : ''}${h.schedule ? ' · ' + esc(h.schedule) : ''}</div>
        <div class="row small"><span>Мест: <b>${st.length}</b> из ${h.seats || '—'}</span><span class="sp"></span><span>Занятий: <b>${lessons.length}</b></span></div>
        <div class="meter" style="margin:6px 0 10px"><i style="width:${Math.min(100, h.seats ? st.length / h.seats * 100 : 0)}%"></i></div>
        <div class="small">${st.map((s) => esc(client(s.client_id)?.name || '—')).join(', ') || '<span class="muted">Пока никого</span>'}</div>
        ${lessons.length ? `<div class="small muted" style="margin-top:6px">Ближайшее: ${(() => { const n = lessons.find((a) => a.date >= today()); return n ? dmy(n.date) + ' ' + n.start : 'все прошли'; })()}</div>` : ''}
        <div class="row" style="margin-top:12px"><button class="sm" data-les="${h.id}">${ic('cal')}Добавить занятие</button><button class="sm" data-addst="${h.id}">${ic('plus')}Ученица</button><span class="sp"></span><button class="sm icon" data-edh="${h.id}">${ic('edit')}</button></div></div>`;
    }).join('')}</div>` : '<div class="card empty">Потоков пока нет. Поток — это группа учениц с датами занятий.</div>';
  } else {
    html += `<div class="grid g3">${D.courses.map((c) => `<div class="card" style="${c.active ? '' : 'opacity:.55'}"><span class="badge b-violet">${esc(c.tag || 'Курс')}</span>
      <div style="font:500 24px/1.15 var(--serif);margin:10px 0 6px">${esc(c.title)}</div>
      <div class="small muted">${c.hours ? c.hours + ' ч · ' : ''}${D.students.filter((s) => s.course_id === c.id).length} учениц всего</div>
      <ul class="small" style="padding-left:18px;color:var(--text2)">${String(c.program || '').split('\n').filter(Boolean).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      <div class="row"><b class="serif" style="font-size:24px">${c.price_from ? 'от ' : ''}${rub(c.price)}</b><span class="sp"></span>${c.on_site ? '<span class="badge b-ok">на сайте</span>' : ''}<button class="sm icon" data-edc="${c.id}">${ic('edit')}</button></div></div>`).join('')}</div>`;
  }
  page.innerHTML = html;
  $('#add').onclick = () => (tab === 'students' ? studentModal() : tab === 'cohorts' ? cohortModal() : courseModal());
  $$('[data-pay]', page).forEach((b) => (b.onclick = () => payModal({ student: byId('students', b.dataset.pay) })));
  $$('[data-cert]', page).forEach((b) => (b.onclick = () => certificate(byId('students', b.dataset.cert))));
  $$('[data-ed]', page).forEach((b) => (b.onclick = () => studentModal(byId('students', b.dataset.ed))));
  $$('[data-edh]', page).forEach((b) => (b.onclick = () => cohortModal(byId('cohorts', b.dataset.edh))));
  $$('[data-edc]', page).forEach((b) => (b.onclick = () => courseModal(byId('courses', b.dataset.edc))));
  $$('[data-addst]', page).forEach((b) => (b.onclick = () => { const h = byId('cohorts', b.dataset.addst); studentModal({ cohort_id: h.id, course_id: h.course_id }); }));
  $$('[data-les]', page).forEach((b) => (b.onclick = () => apptModal({ kind: 'lesson', cohort_id: +b.dataset.les, date: byId('cohorts', b.dataset.les).start_date || today(), duration: 240 })));
});

function studentModal(s = {}) {
  const c = client(s.client_id);
  modal(s.id ? 'Ученица' : 'Новая ученица', `<div class="form">
    <label class="f">Ученица<div><input id="sq" placeholder="Имя или телефон" value="${esc(c ? c.name : '')}" autocomplete="off"></div></label>
    <div class="two hidden" id="sn"><label class="f">Имя<input id="snName"></label><label class="f">Телефон<input id="snPhone" type="tel"></label></div>
    <div class="two"><label class="f">Курс<select name="course_id" required>${opts(D.courses.map((x) => [x.id, x.title]), s.course_id, '— выберите —')}</select></label>
    <label class="f">Поток<select name="cohort_id">${opts(D.cohorts.map((h) => [h.id, cohortTitle(h)]), s.cohort_id, 'индивидуально / без потока')}</select></label></div>
    <div class="two"><label class="f">Стоимость, ₽<input name="price" type="number" min="0" step="100" value="${s.price ?? ''}"></label>
    <label class="f">Статус<select name="status">${opts(Object.entries(STUDENT_ST), s.status || 'enrolled')}</select></label></div>
    <label class="f">Номер сертификата<input name="cert_no" value="${esc(s.cert_no || '')}" placeholder="выдаётся автоматически при печати"></label>
    <label class="f">Заметка<textarea name="note" rows="2">${esc(s.note || '')}</textarea></label></div>`, {
    footer: s.id ? `<button type="button" class="danger icon" id="sd">${ic('trash')}</button>` : '',
    onOpen: (form, close) => {
      let cid = s.client_id || null; const sq = $('#sq', form);
      autocomplete(sq, { search: findClients, render: (x) => `<b>${esc(x.name)}</b> <span class="muted small">${esc(SH.fmtPhone(x.phone))}</span>`, onPick: (x) => { cid = x.id; sq.value = x.name; $('#sn', form).classList.add('hidden'); } });
      sq.addEventListener('input', () => { cid = null; $('#sn', form).classList.toggle('hidden', !sq.value.trim()); $('#snName', form).value = sq.value.trim(); });
      form.course_id.onchange = () => { const cr = byId('courses', form.course_id.value); if (cr && !form.price.value) form.price.value = cr.price; };
      if (!s.id && s.course_id && !s.price) form.price.value = byId('courses', s.course_id)?.price || '';
      form._cid = () => cid;
      const b = $('#sd', form); if (b) b.onclick = async () => { if (await confirmBox('Удалить ученицу из обучения? Оплаты останутся в финансах.', 'Удалить')) { await del('students', s.id); close(); rerender(); } };
    },
    onSubmit: async (f, form) => {
      let cid = form._cid();
      if (!cid) { const name = $('#snName', form).value.trim(); if (!name) throw new Error('Укажите ученицу'); const ph = $('#snPhone', form).value.trim(); cid = (await save('clients', { name, phone: ph ? SH.fmtPhone(ph) : null, is_student: 1, source: 'Другое' })).id; }
      if (!f.course_id) throw new Error('Выберите курс');
      await save('students', { id: s.id, client_id: cid, course_id: +f.course_id, cohort_id: f.cohort_id ? +f.cohort_id : null, price: +f.price || 0, status: f.status, cert_no: f.cert_no || null, note: f.note || null });
      if (!client(cid).is_student) await save('clients', { id: cid, is_student: 1 });
      toast('Сохранено'); rerender();
    },
  });
}
function cohortModal(h = {}) {
  modal(h.id ? 'Поток' : 'Новый поток', `<div class="form">
    <label class="f">Курс<select name="course_id">${opts(D.courses.map((x) => [x.id, x.title]), h.course_id)}</select></label>
    <label class="f">Название (необязательно)<input name="title" value="${esc(h.title || '')}" placeholder="например: Базовый, декабрь"></label>
    <div class="three"><label class="f">Начало<input type="date" name="start_date" value="${h.start_date || ''}"></label><label class="f">Окончание<input type="date" name="end_date" value="${h.end_date || ''}"></label><label class="f">Мест<input type="number" name="seats" min="1" value="${h.seats || 4}"></label></div>
    <label class="f">Расписание<input name="schedule" value="${esc(h.schedule || '')}" placeholder="пн, ср, пт с 10:00 до 15:00"></label>
    <label class="f">Статус<select name="status">${opts(Object.entries(COHORT_ST), h.status || 'open')}</select></label>
    <label class="f">Заметка<textarea name="note" rows="2">${esc(h.note || '')}</textarea></label></div>`, {
    footer: h.id ? `<button type="button" class="danger icon" id="hd">${ic('trash')}</button>` : '',
    onOpen: (form, close) => { const b = $('#hd', form); if (b) b.onclick = async () => { if (await confirmBox('Удалить поток и его занятия из календаря?', 'Удалить')) { await del('cohorts', h.id); D.appointments = D.appointments.filter((a) => !(a.kind === 'lesson' && a.cohort_id === h.id)); close(); rerender(); } }; },
    onSubmit: async (f) => { await save('cohorts', { id: h.id, ...f, course_id: +f.course_id, seats: +f.seats || null }); toast('Сохранено'); rerender(); },
  });
}
function courseModal(c = {}) {
  modal(c.id ? 'Курс' : 'Новый курс', `<div class="form">
    <label class="f">Название<input name="title" value="${esc(c.title || '')}" required></label>
    <div class="three"><label class="f">Метка<input name="tag" value="${esc(c.tag || '')}" placeholder="С нуля"></label><label class="f">Цена, ₽<input name="price" type="number" min="0" step="100" value="${c.price ?? ''}"></label><label class="f">Часов<input name="hours" type="number" min="0" value="${c.hours ?? ''}"></label></div>
    <label class="f">Программа — каждый пункт с новой строки<textarea name="program" rows="5">${esc(c.program || '')}</textarea></label>
    <div class="row"><button type="button" class="sm" id="aiC">${ic('wand')}ИИ: продающее описание</button></div><div id="aiOut"></div>
    <label class="chk"><input type="checkbox" name="price_from" ${c.price_from ?? 1 ? 'checked' : ''}> Цена «от»</label>
    <label class="chk"><input type="checkbox" name="on_site" ${c.on_site ?? 1 ? 'checked' : ''}> Показывать на сайте</label>
    <label class="chk"><input type="checkbox" name="active" ${c.active ?? 1 ? 'checked' : ''}> Курс активен</label></div>`, {
    onOpen: (form) => {
      $('#aiC', form).onclick = async (e) => {
        const b = e.currentTarget; b.disabled = true; $('#aiOut', form).innerHTML = '<div class="hint">ИИ пишет…</div>';
        try {
          const r = await api('POST', '/api/ai', { preset: 'course', prompt: `Курс: ${form.title.value}\nДля кого: ${form.tag.value}\nЦена: ${form.price.value} ₽\nЧасов: ${form.hours.value}\nПрограмма:\n${form.program.value}` });
          $('#aiOut', form).innerHTML = `<div class="ai-out">${esc(r.text)}</div><button type="button" class="sm" style="margin-top:6px" id="cpy">${ic('copy')}Скопировать</button>`;
          $('#cpy', form).onclick = () => copyText(r.text);
        } catch (er) { $('#aiOut', form).innerHTML = `<div class="notice warn">${esc(er.message)}</div>`; } finally { b.disabled = false; }
      };
    },
    onSubmit: async (f) => { await save('courses', { id: c.id, ...f, price: +f.price || 0, hours: +f.hours || null }); toast('Сохранено'); rerender(); },
  });
}
async function certificate(s) {
  if (!s.cert_no) { const n = Math.max(0, ...D.students.map((x) => parseInt(String(x.cert_no || '').replace(/\D/g, ''), 10) || 0)) + 1; s = await save('students', { id: s.id, cert_no: String(n).padStart(3, '0') }); }
  const c = client(s.client_id), cr = byId('courses', s.course_id), h = byId('cohorts', s.cohort_id);
  const date = h?.end_date || today();
  const w = window.open('', '_blank');
  if (!w) return toast('Разрешите всплывающие окна для печати', true);
  w.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Сертификат ${esc(c?.name || '')}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Manrope:wght@400;500;600&display=swap">
  <style>@page{size:A4 landscape;margin:0}body{margin:0;font-family:Manrope,sans-serif;color:#2A2420;background:#fff}
  .c{width:297mm;height:210mm;box-sizing:border-box;padding:16mm;display:flex}
  .in{flex:1;border:1.5px solid #B9975F;outline:1px solid #D9C29A;outline-offset:-6mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:18mm;background:#FBF8F4}
  .e{letter-spacing:.4em;text-transform:uppercase;font-size:12pt;color:#85663A}h1{font:400 64pt/1 'Cormorant Garamond',serif;margin:8mm 0 4mm}
  .t{font-size:12pt;color:#5C524B}.n{font:italic 500 40pt 'Cormorant Garamond',serif;color:#85663A;margin:6mm 0}.cr{font:500 22pt 'Cormorant Garamond',serif}
  .ft{display:flex;justify-content:space-between;width:100%;margin-top:16mm;font-size:11pt;color:#5C524B}.ft b{display:block;font:500 16pt 'Cormorant Garamond',serif;color:#2A2420;border-top:1px solid #B9975F;padding-top:2mm;margin-top:10mm;min-width:60mm}
  @media screen{body{background:#eee}.c{margin:20px auto;box-shadow:0 10px 40px rgba(0,0,0,.15);background:#fff}}</style></head><body>
  <div class="c"><div class="in"><div class="e">Сертификат № ${esc(s.cert_no)}</div><h1>Сертификат</h1><div class="t">подтверждает, что</div><div class="n">${esc(c?.name || '')}</div>
  <div class="t">успешно прошла обучение по программе</div><div class="cr">«${esc(cr?.title || '')}»${cr?.hours ? ` · ${cr.hours} ч` : ''}</div>
  <div class="ft"><div>Дата<b>${dmy(date)}</b></div><div>Мастер-инструктор<b>${esc(S('master_name'))}</b></div></div></div></div>
  <script>setTimeout(function(){window.print()},600)<\/script></body></html>`);
  w.document.close(); rerender();
}

// ================= Финансы =================
route(/^\/finance$/, (page, m, q) => {
  const month = q.m || ym(today());
  const tab = q.tab || (q.f === 'noreceipt' ? 'income' : 'income');
  const [y, mo] = month.split('-').map(Number);
  const prevM = ymd(new Date(y, mo - 2, 1)).slice(0, 7), nextM = ymd(new Date(y, mo, 1)).slice(0, 7);
  const pays = D.payments.filter((p) => ym(p.date) === month).sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
  const exps = D.expenses.filter((e) => ym(e.date) === month).sort((a, b) => b.date.localeCompare(a.date));
  const inc = pays.reduce((s, p) => s + +p.amount, 0), incS = pays.filter((p) => p.kind === 'service').reduce((s, p) => s + +p.amount, 0), incC = pays.filter((p) => p.kind === 'course').reduce((s, p) => s + +p.amount, 0);
  const exp = exps.reduce((s, e) => s + +e.amount, 0);
  const tax = pays.reduce((s, p) => s + p.amount * taxRate(p) / 100, 0);
  const yearInc = D.payments.filter((p) => p.date.slice(0, 4) === String(y)).reduce((s, p) => s + +p.amount, 0);
  const limit = +S('npd_limit') || 2400000;
  const noRec = D.payments.filter((p) => !p.receipt).sort((a, b) => a.date.localeCompare(b.date));
  const onlyNoRec = q.f === 'noreceipt';
  const list = onlyNoRec ? noRec : pays;
  const days = new Date(y, mo, 0).getDate();
  const byDay = Array.from({ length: days }, (_, i) => pays.filter((p) => +p.date.slice(8, 10) === i + 1).reduce((s, p) => s + +p.amount, 0));
  const maxD = Math.max(1, ...byDay);
  const dueM = ymd(new Date(y, mo, 28));

  page.innerHTML = topbar('Финансы', `<button id="addE">${ic('receipt')}<span class="hide-m">Расход</span></button><button class="primary" id="addI">${ic('plus')}<span class="hide-m">Доход</span></button>`) + `
  <div class="cal-head"><button class="icon" data-m="${prevM}">${ic('back')}</button><span class="title">${MONTHS_NOM[mo - 1]} ${y}</span><button class="icon" data-m="${nextM}">${ic('next')}</button><span class="sp"></span><a class="btn sm" href="https://lknpd.nalog.ru/" target="_blank" rel="noopener">${ic('receipt')}Мой налог</a></div>
  <div class="grid g4" style="margin-bottom:14px">
    <div class="kpi"><div class="l">Доходы</div><div class="v ok">${rub(inc)}</div><div class="s">услуги ${rub(incS)} · обучение ${rub(incC)}</div></div>
    <div class="kpi"><div class="l">Расходы</div><div class="v">${rub(exp)}</div><div class="s">материалы, аренда и прочее</div></div>
    <div class="kpi"><div class="l">Чистыми</div><div class="v acc">${rub(inc - exp - tax)}</div><div class="s">после налога и расходов</div></div>
    <div class="kpi"><div class="l">Налог НПД</div><div class="v">${rub(tax)}</div><div class="s">уплатить до ${dmy(dueM)}</div></div>
  </div>
  <div class="grid g2" style="margin-bottom:14px">
    <div class="card"><h3>Лимит самозанятой за ${y} год</h3><div class="row" style="margin-bottom:8px"><b class="serif" style="font-size:24px">${rub(yearInc)}</b><span class="muted">из ${rub(limit)}</span><span class="sp"></span><span class="${yearInc / limit > .85 ? 'bad' : 'muted'}">${Math.round(yearInc / limit * 100)}%</span></div>
      <div class="meter"><i style="width:${Math.min(100, yearInc / limit * 100)}%;${yearInc / limit > .85 ? 'background:var(--bad)' : ''}"></i></div>
      <div class="hint" style="margin-top:8px">Налог: ${S('tax_person') || 4}% с оплат физлиц, ${S('tax_company') || 6}% — от ИП и компаний. Расходы налог не уменьшают, они нужны для расчёта прибыли.</div></div>
    <div class="card"><h3>Доход по дням</h3><div class="bars">${byDay.map((v, i) => `<div class="bar ${month === ym(today()) && i + 1 === +today().slice(8) ? 'cur' : ''}" title="${i + 1}: ${rub(v)}"><i style="height:${v / maxD * 100}%"></i>${(i + 1) % 5 === 1 || days < 16 ? `<small>${i + 1}</small>` : '<small>&nbsp;</small>'}</div>`).join('')}</div></div>
  </div>
  ${noRec.length ? `<div class="notice warn row" style="margin-bottom:14px">${ic('receipt')}<span class="sp"><b>${noRec.length}</b> ${plural(noRec.length, 'оплата', 'оплаты', 'оплат')} без чека на ${rub(noRec.reduce((s, p) => s + +p.amount, 0))}. Пробейте чеки в «Мой налог» и отметьте здесь.</span>${onlyNoRec ? `<a class="btn sm" href="#/finance?m=${month}">Показать все</a>` : `<a class="btn sm" href="#/finance?m=${month}&f=noreceipt">Показать</a>`}</div>` : ''}
  <div class="tabs">${[['income', onlyNoRec ? 'Без чека' : 'Доходы'], ['expense', 'Расходы']].map(([k, t]) => `<a href="#/finance?m=${month}&tab=${k}${k === 'income' && onlyNoRec ? '&f=noreceipt' : ''}" class="${k === tab ? 'on' : ''}">${t}</a>`).join('')}</div>
  ${tab === 'income' ? `<div class="card" style="padding:6px 12px"><div class="list">${list.length ? list.map((p) => { const c = client(p.client_id); return `
    <div class="item"><span class="main-t"><b>${esc(c?.name || p.comment || 'Доход')}</b><span class="muted">${dmy(p.date)} · ${p.kind === 'course' ? 'обучение' : p.kind === 'service' ? 'услуги' : 'другое'} · ${p.method === 'cash' ? 'наличные' : 'перевод'}${p.payer === 'company' ? ' · от ИП/компании' : ''}${c && p.comment ? ' · ' + esc(p.comment) : ''}</span></span>
    <span class="mono" style="font-weight:600">${rub(p.amount)}</span>
    <button class="sm ${p.receipt ? '' : 'primary'}" data-rec="${p.id}" title="${p.receipt ? 'Чек выдан' : 'Отметить: чек выдан'}">${p.receipt ? ic('check') + '<span class="hide-m">Чек</span>' : 'Чек'}</button><button class="sm ghost icon" data-ep="${p.id}">${ic('edit')}</button></div>`; }).join('') : '<div class="empty">Нет оплат за этот месяц</div>'}</div></div>`
    : `<div class="card" style="padding:6px 12px"><div class="list">${exps.length ? exps.map((e) => `<div class="item click" data-ee="${e.id}"><span class="main-t"><b>${esc(e.category || 'Расход')}</b><span class="muted">${dmy(e.date)}${e.comment ? ' · ' + esc(e.comment) : ''}</span></span><span class="mono" style="font-weight:600">−${rub(e.amount)}</span></div>`).join('') : '<div class="empty">Расходов за месяц нет</div>'}</div>
    ${exps.length ? `<div class="hint" style="padding:8px 4px">${EXPENSE_CATS.map((c) => [c, exps.filter((e) => e.category === c).reduce((s, e) => s + +e.amount, 0)]).filter(([, v]) => v).map(([c, v]) => `${c}: ${rub(v)}`).join(' · ')}</div>` : ''}</div>`}`;
  $$('[data-m]', page).forEach((b) => (b.onclick = () => go(`/finance?m=${b.dataset.m}&tab=${tab}`)));
  $('#addE').onclick = () => expenseModal();
  $('#addI').onclick = () => incomeModal();
  $$('[data-rec]', page).forEach((b) => (b.onclick = async () => { const p = byId('payments', b.dataset.rec); await save('payments', { id: p.id, receipt: p.receipt ? 0 : 1 }); rerender(); }));
  $$('[data-ep]', page).forEach((b) => (b.onclick = () => incomeModal(byId('payments', b.dataset.ep))));
  $$('[data-ee]', page).forEach((b) => (b.onclick = () => expenseModal(byId('expenses', b.dataset.ee))));
  if (q.add === 'expense') { history.replaceState(null, '', '#/finance'); expenseModal(); }
});
function expenseModal(e = {}) {
  modal(e.id ? 'Расход' : 'Новый расход', `<div class="form"><div class="two"><label class="f">Сумма, ₽<input name="amount" type="number" min="0" step="1" value="${e.amount ?? ''}" required></label><label class="f">Дата<input name="date" type="date" value="${e.date || today()}"></label></div>
    <label class="f">Категория<select name="category">${opts(EXPENSE_CATS, e.category || 'Материалы')}</select></label><label class="f">Комментарий<input name="comment" value="${esc(e.comment || '')}" placeholder="например: базы, топы, фрезы"></label></div>`, {
    footer: e.id ? `<button type="button" class="danger icon" id="xd">${ic('trash')}</button>` : '',
    onOpen: (f, close) => { const b = $('#xd', f); if (b) b.onclick = async () => { if (await confirmBox('Удалить расход?', 'Удалить')) { await del('expenses', e.id); close(); rerender(); } }; },
    onSubmit: async (f) => { if (!(+f.amount > 0)) throw new Error('Укажите сумму'); await save('expenses', { id: e.id, ...f, amount: +f.amount }); toast('Сохранено'); rerender(); },
  });
}
function incomeModal(p = {}) {
  modal(p.id ? 'Оплата' : 'Доход без записи', `<div class="form"><div class="two"><label class="f">Сумма, ₽<input name="amount" type="number" min="0" value="${p.amount ?? ''}" required></label><label class="f">Дата<input name="date" type="date" value="${p.date || today()}"></label></div>
    <div class="two"><label class="f">За что<select name="kind">${opts([['service', 'Услуги'], ['course', 'Обучение'], ['other', 'Другое']], p.kind || 'service')}</select></label><label class="f">Способ<select name="method">${opts([['card', 'Перевод на карту'], ['cash', 'Наличные']], p.method || 'card')}</select></label></div>
    <label class="f">Плательщик<select name="payer">${opts([['person', `Физлицо — ${S('tax_person') || 4}%`], ['company', `ИП или компания — ${S('tax_company') || 6}%`]], p.payer || 'person')}</select></label>
    <label class="f">Комментарий<input name="comment" value="${esc(p.comment || '')}"></label><label class="chk"><input type="checkbox" name="receipt" ${p.receipt ? 'checked' : ''}> Чек в «Мой налог» выдан</label></div>`, {
    footer: p.id ? `<button type="button" class="danger icon" id="pd">${ic('trash')}</button>` : '',
    onOpen: (f, close) => { const b = $('#pd', f); if (b) b.onclick = async () => { if (await confirmBox('Удалить оплату? Если чек уже выдан — аннулируйте его в «Мой налог».', 'Удалить')) { await del('payments', p.id); close(); rerender(); } }; },
    onSubmit: async (f) => { if (!(+f.amount > 0)) throw new Error('Укажите сумму'); await save('payments', { id: p.id, ...f, amount: +f.amount }); toast('Сохранено'); rerender(); },
  });
}
