'use strict';
/* Демо-версия: «сервер» внутри браузера. Данные — в localStorage этого браузера. */
(function () {
  const SH = window.NailShared;
  const KEY = 'nailcrm-demo-v2';
  const TABLES = ['clients', 'services', 'appointments', 'payments', 'expenses', 'courses', 'cohorts', 'students', 'leads', 'posts', 'works', 'reviews', 'time_off'];
  const ymd = SH.ymd;
  const nowStr = () => { const d = new Date(); return ymd(d) + ' ' + d.toTimeString().slice(0, 8); };
  const add = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
  let DB;

  function seed() {
    const db = { nextId: 1, logged: false, sms: [] };
    TABLES.forEach((t) => (db[t] = []));
    const ins = (t, o) => { const r = { id: db.nextId++, created_at: nowStr(), ...o }; db[t].push(r); return r; };
    db.settings = {
      master_name: 'Алена Макарова', studio_name: 'Алена Макарова · nail studio', city: 'Канск', phone: '+7 (900) 000-00-00', address: 'г. Канск, [адрес студии]',
      hours_text: 'ежедневно, 10:00–20:00', tagline: 'Мастер-инструктор по маникюру', social_tg: 'https://t.me/', social_wa: '', social_vk: 'https://vk.com/', social_max: '', review_url: 'https://2gis.ru/', site_url: '',
      work_days: '1,2,3,4,5,6', work_from: '10:00', work_to: '20:00', slot_step: '30', booking_on: '1', booking_auto: '0', booking_min_hours: '3', booking_days_ahead: '30',
      tax_person: '4', tax_company: '6', npd_limit: '2400000', site_on: '1', hero_photo: window.DEMO_HERO || '', summary_time: '20:00',
      sms_provider: 'gate', sms_gate_user: 'demo', has_sms_gate_pass: true, sms_from_hour: '10', sms_to_hour: '20', sms_interval: '40', sms_daily_limit: '100', sms_remind_time: '18:00', sms_correction_days: '21',
      sms_auto_remind: '1', sms_auto_confirm: '1', sms_auto_review: '1', sms_auto_correction: '0', sms_auto_birthday: '1',
      sms_tpl_remind: '{имя}, напоминаю: жду вас {дата} в {время} на {услуга}. Алена, {телефон}',
      sms_tpl_confirm: '{имя}, вы записаны {дата} в {время} на {услуга}. Адрес: {адрес}. Алена',
      sms_tpl_review: '{имя}, спасибо, что были у меня! Буду рада вашему отзыву: {2гис}',
      sms_tpl_correction: '{имя}, прошло 3 недели — самое время обновить маникюр. Записаться: {телефон}. Алена',
      sms_tpl_birthday: '{имя}, с днём рождения! Дарю скидку 10% на любую услугу в течение месяца. Алена, {телефон}',
      tg_post_chat: '@demo_nails', ai_provider: 'gigachat', has_gigachat_key: true, has_tg_token: true, has_max_token: true, max_content_chat: '1', vk_group_id: '123', has_vk_token: true, api_key: 'demo-key', tz: '',
    };
    const S = [
      ['Маникюр', 'Маникюр без покрытия', 700, 0, 60, 'комбинированный или аппаратный'], ['Маникюр', 'Маникюр + гель-лак', 1500, 0, 120, 'укрепление базой, однотон'],
      ['Маникюр', 'Маникюр + выравнивание + гель-лак', 1800, 0, 150, 'ровная архитектура, стойкость'], ['Маникюр', 'Наращивание ногтей', 2500, 0, 180, 'длина до 2, однотон'],
      ['Маникюр', 'Коррекция наращивания', 2200, 0, 150, 'с покрытием'], ['Маникюр', 'Снятие покрытия', 200, 0, 20, 'работа другого мастера'],
      ['Дизайн и ремонт', 'Френч или лунки', 300, 1, 20, 'на все ногти'], ['Дизайн и ремонт', 'Втирка, градиент', 300, 0, 15, 'на все ногти'],
      ['Дизайн и ремонт', 'Дизайн одного ногтя', 100, 1, 10, 'роспись, стемпинг, декор'], ['Дизайн и ремонт', 'Ремонт одного ногтя', 150, 0, 15, 'восстановление формы'],
    ];
    S.forEach(([category, name, price, price_from, duration, note], i) => ins('services', { category, name, price, price_from, duration, note, on_site: 1, sort: i, active: 1 }));
    const c1 = ins('courses', { title: 'Базовый курс маникюра', tag: 'С нуля', price: 15000, price_from: 1, hours: 40, program: 'Анатомия и гигиена\nКомбинированный маникюр\nПокрытие гель-лаком\nПрактика на моделях', on_site: 1, sort: 1, active: 1 });
    const c2 = ins('courses', { title: 'Выравнивание и архитектура', tag: 'Повышение', price: 8000, price_from: 1, hours: 16, program: 'Идеальные блики\nРабота с проблемными ногтями\nСкорость без потери качества', on_site: 1, sort: 2, active: 1 });
    ins('courses', { title: 'Мастер-класс один на один', tag: 'Индивидуально', price: 5000, price_from: 1, hours: 6, program: 'Программа под ваш запрос\nРазбор ваших работ\nГибкий график', on_site: 1, sort: 3, active: 1 });

    const names = ['Ольга Смирнова', 'Анастасия Кузнецова', 'Мария Попова', 'Екатерина Васильева', 'Дарья Петрова', 'Юлия Соколова', 'Ирина Михайлова', 'Наталья Новикова', 'Виктория Фёдорова', 'Елена Морозова',
      'Алина Волкова', 'Ксения Алексеева', 'Полина Лебедева', 'Татьяна Семёнова', 'Светлана Егорова', 'Кристина Павлова', 'Вероника Козлова', 'Софья Степанова', 'Алёна Николаева', 'Валерия Орлова',
      'Марина Андреева', 'Яна Макарова', 'Диана Захарова', 'Людмила Зайцева', 'Ангелина Соловьёва'];
    const src = ['Рекомендация', 'Онлайн-запись', 'ВКонтакте', 'Telegram', '2ГИС', 'Постоянная', 'Рекомендация', 'Авито'];
    let rnd = 7; const R = () => ((rnd = (rnd * 9301 + 49297) % 233280) / 233280);
    const cl = names.map((name, i) => {
      const phone = SH.fmtPhone('79' + String(130000000 + Math.floor(R() * 89999999)));
      const bm = String(1 + Math.floor(R() * 12)).padStart(2, '0'), bd = String(1 + Math.floor(R() * 28)).padStart(2, '0');
      return ins('clients', { name, phone, phone_norm: SH.normPhone(phone), birthday: i % 3 === 0 ? `199${i % 10}-${bm}-${bd}` : null, source: src[i % src.length], notes: i % 5 === 0 ? 'Любит нюдовые оттенки, короткий миндаль' : i % 7 === 0 ? 'Тонкие ногти — только выравнивание' : null, discount: i % 9 === 0 ? 5 : 0, no_sms: 0, is_student: i === 21 || i === 22 ? 1 : 0, created_at: add(-90 + i * 3) + ' 12:00:00' });
    });
    // день рождения сегодня/скоро — для наглядности
    cl[3].birthday = '1994-' + add(2).slice(5); cl[9].birthday = '1991-' + add(0).slice(5);
    const svc = db.services;
    const pick = () => { const r = R(); return r < 0.45 ? [svc[1]] : r < 0.6 ? [svc[2]] : r < 0.72 ? [svc[4]] : r < 0.82 ? [svc[1], svc[6]] : r < 0.9 ? [svc[3]] : [svc[1], svc[7]]; };
    const workday = (ds) => new Date(ds + 'T12:00').getDay() !== 0;
    const times = ['10:00', '12:30', '15:00', '17:30'];
    for (let d = -75; d <= 14; d++) {
      const ds = add(d); if (!workday(ds)) continue;
      times.forEach((t, k) => {
        if (R() < (d < 0 ? 0.3 : d < 4 ? 0.35 : 0.55)) return;
        const items = pick(); const c = cl[Math.floor(R() * cl.length)];
        const dur = items.reduce((s, x) => s + x.duration, 0); const total = items.reduce((s, x) => s + x.price, 0);
        const st = d < 0 ? (R() < 0.07 ? 'noshow' : 'done') : d === 0 && k < 1 ? 'done' : R() < 0.5 ? 'confirmed' : 'booked';
        const a = ins('appointments', { kind: 'client', client_id: c.id, date: ds, start: t, duration: Math.min(dur, 150), items: items.map((s) => ({ service_id: s.id, name: s.name, price: s.price, duration: s.duration })), total, discount: 0, status: st, source: R() < 0.3 ? 'Онлайн-запись' : 'Телефон', note: null, done_at: st === 'done' ? ds + ' 18:00:00' : null, review_at: st === 'done' && d < -3 ? ds : null, cohort_id: null });
        if (st === 'done') ins('payments', { date: ds, amount: total, method: R() < 0.75 ? 'card' : 'cash', kind: 'service', payer: 'person', appointment_id: a.id, client_id: c.id, comment: items.map((s) => s.name).join(', '), receipt: d < -2 ? 1 : 0, student_id: null });
      });
    }
    // онлайн-запись, ждёт подтверждения
    let rd = 2; while (!workday(add(rd))) rd++;
    ins('appointments', { kind: 'client', client_id: cl[12].id, date: add(rd), start: '11:00', duration: 120, items: [{ service_id: svc[1].id, name: svc[1].name, price: 1500, duration: 120 }], total: 1500, status: 'request', source: 'Онлайн-запись', note: 'Хочу молочный с блёстками', cohort_id: null });
    // обучение
    let cs = 9; while (!workday(add(cs))) cs++;
    const h1 = ins('cohorts', { course_id: c1.id, title: 'Базовый · ' + ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'][new Date(add(cs)).getMonth()], start_date: add(cs), end_date: add(cs + 6), schedule: 'пн–пт, 10:00–15:00', seats: 4, status: 'open', note: null });
    const h0 = ins('cohorts', { course_id: c2.id, title: 'Архитектура · осень', start_date: add(-40), end_date: add(-38), schedule: '3 дня', seats: 3, status: 'done', note: null });
    for (let i = 0; i < 3; i++) { let ld = cs + i; while (!workday(add(ld))) ld++; ins('appointments', { kind: 'lesson', cohort_id: h1.id, client_id: null, date: add(ld), start: '10:00', duration: 300, items: [], total: 0, status: 'booked' }); }
    const s1 = ins('students', { client_id: cl[21].id, course_id: c1.id, cohort_id: h1.id, price: 15000, status: 'enrolled', note: null });
    const s2 = ins('students', { client_id: cl[22].id, course_id: c1.id, cohort_id: h1.id, price: 15000, status: 'enrolled', note: 'Оплата частями' });
    const s3 = ins('students', { client_id: cl[5].id, course_id: c2.id, cohort_id: h0.id, price: 8000, status: 'graduated', cert_no: '001' });
    ins('payments', { date: add(-5), amount: 15000, method: 'card', kind: 'course', payer: 'person', student_id: s1.id, client_id: cl[21].id, comment: 'Обучение: Базовый курс', receipt: 1 });
    ins('payments', { date: add(-2), amount: 5000, method: 'card', kind: 'course', payer: 'person', student_id: s2.id, client_id: cl[22].id, comment: 'Обучение: предоплата', receipt: 0 });
    ins('payments', { date: add(-41), amount: 8000, method: 'card', kind: 'course', payer: 'company', student_id: s3.id, client_id: cl[5].id, comment: 'Обучение: архитектура (оплатил салон)', receipt: 1 });
    // расходы
    [[-3, 4200, 'Материалы', 'базы, топы, гель-лаки'], [-12, 15000, 'Аренда', 'кабинет'], [-20, 1800, 'Инструмент', 'фрезы'], [-25, 1500, 'Реклама', 'ВК'], [-33, 3900, 'Материалы', 'одноразовые пилки, крафт-пакеты'], [-42, 15000, 'Аренда', 'кабинет']]
      .forEach(([d, amount, category, comment]) => ins('expenses', { date: add(d), amount, category, comment }));
    // заявки
    ins('leads', { name: 'Карина', phone: '+7 (913) 555-12-34', kind: 'course', subject: 'Курс: Базовый курс маникюра', message: 'Хочу научиться с нуля, есть ли рассрочка?', source: 'Сайт', status: 'new', created_at: add(0) + ' 09:12:00' });
    ins('leads', { name: 'Ирина', phone: '+7 (923) 444-56-78', kind: 'service', subject: 'Наращивание', message: 'Можно в субботу после обеда?', source: 'Сайт', status: 'new', created_at: add(-1) + ' 20:40:00' });
    // контент-план
    ins('posts', { date: add(1), time: '10:00', title: 'Молочный френч', text: 'Нежный молочный френч с тонкой линией ✨\nИдеален к любому образу и держится 3–4 недели.\n\n📍 Канск\n📞 Запись: +7 (900) 000-00-00\n#маникюрканск #френч #ногтиканск', channels: ['max', 'tg', 'vk', 'site'], status: 'draft', media: [] });
    ins('posts', { date: add(4), title: 'Набор на базовый курс', status: 'idea', channels: ['tg', 'vk'], media: [] });
    ins('posts', { date: add(8), title: 'Уход за кутикулой зимой', status: 'idea', channels: ['tg', 'vk', 'max'], media: [] });
    ins('posts', { date: add(-6), time: '11:00', title: 'Нюд с втиркой', text: 'Нюд с жемчужной втиркой — мягкий блеск на каждый день.', channels: ['tg', 'vk'], status: 'published', media: [], results: { tg: { ok: true }, vk: { ok: true } }, published_at: add(-6) + ' 11:00:00' });
    // отзывы
    ins('reviews', { name: 'Ольга', text: 'Алёна — волшебница! Маникюр держится больше трёх недель, ни одного скола. Очень уютно и стерильно.', rating: 5, date: add(-20), on_site: 1 });
    ins('reviews', { name: 'Мария', text: 'Прошла базовый курс — всё по полочкам, много практики. Уже работаю с клиентами!', rating: 5, date: add(-35), on_site: 1 });
    ins('reviews', { name: 'Екатерина', text: 'Идеальные блики и форма, очень аккуратная работа. Записываюсь только сюда.', rating: 5, date: add(-50), on_site: 1 });
    // SMS-история
    db.sms.push({ id: 1, phone: cl[2].phone, text: SH.fill(db.settings.sms_tpl_remind, { name: cl[2].name, date: add(1), time: '12:30', service: 'маникюр + гель-лак' }, db.settings), kind: 'remind', client_id: cl[2].id, status: 'sent', created_at: add(-1) + ' 18:00:00', sent_at: add(-1) + ' 18:00:40' });
    return db;
  }
  function load() { try { DB = JSON.parse(localStorage.getItem(KEY)); } catch { DB = null; } if (!DB || !DB.settings) { DB = seed(); persist(); } if (!DB.settings.hero_custom) DB.settings.hero_photo = window.DEMO_HERO || ''; }
  function persist() { try { const h = DB.settings.hero_photo; if (!DB.settings.hero_custom) DB.settings.hero_photo = ''; localStorage.setItem(KEY, JSON.stringify(DB)); DB.settings.hero_photo = h; } catch (e) { console.warn('demo storage', e); } }
  window.demoReset = () => { try { localStorage.removeItem(KEY); } catch {} location.hash = ''; location.reload(); };
  const err = (status, message) => { const e = new Error(message); e.status = status; throw e; };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const integrations = () => ({
    tg: { ok: true, linked: true, token: true, bot: 'demo_nails_bot', post_chat: DB.settings.tg_post_chat || '' },
    max: { ok: true, linked: true, token: true, chats: [{ id: '1', title: 'Канал «Ногти Канск»' }], content_chat: DB.settings.max_content_chat || '' },
    vk: { token: !!DB.settings.has_vk_token, group: DB.settings.vk_group_id || '' }, sms: DB.settings.sms_provider || '', ai: DB.settings.ai_provider || '',
  });
  const smsPush = (o) => { DB.sms.unshift({ id: Date.now() + Math.random(), status: 'sent', created_at: nowStr(), sent_at: nowStr(), ...o }); };
  const sett = () => DB.settings;
  const slotArgs = (date, duration) => ({ date, duration, s: sett(), now: new Date(), appts: DB.appointments.filter((a) => a.date === date && !['cancelled', 'noshow'].includes(a.status)), timeOff: DB.time_off });
  const svcList = (ids) => DB.services.filter((s) => ids.includes(s.id));

  // ИИ в демо — заготовки по шаблону
  function demoAi(preset, prompt) {
    const s = sett(); const p = String(prompt || '').trim();
    const tags = '#маникюр' + (s.city ? s.city.toLowerCase().replace(/\s/g, '') : '') + ' #ногти #маникюр #nails #гельлак';
    const tail = `\n\n📍 ${s.city || ''}\n📞 Запись: ${s.phone}\n${tags}`;
    const facts = p.replace(/^Факты о работе:\s*/i, '').replace(/\s+/g, ' ').trim();
    switch (preset) {
      case 'post': return `✨ ${facts.split(/[.,!]/)[0] || 'Новая работа'}\n\nЛюблю такие работы: аккуратная форма, ровное покрытие и ничего лишнего. ${facts.length > 40 ? facts : 'Нежно, премиально и уместно в любой день.'}\n\nДержится 3–4 недели без сколов — проверено на клиентках 💛\nХотите так же? Напишите или запишитесь онлайн по ссылке в профиле.${tail}`;
      case 'improve': return p.replace(/\n{3,}/g, '\n\n').replace(/^./, (c) => c.toUpperCase()) + (/#/.test(p) ? '' : tail);
      case 'sms': return '{имя}, давно не виделись! Есть окошки на этой неделе — запишу на удобное время. Алена, ' + s.phone;
      case 'reply': return `Здравствуйте! Спасибо, что написали 💛\n${/суббот/i.test(p) ? 'В субботу есть окошко вечером — могу записать на 17:30.' : 'Подберу для вас удобное время.'} Стоимость зависит от длины и дизайна — точно скажу после фото ваших ногтей. Записать вас?`;
      case 'promo': return 'Будние окошки со скидкой 10% 🌿\nПн–чт с 10:00 до 14:00 — маникюр с покрытием по специальной цене. Количество мест ограничено, записывайтесь онлайн или по телефону.' + tail;
      case 'course': return `${p.split('\n')[0].replace(/^Курс:\s*/, '') || 'Курс маникюра'} — для тех, кто хочет уверенно работать с клиентами.\n\nНа курсе: теория без воды, много практики на моделях, разбор каждой работы и поддержка после обучения. Небольшая группа — внимание каждой ученице.\n\nВ итоге вы умеете делать аккуратный маникюр с ровным покрытием и знаете, как найти первых клиентов.\n\nЗапишитесь на ближайший поток — мест немного 💛`;
      case 'ideas': {
        const t = ['Работа недели: нюд с втиркой', 'Как ухаживать за кутикулой зимой', 'До/после: выравнивание', 'Набор на базовый курс', 'Топ-5 оттенков сезона', 'Отзыв ученицы', 'Почему я за стерильность: крафт-пакеты и сухожар', 'Френч: классика и новые варианты', 'Уход за руками зимой', 'Один день из жизни мастера', 'Ответы на частые вопросы', 'Свободные окошки на неделю'];
        return t.map((x, i) => { const d = new Date(); d.setDate(d.getDate() + 2 + i * 2); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} — ${x} — короткий живой пост с фото`; }).join('\n');
      }
      default: return /коротк|сократи/i.test(p) ? p.split('\n').filter(Boolean).slice(0, 4).join('\n').replace(/^Сократи[^:]*:\s*/i, '') : 'Варианты: «Шёлковый нюд», «Утренний латте», «Пудровая роза», «Сливочный кашемир», «Тёплый беж».';
    }
  }

  async function handle(method, url, body) {
    await new Promise((r) => setTimeout(r, 60));
    const u = new URL(url, 'http://demo'); const p = u.pathname; const q = Object.fromEntries(u.searchParams); body = body || {};
    let m;
    if (p === '/api/me') return { user: DB.logged ? { id: 1, login: 'admin', name: sett().master_name } : null };
    if (p === '/api/login') { if (body.login !== 'admin' || body.password !== 'demo') err(401, 'Демо: логин admin, пароль demo'); DB.logged = true; persist(); return { ok: true }; }
    if (p === '/api/logout') { DB.logged = false; persist(); return { ok: true }; }
    // сайт
    if (p === '/api/public/days') { const out = []; for (let i = 0; i <= (+sett().booking_days_ahead || 30); i++) { const ds = add(i); out.push({ date: ds, free: SH.freeSlots(slotArgs(ds, +q.duration || 60)).length }); } return { days: out }; }
    if (p === '/api/public/slots') return { slots: SH.freeSlots(slotArgs(q.date, +q.duration || 60)) };
    if (p === '/api/public/book') {
      const items = svcList((body.services || []).map(Number)); if (!items.length) err(400, 'Выберите услугу');
      const duration = items.reduce((s, i) => s + i.duration, 0);
      if (!SH.freeSlots(slotArgs(body.date, duration)).includes(body.start)) err(409, 'Это время уже заняли — выберите другое');
      const pn = SH.normPhone(body.phone); if (pn.length !== 11) err(400, 'Укажите номер телефона полностью');
      let c = DB.clients.find((x) => x.phone_norm === pn);
      if (!c) { c = { id: DB.nextId++, name: body.name || 'Клиентка', phone: SH.fmtPhone(pn), phone_norm: pn, source: 'Онлайн-запись', created_at: nowStr() }; DB.clients.push(c); }
      const auto = sett().booking_auto === '1';
      DB.appointments.push({ id: DB.nextId++, kind: 'client', client_id: c.id, date: body.date, start: body.start, duration, items: items.map((i) => ({ service_id: i.id, name: i.name, price: i.price, duration: i.duration })), total: items.reduce((s, i) => s + i.price, 0), status: auto ? 'booked' : 'request', source: 'Онлайн-запись', note: body.comment || null, created_at: nowStr() });
      persist(); return { ok: true, status: auto ? 'booked' : 'request' };
    }
    if (p === '/api/public/lead') { if (SH.normPhone(body.phone).length < 10) err(400, 'Укажите телефон'); DB.leads.push({ id: DB.nextId++, name: body.name, phone: SH.fmtPhone(body.phone), kind: /курс|обуч/i.test(body.subject || '') ? 'course' : 'service', subject: body.subject, message: body.message, source: 'Сайт', status: 'new', created_at: nowStr() }); persist(); return { ok: true }; }
    if (!DB.logged) err(401, 'Требуется вход');
    if (p === '/api/data') { const o = {}; TABLES.forEach((t) => (o[t] = clone(DB[t]))); o.settings = clone(sett()); o.integrations = integrations(); return o; }
    if ((m = /^\/api\/t\/(\w+)(?:\/(\d+))?$/.exec(p))) {
      const t = m[1], id = +m[2]; if (!TABLES.includes(t)) err(404, 'Нет таблицы');
      const { _sms_confirm, ...b } = body;
      if (t === 'clients' && 'phone' in b) b.phone_norm = SH.normPhone(b.phone) || null;
      for (const k in b) if (typeof b[k] === 'boolean') b[k] = b[k] ? 1 : 0;
      let row;
      if (method === 'POST') { row = { id: DB.nextId++, created_at: nowStr(), ...b }; DB[t].push(row); }
      else if (method === 'PUT') { row = DB[t].find((x) => x.id === id); if (!row) err(404, 'Запись не найдена'); const was = row.status; Object.assign(row, b); if (t === 'appointments' && b.status === 'done' && was !== 'done') row.done_at = nowStr(); }
      else if (method === 'DELETE') {
        if (t === 'clients') { DB.appointments = DB.appointments.filter((a) => a.client_id !== id); DB.students = DB.students.filter((s) => s.client_id !== id); DB.payments.forEach((x) => { if (x.client_id === id) x.client_id = null; }); }
        if (t === 'cohorts') { DB.appointments = DB.appointments.filter((a) => !(a.kind === 'lesson' && a.cohort_id === id)); DB.students.forEach((s) => { if (s.cohort_id === id) s.cohort_id = null; }); }
        DB[t] = DB[t].filter((x) => x.id !== id); persist(); return { ok: true };
      }
      if (t === 'appointments' && _sms_confirm && row.client_id && sett().sms_provider) {
        const c = DB.clients.find((x) => x.id === row.client_id);
        if (c && c.phone && !c.no_sms) smsPush({ phone: c.phone, client_id: c.id, kind: 'confirm', text: SH.fill(sett().sms_tpl_confirm, { name: c.name, date: row.date, time: row.start, service: (row.items || []).map((i) => i.name).join(', ').toLowerCase() }, sett()) });
      }
      persist(); return clone(row);
    }
    if (p === '/api/settings') {
      for (const [k, v] of Object.entries(body)) { if (/(token|key|pass|api_id)$/.test(k)) { if (String(v || '').trim()) sett()['has_' + k] = true; continue; } if (k.startsWith('clear_')) continue; sett()[k] = typeof v === 'boolean' ? (v ? '1' : '0') : String(v ?? ''); }
      persist(); return { settings: clone(sett()), integrations: integrations() };
    }
    if (p === '/api/link-code') return { code: String(100000 + Math.floor(Math.random() * 899999)) };
    if (p === '/api/notify-test' || p === '/api/sms/test') { if (p === '/api/sms/test') smsPush({ phone: body.phone, text: 'Проверка SMS из CRM', kind: 'test' }); persist(); return { ok: true }; }
    if (p === '/api/integrations') return integrations();
    if (p === '/api/upload') { if (body.as === 'hero') { sett().hero_photo = body.data; sett().hero_custom = 1; } if (body.as === 'bg') sett().site_bg = body.data; persist(); return { file: body.data, url: body.data }; }
    if (p === '/api/ai' || p === '/api/ai/test') { await new Promise((r) => setTimeout(r, 700)); return { text: p === '/api/ai/test' ? 'Готов помогать с текстами! (демо)' : demoAi(body.preset, body.prompt) }; }
    if ((m = /^\/api\/posts\/(\d+)\/publish$/.exec(p))) {
      const post = DB.posts.find((x) => x.id === +m[1]); if (!post) err(404, 'Пост не найден');
      if (!(post.media || []).length) err(400, 'Добавьте хотя бы одно фото');
      await new Promise((r) => setTimeout(r, 900));
      post.results = {}; for (const ch of post.channels || []) post.results[ch] = { ok: true, at: new Date().toISOString() };
      if ((post.channels || []).includes('site') && !DB.works.some((w) => w.post_id === post.id)) post.media.forEach((f) => DB.works.push({ id: DB.nextId++, photo: f, caption: post.title || '', category: 'Маникюр', on_site: 1, post_id: post.id, created_at: nowStr() }));
      post.status = 'published'; post.published_at = nowStr(); persist(); return clone(post);
    }
    if (p === '/api/sms/send') {
      const list = Array.isArray(body.to) ? body.to : [{ phone: body.phone, client_id: body.client_id, name: body.name }];
      let queued = 0; const skipped = {};
      for (const x of list) { const c = DB.clients.find((y) => y.id === x.client_id); if (c && c.no_sms) { skipped['отказалась от SMS'] = (skipped['отказалась от SMS'] || 0) + 1; continue; } smsPush({ phone: x.phone, client_id: x.client_id, kind: list.length > 1 ? 'bulk' : 'manual', text: SH.fill(body.text, x, sett()) }); queued++; }
      persist(); return { queued, skipped, est_minutes: Math.ceil(queued * 40 / 60) };
    }
    if (p === '/api/sms/queue') return { rows: DB.sms.slice(0, 300).map((x) => ({ ...x, client: DB.clients.find((c) => c.id === x.client_id)?.name })), stats: {}, active: 'gate', error: '' };
    if (p === '/api/sms/cancel') return { cancelled: 0 };
    if (p === '/api/sms/retry') return { n: 0 };
    if (p === '/api/password') err(400, 'В демо пароль не меняется');
    if (p === '/api/update/status') return { version: '1.5.1', repo: 'zeus199191/nailcrm', running: false, log: '', enabled: true };
    if (p === '/api/update/check') return { current: '1.5.1', latest: '1.5.1', available: false };
    if (p.startsWith('/api/update/')) err(400, 'В демо обновление не работает — только на сервере');
    err(404, 'Нет в демо: ' + p);
  }
  load();
  window.DEMO_API = handle;
  window.DEMO_SITE = () => ({
    settings: sett(),
    services: DB.services.filter((s) => s.active && s.on_site).sort((a, b) => (a.sort || 0) - (b.sort || 0)),
    courses: DB.courses.filter((c) => c.active && c.on_site),
    works: DB.works.filter((w) => w.on_site).slice().reverse().slice(0, 24).map((w) => ({ ...w, url: w.photo })),
    reviews: DB.reviews.filter((r) => r.on_site).slice().reverse(),
  });
})();
