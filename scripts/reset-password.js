'use strict';
// Сброс пароля: node scripts/reset-password.js admin НовыйПароль
const { run, get } = require('../lib/db');
const { hashPassword } = require('../lib/auth');
const [login, pw] = process.argv.slice(2);
if (!login || !pw || pw.length < 6) { console.log('Использование: node scripts/reset-password.js admin НовыйПароль (от 6 символов)'); process.exit(1); }
if (!get('SELECT 1 FROM users WHERE login=?', login)) { console.log('Нет пользователя', login); process.exit(1); }
run('UPDATE users SET pass_hash=? WHERE login=?', hashPassword(pw), login);
run('DELETE FROM sessions');
console.log('Пароль изменён');
