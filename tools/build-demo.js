'use strict';
// Сборка демо-версии в один HTML-файл: node tools/build-demo.js → dist/demo.html
const fs = require('node:fs');
const path = require('node:path');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const hero = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(__dirname, 'hero-demo.jpg')).toString('base64');
const js = ['lib/shared.js', 'lib/landing.js', 'tools/demo-api.js', 'public/js/core.js', 'public/js/calendar.js', 'public/js/pages.js', 'public/js/training.js', 'public/js/marketing.js', 'public/js/settings.js'];
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
const shell = `
(function () {
  const site = document.getElementById('site'), root = document.getElementById('root');
  const shadow = site.attachShadow({ mode: 'open' });
  function renderSite() {
    const html = NailLanding.render(DEMO_SITE(), { crmUrl: '#/' });
    const css = NailLanding.CSS.replace(/:root\\{/g, ':host{').replace(/(^|[^a-z])body\\{/g, '$1.sitebody{');
    let body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));
    const data = /<script>(window\\.__SITE__[\\s\\S]*?)<\\/script>/.exec(body)[1];
    body = body.replace(/<script>[\\s\\S]*?<\\/script>/g, '');
    new Function(data)();
    shadow.innerHTML = '<style>' + css + '</style><div class="sitebody">' + body + '</div>';
    NailLanding.siteScript(shadow);
  }
  window.demoOpenSite = function () {
    document.querySelectorAll('.modal-bg').forEach((x) => x.remove()); document.body.style.overflow = '';
    history.replaceState(null, '', location.pathname + location.search);
    root.style.display = 'none'; site.style.display = 'block'; renderSite(); window.scrollTo(0, 0);
  };
  window.demoOpenCrm = function () {
    site.style.display = 'none'; shadow.innerHTML = ''; root.style.display = ''; document.body.style.overflow = '';
    if (!location.hash.startsWith('#/')) history.replaceState(null, '', '#/');
    window.scrollTo(0, 0); boot();
  };
  if (location.hash.startsWith('#/')) window.demoOpenCrm(); else window.demoOpenSite();
})();`;
const out = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#FBF8F4"><meta name="format-detection" content="telephone=no">
<title>Алена Макарова — сайт и CRM (демо)</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Manrope:wght@400;500;600;700&display=swap">
<style>${R('public/style.css')}
#site{display:none}</style></head>
<body><div id="site"></div><div id="root" style="display:none"></div><div class="toasts" id="toasts"></div>
<script>window.DEMO_HERO=${JSON.stringify(hero)};</script>
${js.map((f) => `<script>/* ${f} */\n${safe(R(f))}</script>`).join('\n')}
<script>${shell}</script>
</body></html>`;
fs.mkdirSync(path.join(__dirname, '..', 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'dist', 'demo.html'), out);
console.log('dist/demo.html', Math.round(out.length / 1024) + ' KB');
