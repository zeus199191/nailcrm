'use strict';
/* Настройки */
route(/^\/settings$/, (page) => {
  const I_ = D.integrations || {};
  const days = String(S('work_days') || '').split(',').map(Number);
  const sec = (k) => (S('has_' + k) ? 'сохранён — оставьте пустым, чтобы не менять' : '');
  const card = (id, title, body, hint = '') => `<form class="card form" id="${id}" style="margin-bottom:14px"><h2 class="serif" style="font-size:24px;font-weight:500;margin:0">${title}</h2>${hint ? `<div class="hint">${hint}</div>` : ''}${body}<div class="row"><button class="primary" type="submit">Сохранить</button><span class="sp"></span><span data-extra></span></div></form>`;
  const inp = (k, label, ph = '', type = 'text') => `<label class="f">${label}<input name="${k}" type="${type}" value="${esc(S(k))}" placeholder="${esc(ph)}"></label>`;
  const secret = (k, label) => `<label class="f">${label}<input name="${k}" type="password" autocomplete="off" placeholder="${esc(sec(k))}"></label>`;
  const chk = (k, label) => `<label class="chk"><input type="checkbox" name="${k}" ${S(k) === '1' ? 'checked' : ''}> ${label}</label>`;
  const stBadge = (ok, t1, t2) => `<span class="badge ${ok ? 'b-ok' : ''}">${ok ? t1 : t2}</span>`;

  page.innerHTML = topbar('Настройки') + `<div class="grid g2" style="align-items:start"><div>
  ${card('fProfile', 'Профиль и контакты', `
    <div class="two">${inp('master_name', 'Имя мастера')}${inp('city', 'Город')}</div>
    ${inp('tagline', 'Подпись на сайте', 'Мастер-инструктор по маникюру')}
    <div class="two">${inp('phone', 'Телефон для записи', '+7')}${inp('hours_text', 'Часы работы (текст на сайте)')}</div>
    ${inp('address', 'Адрес студии')}
    <div class="two">${inp('social_tg', 'Telegram (ссылка)', 'https://t.me/...')}${inp('social_wa', 'WhatsApp (ссылка)', 'https://wa.me/7...')}</div>
    <div class="two">${inp('social_vk', 'ВКонтакте', 'https://vk.com/...')}${inp('social_max', 'MAX', 'https://max.ru/...')}</div>
    ${inp('review_url', 'Ссылка на отзывы (2ГИС, Яндекс Карты)', 'https://2gis.ru/...')}
    <div class="row"><img src="${esc(mediaUrl(S('hero_photo')))}" style="width:64px;height:80px;object-fit:cover;border-radius:32px 32px 8px 8px;border:1px solid var(--line)" alt=""><button type="button" class="sm" id="hero">${ic('photo')}Сменить фото на сайте</button></div>`)}
  ${card('fBook', 'График и онлайн-запись', `
    <label class="f">Рабочие дни</label><div class="chips">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="chip"><input type="checkbox" name="wd_${d}" ${days.includes(d) ? 'checked' : ''}> ${DOW[d]}</label>`).join('')}</div>
    <div class="three"><label class="f">С<input type="time" name="work_from" value="${esc(S('work_from'))}"></label><label class="f">До<input type="time" name="work_to" value="${esc(S('work_to'))}"></label>
    <label class="f">Шаг записи<select name="slot_step">${opts([[15, '15 мин'], [30, '30 мин'], [60, '1 час']], S('slot_step'))}</select></label></div>
    ${chk('booking_on', 'Онлайн-запись на сайте включена')}
    ${chk('booking_auto', 'Записывать сразу, без моего подтверждения')}
    <div class="two"><label class="f">Не раньше чем за, часов<input type="number" min="0" name="booking_min_hours" value="${esc(S('booking_min_hours'))}"></label><label class="f">Запись вперёд на, дней<input type="number" min="1" max="60" name="booking_days_ahead" value="${esc(S('booking_days_ahead'))}"></label></div>
    <label class="f">Выходные и отпуск</label>
    <div class="list" id="toff">${D.time_off.length ? D.time_off.slice().sort((a, b) => a.date_from.localeCompare(b.date_from)).map((t) => `<div class="item"><span class="main-t"><b>${dmy(t.date_from)}${t.date_to && t.date_to !== t.date_from ? ' — ' + dmy(t.date_to) : ''}</b><span class="muted">${esc(t.note || '')}</span></span><button type="button" class="sm ghost icon" data-dt="${t.id}">${ic('trash')}</button></div>`).join('') : '<div class="hint">Нет. В эти дни онлайн-запись закрыта.</div>'}</div>
    <button type="button" class="sm" id="addOff" style="align-self:flex-start">${ic('plus')}Выходные / отпуск</button>`)}
  ${!TAX() ? '' : card('fTax', 'Налог самозанятой', `<div class="three">${inp('tax_person', 'С физлиц, %', '4', 'number')}${inp('tax_company', 'С ИП и компаний, %', '6', 'number')}${inp('npd_limit', 'Лимит в год, ₽', '2400000', 'number')}</div>`, 'Налог считается с каждой оплаты в «Финансах». Чеки пробиваются в приложении «Мой налог», в CRM вы отмечаете, что чек выдан.')}
  ${card('fSite', 'Сайт', `${chk('site_on', 'Сайт включён (иначе главная страница сразу открывает вход в CRM)')}
    ${inp('site_url', 'Адрес сайта', 'https://...')}
    <div class="hint">Заявки и онлайн-записи с сайта сразу попадают в «Заявки», а уведомление приходит в Telegram или MAX.${S('api_key') ? `<br>Ключ для внешних форм (Тильда, квизы): <code>${esc(S('api_key'))}</code> — POST /api/public/lead` : ''}</div>`)}
  </div><div>
  ${card('fSms', 'SMS', `<div class="row">${stBadge(I_.sms, 'Подключено: ' + (I_.sms === 'gate' ? 'телефон' : 'SMS.ru'), 'Не подключено')}</div>
    <label class="f">Как отправлять<select name="sms_provider">${opts([['', 'Выключено'], ['gate', 'С моего Android-телефона (SMS Gateway)'], ['smsru', 'Через SMS.ru']], S('sms_provider'))}</select></label>
    <div data-p="gate" class="form"><div class="hint">Установите на Android-телефон приложение <b>SMS Gateway for Android</b> (sms-gate.app), включите «Облачный сервер» и перепишите сюда логин и пароль из приложения. SMS уйдут с вашей SIM по тарифу оператора.</div>
      <div class="two">${inp('sms_gate_user', 'Логин из приложения')}${secret('sms_gate_pass', 'Пароль из приложения')}</div></div>
    <div data-p="smsru" class="form"><div class="two">${secret('smsru_api_id', 'API-ключ SMS.ru')}${inp('smsru_from', 'Имя отправителя (если одобрено)')}</div></div>
    <div class="three"><label class="f">Не раньше, ч<input type="number" name="sms_from_hour" min="0" max="23" value="${esc(S('sms_from_hour'))}"></label><label class="f">Не позже, ч<input type="number" name="sms_to_hour" min="1" max="24" value="${esc(S('sms_to_hour'))}"></label><label class="f">В день, не больше<input type="number" name="sms_daily_limit" min="1" value="${esc(S('sms_daily_limit'))}"></label></div>
    <div class="hint">Пауза между SMS с телефона — ${esc(S('sms_interval') || 40)} сек., чтобы оператор не заблокировал SIM. Тексты автосообщений — в Маркетинг → SMS-рассылки.</div>`, '')}
  ${card('fNotify', 'Уведомления мне', `
    <div class="hint">Бот присылает новые онлайн-записи и заявки, а вечером — план на завтра. Можно подключить Telegram, MAX или оба.</div>
    <label class="f">Telegram: токен бота (создайте бота у @BotFather)<input name="tg_token" type="password" autocomplete="off" placeholder="${esc(sec('tg_token'))}"></label>
    <div class="row">${stBadge(I_.tg?.linked, 'Telegram подключён', I_.tg?.token ? 'Бот есть, чат не привязан' : 'Не подключён')}${I_.tg?.bot ? `<span class="small muted">@${esc(I_.tg.bot)}</span>` : ''}${I_.tg?.error ? `<span class="small bad">${esc(I_.tg.error)}</span>` : ''}</div>
    <label class="f">MAX: токен бота (из кабинета партнёра MAX)<input name="max_token" type="password" autocomplete="off" placeholder="${esc(sec('max_token'))}"></label>
    <div class="row">${stBadge(I_.max?.linked, 'MAX подключён', I_.max?.token ? 'Бот есть, чат не привязан' : 'Не подключён')}${I_.max?.error ? `<span class="small bad">${esc(I_.max.error)}</span>` : ''}</div>
    <div class="row"><button type="button" class="sm" id="code">${ic('send')}Получить код привязки</button><button type="button" class="sm" id="ntest">Проверить</button></div><div id="codeOut"></div>
    <label class="f">Сводка на завтра в<input type="time" name="summary_time" value="${esc(S('summary_time') || '20:00')}"></label>`)}
  ${card('fSocial', 'Соцсети для публикаций', `
    <label class="f">Telegram-канал (бот должен быть администратором канала)<input name="tg_post_chat" value="${esc(S('tg_post_chat'))}" placeholder="@my_nails"></label>
    <label class="f">MAX: чат или канал для постов<select name="max_content_chat">${opts((I_.max?.chats || []).map((c) => [c.id, c.title || c.id]), S('max_content_chat'), (I_.max?.chats || []).length ? '— выберите —' : 'добавьте бота в канал MAX — он появится здесь')}</select></label>
    <div class="two"><label class="f">ВКонтакте: ID или ссылка группы<input name="vk_group_id" value="${esc(S('vk_group_id'))}" placeholder="https://vk.com/club123"></label>${secret('vk_token', 'Ключ доступа ВК (права wall, photos)')}</div>
    <div class="row">${['tg', 'max', 'vk'].map((k) => stBadge(chConnected(k), CH[k] + ' ✓', CH[k] + ' —')).join(' ')}</div>`, 'Посты публикуются из «Маркетинг → SMM» одной кнопкой во все каналы и в «Образцы работ» на сайте.')}
  ${card('fAi', 'ИИ-помощник', `<div class="row">${stBadge(I_.ai, 'Подключён: ' + (I_.ai === 'yandex' ? 'YandexGPT' : 'GigaChat'), 'Не подключён')}</div>
    <label class="f">Сервис<select name="ai_provider">${opts([['', 'Выключен'], ['gigachat', 'GigaChat (Сбер)'], ['yandex', 'YandexGPT (Яндекс)']], S('ai_provider'))}</select></label>
    <div data-ai="gigachat" class="form"><div class="hint">developers.sber.ru → GigaChat API → «Ключ авторизации». Для физлиц есть бесплатный лимит.</div>${secret('gigachat_key', 'Ключ авторизации GigaChat')}</div>
    <div data-ai="yandex" class="form"><div class="two">${secret('yandex_key', 'API-ключ Yandex Cloud')}${inp('yandex_folder', 'ID каталога')}</div></div>
    <button type="button" class="sm" id="aiTest" style="align-self:flex-start">Проверить</button>`)}
  <div class="card form" id="fDom" style="margin-bottom:14px"><h2 class="serif" style="font-size:24px;font-weight:500;margin:0">Домен сайта</h2>
    <div id="domBox"><div class="hint">Проверяю…</div></div></div>
  <div class="card form" id="fUpd" style="margin-bottom:14px"><div class="row"><h2 class="serif" style="font-size:24px;font-weight:500;margin:0;flex:1">Обновление CRM</h2><span class="badge" id="updVer">версия …</span></div>
    <div id="updBox"><div class="hint">Проверяю…</div></div>
    <details><summary class="small muted" style="cursor:pointer">Источник обновлений и ручная загрузка</summary><div class="form" style="margin-top:10px">
      <div class="two"><label class="f">Репозиторий GitHub<input id="updRepo" value="${esc(S('update_repo') || 'zeus199191/nailcrm')}" placeholder="владелец/название"></label><label class="f">Ветка<input id="updBr" value="${esc(S('update_branch') || 'main')}"></label></div>
      <div class="row"><button type="button" class="sm" id="updSave">Сохранить источник</button><button type="button" class="sm" id="updFile">${ic('upload')}Загрузить архив nailcrm.tar.gz</button></div>
      <div class="hint">Если GitHub недоступен, можно загрузить архив с новой версией вручную — он установится так же.</div></div></details>
    <pre id="updLog" class="ai-out hidden" style="font-size:12px;max-height:260px;overflow:auto;margin:0"></pre></div>
  <div class="card form"><h2 class="serif" style="font-size:24px;font-weight:500;margin:0">Безопасность и данные</h2>
    <div class="row"><button class="sm" id="pw">Сменить пароль</button>${window.DEMO_API ? '' : `<a class="btn sm" href="/api/backup">${ic('download')}Скачать копию базы</a>`}</div>
    <div class="hint">Копия базы сохраняется на сервере каждую ночь (30 последних). Файл открывается программой DB Browser for SQLite.</div></div>
  <div class="card form" id="fUsers" style="margin-top:14px"><div class="row"><h2 class="serif" style="font-size:24px;font-weight:500;margin:0;flex:1">Пользователи</h2><button type="button" class="sm primary" id="uAdd">${ic('plus')}Добавить</button></div>
    <div class="list" id="uList"><div class="hint">Загрузка…</div></div>
    <div class="hint"><b>Мастер</b> — все функции CRM. <b>Администратор</b> — ещё пользователи, обновления CRM и домен. Выданный пароль человек сам меняет при первом входе.</div></div>
  </div></div>`;

  const bind = (id, map) => { const f = $('#' + id, page); f.onsubmit = async (e) => { e.preventDefault(); try { let d = formData(f); if (map) d = map(d); await saveSettings(d); toast('Сохранено'); rerender(); } catch (er) { fail(er); } }; };
  bind('fProfile'); if (TAX()) bind('fTax'); bind('fSite'); bind('fSms'); bind('fNotify'); bind('fSocial'); bind('fAi');
  bind('fBook', (d) => { const wd = [1, 2, 3, 4, 5, 6, 0].filter((x) => d['wd_' + x]); Object.keys(d).filter((k) => k.startsWith('wd_')).forEach((k) => delete d[k]); d.work_days = wd.join(','); return d; });
  const prov = () => $$('[data-p]', page).forEach((x) => x.classList.toggle('hidden', x.dataset.p !== $('[name=sms_provider]', page).value));
  $('[name=sms_provider]', page).onchange = prov; prov();
  const aip = () => $$('[data-ai]', page).forEach((x) => x.classList.toggle('hidden', x.dataset.ai !== $('[name=ai_provider]', page).value));
  $('[name=ai_provider]', page).onchange = aip; aip();
  const smsx = $('#fSms [data-extra]', page); smsx.innerHTML = `<button type="button" class="sm" id="smsT">Тестовая SMS</button>`;
  $('#smsT', page).onclick = () => modal('Тестовая SMS', `<label class="f">Номер<input name="phone" type="tel" value="${esc(S('phone'))}"></label>`, { submit: 'Отправить', onSubmit: async (f) => { await api('POST', '/api/sms/test', { phone: f.phone }); toast('SMS отправлена'); } });
  $('#hero', page).onclick = async () => { const f = await pickFiles(false); if (!f.length) return; try { await uploadPhotos(f, 'hero'); await loadAll(); toast('Фото обновлено'); rerender(); } catch (e) { fail(e); } };
  $('#addOff', page).onclick = () => modal('Выходные / отпуск', `<div class="form"><div class="two"><label class="f">С<input type="date" name="date_from" value="${today()}" required></label><label class="f">По<input type="date" name="date_to" value="${today()}"></label></div><label class="f">Заметка<input name="note" placeholder="Отпуск, учёба, праздник"></label></div>`, { onSubmit: async (f) => { await save('time_off', f); rerender(); } });
  $$('[data-dt]', page).forEach((b) => (b.onclick = async () => { await del('time_off', b.dataset.dt); rerender(); }));
  $('#code', page).onclick = async () => {
    try {
      const r = await api('POST', '/api/link-code');
      $('#codeOut', page).innerHTML = `<div class="notice">Отправьте боту в Telegram или MAX сообщение с кодом <b style="font-size:20px;letter-spacing:.1em">${r.code}</b>${D.integrations.tg?.bot ? ` — <a href="https://t.me/${esc(D.integrations.tg.bot)}?start=${r.code}" target="_blank" rel="noopener">открыть бота в Telegram</a>` : ''}. Затем обновите страницу.</div>`;
    } catch (e) { fail(e); }
  };
  $('#ntest', page).onclick = async () => { await api('POST', '/api/notify-test'); toast('Отправлено, проверьте мессенджер'); };
  $('#aiTest', page).onclick = async (e) => { const b = e.currentTarget; b.disabled = true; try { const r = await api('POST', '/api/ai/test'); toast(r.text); } catch (er) { fail(er); } finally { b.disabled = false; } };

  // ---------- обновление одной кнопкой ----------
  let updTimer = null;
  const updDraw = (st, chk) => {
    const box = $('#updBox', page); if (!box) return;
    $('#updVer', page).textContent = 'версия ' + st.version;
    const log = $('#updLog', page);
    if (st.log && (st.running || /Ошибка|Откат/.test(st.log))) { log.classList.remove('hidden'); log.textContent = st.log; log.scrollTop = log.scrollHeight; }
    if (!st.enabled && !window.DEMO_API) { box.innerHTML = '<div class="notice warn">Чтобы кнопка заработала, один раз установите эту версию вручную: загрузите архив на сервер и запустите install.sh. Дальше — только кнопкой.</div>'; return; }
    if (st.running) { box.innerHTML = '<div class="notice info">Сервер настраивается (обновление или подключение домена)… CRM перезапустится сама, страница обновится автоматически.</div>'; return; }
    if (/=== Готово/.test(st.log || '') && updTimer === 'done') { box.innerHTML = `<div class="notice">Обновлено до версии ${esc(st.version)} ✓</div>`; return; }
    if (chk && chk.error) { box.innerHTML = `<div class="notice warn">${esc(chk.error)}</div><button type="button" class="sm" id="updCheck">Проверить ещё раз</button>`; }
    else if (chk && chk.available) box.innerHTML = `<div class="row"><span>Доступна версия <b>${esc(chk.latest)}</b>${chk.notes ? ` — <span class="muted">${esc(chk.notes)}</span>` : ''}</span><span class="sp"></span><button type="button" class="primary" id="updRun">${ic('download')}Обновить</button></div>`;
    else if (chk) box.innerHTML = `<div class="row"><span class="ok">${ic('check')} У вас последняя версия</span><span class="sp"></span><button type="button" class="sm" id="updCheck">Проверить</button></div>`;
    const c = $('#updCheck', page); if (c) c.onclick = () => updCheck();
    const r = $('#updRun', page); if (r) r.onclick = async () => {
      if (!(await confirmBox(`Обновить CRM до версии ${esc(chk.latest)}? Займёт 1–3 минуты, данные сохранятся. Перед обновлением делается копия базы.`, 'Обновить'))) return;
      try { updDraw(await api('POST', '/api/update/run', {})); updPoll(); } catch (e) { fail(e); }
    };
  };
  const updCheck = async () => {
    try {
      const st = await api('GET', '/api/update/status');
      if (st.running) { updDraw(st); return updPoll(); }
      let chk; try { chk = await api('GET', '/api/update/check'); } catch (e) { chk = { error: e.message }; }
      updDraw(st, chk);
    } catch (e) { $('#updBox', page).innerHTML = `<div class="notice warn">${esc(e.message)}</div>`; }
  };
  const updPoll = () => {
    let wasDown = false, n = 0;
    const tick = async () => {
      if (!document.body.contains(page) || !$('#updBox', page)) return;
      n++;
      try {
        const st = await api('GET', '/api/update/status');
        if (!st.running && (wasDown || /=== (Готово|Ошибка|Откат)/.test(st.log))) {
          if (/=== Готово/.test(st.log)) { toast('CRM обновлена до ' + st.version); setTimeout(() => location.reload(), 1500); }
          updTimer = 'done'; updDraw(st); return;
        }
        updDraw(st);
      } catch { wasDown = true; $('#updBox', page).innerHTML = '<div class="notice info">CRM перезапускается…</div>'; }
      if (n < 200) setTimeout(tick, 3000);
    };
    setTimeout(tick, 2000);
  };
  $('#updSave', page).onclick = async () => { await saveSettings({ update_repo: $('#updRepo', page).value, update_branch: $('#updBr', page).value || 'main' }); toast('Сохранено'); updCheck(); };
  $('#updFile', page).onclick = () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = '.gz,.tgz,application/gzip';
    i.onchange = async () => {
      const f = i.files[0]; if (!f) return;
      if (!(await confirmBox(`Установить обновление из файла «${esc(f.name)}»?`, 'Установить'))) return;
      const data = await new Promise((ok, no) => { const rd = new FileReader(); rd.onload = () => ok(rd.result); rd.onerror = () => no(new Error('Не удалось прочитать файл')); rd.readAsDataURL(f); });
      try { toast('Загружаю архив…'); updDraw(await api('POST', '/api/update/upload', { data })); updPoll(); } catch (e) { fail(e); }
    };
    i.click();
  };
  if (isAdmin()) updCheck();

  // ---------- домен ----------
  const domDraw = async () => {
    const box = $('#domBox', page); if (!box) return;
    if (window.DEMO_API) { box.innerHTML = '<div class="hint">В демо-версии домен не подключается — только на сервере.</div>'; return; }
    let st; try { st = await api('GET', '/api/domain'); } catch (e) { box.innerHTML = `<div class="notice warn">${esc(e.message)}</div>`; return; }
    const ip = st.ips[0] || 'IP сервера';
    box.innerHTML = `${st.domain ? `<div class="row"><span>Сейчас: <b>${esc(st.domain)}</b></span>${st.https ? `<span class="badge b-ok">HTTPS работает</span><a class="btn sm" href="https://${esc(st.domain)}/crm" target="_blank" rel="noopener">Открыть</a>` : '<span class="badge b-warn">без HTTPS</span>'}</div>` : '<div class="hint">Пока сайт открывается только по IP. Подключите свой домен — будет красивый адрес и защищённое соединение (HTTPS) бесплатно.</div>'}
      <div class="notice"><b>1.</b> Купите домен (например, на reg.ru или nic.ru) — от 200 ₽ в год.<br><b>2.</b> В настройках DNS у регистратора добавьте <b>A-запись</b>: имя <code>@</code>, значение <code>${esc(ip)}</code>${st.ips.length > 1 ? ` (или ${esc(st.ips.slice(1).join(', '))})` : ''}.<br><b>3.</b> Через 15–60 минут введите домен ниже и нажмите «Подключить».</div>
      <div class="two"><label class="f">Домен<input id="domName" value="${esc(st.domain || '')}" placeholder="nails-kansk.ru" autocapitalize="none"></label><label class="f">Почта для сертификата (необязательно)<input id="domMail" type="email" value="${esc(st.email || '')}" placeholder="you@mail.ru"></label></div>
      <div class="row"><button type="button" class="sm" id="domCheck">Проверить домен</button><button type="button" class="primary" id="domGo">${ic('site')}Подключить</button></div><div id="domRes"></div>`;
    $('#domCheck', page).onclick = async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try { const r = await api('POST', '/api/domain/check', { domain: $('#domName', page).value }); $('#domRes', page).innerHTML = r.ok ? `<div class="notice">✓ ${esc(r.domain)} указывает на этот сервер — можно подключать.</div>` : `<div class="notice warn">${esc(r.reason)}</div>`; }
      catch (er) { fail(er); } finally { b.disabled = false; }
    };
    $('#domGo', page).onclick = async () => {
      const d = $('#domName', page).value.trim(); if (!d) return toast('Введите домен', true);
      if (!(await confirmBox(`Подключить ${esc(d)}? Займёт 1–3 минуты. Сайт и CRM будут доступны по https://${esc(d.replace(/^https?:\/\//, ''))}, а адрес по IP останется запасным. Войти в CRM на новом адресе нужно будет заново.`, 'Подключить'))) return;
      try { updDraw(await api('POST', '/api/domain/connect', { domain: d, email: $('#domMail', page).value })); $('#fUpd', page).scrollIntoView({ behavior: 'smooth' }); updPoll(); } catch (er) { fail(er); }
    };
  };
  if (isAdmin()) domDraw();

  // ---------- пользователи ----------
  const ROLE = { admin: 'Администратор', master: 'Мастер' };
  const userModal = (u = {}) => modal(u.id ? 'Пользователь' : 'Новый пользователь', `<div class="form">
    <div class="two"><label class="f">Имя<input name="name" value="${esc(u.name || '')}" placeholder="Алена" required></label><label class="f">Логин<input name="login" value="${esc(u.login || '')}" ${u.id ? 'disabled' : ''} placeholder="alena" autocapitalize="none"></label></div>
    <div class="two"><label class="f">Роль<select name="role">${opts(Object.entries(ROLE), u.role || 'master')}</select></label><label class="f">${u.id ? 'Новый пароль (если нужно сбросить)' : 'Пароль'}<input name="password" autocomplete="new-password" ${u.id ? '' : 'required'}></label></div>
    ${u.id ? `<label class="chk"><input type="checkbox" name="active" ${u.active ? 'checked' : ''}> Вход разрешён</label>` : ''}
    <div class="hint">Выданный пароль человек сменит при первом входе.</div></div>`, {
    onSubmit: async (f) => {
      if (u.id) await api('PUT', '/api/users/' + u.id, { name: f.name, role: f.role, active: f.active, ...(f.password ? { password: f.password } : {}) });
      else await api('POST', '/api/users', f);
      toast('Сохранено'); drawUsers();
    },
  });
  const drawUsers = async () => {
    const el = $('#uList', page); if (!el) return;
    try {
      const list = await api('GET', '/api/users');
      el.innerHTML = list.map((u) => `<div class="item click" data-u="${u.id}" style="${u.active ? '' : 'opacity:.5'}"><span class="av">${esc(initials(u.name))}</span><span class="main-t"><b>${esc(u.name)}${D.me && D.me.id === u.id ? ' <span class="muted small">(вы)</span>' : ''}</b><span class="muted">логин ${esc(u.login)}${u.active ? '' : ' · вход отключён'}</span></span><span class="badge ${u.role === 'admin' ? 'b-violet' : 'b-ok'}">${ROLE[u.role] || u.role}</span></div>`).join('');
      $$('[data-u]', el).forEach((x) => (x.onclick = () => userModal(list.find((u) => u.id === +x.dataset.u))));
    } catch (e) { el.innerHTML = `<div class="hint">${esc(e.message)}</div>`; }
  };
  if (isAdmin() && !window.DEMO_API) { $('#uAdd', page).onclick = () => userModal(); drawUsers(); }
  // мастер не видит системные разделы
  if (!isAdmin() || window.DEMO_API) $$('#fUsers', page).forEach((e) => e.remove());
  if (!isAdmin()) $$('#fDom, #fUpd', page).forEach((e) => e.remove());
  $('#pw', page).onclick = () => modal('Смена пароля', `<div class="form"><label class="f">Текущий пароль<input type="password" name="old" autocomplete="current-password"></label><label class="f">Новый пароль (от 6 символов)<input type="password" name="new" autocomplete="new-password"></label></div>`, { onSubmit: async (f) => { await api('POST', '/api/password', f); toast('Пароль изменён'); } });
  if (location.hash.includes('#', 1)) { const id = location.hash.split('#').pop(); const el = $('#' + id, page); if (el) el.scrollIntoView(); }
});
