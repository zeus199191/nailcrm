'use strict';
// Резервная копия базы: каждую ночь в 03:30, хранятся 30 последних. Вручную: node scripts/backup.js
const fs = require('node:fs');
const path = require('node:path');
function backup() {
  const { db, DATA_DIR } = require('../lib/db');
  const dir = path.join(DATA_DIR, 'backups'); fs.mkdirSync(dir, { recursive: true });
  const d = new Date(); const p = (n) => String(n).padStart(2, '0');
  const f = path.join(dir, `crm-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.sqlite`);
  db.exec(`VACUUM INTO '${f.replace(/'/g, "''")}'`);
  const list = fs.readdirSync(dir).filter((x) => x.endsWith('.sqlite')).sort();
  for (const x of list.slice(0, Math.max(0, list.length - 30))) fs.unlinkSync(path.join(dir, x));
  return f;
}
function schedule() {
  let last = '';
  const t = setInterval(() => {
    const d = new Date(); const key = d.toDateString();
    if (d.getHours() === 3 && d.getMinutes() >= 30 && last !== key) { last = key; try { backup(); } catch (e) { console.error('backup', e.message); } }
  }, 60000); t.unref?.();
}
if (require.main === module) console.log('Копия:', backup());
module.exports = { backup, schedule };
