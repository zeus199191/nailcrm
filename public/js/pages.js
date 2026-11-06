'use strict';
/* Главная, клиентки, заявки, услуги */

// ================= Главная =================
route(/^\/$/, (page) => {
  const t = today(), n = now(), mon = ym(t);
  const hour = n.getHours();
  const hi = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  const first = (S('master_name') || '').split(/\s+/)[0];
  const todays = D.appointments.filter((a) => a.date === t && a.status !== 'cancelled').sort((a, b) => a.start.localeCompare(b.start));
  const tomorrow = D.appointments.filter((a) => a.date === addDays(t, 1) && SH.ACTIVE.includes(a.status));
  const payToday = D.payments.filter((p) => p.date === t).reduce((s, p) => s + +p.amount, 0);
  const payMonth = D.payments.filter((p) => ym(p.date) === mon);
  const incMonth = payMonth.reduce((s, p) => s + +p.amount, 0);
  const taxMonth = payMonth.reduce((s, p) => s + p.amount * taxRate(p) / 100, 0);
  const noReceipt = D.payments.filter((p) => !p.receipt).length;
  const week7 = D.appointments.filter((a) => a.kind === 'client' && SH.ACTIVE.includes(a.status) && a.date >= t && a.date <= addDays(t, 6));
  const requests = D.appointments.filter((a) => a.status === 'request');
  const newLeads = D.leads.filter((l) => l.status === 'new');
  const bdays = D.clients.map((c) => [c, birthdaySoon(c, 7)]).filter(([, d]) => d !== null).sort((a, b) => a[1] - b[1]);
  const planned = todays.filter((a) => a.kind === 'client' && SH.ACTIVE.includes(a.status)).reduce((s, a) => s + (+a.total || 0), 0);
  const debts = D.students.filter((s) => ['enrolled', 'learning'].includes(s.status) && paidStudent(s.id) < (+s.price || 0));
  const cohortsSoon = D.cohorts.filter((h) => h.status === 'open' && h.start_date && h.start_date >= t && daysBetween(t, h.start_date) <= 14);
  const readyPosts = D.posts.filter((p) => p.status === 'ready').length;

  page.innerHTML = `
  <div class="topbar" style="margin-bottom:16px"><div><h1 style="display:block">${hi}${first ? ', ' + esc(first) : ''}</h1><div class="muted" style="margin-top:4px">${dWeek(t)[0].toUpperCase() + dWeek(t).slice(1)}</div></div><span class="sp"></span>
    <button class="primary hide-m" id="addA">${ic('plus')}Запись</button></div>
  ${requests.length || newLeads.length ? `<a class="notice warn row" href="#/leads" style="margin-bottom:14px;display:flex">${ic('inbox')}<span class="sp">${requests.length ? `<b>${requests.length}</b> ${plural(requests.length, 'онлайн-запись ждёт', 'онлайн-записи ждут', 'онлайн-записей ждут')} подтверждения. ` : ''}${newLeads.length ? `<b>${newLeads.length}</b> ${plural(newLeads.length, 'новая заявка', 'новые заявки', 'новых заявок')}.` : ''}</span>${ic('next')}</a>` : ''}
  <div class="grid g4" style="margin-bottom:14px">
    <div class="kpi click" data-go="/calendar"><div class="l">Сегодня</div><div class="v">${todays.filter((a) => a.kind === 'client').length} ${plural(todays.filter((a) => a.kind === 'client').length, 'клиентка', 'клиентки', 'клиенток')}</div><div class="s">${planned ? 'ожидается ' + rub(planned) : 'свободный день'}</div></div>
    <div class="kpi click" data-go="/finance"><div class="l">Получено сегодня</div><div class="v ok">${rub(payToday)}</div><div class="s">за месяц ${rub(incMonth)}</div></div>
    ${TAX() ? `<div class="kpi click" data-go="/finance"><div class="l">Налог за ${MONTHS_NOM[n.getMonth()].toLowerCase()}</div><div class="v">${rub(taxMonth)}</div><div class="s">уплатить до 28 числа</div></div>
    <div class="kpi click" data-go="/finance?f=noreceipt"><div class="l">Чеки не выданы</div><div class="v ${noReceipt ? 'warn' : ''}">${noReceipt}</div><div class="s">${noReceipt ? 'пробейте в «Мой налог»' : 'всё в порядке'}</div></div>`
    : `<div class="kpi click" data-go="/calendar?v=week"><div class="l">Записей на неделю</div><div class="v">${week7.length}</div><div class="s">${week7.length ? 'на ' + rub(week7.reduce((s, a) => s + (+a.total || 0), 0)) : 'окна свободны'}</div></div>
    <div class="kpi click" data-go="/leads"><div class="l">Новые заявки</div><div class="v ${requests.length + newLeads.length ? 'warn' : ''}">${requests.length + newLeads.length}</div><div class="s">${requests.length + newLeads.length ? 'ждут ответа' : 'всё обработано'}</div></div>`}
  </div>
  <div class="grid g-main">
    <div class="card"><div class="row" style="margin-bottom:6px"><h3 style="margin:0">Записи на сегодня</h3><span class="sp"></span><a href="#/calendar?v=day&d=${t}" class="small">Календарь →</a></div>
      <div class="list">${todays.length ? todays.map(apptRow).join('') : `<div class="empty">На сегодня записей нет${isWorkDay(t) ? '' : ' — выходной'}<br><button class="sm" id="addA2" style="margin-top:10px">${ic('plus')}Записать</button></div>`}</div>
      ${tomorrow.length ? `<div class="hint" style="margin-top:10px">Завтра: ${tomorrow.length} ${plural(tomorrow.length, 'запись', 'записи', 'записей')} — ${tomorrow.sort((a, b) => a.start.localeCompare(b.start)).map((a) => `${a.start} ${esc(apptTitle(a))}`).join(', ')}</div>` : ''}
    </div>
    <div class="col" style="gap:14px">
      <div class="card"><h3>Быстрые действия</h3><div class="grid g2" style="gap:8px">
        <button id="qA">${ic('cal')}Запись</button><button id="qC">${ic('users')}Клиентка</button>
        <button data-go="/marketing?tab=smm">${ic('photo')}Пост</button><button data-go="/marketing?tab=sms">${ic('msg')}Рассылка</button>
        <button data-go="/finance?add=expense">${ic('receipt')}Расход</button><button data-go="/marketing?tab=ai">${ic('wand')}ИИ-текст</button>
      </div></div>
      ${bdays.length ? `<div class="card"><h3>${ic('gift').replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-2px"')} Дни рождения на неделе</h3><div class="list">${bdays.map(([c, d]) => `<a class="item click" href="#/clients/${c.id}" style="color:var(--text)"><span class="av">${esc(initials(c.name))}</span><span class="main-t"><b>${esc(c.name)}</b><span class="muted">${d === 0 ? 'сегодня 🎉' : d === 1 ? 'завтра' : 'через ' + d + ' ' + plural(d, 'день', 'дня', 'дней')} · ${dLong(t.slice(0, 4) + '-' + c.birthday.slice(-5))}</span></span></a>`).join('')}</div></div>` : ''}
      ${cohortsSoon.length || debts.length ? `<div class="card"><h3>Обучение</h3><div class="list">
        ${cohortsSoon.map((h) => `<a class="item click" href="#/training?tab=cohorts" style="color:var(--text)"><span class="main-t"><b>${esc(cohortTitle(h))}</b><span class="muted">старт ${dmy(h.start_date)} · ${D.students.filter((s) => s.cohort_id === h.id && s.status !== 'dropped').length} из ${h.seats || '—'} мест</span></span></a>`).join('')}
        ${debts.slice(0, 4).map((s) => `<a class="item click" href="#/training" style="color:var(--text)"><span class="main-t"><b>${esc(client(s.client_id)?.name || 'Ученица')}</b><span class="muted">осталось оплатить ${rub(s.price - paidStudent(s.id))}</span></span></a>`).join('')}</div></div>` : ''}
      ${readyPosts ? `<a class="notice info" href="#/marketing?tab=smm">${readyPosts} ${plural(readyPosts, 'пост ждёт', 'поста ждут', 'постов ждут')} публикации по расписанию</a>` : ''}
    </div>
  </div>`;
  $$('[data-go]', page).forEach((b) => (b.onclick = () => go(b.dataset.go)));
  ['#addA', '#addA2', '#qA'].forEach((s) => { const b = $(s, page); if (b) b.onclick = () => apptModal({ date: t }); });
  $('#qC', page).onclick = () => clientModal();
  $$('[data-appt]', page).forEach((e) => (e.onclick = () => apptModal(byId('appointments', e.dataset.appt))));
});

// ================= Клиентки =================
const CL_FILTERS = [['all', 'Все'], ['regular', 'Постоянные'], ['lost', 'Давно не были'], ['new', 'Новые за месяц'], ['students', 'Ученицы'], ['bday', 'Именинницы месяца']];
function clientFilter(f) {
  const t = today();
  return (c) => {
    if (f === 'regular') return doneVisits(c.id).length >= 3;
    if (f === 'lost') { const lv = lastVisit(c.id); return lv && daysBetween(lv, t) > 45 && !nextVisit(c.id); }
    if (f === 'new') return (c.created_at || '').slice(0, 7) === ym(t);
    if (f === 'students') return c.is_student || D.students.some((s) => s.client_id === c.id);
    if (f === 'bday') return c.birthday && c.birthday.slice(-5, -3) === t.slice(5, 7);
    return true;
  };
}
route(/^\/clients$/, (page, m, q) => {
  const f = q.f || 'all';
  page.innerHTML = topbar('Клиентки', `<button class="hide-m" id="imp">${ic('upload')}Импорт</button><button class="primary" id="add">${ic('plus')}<span class="hide-m">Клиентка</span></button>`) + `
  <div class="row" style="margin-bottom:12px"><div class="search">${ic('search')}<input id="q" placeholder="Поиск по имени или телефону" value="${esc(q.q || '')}"></div></div>
  <div class="chips" style="margin-bottom:14px">${CL_FILTERS.map(([k, t]) => `<button class="chip ${k === f ? 'on' : ''}" data-f="${k}">${t} <span class="n">${D.clients.filter(clientFilter(k)).length}</span></button>`).join('')}</div>
  <div class="card" style="padding:6px 10px"><div class="list" id="list"></div></div>`;
  const draw = () => {
    const qs = $('#q').value.trim();
    let rows = D.clients.filter(clientFilter(f));
    if (qs) { const ql = qs.toLowerCase(); const qd = qs.replace(/\D/g, ''); rows = D.clients.filter(clientFilter(f)).filter((c) => c.name.toLowerCase().includes(ql) || (qd.length >= 3 && (c.phone_norm || '').includes(qd))); }
    rows = rows.slice().sort((a, b) => (lastVisit(b.id) || b.created_at || '').localeCompare(lastVisit(a.id) || a.created_at || ''));
    $('#list').innerHTML = rows.length ? rows.slice(0, 300).map((c) => {
      const n = doneVisits(c.id).length, lv = lastVisit(c.id), nx = nextVisit(c.id);
      return `<a class="item click" href="#/clients/${c.id}" style="color:var(--text)"><span class="av">${esc(initials(c.name))}</span><span class="main-t"><b>${esc(c.name)}${c.is_student || D.students.some((s) => s.client_id === c.id) ? ' <span class="badge b-violet">ученица</span>' : ''}</b>
        <span class="muted">${esc(SH.fmtPhone(c.phone) || 'без телефона')}${n ? ' · ' + n + ' ' + plural(n, 'визит', 'визита', 'визитов') : ''}${lv ? ' · был' + 'а ' + dmy(lv) : ''}</span></span>
        ${nx ? `<span class="badge b-booked hide-m">${dmy(nx.date)} ${nx.start}</span>` : ''}<span class="mono small muted hide-m">${spentBy(c.id) ? rub(spentBy(c.id)) : ''}</span></a>`;
    }).join('') : '<div class="empty">Никого не нашлось</div>';
  };
  $('#q').addEventListener('input', debounce(draw, 150));
  $$('[data-f]', page).forEach((b) => (b.onclick = () => go('/clients?f=' + b.dataset.f)));
  $('#add').onclick = () => clientModal();
  $('#imp').onclick = importModal;
  draw();
});

function clientModal(c = {}, after) {
  modal(c.id ? 'Клиентка' : 'Новая клиентка', `<div class="form">
    <label class="f">Имя и фамилия<input name="name" value="${esc(c.name || '')}" required></label>
    <div class="two"><label class="f">Телефон<input name="phone" type="tel" inputmode="tel" value="${esc(c.phone || '')}" placeholder="+7"></label>
    <label class="f">День рождения<input name="birthday" type="date" value="${esc(c.birthday && c.birthday.length === 10 ? c.birthday : '')}"></label></div>
    <div class="two"><label class="f">Откуда пришла<select name="source">${opts(SOURCES, c.source, '—')}</select></label>
    <label class="f">Постоянная скидка, %<input name="discount" type="number" min="0" max="100" value="${c.discount || ''}"></label></div>
    <label class="f">Заметки (форма, длина, аллергии, любимые оттенки)<textarea name="notes" rows="3">${esc(c.notes || '')}</textarea></label>
    <label class="chk"><input type="checkbox" name="is_student" ${c.is_student ? 'checked' : ''}> Ученица / мастер</label>
    <label class="chk"><input type="checkbox" name="no_sms" ${c.no_sms ? 'checked' : ''}> Не отправлять SMS-рассылки</label>
  </div>`, {
    onSubmit: async (f) => {
      if (!f.name) throw new Error('Укажите имя');
      const pn = SH.normPhone(f.phone);
      const dup = pn && D.clients.find((x) => x.id !== c.id && x.phone_norm === pn);
      if (dup && !(await confirmBox(`Телефон уже есть у «${esc(dup.name)}». Всё равно сохранить?`, 'Сохранить'))) return false;
      const row = await save('clients', { id: c.id, ...f, phone: f.phone ? SH.fmtPhone(f.phone) : null, discount: +f.discount || 0, birthday: f.birthday || null });
      toast('Сохранено');
      if (after) after(row); else if (!c.id) go('/clients/' + row.id); else rerender();
    },
  });
}

route(/^\/clients\/(\d+)$/, (page, m) => {
  const c = client(m[1]);
  if (!c) { page.innerHTML = '<div class="card empty">Клиентка не найдена</div>'; return; }
  const visits = visitsOf(c.id).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
  const done = visits.filter((a) => a.status === 'done');
  const spent = spentBy(c.id);
  const avg = done.length ? done.reduce((s, a) => s + (+a.total || 0), 0) / done.length : 0;
  const nx = nextVisit(c.id);
  const lv = lastVisit(c.id);
  const gaps = done.map((a) => a.date).sort().map((d, i, arr) => (i ? daysBetween(arr[i - 1], d) : null)).filter((x) => x);
  const every = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;
  const studs = D.students.filter((s) => s.client_id === c.id);
  const noshow = visits.filter((a) => a.status === 'noshow').length;
  page.innerHTML = `
  <div class="topbar"><button class="ghost icon" onclick="history.back()" aria-label="Назад">${ic('back')}</button><h1 style="display:block">${esc(c.name)}</h1><span class="sp"></span>
    <button id="edit">${ic('edit')}<span class="hide-m">Изменить</span></button></div>
  <div class="row" style="margin-bottom:14px">
    <button class="primary" id="book">${ic('cal')}Записать</button>
    ${c.phone ? `<a class="btn" href="${telHref(c.phone)}">${ic('phone')}Позвонить</a><a class="btn" href="${waHref(c.phone)}" target="_blank" rel="noopener">WhatsApp</a><button id="sms">${ic('msg')}SMS</button>` : ''}
  </div>
  <div class="grid g4" style="margin-bottom:14px">
    <div class="kpi"><div class="l">Визитов</div><div class="v">${done.length}</div><div class="s">${noshow ? 'не пришла: ' + noshow : every ? 'приходит раз в ' + every + ' дн.' : ''}</div></div>
    <div class="kpi"><div class="l">Оплачено всего</div><div class="v">${rub(spent)}</div><div class="s">${avg ? 'средний чек ' + rub(avg) : ''}</div></div>
    <div class="kpi"><div class="l">Последний визит</div><div class="v" style="font-size:22px">${lv ? dmy(lv) : '—'}</div><div class="s">${lv ? daysBetween(lv, today()) + ' дн. назад' : ''}</div></div>
    <div class="kpi"><div class="l">Следующая запись</div><div class="v" style="font-size:22px">${nx ? dmy(nx.date) : '—'}</div><div class="s">${nx ? nx.start + ' · ' + esc(apptServices(nx)) : 'не записана'}</div></div>
  </div>
  <div class="grid g-main">
    <div class="card"><h3>История визитов</h3><div class="list">${visits.length ? visits.map((a) => `<div class="item click" data-appt="${a.id}"><span class="main-t"><b>${dmy(a.date)} · ${a.start}</b><span class="muted">${esc(apptServices(a) || '—')}${a.note ? ' · ' + esc(a.note) : ''}</span></span><span class="mono">${a.total ? rub(a.total) : ''}</span>${statusBadge(a.status)}</div>`).join('') : '<div class="empty">Визитов пока нет</div>'}</div></div>
    <div class="col" style="gap:14px">
      <div class="card"><h3>Контакты и заметки</h3><div class="col" style="gap:6px">
        <div>${ic('phone').replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-2px;color:var(--muted)"')} ${esc(SH.fmtPhone(c.phone) || '—')}</div>
        ${c.birthday ? `<div>🎂 ${dLong(c.birthday.length === 10 ? c.birthday : '2000-' + c.birthday.slice(-5))}</div>` : ''}
        ${c.source ? `<div class="muted small">Источник: ${esc(c.source)}</div>` : ''}
        ${c.discount ? `<div><span class="badge b-ok">Скидка ${c.discount}%</span></div>` : ''}
        ${c.no_sms ? '<div><span class="badge b-bad">Без SMS-рассылок</span></div>' : ''}
        <div style="white-space:pre-wrap;margin-top:6px">${c.notes ? esc(c.notes) : '<span class="muted">Заметок нет</span>'}</div>
        <div class="muted small">В базе с ${dmy(c.created_at)}</div>
      </div></div>
      ${studs.length ? `<div class="card"><h3>Обучение</h3>${studs.map((s) => `<div class="item"><span class="main-t"><b>${esc(byId('courses', s.course_id)?.title || 'Курс')}</b><span class="muted">${STUDENT_ST[s.status] || s.status} · оплачено ${rub(paidStudent(s.id))} из ${rub(s.price)}</span></span></div>`).join('')}</div>` : ''}
      <button class="danger sm" id="delC" style="align-self:flex-start">${ic('trash')}Удалить клиентку</button>
    </div>
  </div>`;
  $('#edit').onclick = () => clientModal(c);
  $('#book').onclick = () => apptModal({ client_id: c.id, date: today() });
  const sb = $('#sms'); if (sb) sb.onclick = () => smsOneModal(c);
  $$('[data-appt]', page).forEach((e) => (e.onclick = () => apptModal(byId('appointments', e.dataset.appt))));
  $('#delC').onclick = async () => { if (!(await confirmBox(`Удалить «${esc(c.name)}» вместе с историей записей? Оплаты в финансах останутся.`, 'Удалить'))) return; await del('clients', c.id); D.appointments = D.appointments.filter((a) => a.client_id !== c.id); toast('Удалено'); go('/clients'); };
});

function smsOneModal(c, text = '') {
  if (!D.integrations.sms) return toast('SMS не подключены: Настройки → SMS', true);
  modal('SMS — ' + esc(c.name), `<div class="form"><label class="f">Текст<textarea name="text" rows="4" id="st">${esc(text)}</textarea></label><div class="hint" id="sl"></div><div class="hint">Подстановки: {имя}, {телефон}, {адрес}</div></div>`, {
    submit: 'Отправить',
    onOpen: (f) => { const u = () => { const v = SH.fill(f.text.value, { name: c.name }, D.settings); $('#sl', f).textContent = `${v.length} симв. · ${SH.smsParts(v)} SMS`; }; f.text.oninput = u; u(); },
    onSubmit: async (f) => { const r = await api('POST', '/api/sms/send', { phone: c.phone, client_id: c.id, name: c.name, text: f.text }); toast(r.queued ? 'SMS поставлена в очередь' : 'Не отправлено: ' + Object.keys(r.skipped).join(', '), !r.queued); },
  });
}

function importModal() {
  modal('Импорт клиенток', `<div class="form"><div class="hint">Вставьте список из Excel, Google-таблицы или заметок: каждая клиентка с новой строки, имя и телефон через табуляцию, точку с запятой или запятую. Дубли по телефону пропускаются.</div>
    <textarea name="txt" rows="10" placeholder="Анна Иванова; 89131234567&#10;Ольга	+7 913 765-43-21"></textarea>
    <label class="f">Источник<select name="source">${opts(SOURCES, 'Постоянная')}</select></label></div>`, {
    submit: 'Загрузить',
    onSubmit: async (f) => {
      let n = 0, skip = 0;
      for (const line of f.txt.split(/\r?\n/)) {
        const ph = (line.match(/(\+?\d[\d\s()\-]{8,}\d)/) || [])[1]; if (!ph) { if (line.trim()) skip++; continue; }
        const pn = SH.normPhone(ph); if (pn.length !== 11 || D.clients.some((c) => c.phone_norm === pn)) { skip++; continue; }
        const name = line.replace(ph, '').replace(/[;,\t]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Клиентка';
        await save('clients', { name, phone: SH.fmtPhone(pn), source: f.source }); n++;
      }
      toast(`Добавлено: ${n}${skip ? ', пропущено: ' + skip : ''}`); rerender();
    },
  });
}

// ================= Заявки =================
const LEAD_ST = { new: 'Новая', work: 'В работе', done: 'Обработана', lost: 'Отказ' };
route(/^\/leads$/, (page, m, q) => {
  const f = q.f || 'open';
  const reqs = D.appointments.filter((a) => a.status === 'request').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const leads = D.leads.filter((l) => (f === 'open' ? ['new', 'work'].includes(l.status) : f === 'all' ? true : l.status === f)).sort((a, b) => b.id - a.id);
  page.innerHTML = topbar('Заявки', `<button class="primary" id="add">${ic('plus')}<span class="hide-m">Заявка</span></button>`) + `
  ${reqs.length ? `<div class="card" style="margin-bottom:14px;border-color:#EBD3A6"><h3>Онлайн-записи ждут подтверждения</h3><div class="list">${reqs.map((a) => { const c = client(a.client_id); return `
    <div class="item" style="flex-wrap:wrap"><span class="time">${a.start}</span><span class="main-t"><b>${esc(c?.name || 'Клиентка')} · ${dWeek(a.date)}</b><span class="muted">${esc(apptServices(a))} · ${rub(a.total)}${c?.phone ? ' · ' + esc(SH.fmtPhone(c.phone)) : ''}${a.note ? ' · 💬 ' + esc(a.note) : ''}</span></span>
    <div class="row"><button class="primary sm" data-ok="${a.id}">${ic('check')}Подтвердить</button><button class="sm" data-edit="${a.id}">Другое время</button><button class="sm danger" data-no="${a.id}">Отклонить</button>${c?.phone ? `<a class="btn sm icon" href="${telHref(c.phone)}">${ic('phone')}</a>` : ''}</div></div>`; }).join('')}</div>
    ${D.integrations.sms && S('sms_auto_confirm') === '1' ? '<div class="hint">После подтверждения клиентке уйдёт SMS.</div>' : ''}</div>` : ''}
  <div class="chips" style="margin-bottom:12px">${[['open', 'Активные'], ['done', 'Обработанные'], ['lost', 'Отказ'], ['all', 'Все']].map(([k, t]) => `<button class="chip ${k === f ? 'on' : ''}" data-f="${k}">${t}</button>`).join('')}</div>
  <div class="card" style="padding:6px 12px"><div class="list">${leads.length ? leads.map((l) => `
    <div class="item" style="flex-wrap:wrap;align-items:flex-start"><span class="av" style="${l.kind === 'course' ? 'background:var(--violetbg);color:var(--violet)' : ''}">${l.kind === 'course' ? ic('cap') : esc(initials(l.name || '?'))}</span>
      <span class="main-t" style="min-width:200px"><b>${esc(l.name || 'Без имени')} <span class="badge ${l.status === 'new' ? 'b-warn' : l.status === 'work' ? 'b-info' : l.status === 'lost' ? 'b-bad' : 'b-ok'}">${LEAD_ST[l.status]}</span></b>
      <span class="muted">${esc(SH.fmtPhone(l.phone))} · ${esc(l.subject || (l.kind === 'course' ? 'Обучение' : 'Услуги'))} · ${esc(l.source || '')} · ${dmy(l.created_at)} ${(l.created_at || '').slice(11, 16)}</span>
      ${l.message ? `<div style="margin-top:4px;white-space:pre-wrap">${esc(l.message)}</div>` : ''}</span>
      <div class="row">${l.phone ? `<a class="btn sm" href="${telHref(l.phone)}">${ic('phone')}</a>` : ''}
        ${['new', 'work'].includes(l.status) ? `${l.kind === 'course' ? `<button class="sm primary" data-stud="${l.id}">${ic('cap')}В ученицы</button>` : `<button class="sm primary" data-book="${l.id}">${ic('cal')}Записать</button>`}
        ${l.status === 'new' ? `<button class="sm" data-st="${l.id}:work">В работе</button>` : ''}<button class="sm" data-st="${l.id}:lost">Отказ</button>` : ''}
        <button class="sm ghost icon" data-del="${l.id}" title="Удалить">${ic('trash')}</button></div></div>`).join('') : '<div class="empty">Заявок нет. Они приходят с сайта, а также их можно добавить вручную.</div>'}</div></div>`;
  $$('[data-f]', page).forEach((b) => (b.onclick = () => go('/leads?f=' + b.dataset.f)));
  $('#add').onclick = () => leadModal();
  $$('[data-ok]', page).forEach((b) => (b.onclick = async () => { await save('appointments', { id: +b.dataset.ok, status: 'booked', _sms_confirm: 1 }); toast('Запись подтверждена'); rerender(); }));
  $$('[data-edit]', page).forEach((b) => (b.onclick = () => apptModal({ ...byId('appointments', b.dataset.edit), status: 'booked' })));
  $$('[data-no]', page).forEach((b) => (b.onclick = async () => { if (!(await confirmBox('Отклонить онлайн-запись? Лучше позвонить клиентке и предложить другое время.', 'Отклонить'))) return; await save('appointments', { id: +b.dataset.no, status: 'cancelled' }); rerender(); }));
  $$('[data-st]', page).forEach((b) => (b.onclick = async () => { const [id, st] = b.dataset.st.split(':'); await save('leads', { id: +id, status: st }); rerender(); }));
  $$('[data-del]', page).forEach((b) => (b.onclick = async () => { if (await confirmBox('Удалить заявку?', 'Удалить')) { await del('leads', b.dataset.del); rerender(); } }));
  const ensureClient = async (l) => { const pn = SH.normPhone(l.phone); return D.clients.find((c) => pn && c.phone_norm === pn) || save('clients', { name: l.name || 'Клиентка', phone: l.phone, source: l.source === 'Сайт' ? 'Сайт' : 'Другое' }); };
  $$('[data-book]', page).forEach((b) => (b.onclick = async () => { const l = byId('leads', b.dataset.book); const c = await ensureClient(l); await save('leads', { id: l.id, status: 'done' }); apptModal({ client_id: c.id, date: today(), note: l.message || null }); }));
  $$('[data-stud]', page).forEach((b) => (b.onclick = async () => { const l = byId('leads', b.dataset.stud); const c = await ensureClient(l); if (!c.is_student) await save('clients', { id: c.id, is_student: 1 }); await save('leads', { id: l.id, status: 'done' }); const cr = D.courses.find((x) => (l.subject || l.message || '').includes(x.title)); studentModal({ client_id: c.id, course_id: cr?.id }); }));
});
function leadModal(l = {}) {
  modal('Заявка', `<div class="form"><div class="two"><label class="f">Имя<input name="name" value="${esc(l.name || '')}"></label><label class="f">Телефон<input name="phone" type="tel" value="${esc(l.phone || '')}" required></label></div>
    <div class="two"><label class="f">Тип<select name="kind">${opts([['service', 'Услуги'], ['course', 'Обучение'], ['other', 'Другое']], l.kind || 'service')}</select></label><label class="f">Источник<select name="source">${opts(SOURCES, l.source || 'Telegram')}</select></label></div>
    <label class="f">Что интересует<input name="subject" value="${esc(l.subject || '')}"></label><label class="f">Комментарий<textarea name="message">${esc(l.message || '')}</textarea></label></div>`, {
    onSubmit: async (f) => { if (!f.phone) throw new Error('Укажите телефон'); await save('leads', { id: l.id, ...f, phone: SH.fmtPhone(f.phone), status: l.status || 'new' }); rerender(); },
  });
}

// ================= Услуги и цены =================
route(/^\/services$/, (page) => {
  const cats = [...new Set(D.services.map((s) => s.category || 'Услуги'))];
  page.innerHTML = topbar('Услуги и цены', `<button class="primary" id="add">${ic('plus')}Услуга</button>`, 'Прайс сразу виден на сайте и в онлайн-записи. Длительность нужна, чтобы онлайн-запись правильно считала свободное время.') +
    cats.map((cat) => `<div class="card"><h3>${esc(cat)}</h3><div class="list">${D.services.filter((s) => (s.category || 'Услуги') === cat).sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.id - b.id).map((s) => `
      <div class="item click" data-s="${s.id}" style="${s.active ? '' : 'opacity:.5'}"><span class="main-t"><b>${esc(s.name)}</b><span class="muted">${fmtDur(s.duration)}${s.note ? ' · ' + esc(s.note) : ''}</span></span>
      ${s.on_site ? '<span class="badge b-ok hide-m">на сайте</span>' : '<span class="badge hide-m">скрыта</span>'}<span class="serif acc" style="font-size:21px;white-space:nowrap">${s.price_from ? 'от ' : ''}${rub(s.price)}</span></div>`).join('')}</div></div>`).join('');
  $('#add').onclick = () => serviceModal();
  $$('[data-s]', page).forEach((e) => (e.onclick = () => serviceModal(byId('services', e.dataset.s))));
});
function serviceModal(s = {}) {
  const cats = [...new Set(D.services.map((x) => x.category).filter(Boolean))];
  modal(s.id ? 'Услуга' : 'Новая услуга', `<div class="form">
    <label class="f">Название<input name="name" value="${esc(s.name || '')}" required></label>
    <label class="f">Категория<input name="category" list="cats" value="${esc(s.category || cats[0] || '')}"><datalist id="cats">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
    <div class="three"><label class="f">Цена, ₽<input name="price" type="number" min="0" step="10" value="${s.price ?? ''}"></label>
    <label class="f">Длительность<select name="duration">${opts([10, 15, 20, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240].map((m) => [m, fmtDur(m)]), s.duration || 60)}</select></label>
    <label class="f">Порядок<input name="sort" type="number" value="${s.sort ?? D.services.length}"></label></div>
    <label class="f">Пояснение (видно на сайте)<input name="note" value="${esc(s.note || '')}"></label>
    <label class="chk"><input type="checkbox" name="price_from" ${s.price_from ? 'checked' : ''}> Цена «от»</label>
    <label class="chk"><input type="checkbox" name="on_site" ${s.on_site ?? 1 ? 'checked' : ''}> Показывать на сайте и в онлайн-записи</label>
    <label class="chk"><input type="checkbox" name="active" ${s.active ?? 1 ? 'checked' : ''}> Услуга активна</label></div>`, {
    footer: s.id ? `<button type="button" class="danger icon" id="sd">${ic('trash')}</button>` : '',
    onSubmit: async (f) => { await save('services', { id: s.id, ...f, price: +f.price || 0, duration: +f.duration, sort: +f.sort || 0 }); toast('Сохранено'); rerender(); },
    onOpen: (form, close) => { const b = $('#sd', form); if (b) b.onclick = async () => { if (await confirmBox('Удалить услугу? В старых записях она останется.', 'Удалить')) { await del('services', s.id); close(); rerender(); } }; },
  });
}
