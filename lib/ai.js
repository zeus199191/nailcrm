'use strict';
// ИИ-тексты: GigaChat (Сбер) или YandexGPT (Яндекс). Ключи — Настройки → «ИИ-помощник».
const crypto = require('node:crypto');
const { getSetting, setSetting } = require('./db');
const { HttpError } = require('./http');

const provider = () => {
  const p = getSetting('ai_provider');
  if (p === 'yandex' && getSetting('yandex_key') && getSetting('yandex_folder')) return 'yandex';
  if (p === 'gigachat' && getSetting('gigachat_key')) return 'gigachat';
  return '';
};

let gTok = null, gExp = 0;
async function gigaToken() {
  if (gTok && Date.now() < gExp - 60000) return gTok;
  const key = String(getSetting('gigachat_key') || '').trim().replace(/^Basic\s+/i, '');
  const res = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
    method: 'POST', signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', RqUID: crypto.randomUUID(), Authorization: 'Basic ' + key },
    body: 'scope=' + (getSetting('gigachat_scope') || 'GIGACHAT_API_PERS'),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new HttpError(502, 'GigaChat не выдал доступ: ' + (j.message || j.error_description || res.status) + '. Проверьте ключ авторизации.');
  gTok = j.access_token; gExp = +j.expires_at || Date.now() + 25 * 60000; return gTok;
}
async function giga(system, user) {
  const body = JSON.stringify({ model: getSetting('gigachat_model') || 'GigaChat', temperature: 0.8, max_tokens: 1500,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }] });
  let lastErr = '';
  for (const base of ['https://gigachat.devices.sberbank.ru/api/v1', 'https://api.giga.chat/v1']) {
    try {
      const res = await fetch(base + '/chat/completions', { method: 'POST', signal: AbortSignal.timeout(90000),
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + await gigaToken() }, body });
      const j = await res.json().catch(() => ({}));
      if (res.status === 401) { gTok = null; lastErr = 'нет доступа'; continue; }
      if (!res.ok) { lastErr = j.message || 'HTTP ' + res.status; continue; }
      const t = j.choices?.[0]?.message?.content; if (t) return t;
      lastErr = 'пустой ответ';
    } catch (e) { if (e instanceof HttpError) throw e; lastErr = String(e.cause?.code || e.message); }
  }
  throw new HttpError(502, 'GigaChat: ' + lastErr);
}
async function yandex(system, user, retry = true) {
  const folder = String(getSetting('yandex_folder') || '').trim();
  const model = String(getSetting('yandex_model') || 'yandexgpt/latest').trim();
  const res = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
    method: 'POST', signal: AbortSignal.timeout(90000),
    headers: { 'Content-Type': 'application/json', Authorization: 'Api-Key ' + String(getSetting('yandex_key') || '').trim(), 'x-folder-id': folder },
    body: JSON.stringify({ modelUri: `gpt://${folder}/${model}`, completionOptions: { stream: false, temperature: 0.7, maxTokens: '1800' },
      messages: [{ role: 'system', text: system }, { role: 'user', text: user }] }),
  });
  const j = await res.json().catch(() => ({}));
  const msg = j.error?.message || j.message || '';
  const fx = /service account folder ID '([a-z0-9]+)'/i.exec(msg);
  if (!res.ok && fx && retry) { setSetting('yandex_folder', fx[1]); return yandex(system, user, false); }
  if (!res.ok) throw new HttpError(502, 'YandexGPT: ' + (msg || 'HTTP ' + res.status));
  const t = j.result?.alternatives?.[0]?.message?.text; if (!t) throw new HttpError(502, 'YandexGPT: пустой ответ');
  return t;
}
async function complete(system, user) {
  const p = provider();
  if (!p) throw new HttpError(400, 'ИИ не подключён: Настройки → «ИИ-помощник»');
  const t = p === 'yandex' ? await yandex(system, user) : await giga(system, user);
  return String(t).replace(/^\s*```[a-z]*\s*|\s*```\s*$/g, '').replace(/\*\*(.+?)\*\*/g, '$1').trim();
}

// Что умеет помощник
const PRESETS = {
  post: 'Напиши пост для соцсетей (ВКонтакте, Telegram, MAX) о работе мастера. До 800 знаков, 1–4 эмодзи, в конце строка с городом и телефоном для записи и 3–6 хэштегов.',
  improve: 'Улучши этот текст поста: сделай живее и понятнее, сохрани все факты. В конце — город, телефон для записи и 3–6 хэштегов.',
  sms: 'Напиши текст SMS-рассылки. Строго до 140 символов, без эмодзи, без ссылок, если их не дали. Можно использовать подстановку {имя} в начале. Выдай только текст SMS.',
  reply: 'Напиши вежливый, тёплый ответ клиентке в мессенджере от лица мастера. Коротко, по делу, без канцелярита.',
  ideas: 'Предложи 12 идей постов на месяц для соцсетей мастера маникюра и инструктора. Учитывай сезон и праздники. Формат: каждая идея с новой строки, вида «ДД.ММ — Заголовок — одна фраза, о чём пост». Без нумерации и вступления.',
  course: 'Напиши продающее описание курса обучения маникюру для сайта и соцсетей: для кого, что будет на курсе, результат, призыв записаться. До 900 знаков.',
  promo: 'Придумай акцию для клиенток мастера маникюра и напиши короткий текст объявления (до 500 знаков).',
  free: '',
};
function system() {
  const name = getSetting('master_name') || 'мастер';
  const city = getSetting('city') || '';
  const phone = getSetting('phone') || '';
  return `Ты помощник мастера маникюра и педикюра ${name}${city ? ` из города ${city}` : ''}. Мастер работает одна (самозанятая), делает маникюр, педикюр, наращивание, дизайн и обучает мастеров (курсы с нуля, повышение квалификации, индивидуальные мастер-классы). Стиль бренда: нежность и премиум, светлая эстетика.
Правила: пиши на русском, живым тёплым языком, без канцелярита и штампов. Используй только факты, которые тебе дали: не придумывай цены, сроки, акции, отзывы и материалы. Без markdown, без звёздочек и решёток-заголовков.${phone ? ` Телефон для записи: ${phone}.` : ''}`;
}
async function run(preset, prompt) {
  const task = PRESETS[preset] ?? '';
  const user = (task ? task + '\n\n' : '') + String(prompt || '').slice(0, 4000);
  if (!String(prompt || '').trim() && !['ideas', 'promo'].includes(preset)) throw new HttpError(400, 'Напишите, о чём текст — ИИ нужны факты');
  return complete(system(), user + (preset === 'ideas' ? `\nСегодня ${new Date().toLocaleDateString('ru-RU')}.` : ''));
}
module.exports = { provider, complete, run, PRESETS };
