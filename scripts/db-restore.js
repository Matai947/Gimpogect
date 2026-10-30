// Loads a backup made by db-backup.js into our own database through PostgREST (DB_REST_URL), table by table.
// A row already there is overwritten by the copy (same id), so running it twice is safe.
//
//   DB_REST_URL=http://127.0.0.1:3000 DB_REST_TOKEN=… node scripts/db-restore.js backup/2026-11-01-09-30
// Then, in psql: select setval(pg_get_serial_sequence('visits','id'), (select coalesce(max(id),1) from visits));
//                select setval(pg_get_serial_sequence('clicks','id'), (select coalesce(max(id),1) from clicks));
const fs = require('fs');
const path = require('path');

const REST = process.env.DB_REST_URL;
const dir = process.argv[2];
if (!REST || !dir) {
  console.error('DB_REST_URL=… node scripts/db-restore.js <backup folder>');
  process.exit(1);
}
const AUTH = process.env.DB_REST_TOKEN ? { authorization: `Bearer ${process.env.DB_REST_TOKEN}` } : {};
const KEYS = { clients: 'id', sales: 'id', visits: 'id', leads: 'id', trainer_sessions: 'id', settings: 'key', clicks: 'id' };

(async () => {
  for (const [table, key] of Object.entries(KEYS)) {
    const file = path.join(dir, `${table}.json`);
    if (!fs.existsSync(file)) continue;
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (let i = 0; i < rows.length; i += 500) {
      const r = await fetch(`${REST}/${table}?on_conflict=${key}`, { method: 'POST', headers: { ...AUTH, 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 500)) });
      if (!r.ok) throw new Error(`${table} @${i}: ${r.status} ${await r.text()}`);
    }
    const check = await fetch(`${REST}/${table}?select=${key}&limit=1`, { headers: { ...AUTH, prefer: 'count=exact' } });
    console.log(table, rows.length, '→ in the database:', (check.headers.get('content-range') || '').split('/')[1]);
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
