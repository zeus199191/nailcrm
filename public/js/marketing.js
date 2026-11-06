'use strict';
/* Маркетинг: аналитика, SMM и контент-план, SMS-рассылки, портфолио, отзывы, ИИ-помощник */
const CH = { max: 'MAX', tg: 'Telegram', vk: 'ВКонтакте', site: 'Сайт' };
const POST_ST = { idea: 'Идея', draft: 'Черновик', ready: 'Готов к публикации', published: 'Опубликован', partial: 'Опубликован частично', error: 'Ошибка' };
const chConnected = (k) => (k === 'site' ? true : k === 'tg' ? !!(D.integrations.tg?.token && D.integrations.tg?.post_chat) : k === 'max' ? !!(D.integrations.max?.token && D.integrations.max?.content_chat) : !!(D.integrations.vk?.token && D.integrations.vk?.group));

route(/^\/marketing$/, (page, m, q) => {
  const tab = q.tab || 'analytics';
  const T = [['analytics', 'Аналитика'], ['smm', 'SMM и контент-план'], ['sms', 'SMS-рассылки'], ['portfolio', 'Портфолио'], ['reviews', 'Отзывы'], ['ai', 'ИИ-помощник']];
  page.innerHTML = topbar('Маркетинг') + `<div class="tabs">${T.map(([k, t]) => `<a href="#/marketing?tab=${k}" class="${k === tab ? 'on' : ''}">${t}</a>`).join('')}</div><div id="mk"></div>`;
  const el = $('#mk');
  ({ analytics, smm, sms: smsTab, portfolio, reviews: reviewsTab, ai: aiTab }[tab] || analytics)(el, q);
});

// ---------- аналитика ----------
function analytics(el) {
  const t = today(), mon = ym(t);
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(+t.slice(0, 4), +t.slice(5, 7) - 12 + i, 1); return ymd(d).slice(0, 7); });
  const rev = months.map((mm) => D.payments.filter((p) => ym(p.date) === mm).reduce((s, p) => s + +p.amount, 0));
  const maxR = Math.max(1, ...rev);
  const visM = D.appointments.filter((a) => a.kind === 'client' && ym(a.date) === mon);
  const done = visM.filter((a) => a.status === 'done'), noshow = visM.filter((a) => a.status === 'noshow');
  const avg = done.length ? done.reduce((s, a) => s + (+a.total || 0), 0) / done.length : 0;
  const firstVisit = {}; D.appointments.filter((a) => a.status === 'done' && a.client_id).forEach((a) => { if (!firstVisit[a.client_id] || a.date < firstVisit[a.client_id]) firstVisit[a.client_id] = a.date; });
  const newC = [...new Set(done.map((a) => a.client_id))].filter((id) => ym(firstVisit[id]) === mon).length;
  const uniq = new Set(done.map((a) => a.client_id)).size;
  // загрузка: занятые минуты / рабочие минуты месяца
  const [yy, mm] = mon.split('-').map(Number); const nd = new Date(yy, mm, 0).getDate();
  let work = 0; for (let i = 1; i <= nd; i++) if (isWorkDay(`${mon}-${pad(i)}`)) work += SH.toMin(S('work_to') || '20:00') - SH.toMin(S('work_from') || '10:00');
  const busy = D.appointments.filter((a) => ym(a.date) === mon && !['cancelled', 'noshow'].includes(a.status)).reduce((s, a) => s + (+a.duration || 0), 0);
  // возвращаемость: клиентки, у которых после визита был следующий в течение 45 дней
  const doneAll = D.appointments.filter((a) => a.status === 'done' && a.client_id && a.date <= addDays(t, -45));
  const ret = doneAll.filter((a) => D.appointments.some((b) => b.client_id === a.client_id && b.status === 'done' && b.date > a.date && daysBetween(a.date, b.date) <= 45));
  const sources = {}; D.clients.forEach((c) => { const k = c.source || 'Не указан'; sources[k] = (sources[k] || 0) + 1; });
  const srcList = Object.entries(sources).sort((a, b) => b[1] - a[1]);
  const svc = {}; D.appointments.filter((a) => a.status === 'done' && a.date >= addDays(t, -90)).forEach((a) => apptItems(a).forEach((i) => { svc[i.name] = svc[i.name] || [0, 0]; svc[i.name][0]++; svc[i.name][1] += +i.price || 0; }));
  const svcList = Object.entries(svc).sort((a, b) => b[1][1] - a[1][1]).slice(0, 8);
  const maxS = Math.max(1, ...svcList.map((x) => x[1][1])), maxSrc = Math.max(1, ...srcList.map((x) => x[1]));
  const lost = D.clients.filter(clientFilter('lost')).length;
  el.innerHTML = `<div class="grid g4" style="margin-bottom:14px">
    <div class="kpi"><div class="l">Визитов в месяце</div><div class="v">${done.length}</div><div class="s">${uniq} ${plural(uniq, 'клиентка', 'клиентки', 'клиенток')}, новых ${newC}</div></div>
    <div class="kpi"><div class="l">Средний чек</div><div class="v">${rub(avg)}</div><div class="s">по визитам месяца</div></div>
    <div class="kpi"><div class="l">Загрузка</div><div class="v">${work ? Math.round(busy / work * 100) : 0}%</div><div class="s">записано ${fmtDur(busy)}</div></div>
    <div class="kpi"><div class="l">Возвращаются</div><div class="v">${doneAll.length ? Math.round(ret.length / doneAll.length * 100) : 0}%</div><div class="s">в течение 45 дней · не пришли: ${noshow.length}</div></div></div>
  <div class="card" style="margin-bottom:14px"><h3>Доход за 12 месяцев</h3><div class="bars" style="height:180px">${rev.map((v, i) => `<div class="bar ${i === 11 ? 'cur' : ''}" title="${MONTHS_NOM[+months[i].slice(5) - 1]}: ${rub(v)}"><small class="mono">${v ? Math.round(v / 1000) + 'к' : ''}</small><i style="height:${v / maxR * 100}%"></i><small>${MONTHS_NOM[+months[i].slice(5) - 1].slice(0, 3)}</small></div>`).join('')}</div></div>
  <div class="grid g2">
    <div class="card"><h3>Что приносит деньги · 90 дней</h3>${svcList.length ? `<div class="hbar">${svcList.map(([n, [c, s]]) => `<span>${esc(n)} <span class="muted small">× ${c}</span></span><span class="r mono">${rub(s)}</span><div class="meter"><i style="width:${s / maxS * 100}%"></i></div>`).join('')}</div>` : '<div class="empty">Пока нет данных</div>'}</div>
    <div class="card"><h3>Откуда приходят клиентки</h3>${srcList.length ? `<div class="hbar">${srcList.map(([n, c]) => `<span>${esc(n)}</span><span class="r mono">${c}</span><div class="meter"><i style="width:${c / maxSrc * 100}%"></i></div>`).join('')}</div>` : '<div class="empty">Пока нет данных</div>'}
      ${lost ? `<div class="notice" style="margin-top:10px">${lost} ${plural(lost, 'клиентка давно не была', 'клиентки давно не были', 'клиенток давно не были')} (больше 45 дней). <a href="#/marketing?tab=sms&seg=lost">Напомнить о себе SMS →</a></div>` : ''}</div>
  </div>`;
}

