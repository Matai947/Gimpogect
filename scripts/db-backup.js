// Full copy of the database as JSON files, one per table, in backup/<date>/ (this folder is never committed: it holds clients' data).
// Works against Supabase (SUPABASE_URL + SUPABASE_SECRET_KEY) or our own PostgREST (DB_REST_URL).
//
//   SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/db-backup.js
const fs = require('fs');
const path = require('path');

const REST = process.env.DB_REST_URL || `${process.env.SUPABASE_URL}/rest/v1`;
const KEY = process.env.SUPABASE_SECRET_KEY;
const TABLES = { clients: 'id', sales: 'id', visits: 'id', leads: 'id', trainer_sessions: 'id', settings: 'key', clicks: 'id' };

async function all(table, order) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${REST}/${table}?select=*&order=${order}&limit=1000&offset=${from}`, { headers: { ...(KEY ? { apikey: KEY } : {}), ...(process.env.DB_REST_TOKEN ? { authorization: `Bearer ${process.env.DB_REST_TOKEN}` } : {}) } });
    if (r.status === 404) return null; // the table does not exist there
    if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
    const page = await r.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

(async () => {
  const stamp = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const dir = path.join(__dirname, '..', 'backup', stamp);
  fs.mkdirSync(dir, { recursive: true });
  const counts = {};
  for (const [table, key] of Object.entries(TABLES)) {
    const rows = await all(table, key);
    if (!rows) continue;
    fs.writeFileSync(path.join(dir, `${table}.json`), JSON.stringify(rows));
    counts[table] = rows.length;
  }
  fs.writeFileSync(path.join(dir, 'counts.json'), JSON.stringify({ at: new Date().toISOString(), counts }, null, 2));
  console.log(dir);
  console.log(counts);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
