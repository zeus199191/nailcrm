// Лендинг мастера: прайс и курсы из CRM, портфолио, отзывы, онлайн-запись, заявка, кнопка «Вход» в CRM.
// Чистая функция render(data, opts) — работает и на сервере, и в демо-версии в браузере.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NailLanding = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rub = (n) => Math.round(+n || 0).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽';
  const tel = (p) => '+' + String(p || '').replace(/\D/g, '').replace(/^8/, '7');
  const ICON = {
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    pin: '<path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    img: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="m21 15-5-5L5 21"/>',
    check: '<path d="M20 6 9 17l-5-5"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>', back: '<path d="m15 18-6-6 6-6"/>', star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  };
  const ic = (n, cls) => `<svg class="i ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

  const CSS = `:root{--bg:#FBF8F4;--blush:#F6EFE8;--ink:#2A2420;--text:#5C524B;--muted:#6B5F57;--gold:#85663A;--gold-dk:#5E4826;--line:#B9975F;--line-soft:#D9C29A;--border:#EADFCF;--border-2:#E2D3BC;--serif:'Cormorant Garamond',Georgia,serif;--sans:'Manrope',-apple-system,system-ui,sans-serif}
*{box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.6;padding-bottom:84px}
a{color:var(--gold)}img{max-width:100%}
.wrap{max-width:1200px;margin:0 auto;padding-left:20px;padding-right:20px}
.eyebrow{font-size:12px;letter-spacing:.26em;text-transform:uppercase;color:var(--gold)}
h1,h2,h3{font-family:var(--serif);font-weight:400;margin:0;line-height:1.1}h2{font-size:clamp(36px,8vw,54px)}
.rule{display:block;width:56px;height:1px;background:var(--line)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:0 30px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px;font-family:var(--sans);cursor:pointer;border:1px solid transparent;-webkit-tap-highlight-color:transparent}
.btn-gold{background:var(--gold);color:#fff}.btn-gold:active{background:var(--gold-dk)}.btn-gold[disabled]{opacity:.45;cursor:default}
.btn-ghost{background:#fff;color:var(--ink);border-color:var(--line-soft);font-weight:500}
.btn-sm{min-height:44px;padding:0 20px;font-size:14px;font-weight:500}
:focus-visible{outline:2px solid var(--line);outline-offset:3px}
svg.i{width:18px;height:18px;fill:none;stroke:var(--gold);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;flex:none}
header{position:sticky;top:0;z-index:10;background:rgba(251,248,244,.92);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-bottom:1px solid var(--border)}
.hdr{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:12px;padding-bottom:12px}
.logo{text-decoration:none;color:var(--ink);display:flex;align-items:center;gap:10px;min-width:0}
.logo img{height:40px;width:auto;flex:none}.logo span{display:flex;flex-direction:column;line-height:1.1;min-width:0}
.logo b{font-family:var(--serif);font-weight:500;font-size:23px;white-space:nowrap}
.logo small{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold);margin-top:3px;white-space:nowrap}
@media(max-width:480px){.logo b{font-size:19px}.logo img{height:34px}.logo small{letter-spacing:.16em}.login{width:44px;padding:0;justify-content:center}.login .lt{display:none}.hdr-r{gap:6px}}
@media(max-width:360px){.logo small{display:none}}
.ft-logo{display:flex;flex-direction:column;align-items:center;gap:8px;padding-top:36px}.ft-logo img{height:120px;width:auto}
nav{display:none;gap:26px;font-size:14px}nav a{text-decoration:none;color:#4A403A}
.hdr-r{display:flex;align-items:center;gap:8px}
.ic-btn{width:44px;height:44px;border-radius:50%;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;background:#fff;text-decoration:none}
.login{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid var(--border-2);background:#fff;color:var(--ink);text-decoration:none;font-size:14px;font-weight:500}
.call-full{display:none}
@media(min-width:960px){nav{display:flex}.call-ic{display:none}.call-full{display:inline-flex}}
.hero{display:flex;flex-direction:column-reverse;gap:40px;padding-top:36px;padding-bottom:64px}
.hero-text{display:flex;flex-direction:column;gap:22px}
.hero h1{font-size:clamp(42px,11vw,78px);line-height:1.03}.hero h1 em{color:var(--gold)}
.lead{margin:0;font-size:17px;color:var(--text);max-width:500px}
.ctas{display:flex;flex-wrap:wrap;gap:12px}.ctas .btn{flex:1 1 160px}
.feats{display:grid;grid-template-columns:1fr;gap:14px;margin-top:8px;padding-top:22px;border-top:1px solid var(--border)}
.feats div{display:flex;flex-direction:column}.feats b{font-family:var(--serif);font-weight:500;font-size:21px}.feats span{font-size:13px;color:var(--muted)}
.photo-wrap{display:flex;justify-content:center}
.arch{position:relative;width:100%;max-width:400px;padding:12px;border:1px solid var(--line-soft);border-radius:220px 220px 26px 26px}
.arch img{display:block;width:100%;height:clamp(380px,110vw,540px);object-fit:cover;object-position:center 22%;border-radius:208px 208px 16px 16px;background:var(--blush)}
.badge{position:absolute;left:-6px;bottom:36px;background:#fff;border:1px solid var(--border);border-radius:16px;padding:12px 18px;display:flex;flex-direction:column;box-shadow:0 14px 36px rgba(90,70,40,.10)}
.badge i{font-family:var(--serif);font-size:20px;color:var(--gold)}.badge span{font-size:12px;color:var(--muted)}
@media(min-width:900px){.hero{flex-direction:row;align-items:center;gap:56px;padding-top:72px;padding-bottom:88px}.hero-text{flex:1 1 0}.photo-wrap{flex:0 0 420px}.feats{grid-template-columns:repeat(3,1fr)}.ctas .btn{flex:0 0 auto}}
section{scroll-margin-top:70px}.sec{padding-top:72px;padding-bottom:72px}
.head-c{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;margin-bottom:32px}
/* фон из роз: фото в тёплой сепии, приглушённое, поверх — кремовая вуаль для читаемости */
.bgr{position:fixed;inset:0;z-index:0;pointer-events:none;background:var(--bg)}
.bgr i{position:absolute;inset:-20px;background-image:var(--bgimg);background-size:cover;background-position:center;filter:sepia(.75) saturate(.55) brightness(1.12) contrast(.88) blur(.4px);opacity:var(--bgop,.28)}
.bgr b{position:absolute;inset:0;background:linear-gradient(180deg,rgba(251,248,244,.55),rgba(251,248,244,.25) 40%,rgba(251,248,244,.55))}
.site{position:relative;z-index:1}
.prices{background:rgba(255,255,255,.80);border-top:1px solid #EFE6D9;border-bottom:1px solid #EFE6D9;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}.prices .wrap{max-width:900px}
.tabs{display:flex;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px;margin-bottom:12px;scrollbar-width:none}.tabs::-webkit-scrollbar{display:none}
@media(min-width:600px){.tabs{justify-content:center}}
.tab{flex:none;min-height:44px;padding:0 20px;border-radius:999px;border:1px solid var(--border-2);background:var(--bg);color:var(--ink);font:500 14px var(--sans);cursor:pointer}
.tab[aria-selected="true"]{background:var(--gold);border-color:var(--gold);color:#fff;font-weight:600}
.plist{display:none}.plist.on{display:block}
.row{display:flex;align-items:baseline;gap:12px;padding:18px 2px;border-bottom:1px solid #EFE6D9}
.row .n{display:flex;flex-direction:column;min-width:0}.row .n b{font-weight:500;font-size:16px}.row .n span{font-size:13px;color:var(--muted)}
.row .dots{flex:1 1 20px;border-bottom:1px dotted var(--line-soft);transform:translateY(-5px)}
.row .p{font-family:var(--serif);font-size:24px;font-weight:500;color:var(--gold);white-space:nowrap}
.note{margin:22px 0 0;text-align:center;font-size:14px;color:var(--muted)}
.center{display:flex;justify-content:center;margin-top:26px}
.c-head{display:flex;flex-direction:column;gap:14px;margin-bottom:32px}.c-head p{margin:0;color:var(--text);max-width:440px}
@media(min-width:900px){.c-head{flex-direction:row;align-items:flex-end;justify-content:space-between}}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:18px}
.card{background:rgba(255,255,255,.88);border:1px solid var(--border);border-radius:24px;padding:30px 26px;display:flex;flex-direction:column;gap:16px}
.card h3{font-weight:500;font-size:28px}.card ul{margin:0;padding-left:18px;color:var(--text);font-size:15px}.card li{margin:4px 0}
.card .ft{margin-top:auto;padding-top:16px;border-top:1px solid #EFE6D9;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.card .ft b{font-family:var(--serif);font-weight:500;font-size:26px}.card .btn-sm{border-color:var(--line)}
.works{background:rgba(246,239,232,.72)}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
@media(min-width:700px){.grid{grid-template-columns:repeat(3,1fr);gap:16px}}@media(min-width:1000px){.grid{grid-template-columns:repeat(4,1fr)}}
figure{margin:0;display:flex;flex-direction:column;gap:8px}
.ph{aspect-ratio:4/5;border-radius:18px;background:#fff;border:1px solid #E8DACA;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#8C7E73;font-size:12px;overflow:hidden}
.ph img{width:100%;height:100%;object-fit:cover;display:block}.ph svg{width:30px;height:30px;stroke-width:1.2}
figcaption{font-size:13px;color:var(--text);padding:0 4px}
.revs{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.rev{background:rgba(255,255,255,.88);border:1px solid var(--border);border-radius:20px;padding:22px;display:flex;flex-direction:column;gap:10px}
.rev .st{display:flex;gap:2px}.rev .st svg{width:15px;height:15px;fill:var(--line);stroke:none}.rev p{margin:0;color:var(--text);font-size:15px}.rev b{font-weight:600;font-size:14px}
.contact{display:flex;flex-direction:column;gap:36px}@media(min-width:900px){.contact{flex-direction:row}.contact>*{flex:1 1 0}}
.c-info{display:flex;flex-direction:column;gap:22px}.c-info p{margin:0;color:var(--text);max-width:400px}
.ci{display:flex;align-items:center;gap:14px;text-decoration:none;color:var(--ink)}
.ci .circ{width:50px;height:50px;flex:none;border-radius:50%;border:1px solid var(--line-soft);display:flex;align-items:center;justify-content:center}
.ci .t{display:flex;flex-direction:column}.ci .t small{font-size:13px;color:var(--muted)}.ci .t b{font-weight:500;font-size:16px}.ci .t b.big{font-family:var(--serif);font-size:25px}
.soc{display:flex;flex-wrap:wrap;gap:8px}.soc a{display:inline-flex;align-items:center;min-height:44px;padding:0 20px;border-radius:999px;background:#fff;border:1px solid var(--border-2);text-decoration:none;color:var(--ink);font-size:14px;font-weight:500}
.form-card{background:#fff;border:1px solid var(--border);border-radius:26px;padding:30px 22px;box-shadow:0 24px 60px rgba(90,70,40,.07)}
@media(min-width:600px){.form-card{padding:40px 36px}}
form{display:flex;flex-direction:column;gap:16px}
label{display:flex;flex-direction:column;gap:7px;font-size:13px;font-weight:500;color:#4A403A}
input,select,textarea{font:16px var(--sans);color:var(--ink);background:var(--bg);border:1px solid var(--border-2);border-radius:14px;width:100%;-webkit-appearance:none;appearance:none}
input,select{min-height:50px;padding:0 16px}textarea{padding:14px 16px;resize:vertical;min-height:90px}
select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%2385663A' stroke-width='1.6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 16px center;padding-right:40px}
input:focus,select:focus,textarea:focus{outline:2px solid var(--line);outline-offset:1px}
.hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
.legal{margin:0;font-size:12px;color:var(--muted);text-align:center}.err{color:#A3341F;font-size:14px;margin:0}
.thanks{display:flex;min-height:300px;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center}
.thanks .circ{width:64px;height:64px;border-radius:50%;border:1px solid var(--line);display:flex;align-items:center;justify-content:center}
.thanks h3{font-weight:500;font-size:32px}.thanks p{margin:0;color:var(--text);max-width:320px}
footer{border-top:1px solid var(--border)}
.ftr{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;padding-top:24px;padding-bottom:calc(24px + env(safe-area-inset-bottom));font-size:13px;color:var(--muted)}.ftr a{text-decoration:none}
.bar{position:fixed;left:0;right:0;bottom:0;z-index:20;display:flex;gap:10px;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:rgba(251,248,244,.95);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-top:1px solid var(--border)}
.bar .btn{flex:1;min-height:48px}
@media(min-width:900px){.bar{display:none}body{padding-bottom:0}}
.ov{position:fixed;inset:0;z-index:50;background:rgba(42,36,32,.35);display:none;align-items:flex-end;justify-content:center}
.ov.on{display:flex}@media(min-width:700px){.ov{align-items:center}}
.sheet{background:var(--bg);width:100%;max-width:560px;max-height:92vh;max-height:92dvh;overflow:auto;border-radius:26px 26px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom));-webkit-overflow-scrolling:touch}
@media(min-width:700px){.sheet{border-radius:26px;padding:30px}}
.sh-h{display:flex;align-items:center;gap:10px;margin-bottom:16px}.sh-h h3{flex:1;font-size:30px;font-weight:500}
.sh-h button{width:44px;height:44px;border-radius:50%;border:1px solid var(--border-2);background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}
.steps{display:flex;gap:6px;margin-bottom:18px}.steps i{flex:1;height:3px;border-radius:3px;background:var(--border)}.steps i.on{background:var(--line)}
.svc{display:flex;flex-direction:row;text-align:left;align-items:center;gap:12px;padding:14px;border:1px solid var(--border-2);border-radius:16px;background:#fff;cursor:pointer;margin-bottom:8px}
.svc input{width:22px;height:22px;min-height:0;flex:none;accent-color:var(--gold);-webkit-appearance:auto;appearance:auto}
.svc .n{flex:1;display:flex;flex-direction:column}.svc .n b{font-weight:500;font-size:15px}.svc .n span{font-size:12px;color:var(--muted)}
.svc .p{font-family:var(--serif);font-size:20px;color:var(--gold);white-space:nowrap}
.svc:has(input:checked){border-color:var(--gold);background:#FFFDF9}
.cat{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin:16px 0 8px}
.sum{position:sticky;bottom:-22px;margin:14px -20px -22px;padding:14px 20px calc(14px + env(safe-area-inset-bottom));background:rgba(251,248,244,.97);border-top:1px solid var(--border);display:flex;align-items:center;gap:12px}
.sum div{flex:1;font-size:13px;color:var(--muted)}.sum b{display:block;font-family:var(--serif);font-size:22px;color:var(--ink);font-weight:500}
.days{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;margin-bottom:14px;-webkit-overflow-scrolling:touch}
.day{flex:none;width:62px;min-height:70px;border-radius:16px;border:1px solid var(--border-2);background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;font:500 13px var(--sans);color:var(--ink)}
.day small{font-size:11px;color:var(--muted);text-transform:uppercase}.day b{font-size:20px;font-family:var(--serif);font-weight:500}
.day[disabled]{opacity:.35;cursor:default}.day.on{background:var(--gold);border-color:var(--gold);color:#fff}.day.on small{color:#fff}
.slots{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.slot{min-height:46px;border-radius:12px;border:1px solid var(--border-2);background:#fff;font:500 15px var(--sans);color:var(--ink);cursor:pointer}
.slot.on{background:var(--gold);color:#fff;border-color:var(--gold)}
.empty{color:var(--muted);font-size:14px;padding:12px 0}
.chosen{background:#fff;border:1px solid var(--border);border-radius:16px;padding:14px 16px;font-size:14px;color:var(--text);margin-bottom:16px}.chosen b{color:var(--ink)}`;

  // фон по умолчанию: бежевые розы, Annie Spratt / Unsplash (бесплатная лицензия Unsplash)
  const DEFAULT_BG = 'https://images.unsplash.com/photo-1559320813-8cf20f4c4508?auto=format&fit=crop&w=1800&q=70';
  function render(data, opts) {
    opts = opts || {};
    const s = data.settings || {};
    const services = data.services || [], courses = data.courses || [], works = data.works || [], reviews = data.reviews || [];
    const phone = s.phone || '';
    const name = s.master_name || 'Мастер маникюра';
    const first = name.split(/\s+/)[0];
    const cats = [...new Set(services.map((x) => x.category || 'Услуги'))];
    const price = (x) => (x.price_from ? 'от ' : '') + rub(x.price);
    const booking = s.booking_on === '1';
    const socials = [['social_tg', 'Telegram'], ['social_wa', 'WhatsApp'], ['social_vk', 'ВКонтакте'], ['social_max', 'MAX']].filter(([k]) => s[k]);
    const crm = opts.crmUrl || '/crm';
    const site = JSON.stringify({ services, booking, auto: s.booking_auto === '1', first }).replace(/</g, '\\u003c');
    const placeholders = ['Нюд с втиркой', 'Классический френч', 'Молочный однотон', 'Дизайн с золотом', 'Френч с втиркой', 'Наращивание', 'Минимализм', 'Работа ученицы'];

    return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#FBF8F4">
<title>${esc(name)} · Pro Nails School — маникюр и обучение${s.city ? ', ' + esc(s.city) : ''}</title>
<link rel="icon" type="image/png" href="${esc(opts.iconSrc || '/icon-192.png')}"><link rel="apple-touch-icon" href="/icon-180.png">
<meta name="description" content="${esc(s.tagline || '')}. Маникюр, наращивание, дизайн и обучение мастеров${s.city ? ' в городе ' + esc(s.city) : ''}. Онлайн-запись.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Manrope:wght@400;500;600&display=swap">
<style>${CSS}</style></head><body>
${s.site_bg !== 'none' ? `<div class="bgr" aria-hidden="true" style="--bgimg:url('${esc(opts.bgSrc || s.site_bg || DEFAULT_BG)}');--bgop:${Math.max(0.05, Math.min(0.6, +s.site_bg_opacity || 0.28))}"><i></i><b></b></div>` : ''}<div class="site">
<header><div class="wrap hdr">
<a href="#top" class="logo"><img src="${esc(opts.logoSrc || '/img/logo-mark.png')}" alt="" width="60" height="40"><span><b>${esc(name)}</b><small>Pro Nails School${s.city ? ' · ' + esc(s.city) : ''}</small></span></a>
<nav aria-label="Разделы"><a href="#prices">Прайс</a>${courses.length ? '<a href="#courses">Обучение</a>' : ''}<a href="#works">Работы</a>${reviews.length ? '<a href="#reviews">Отзывы</a>' : ''}<a href="#contact">Контакты</a></nav>
<div class="hdr-r">
<a href="tel:${tel(phone)}" class="ic-btn call-ic" aria-label="Позвонить">${ic('phone')}</a>
<a href="tel:${tel(phone)}" class="btn btn-ghost btn-sm call-full">${ic('phone')}${esc(phone)}</a>
<a href="${esc(crm)}" class="login" data-login aria-label="${opts.loggedIn ? 'CRM' : 'Вход в CRM'}">${ic('user')}<span class="lt">${opts.loggedIn ? 'CRM' : 'Вход'}</span></a>
</div></div></header>
<main id="top">
<section class="wrap hero">
<div class="hero-text">
<div class="eyebrow">${esc(s.tagline || 'Мастер-инструктор по маникюру')}</div>
<h1>Нежность в&nbsp;деталях, <em>безупречность</em> в&nbsp;каждой работе</h1>
<p class="lead">Аккуратный маникюр с ровным покрытием и чистой архитектурой. Обучаю мастеров с нуля и помогаю опытным выйти на новый уровень.</p>
<div class="ctas"><button class="btn btn-gold" data-book>${booking ? 'Записаться онлайн' : 'Записаться'}</button><a href="tel:${tel(phone)}" class="btn btn-ghost">${ic('phone')}Позвонить</a></div>
<div class="feats"><div><b>Стерильность</b><span>крафт-пакеты и сухожар</span></div><div><b>Премиум-материалы</b><span>проверенные бренды</span></div><div><b>Обучение</b><span>курсы и мастер-классы</span></div></div>
</div>
<div class="photo-wrap"><div class="arch"><img src="${esc(opts.heroSrc || s.hero_photo || '')}" alt="${esc(name)}"><div class="badge"><i>${esc(first)}</i><span>мастер и преподаватель</span></div></div></div>
</section>

<section id="prices" class="prices"><div class="wrap sec">
<div class="head-c"><span class="eyebrow">Услуги и цены</span><h2>Прайс</h2><span class="rule"></span></div>
<div class="tabs" role="tablist" aria-label="Категории услуг">${cats.map((c, i) => `<button class="tab" role="tab" aria-selected="${i === 0}" data-t="c${i}">${esc(c)}</button>`).join('')}</div>
${cats.map((c, i) => `<div class="plist${i === 0 ? ' on' : ''}" id="c${i}">${services.filter((x) => (x.category || 'Услуги') === c).map((x) => `<div class="row"><div class="n"><b>${esc(x.name)}</b>${x.note ? `<span>${esc(x.note)}</span>` : ''}</div><span class="dots"></span><span class="p">${price(x)}</span></div>`).join('')}</div>`).join('')}
<p class="note">Итоговая стоимость зависит от длины и сложности — уточню при записи.</p>
<div class="center"><button class="btn btn-gold" data-book>${booking ? 'Выбрать время' : 'Записаться'}</button></div>
</div></section>

${courses.length ? `<section id="courses" class="wrap sec">
<div class="c-head"><div style="display:flex;flex-direction:column;gap:12px"><span class="eyebrow">Для мастеров</span><h2>Обучение маникюру</h2></div>
<p>Небольшие группы и индивидуальные занятия: много практики на моделях, разбор ошибок и поддержка после курса.</p></div>
<div class="cards">${courses.map((c) => `<article class="card">${c.tag ? `<span class="eyebrow">${esc(c.tag)}</span>` : ''}<h3>${esc(c.title)}</h3>
<ul>${String(c.program || '').split('\n').filter((l) => l.trim()).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
<div class="ft"><b>${c.price ? (c.price_from ? 'от ' : '') + rub(c.price) : 'по запросу'}</b><button class="btn btn-ghost btn-sm" data-course="${esc(c.title)}">Хочу на курс</button></div></article>`).join('')}</div>
</section>` : ''}

<section id="works" class="works"><div class="wrap sec">
<div class="head-c"><span class="eyebrow">Портфолио</span><h2>Образцы работ</h2><span class="rule"></span></div>
<div class="grid">${works.length ? works.map((w) => `<figure><div class="ph"><img src="${esc(w.url)}" alt="${esc(w.caption || 'Работа мастера')}" loading="lazy"></div>${w.caption ? `<figcaption>${esc(w.caption)}</figcaption>` : ''}</figure>`).join('')
    : placeholders.map((p) => `<figure><div class="ph">${ic('img')}Фото работы</div><figcaption>${p}</figcaption></figure>`).join('')}</div>
${socials.length ? `<div class="center"><a href="${esc(s[socials[0][0]])}" class="btn btn-ghost btn-sm" style="border-color:var(--line)" target="_blank" rel="noopener">Больше работ в ${socials[0][1]}</a></div>` : ''}
</div></section>

${reviews.length ? `<section id="reviews" class="wrap sec">
<div class="head-c"><span class="eyebrow">Отзывы</span><h2>Что говорят клиентки</h2><span class="rule"></span></div>
<div class="revs">${reviews.map((v) => `<div class="rev"><div class="st">${Array.from({ length: Math.max(1, Math.min(5, +v.rating || 5)) }, () => ic('star')).join('')}</div><p>${esc(v.text)}</p><b>${esc(v.name || '')}</b></div>`).join('')}</div>
${s.review_url ? `<div class="center"><a href="${esc(s.review_url)}" class="btn btn-ghost btn-sm" target="_blank" rel="noopener">Все отзывы</a></div>` : ''}
</section>` : ''}

<section id="contact" class="wrap sec contact">
<div class="c-info">
<div style="display:flex;flex-direction:column;gap:12px"><span class="eyebrow">Запись</span><h2>Оставьте заявку</h2><p>Перезвоню, подберу удобное время и отвечу на вопросы по услугам и обучению.</p></div>
<a href="tel:${tel(phone)}" class="ci"><span class="circ">${ic('phone')}</span><span class="t"><small>Телефон</small><b class="big">${esc(phone)}</b></span></a>
${s.address ? `<div class="ci"><span class="circ">${ic('pin')}</span><span class="t"><small>Адрес</small><b>${esc(s.address)}</b></span></div>` : ''}
${s.hours_text ? `<div class="ci"><span class="circ">${ic('clock')}</span><span class="t"><small>Часы работы</small><b>${esc(s.hours_text)}</b></span></div>` : ''}
${socials.length ? `<div class="soc">${socials.map(([k, t]) => `<a href="${esc(s[k])}" target="_blank" rel="noopener">${t}</a>`).join('')}</div>` : ''}
</div>
<div class="form-card" id="leadBox">${leadForm('lf')}</div>
</section>
</main>
<footer><div class="wrap ft-logo"><img src="${esc(opts.logoFullSrc || '/img/logo-full.png')}" alt="${esc(name)} · Pro Nails School" loading="lazy"></div><div class="wrap ftr"><span><span style="font-family:var(--serif);font-size:18px;color:var(--ink)">${esc(name)}</span> · маникюр и обучение${s.city ? ' · ' + esc(s.city) : ''}</span><a href="tel:${tel(phone)}">${esc(phone)}</a></div></footer>
</div><div class="bar"><a href="tel:${tel(phone)}" class="btn btn-ghost">${ic('phone')}Позвонить</a><button class="btn btn-gold" data-book>Записаться</button></div>
<div class="ov" id="ov" role="dialog" aria-modal="true" aria-labelledby="ovT"><div class="sheet"><div class="sh-h"><button type="button" id="ovBack" aria-label="Назад" style="visibility:hidden">${ic('back')}</button><h3 id="ovT">Запись</h3><button type="button" id="ovX" aria-label="Закрыть">${ic('x')}</button></div><div id="ovB"></div></div></div>
<script>window.__SITE__=${site};window.__ICONS__=${JSON.stringify({ check: ic('check') })};
window.__LEADFORM__=${JSON.stringify(leadForm('mf'))};</script>
<script>(${siteScript.toString()})(document);</script>
</body></html>`;
  }

  function leadForm(id) {
    return `<form id="${id}" data-lead><input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<label>Ваше имя<input type="text" name="name" required autocomplete="name" placeholder="Как к вам обращаться"></label>
<label>Телефон<input type="tel" name="phone" required autocomplete="tel" inputmode="tel" placeholder="+7 (___) ___-__-__"></label>
<label>Что интересует<select name="subject"><option>Маникюр</option><option>Наращивание</option><option>Дизайн</option><option>Обучение / курс</option><option>Другое</option></select></label>
<label>Комментарий<textarea name="message" rows="3" placeholder="Удобные дни, пожелания по дизайну"></textarea></label>
<p class="err" hidden></p>
<button type="submit" class="btn btn-gold" style="margin-top:4px">Отправить заявку</button>
<p class="legal">Нажимая кнопку, вы соглашаетесь на обработку персональных данных</p></form>`;
  }

  // Скрипт страницы (выполняется в браузере посетителя)
  function siteScript(R) {
    R = R || document;
    var D = window.__SITE__, CHECK = window.__ICONS__.check;
    var demo = null; try { if (window.parent !== window && window.parent.DEMO_API) demo = window.parent.DEMO_API; } catch (e) {}
    function api(m, u, b) {
      if (demo) return demo(m, u, b);
      return fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Ошибка, попробуйте ещё раз'); return j; }); });
    }
    var $ = function (s, el) { return (el || R).querySelector(s); };
    var $$ = function (s, el) { return Array.prototype.slice.call((el || R).querySelectorAll(s)); };
    // якорные ссылки — плавная прокрутка (работает и внутри демо-версии)
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href').slice(1); if (!id || a.hasAttribute('data-login')) return;
        var t = R.getElementById(id); if (!t) return; e.preventDefault();
        window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - (id === 'top' ? 200 : 64), behavior: 'smooth' });
      });
    });
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var rub = function (n) { return Math.round(+n || 0).toLocaleString('ru-RU') + ' ₽'; };
    var DOW = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    var MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

    $$('.tab').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.tab').forEach(function (x) { x.setAttribute('aria-selected', 'false'); });
        $$('.plist').forEach(function (x) { x.classList.remove('on'); });
        b.setAttribute('aria-selected', 'true'); R.getElementById(b.dataset.t).classList.add('on');
      });
    });
    if (window.DEMO_API && R !== document) demo = window.DEMO_API;
    if (demo) $$('[data-login]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); (window.demoOpenCrm || window.parent.demoOpenCrm)(); }); });

    function bindLead(form, extra) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var fd = new FormData(form), b = {}; fd.forEach(function (v, k) { b[k] = v; });
        if (extra) for (var k in extra) b[k] = extra[k];
        b.kind = /обуч|курс/i.test(b.subject || '') ? 'course' : 'service';
        var err = $('.err', form), btn = $('button[type=submit]', form); err.hidden = true; btn.disabled = true;
        api('POST', '/api/public/lead', b).then(function () {
          form.parentNode.innerHTML = '<div class="thanks"><span class="circ">' + CHECK + '</span><h3>Спасибо за заявку!</h3><p>Я свяжусь с вами в ближайшее время.</p></div>';
        }).catch(function (x) { err.textContent = x.message; err.hidden = false; btn.disabled = false; });
      });
    }
    bindLead($('#lf'));

    // ----- окно записи -----
    var ov = $('#ov'), body = $('#ovB'), title = $('#ovT'), back = $('#ovBack');
    var st = { step: 1, ids: [], date: null, time: null, days: [] };
    function open() { ov.classList.add('on'); document.body.style.overflow = 'hidden'; }
    function close() { ov.classList.remove('on'); document.body.style.overflow = ''; }
    $('#ovX').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    back.addEventListener('click', function () { if (st.step > 1) { st.step--; draw(); } });
    function chosen() { return D.services.filter(function (x) { return st.ids.indexOf(x.id) >= 0; }); }
    function dur() { return chosen().reduce(function (s, x) { return s + (+x.duration || 0); }, 0) || 60; }
    function sum() { return chosen().reduce(function (s, x) { return s + (+x.price || 0); }, 0); }
    function steps() { return '<div class="steps">' + [1, 2, 3].map(function (i) { return '<i class="' + (i <= st.step ? 'on' : '') + '"></i>'; }).join('') + '</div>'; }
    function fmtDur(m) { var h = Math.floor(m / 60), mm = m % 60; return (h ? h + ' ч ' : '') + (mm ? mm + ' мин' : '').trim(); }
    function dlabel(ds) { var d = new Date(ds + 'T12:00'); return d.getDate() + ' ' + MON[d.getMonth()] + ', ' + DOW[d.getDay()].toLowerCase(); }

    function draw() {
      back.style.visibility = st.step > 1 ? 'visible' : 'hidden';
      if (st.step === 1) {
        title.textContent = 'Выберите услуги';
        var cats = []; D.services.forEach(function (x) { var c = x.category || 'Услуги'; if (cats.indexOf(c) < 0) cats.push(c); });
        body.innerHTML = steps() + cats.map(function (c) {
          return '<div class="cat">' + esc(c) + '</div>' + D.services.filter(function (x) { return (x.category || 'Услуги') === c; }).map(function (x) {
            return '<label class="svc"><input type="checkbox" value="' + x.id + '"' + (st.ids.indexOf(x.id) >= 0 ? ' checked' : '') + '><span class="n"><b>' + esc(x.name) + '</b><span>' + fmtDur(+x.duration || 60) + (x.note ? ' · ' + esc(x.note) : '') + '</span></span><span class="p">' + (x.price_from ? 'от ' : '') + rub(x.price) + '</span></label>';
          }).join('');
        }).join('') + '<div class="sum"><div>Итого<b id="sumV"></b></div><button class="btn btn-gold" id="next1">Далее</button></div>';
        var upd = function () {
          st.ids = $$('.svc input:checked', body).map(function (i) { return +i.value; });
          $('#sumV').textContent = st.ids.length ? rub(sum()) + ' · ' + fmtDur(dur()) : 'ничего не выбрано';
          $('#next1').disabled = !st.ids.length;
        };
        $$('.svc input', body).forEach(function (i) { i.addEventListener('change', upd); }); upd();
        $('#next1').addEventListener('click', function () { st.step = 2; st.date = null; st.time = null; draw(); });
      } else if (st.step === 2) {
        title.textContent = 'Дата и время';
        body.innerHTML = steps() + '<div class="chosen"><b>' + chosen().map(function (x) { return esc(x.name); }).join(', ') + '</b><br>' + fmtDur(dur()) + ' · ' + rub(sum()) + '</div><div class="days" id="days"><div class="empty">Загружаю свободные дни…</div></div><div id="slots"></div>' +
          '<div class="sum"><div>Время<b id="tV">не выбрано</b></div><button class="btn btn-gold" id="next2" disabled>Далее</button></div>';
        api('GET', '/api/public/days?duration=' + dur()).then(function (r) {
          st.days = r.days || [];
          var el = $('#days');
          if (!st.days.some(function (d) { return d.free; })) { el.innerHTML = '<div class="empty">Свободных окон нет — позвоните, пожалуйста, подберём время.</div>'; return; }
          el.innerHTML = st.days.map(function (d) { var x = new Date(d.date + 'T12:00'); return '<button type="button" class="day" data-d="' + d.date + '"' + (d.free ? '' : ' disabled') + '><small>' + DOW[x.getDay()] + '</small><b>' + x.getDate() + '</b><small>' + MON[x.getMonth()].slice(0, 3) + '</small></button>'; }).join('');
          $$('.day', el).forEach(function (b) { b.addEventListener('click', function () { pickDay(b.dataset.d); }); });
          var firstFree = st.days.filter(function (d) { return d.free; })[0]; if (firstFree) pickDay(st.date || firstFree.date);
        }).catch(function (e) { $('#days').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
        $('#next2').addEventListener('click', function () { st.step = 3; draw(); });
      } else if (st.step === 3) {
        title.textContent = 'Ваши контакты';
        body.innerHTML = steps() + '<div class="chosen"><b>' + dlabel(st.date) + ', ' + st.time + '</b><br>' + chosen().map(function (x) { return esc(x.name); }).join(', ') + ' · ' + rub(sum()) + '</div>' +
          '<form id="bf"><input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"><label>Ваше имя<input name="name" required autocomplete="name" placeholder="Как к вам обращаться"></label><label>Телефон<input name="phone" type="tel" required autocomplete="tel" inputmode="tel" placeholder="+7 (___) ___-__-__"></label><label>Комментарий<textarea name="comment" rows="2" placeholder="Пожелания по дизайну, длине"></textarea></label><p class="err" hidden></p><button class="btn btn-gold" type="submit">' + (D.auto ? 'Записаться' : 'Отправить запись') + '</button><p class="legal">Нажимая кнопку, вы соглашаетесь на обработку персональных данных</p></form>';
        var f = $('#bf');
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          var b = { services: st.ids, date: st.date, start: st.time, name: f.name.value, phone: f.phone.value, comment: f.comment.value, website: f.website.value };
          var err = $('.err', f), btn = $('button', f); err.hidden = true; btn.disabled = true;
          api('POST', '/api/public/book', b).then(function (r) {
            back.style.visibility = 'hidden'; title.textContent = 'Готово';
            body.innerHTML = '<div class="thanks"><span class="circ">' + CHECK + '</span><h3>' + (r.status === 'booked' ? 'Вы записаны!' : 'Запись отправлена!') + '</h3><p>' + dlabel(st.date) + ' в ' + st.time + '. ' +
              (r.status === 'booked' ? 'Жду вас!' : esc(D.first) + ' подтвердит запись в ближайшее время.') + '</p><button class="btn btn-ghost btn-sm" id="okX">Хорошо</button></div>';
            $('#okX').addEventListener('click', close); st = { step: 1, ids: [], date: null, time: null, days: [] };
          }).catch(function (x) { err.textContent = x.message; err.hidden = false; btn.disabled = false; });
        });
      }
    }
    function pickDay(ds) {
      st.date = ds; st.time = null; $('#tV').textContent = 'не выбрано'; $('#next2').disabled = true;
      $$('.day').forEach(function (b) { b.classList.toggle('on', b.dataset.d === ds); });
      var el = $('#slots'); el.innerHTML = '<div class="empty">Загружаю время…</div>';
      api('GET', '/api/public/slots?date=' + ds + '&duration=' + dur()).then(function (r) {
        if (!r.slots.length) { el.innerHTML = '<div class="empty">На этот день всё занято</div>'; return; }
        el.innerHTML = '<div class="slots">' + r.slots.map(function (t) { return '<button type="button" class="slot" data-t="' + t + '">' + t + '</button>'; }).join('') + '</div>';
        $$('.slot', el).forEach(function (b) { b.addEventListener('click', function () {
          $$('.slot', el).forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); st.time = b.dataset.t;
          $('#tV').textContent = dlabel(ds) + ', ' + st.time; $('#next2').disabled = false;
        }); });
      }).catch(function (e) { el.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
    }
    function openLead(subject) {
      back.style.visibility = 'hidden'; title.textContent = subject ? 'Запись на курс' : 'Заявка';
      body.innerHTML = window.__LEADFORM__; var f = $('#mf');
      if (subject) { f.subject.value = 'Обучение / курс'; f.message.value = 'Курс: ' + subject; }
      bindLead(f, subject ? { subject: 'Курс: ' + subject } : null); open();
    }
    $$('[data-book]').forEach(function (b) { b.addEventListener('click', function () { if (!D.booking || !D.services.length) return openLead(); st.step = 1; draw(); open(); }); });
    $$('[data-course]').forEach(function (b) { b.addEventListener('click', function () { openLead(b.dataset.course); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov.classList.contains('on')) close(); });
  }

  return { render: render, siteScript: siteScript, CSS: CSS };
});
