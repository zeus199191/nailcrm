'use strict';
// Вход: один пользователь (мастер). Пароли — scrypt, сессия 90 дней с продлением.
const crypto = require('node:crypto');
const { get, run } = require('./db');
const { HttpError } = require('./http');

const SESSION_DAYS = 90;
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${crypto.scryptSync(String(pw), salt, 64).toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [alg, saltHex, hashHex] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const hash = crypto.scryptSync(String(pw), Buffer.from(saltHex, 'hex'), 64);
  const exp = Buffer.from(hashHex, 'hex');
  return exp.length === hash.length && crypto.timingSafeEqual(hash, exp);
}
function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  run('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)', token, userId, Date.now() + SESSION_DAYS * 864e5);
  run('DELETE FROM sessions WHERE expires_at < ?', Date.now());
  return token;
}
function userFromToken(token) {
  if (!token) return null;
  const u = get('SELECT u.id,u.login,u.name,u.active,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?', token, Date.now());
  if (!u || !u.active) return null;
  if (u.expires_at - Date.now() < (SESSION_DAYS - 1) * 864e5) { run('UPDATE sessions SET expires_at=? WHERE token=?', Date.now() + SESSION_DAYS * 864e5, token); u.renewed = true; }
  delete u.expires_at;
  return u;
}
const attempts = new Map();
function checkRate(key) {
  const now = Date.now();
  const a = attempts.get(key) || { n: 0, t: now };
  if (now - a.t > 15 * 60e3) { a.n = 0; a.t = now; }
  a.n++; attempts.set(key, a);
  if (a.n > 10) throw new HttpError(429, 'Слишком много попыток входа. Подождите 15 минут.');
}
module.exports = { SESSION_DAYS, hashPassword, verifyPassword, createSession, userFromToken, checkRate };