// ---------- SMM ----------
function smm(el, q) {
  const month = q.m || ym(today());
  const [y, mo] = month.split('-').map(Number);
  const first = new Date(y, mo - 1, 1); const start = addDays(ymd(first), -((first.getDay() + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const weeks = cells.slice(35)[0].slice(0, 7) > month ? 5 : 6;
  const posts = D.posts.slice().sort((a, b) => String(b.date || b.created_at).localeCompare(String(a.date || a.created_at)));
  const conn = ['max', 'tg', 'vk'].filter(chConnected);
  el.innerHTML = `<div class="row" style="margin-bottom:12px"><button class="primary" id="np">${ic('plus')}Пост</button><button id="ideas">${ic('wand')}ИИ: идеи на месяц</button><span class="sp"></span>
    <span class="small muted">Подключено: ${['Сайт', ...conn.map((k) => CH[k])].join(', ')}${conn.length < 3 ? ` · <a href="#/settings#fSocial">подключить</a>` : ''}</span></div>
  <div class="cal-head"><button class="icon" data-m="${ymd(new Date(y, mo - 2, 1)).slice(0, 7)}">${ic('back')}</button><span class="title">${MONTHS_NOM[mo - 1]} ${y}</span><button class="icon" data-m="${ymd(new Date(y, mo, 1)).slice(0, 7)}">${ic('next')}</button></div>
  <div class="month" style="margin-bottom:16px">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => `<div class="dh">${d}</div>`).join('')}
    ${cells.slice(0, weeks * 7).map((ds) => `<div class="dc ${ym(ds) !== month ? 'out' : ''} ${ds === today() ? 'today' : ''}" data-day="${ds}"><span class="d">${+ds.slice(8)}</span>${D.posts.filter((p) => p.date === ds).map((p) => `<div class="pp s-${p.status}" data-post="${p.id}">${esc(p.title || (p.text || '').slice(0, 30) || 'Пост')}</div>`).join('')}</div>`).join('')}</div>
  <div class="card" style="padding:6px 12px"><h3 style="padding:8px 4px 0">Все посты</h3><div class="list">${posts.length ? posts.map((p) => {
    const res = p.results || {}; const media = p.media || [];
    return `<div class="item click" data-post="${p.id}">${media[0] ? `<img src="${esc(mediaUrl(media[0]))}" style="width:48px;height:48px;border-radius:10px;object-fit:cover;flex:none" alt="">` : `<span class="av" style="border-radius:10px;background:var(--panel2)">${ic('photo')}</span>`}
      <span class="main-t"><b>${esc(p.title || (p.text || 'Без текста').slice(0, 60))}</b><span class="muted">${p.date ? dmy(p.date) + (p.time ? ' ' + p.time : '') + ' · ' : ''}${(p.channels || []).map((c) => CH[c] + (res[c] ? (res[c].ok ? ' ✓' : ' ✗') : '')).join(', ') || 'каналы не выбраны'}</span></span>
      <span class="badge ${p.status === 'published' ? 'b-ok' : p.status === 'ready' ? 'b-warn' : p.status === 'draft' ? 'b-info' : p.status === 'idea' ? '' : 'b-bad'}">${POST_ST[p.status] || p.status}</span></div>`;
  }).join('') : '<div class="empty">Постов пока нет. Начните с идеи или сразу с фото работы.</div>'}</div></div>`;
  $$('[data-m]', el).forEach((b) => (b.onclick = () => go('/marketing?tab=smm&m=' + b.dataset.m)));
  $('#np', el).onclick = () => postModal({ date: today() });
  $$('[data-day]', el).forEach((d) => (d.onclick = (e) => { if (e.target.closest('[data-post]')) return; postModal({ date: d.dataset.day, status: 'idea' }); }));
  $$('[data-post]', el).forEach((d) => (d.onclick = (e) => { e.stopPropagation(); postModal(byId('posts', d.dataset.post)); }));
  $('#ideas', el).onclick = ideasModal;
}
function postModal(p = {}) {
  const st = { media: [...(p.media || [])] };
  const chans = p.channels || ['max', 'tg', 'vk', 'site'].filter(chConnected);
  const res = p.results || {};
  const m = modal(p.id ? 'Пост' : 'Новый пост', `<div class="form">
    <label class="f">Заголовок (для себя и подписи на сайте)<input name="title" value="${esc(p.title || '')}" placeholder="например: Молочный френч"></label>
    <label class="f">Фото работы<div class="thumbs" id="th"></div></label>
    <label class="f">Текст поста<textarea name="text" rows="7" placeholder="О чём пост: что за работа, оттенок, дизайн. ИИ поможет красиво написать.">${esc(p.text || '')}</textarea></label>
    <div class="row"><button type="button" class="sm" data-ai="post">${ic('wand')}Написать</button><button type="button" class="sm" data-ai="improve">Улучшить</button><button type="button" class="sm" data-ai="short">Короче</button><span class="sp"></span><span class="small muted" id="len"></span></div>
    <div class="hint">Для «Написать» коротко перечислите факты: что сделали, оттенок, дизайн, сколько держится. ИИ не придумывает цены и акции.</div>
    <label class="f">Куда публикуем</label><div class="chips">${Object.entries(CH).map(([k, t]) => `<label class="chip"><input type="checkbox" name="ch_${k}" ${chans.includes(k) ? 'checked' : ''} ${chConnected(k) ? '' : 'disabled'}> ${t}${chConnected(k) ? '' : ' <span class="n">не подключён</span>'}${res[k] ? (res[k].ok ? ' ✓' : ' ✗') : ''}</label>`).join('')}</div>
    ${Object.values(res).some((r) => r && !r.ok) ? `<div class="notice warn">${Object.entries(res).filter(([, r]) => r && !r.ok).map(([k, r]) => `${CH[k] || k}: ${esc(r.error)}`).join('<br>')}</div>` : ''}
    <div class="three"><label class="f">Дата<input type="date" name="date" value="${p.date || ''}"></label><label class="f">Время<input type="time" name="time" value="${p.time || '10:00'}"></label>
    <label class="f">Статус<select name="status">${opts(Object.entries(POST_ST).filter(([k]) => ['idea', 'draft', 'ready'].includes(k) || k === p.status), p.status || 'draft')}</select></label></div>
    <div class="hint">«Готов к публикации» — пост уйдёт сам в указанные дату и время. Или нажмите «Опубликовать сейчас».</div>
  </div>`, {
    wide: true,
    footer: `${p.id ? `<button type="button" class="danger icon" id="pdel">${ic('trash')}</button>` : ''}<button type="button" id="pub">${ic('send')}Опубликовать сейчас</button>`,
    onSubmit: async (f) => { await savePost(f); toast('Сохранено'); rerender(); },
    onOpen: (form, close) => {
      const drawTh = () => {
        $('#th', form).innerHTML = st.media.map((f, i) => `<div class="thumb"><img src="${esc(mediaUrl(f))}" alt=""><button type="button" data-rm="${i}" aria-label="Убрать">${ic('x')}</button></div>`).join('') + `<div class="thumb add" id="addPh">${ic('plus')}<span>Добавить фото</span></div>`;
        $$('[data-rm]', form).forEach((b) => (b.onclick = () => { st.media.splice(+b.dataset.rm, 1); drawTh(); }));
        $('#addPh', form).onclick = async () => { const files = await pickFiles(); if (!files.length) return; toast('Загружаю фото…'); try { (await uploadPhotos(files)).forEach((r) => st.media.push(r.file)); drawTh(); } catch (e) { fail(e); } };
      };
      drawTh();
      const len = () => ($('#len', form).textContent = form.text.value.length + ' симв.'); form.text.oninput = len; len();
      $$('[data-ai]', form).forEach((b) => (b.onclick = async () => {
        const mode = b.dataset.ai; const txt = form.text.value.trim();
        if (!txt && !form.title.value.trim()) return toast('Напишите пару слов о работе — ИИ нужны факты', true);
        b.disabled = true; const old = b.innerHTML; b.textContent = 'Пишу…';
        try {
          const prompt = mode === 'post' ? `Факты о работе: ${form.title.value}. ${txt}` : mode === 'short' ? `Сократи до 3–5 строк, сохрани смысл и хэштеги:\n\n${txt}` : txt;
          const r = await api('POST', '/api/ai', { preset: mode === 'post' ? 'post' : mode === 'short' ? 'free' : 'improve', prompt });
          form.text.value = r.text; len();
        } catch (e) { fail(e); } finally { b.disabled = false; b.innerHTML = old; }
      }));
      const savePost = async (f) => {
        const channels = Object.keys(CH).filter((k) => f['ch_' + k]);
        const row = await save('posts', { id: p.id, title: f.title || null, text: f.text || null, date: f.date || null, time: f.time || null, status: f.status, channels, media: st.media });
        p.id = row.id; return row;
      };
      form._save = savePost;
      $('#pub', form).onclick = async (e) => {
        const b = e.currentTarget; const f = formData(form);
        if (!st.media.length) return toast('Добавьте хотя бы одно фото', true);
        if (!f.text) return toast('Напишите текст поста', true);
        if (!Object.keys(CH).some((k) => f['ch_' + k])) return toast('Выберите, куда публиковать', true);
        b.disabled = true; b.textContent = 'Публикую…';
        try {
          const row = await savePost({ ...f, date: f.date || today() });
          const r = await api('POST', `/api/posts/${row.id}/publish`, {});
          const i = D.posts.findIndex((x) => x.id === r.id); D.posts[i] = r;
          if (r.status === 'published') { toast('Опубликовано'); if (r.channels.includes('site')) D.works = (await api('GET', '/api/data')).works; close(); rerender(); }
          else { toast('Есть ошибки — смотрите в посте', true); close(); rerender(); postModal(r); }
        } catch (er) { fail(er); b.disabled = false; b.innerHTML = ic('send') + 'Опубликовать сейчас'; }
      };
      const d = $('#pdel', form); if (d) d.onclick = async () => { if (await confirmBox('Удалить пост? Опубликованное в соцсетях останется.', 'Удалить')) { await del('posts', p.id); close(); rerender(); } };
    },
  });
  async function savePost(f) { return m.el._save(f); }
}
function ideasModal() {
  modal('ИИ: идеи постов на месяц', `<div class="form"><label class="f">Пожелания (необязательно)<input name="wish" placeholder="например: больше про обучение, акция на педикюр"></label><div id="out"></div></div>`, {
    submit: 'Придумать',
    onSubmit: async (f, form) => {
      $('#out', form).innerHTML = '<div class="hint">ИИ думает…</div>';
      const r = await api('POST', '/api/ai', { preset: 'ideas', prompt: f.wish || '' });
      const lines = r.text.split('\n').map((l) => l.trim()).filter(Boolean);
      $('#out', form).innerHTML = `<div class="list">${lines.map((l, i) => `<label class="chk item"><input type="checkbox" data-i="${i}" checked><span>${esc(l)}</span></label>`).join('')}</div>
        <button type="button" class="primary" id="toPlan" style="margin-top:10px">${ic('plus')}Добавить отмеченные в контент-план</button>`;
      $('#toPlan', form).onclick = async () => {
        const y = today().slice(0, 4); let n = 0;
        for (const cb of $$('[data-i]:checked', form)) {
          const l = lines[+cb.dataset.i]; const mm = /^(\d{1,2})\.(\d{1,2})\s*[—–-]\s*(.+?)(?:\s*[—–-]\s*(.+))?$/.exec(l);
          const date = mm ? `${y}-${pad(mm[2])}-${pad(mm[1])}` : null;
          await save('posts', { date, title: mm ? mm[3] : l.slice(0, 80), text: mm && mm[4] ? mm[4] : null, status: 'idea', channels: ['max', 'tg', 'vk', 'site'].filter(chConnected), media: [] }); n++;
        }
        toast(`Добавлено идей: ${n}`); $$('.modal-bg').forEach((x) => x.remove()); document.body.style.overflow = ''; modalStack = 0; rerender();
      };
      return false;
    },
  });
}

// ---------- SMS ----------
const SEGMENTS = [
  ['all', 'Все с телефоном', () => true], ['lost', 'Давно не были (45+ дней)', clientFilter('lost')], ['regular', 'Постоянные (3+ визита)', clientFilter('regular')],
  ['bday', 'Именинницы месяца', clientFilter('bday')], ['new', 'Новые за месяц', clientFilter('new')], ['students', 'Ученицы', clientFilter('students')],
  ['tomorrow', 'Записаны на завтра', (c) => D.appointments.some((a) => a.client_id === c.id && a.date === addDays(today(), 1) && SH.ACTIVE.includes(a.status))],
];
const AUTO = [
  ['remind', 'Напоминание накануне', 'Вечером накануне визита (время ниже)'], ['confirm', 'Подтверждение записи', 'Когда вы подтверждаете онлайн-запись или ставите галочку при записи'],
  ['review', 'Просьба об отзыве', 'Через несколько часов после визита'], ['correction', 'Пора на коррекцию', 'Если клиентка не записалась через N дней после визита'], ['birthday', 'Поздравление с днём рождения', 'Утром в день рождения'],
];
async function smsTab(el, q) {
  const seg = q.seg || 'lost';
  const on = !!D.integrations.sms;
  const segFn = (SEGMENTS.find((s) => s[0] === seg) || SEGMENTS[0])[2];
  const list = D.clients.filter((c) => c.phone && !c.no_sms && SH.normPhone(c.phone).length === 11).filter(segFn);
  el.innerHTML = `${on ? '' : `<div class="notice warn" style="margin-bottom:14px">SMS не подключены. Можно отправлять с вашего Android-телефона по тарифу оператора (приложение SMS Gateway) или через SMS.ru — <a href="#/settings#fSms">Настройки → SMS</a>.</div>`}
  <div class="grid g-main">
    <div class="card"><h3>Рассылка</h3><div class="form">
      <label class="f">Кому</label><div class="chips">${SEGMENTS.map(([k, t, fn]) => `<button type="button" class="chip ${k === seg ? 'on' : ''}" data-seg="${k}">${t} <span class="n">${D.clients.filter((c) => c.phone && !c.no_sms).filter(fn).length}</span></button>`).join('')}</div>
      <label class="f">Текст<textarea id="txt" rows="4" placeholder="{имя}, ...">${esc(localStorage.getItem('smsDraft') || '')}</textarea></label>
      <div class="row"><button type="button" class="sm" id="aiS">${ic('wand')}ИИ: написать SMS</button><span class="sp"></span><span class="small muted" id="cnt"></span></div>
      <div class="hint">Подстановки: {имя}, {телефон}, {адрес}, {2гис}. Пример: <span class="ai-out" style="display:block;padding:8px;margin-top:4px" id="prev">—</span></div>
      <button class="primary" id="send" ${on ? '' : 'disabled'}>${ic('send')}Отправить ${list.length} ${plural(list.length, 'клиентке', 'клиенткам', 'клиенткам')}</button>
      <details><summary class="small muted" style="cursor:pointer">Кто в списке (${list.length})</summary><div class="small" style="margin-top:6px">${list.map((c) => esc(c.name)).join(', ') || '—'}</div></details>
    </div></div>
    <div class="card"><h3>Автосообщения</h3><form class="form" id="autoF">${AUTO.map(([k, t, h]) => `<div><label class="chk"><input type="checkbox" name="sms_auto_${k}" ${S('sms_auto_' + k) === '1' ? 'checked' : ''}> <b>${t}</b></label><div class="hint" style="margin:-2px 0 6px 27px">${h}</div>
      <textarea name="sms_tpl_${k}" rows="2" style="min-height:60px;font-size:13.5px">${esc(S('sms_tpl_' + k))}</textarea></div>`).join('')}
      <div class="two"><label class="f">Напоминание накануне в<input type="time" name="sms_remind_time" value="${esc(S('sms_remind_time') || '18:00')}"></label><label class="f">«Коррекция» через, дней<input type="number" name="sms_correction_days" min="7" value="${esc(S('sms_correction_days') || 21)}"></label></div>
      <div class="hint">Подстановки: {имя} {дата} {время} {услуга} {телефон} {адрес} {2гис}</div>
      <button class="primary" type="submit">Сохранить</button></form></div>
  </div>
  <div class="card" style="margin-top:14px"><div class="row"><h3 style="margin:0">Очередь и история</h3><span class="sp"></span><button class="sm" id="cancelAll">Отменить ожидающие</button><button class="sm" id="retry">Повторить ошибки</button></div><div id="queue" class="list"><div class="empty">Загрузка…</div></div></div>`;
  const txt = $('#txt', el);
  const upd = () => {
    localStorage.setItem('smsDraft', txt.value);
    const ex = SH.fill(txt.value, { name: list[0]?.name || 'Анна' }, D.settings);
    $('#prev', el).textContent = ex || '—';
    $('#cnt', el).textContent = `${ex.length} симв. · ${SH.smsParts(ex)} SMS × ${list.length} = ${SH.smsParts(ex) * list.length}`;
  };
  txt.oninput = upd; upd();
  $$('[data-seg]', el).forEach((b) => (b.onclick = () => go('/marketing?tab=sms&seg=' + b.dataset.seg)));
  $('#aiS', el).onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try { const r = await api('POST', '/api/ai', { preset: 'sms', prompt: `Кому: ${SEGMENTS.find((s) => s[0] === seg)[1]}. ${txt.value ? 'Идея: ' + txt.value : 'Пригласить на маникюр'}` }); txt.value = r.text; upd(); } catch (er) { fail(er); } finally { b.disabled = false; }
  };
  $('#send', el).onclick = async () => {
    if (!txt.value.trim()) return toast('Напишите текст', true);
    if (!(await confirmBox(`Отправить SMS ${list.length} ${plural(list.length, 'клиентке', 'клиенткам', 'клиенткам')}? Это ${SH.smsParts(SH.fill(txt.value, { name: 'Анна' }, D.settings)) * list.length} SMS.`, 'Отправить'))) return;
    const r = await api('POST', '/api/sms/send', { text: txt.value, to: list.map((c) => ({ phone: c.phone, client_id: c.id, name: c.name })) });
    toast(`В очереди: ${r.queued}${r.est_minutes ? `, отправка ~${r.est_minutes} мин` : ''}`); localStorage.removeItem('smsDraft'); loadQ();
  };
  $('#autoF', el).onsubmit = async (e) => { e.preventDefault(); await saveSettings(formData(e.target)); toast('Автосообщения сохранены'); };
  $('#cancelAll', el).onclick = async () => { const r = await api('POST', '/api/sms/cancel', {}); toast('Отменено: ' + r.cancelled); loadQ(); };
  $('#retry', el).onclick = async () => { const r = await api('POST', '/api/sms/retry', {}); toast('Повтор: ' + r.n); loadQ(); };
  const ST = { queued: ['В очереди', 'b-warn'], sent: ['Отправлено', 'b-ok'], error: ['Ошибка', 'b-bad'], cancelled: ['Отменено', ''] };
  const KIND = { manual: 'вручную', bulk: 'рассылка', remind: 'напоминание', confirm: 'подтверждение', review: 'отзыв', correction: 'коррекция', birthday: 'ДР', test: 'проверка' };
  async function loadQ() {
    try {
      const r = await api('GET', '/api/sms/queue');
      $('#queue', el).innerHTML = (r.error ? `<div class="notice warn">${esc(r.error)}</div>` : '') + (r.rows.length ? r.rows.slice(0, 100).map((x) => `<div class="item"><span class="main-t"><b>${esc(x.client || x.phone)}</b><span class="muted">${esc(x.text)}</span>${x.error ? `<span class="small bad">${esc(x.error)}</span>` : ''}</span><span class="small muted hide-m">${KIND[x.kind] || x.kind} · ${dmy(x.sent_at || x.created_at)} ${(x.sent_at || x.created_at || '').slice(11, 16)}</span><span class="badge ${ST[x.status]?.[1] || ''}">${ST[x.status]?.[0] || x.status}</span></div>`).join('') : '<div class="empty">Сообщений пока не было</div>');
    } catch (e) { $('#queue', el).innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }
  loadQ();
}

// ---------- портфолио ----------
function portfolio(el) {
  const ws = D.works.slice().sort((a, b) => (b.sort || 0) - (a.sort || 0) || b.id - a.id);
  el.innerHTML = `<div class="row" style="margin-bottom:12px"><button class="primary" id="up">${ic('upload')}Загрузить фото</button><span class="hint">Фото с галочкой «на сайте» показываются в разделе «Образцы работ». Посты с каналом «Сайт» добавляют фото сюда автоматически.</span></div>
  ${ws.length ? `<div class="gallery">${ws.map((w) => `<div class="gal"><div class="img"><img src="${esc(mediaUrl(w.photo))}" alt="" loading="lazy"></div><div class="b">
    <input value="${esc(w.caption || '')}" data-cap="${w.id}" placeholder="Подпись" style="min-height:34px;font-size:13px;padding:6px 10px">
    <div class="row"><label class="chk small"><input type="checkbox" data-site="${w.id}" ${w.on_site ? 'checked' : ''}> на сайте</label><span class="sp"></span><button class="sm ghost icon" data-del="${w.id}">${ic('trash')}</button></div></div></div>`).join('')}</div>`
    : '<div class="card empty">Пока пусто. Загрузите лучшие работы — они появятся на сайте вместо заглушек.</div>'}`;
  $('#up', el).onclick = async () => {
    const files = await pickFiles(); if (!files.length) return;
    toast('Загружаю…');
    try { for (const r of await uploadPhotos(files)) await save('works', { photo: r.file, caption: '', on_site: 1, category: 'Маникюр' }); toast('Готово'); rerender(); } catch (e) { fail(e); }
  };
  $$('[data-cap]', el).forEach((i) => i.addEventListener('change', async () => { await save('works', { id: +i.dataset.cap, caption: i.value.trim() || null }); toast('Подпись сохранена'); }));
  $$('[data-site]', el).forEach((i) => (i.onchange = async () => { await save('works', { id: +i.dataset.site, on_site: i.checked ? 1 : 0 }); }));
  $$('[data-del]', el).forEach((b) => (b.onclick = async () => { if (await confirmBox('Удалить фото?', 'Удалить')) { await del('works', b.dataset.del); rerender(); } }));
}

// ---------- отзывы ----------
function reviewsTab(el) {
  const ask = D.appointments.filter((a) => a.status === 'done' && a.client_id && !a.review_at && a.date >= addDays(today(), -10)).sort((a, b) => b.date.localeCompare(a.date));
  el.innerHTML = `<div class="grid g-main"><div class="card"><div class="row" style="margin-bottom:8px"><h3 style="margin:0">Отзывы на сайте</h3><span class="sp"></span><button class="sm primary" id="addR">${ic('plus')}Отзыв</button></div>
    <div class="list">${D.reviews.length ? D.reviews.slice().reverse().map((r) => `<div class="item click" data-r="${r.id}"><span class="main-t"><b>${esc(r.name || 'Клиентка')} <span class="acc">${'★'.repeat(r.rating || 5)}</span></b><span class="muted" style="white-space:normal">${esc(r.text)}</span></span>${r.on_site ? '<span class="badge b-ok">на сайте</span>' : ''}</div>`).join('') : '<div class="empty">Перенесите лучшие отзывы из 2ГИС, Яндекс Карт или соцсетей — они украсят сайт.</div>'}</div></div>
    <div class="card"><h3>Попросить отзыв</h3>${S('review_url') ? '' : '<div class="notice" style="margin-bottom:10px">Укажите ссылку на отзывы (2ГИС или Яндекс Карты) в <a href="#/settings">Настройках</a>.</div>'}
    <div class="list">${ask.length ? ask.map((a) => { const c = client(a.client_id); return `<div class="item"><span class="main-t"><b>${esc(c?.name || '')}</b><span class="muted">${dmy(a.date)} · ${esc(apptServices(a))}</span></span>${c?.phone ? `<button class="sm" data-ask="${a.id}">${ic('msg')}SMS</button>` : ''}</div>`; }).join('') : '<div class="empty">Все недавние клиентки уже получили просьбу</div>'}</div>
    <div class="hint">Можно включить автоматическую просьбу в «SMS-рассылках».</div></div></div>`;
  $('#addR', el).onclick = () => reviewModal();
  $$('[data-r]', el).forEach((x) => (x.onclick = () => reviewModal(byId('reviews', x.dataset.r))));
  $$('[data-ask]', el).forEach((b) => (b.onclick = () => { const a = byId('appointments', b.dataset.ask); smsOneModal(client(a.client_id), SH.fill(S('sms_tpl_review'), { name: client(a.client_id).name }, D.settings)); save('appointments', { id: a.id, review_at: today() }); }));
}
function reviewModal(r = {}) {
  modal(r.id ? 'Отзыв' : 'Новый отзыв', `<div class="form"><div class="two"><label class="f">Имя<input name="name" value="${esc(r.name || '')}"></label><label class="f">Оценка<select name="rating">${opts([5, 4, 3, 2, 1].map((n) => [n, '★'.repeat(n)]), r.rating || 5)}</select></label></div>
    <label class="f">Текст<textarea name="text" rows="4" required>${esc(r.text || '')}</textarea></label><label class="f">Дата<input type="date" name="date" value="${r.date || today()}"></label>
    <label class="chk"><input type="checkbox" name="on_site" ${r.on_site ?? 1 ? 'checked' : ''}> Показывать на сайте</label></div>`, {
    footer: r.id ? `<button type="button" class="danger icon" id="rd">${ic('trash')}</button>` : '',
    onOpen: (f, close) => { const b = $('#rd', f); if (b) b.onclick = async () => { if (await confirmBox('Удалить отзыв?', 'Удалить')) { await del('reviews', r.id); close(); rerender(); } }; },
    onSubmit: async (f) => { if (!f.text) throw new Error('Добавьте текст'); await save('reviews', { id: r.id, ...f, rating: +f.rating }); rerender(); },
  });
}

// ---------- ИИ-помощник ----------
const AI_PRESETS = [['post', 'Пост о работе', 'Молочный френч, тонкая линия, держится 3–4 недели, клиентка просила нежно к свадьбе'], ['reply', 'Ответ клиентке', 'Клиентка спрашивает, можно ли записаться в субботу вечером и сколько стоит наращивание'],
  ['promo', 'Акция', 'Хочу заполнить окна в будни днём'], ['course', 'Описание курса', 'Базовый курс с нуля, 5 дней, группа до 4 человек, практика на моделях, материалы включены'],
  ['ideas', 'Идеи постов', 'Больше про обучение и уход за ногтями зимой'], ['sms', 'Текст SMS', 'Пригласить тех, кто давно не был, на коррекцию'], ['free', 'Свободный запрос', 'Придумай 5 вариантов названия для нюдового оттенка']];
function aiTab(el, q) {
  const p = q.p || 'post';
  const pr = AI_PRESETS.find((x) => x[0] === p) || AI_PRESETS[0];
  el.innerHTML = `${D.integrations.ai || window.DEMO_API ? '' : `<div class="notice warn" style="margin-bottom:14px">ИИ не подключён. Подойдёт GigaChat от Сбера (бесплатный лимит для физлиц) или YandexGPT — <a href="#/settings#fAi">Настройки → ИИ-помощник</a>.</div>`}
  <div class="grid g-main"><div class="card"><div class="chips" style="margin-bottom:12px">${AI_PRESETS.map(([k, t]) => `<button class="chip ${k === p ? 'on' : ''}" data-p="${k}">${t}</button>`).join('')}</div>
    <div class="form"><label class="f">Что нужно<textarea id="pr" rows="5" placeholder="${esc(pr[2])}"></textarea></label><button class="primary" id="run">${ic('wand')}Написать</button><div id="out"></div></div></div>
    <div class="card"><h3>Как получить хороший текст</h3><div class="col small" style="color:var(--text2)"><div>• Дайте факты: что сделали, оттенок, дизайн, для какого повода.</div><div>• ИИ не придумывает цены и акции — напишите их сами, если нужны.</div><div>• Результат можно сразу отправить в пост или скопировать в мессенджер.</div><div>• Подписи, телефон и город ИИ берёт из ваших настроек.</div></div></div></div>`;
  $$('[data-p]', el).forEach((b) => (b.onclick = () => go('/marketing?tab=ai&p=' + b.dataset.p)));
  $('#run', el).onclick = async (e) => {
    const b = e.currentTarget; const text = $('#pr', el).value.trim() || pr[2];
    b.disabled = true; $('#out', el).innerHTML = '<div class="hint">ИИ пишет…</div>';
    try {
      const r = await api('POST', '/api/ai', { preset: p, prompt: text });
      $('#out', el).innerHTML = `<div class="ai-out">${esc(r.text)}</div><div class="row" style="margin-top:8px"><button class="sm" id="cp">${ic('copy')}Скопировать</button>${p === 'post' ? `<button class="sm" id="toPost">${ic('photo')}В новый пост</button>` : ''}${p === 'sms' ? `<button class="sm" id="toSms">${ic('msg')}В рассылку</button>` : ''}</div>`;
      $('#cp', el).onclick = () => copyText(r.text);
      const tp = $('#toPost', el); if (tp) tp.onclick = () => postModal({ text: r.text, date: today(), status: 'draft' });
      const ts = $('#toSms', el); if (ts) ts.onclick = () => { localStorage.setItem('smsDraft', r.text); go('/marketing?tab=sms'); };
    } catch (er) { $('#out', el).innerHTML = `<div class="notice warn">${esc(er.message)}</div>`; } finally { b.disabled = false; }
  };
}
