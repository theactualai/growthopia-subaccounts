// Apply SQL migrations to Supabase.
//
// Needs SUPABASE_DB_URL - the pooler connection string from
// Supabase > Project Settings > Database > Connection string > URI.
// It contains the database password, which is not the same thing as any of the
// API keys, which is why it has to be added separately.
//
// Migrations are tracked in a _migrations table so re-running is safe.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && m[2]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('\nSUPABASE_DB_URL is not set.\n');
  console.error('Supabase dashboard > Project Settings > Database > Connection string > URI');
  console.error('Copy it, replace [YOUR-PASSWORD] with the database password you saved when');
  console.error('you created the project, and add it to .env as SUPABASE_DB_URL=\n');
  process.exit(1);
}

const dir = 'supabase/migrations';
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

await client.query(`
  create table if not exists _migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`);

const { rows } = await client.query('select name from _migrations');
const done = new Set(rows.map((r) => r.name));

let applied = 0;
for (const f of files) {
  if (done.has(f)) { console.log(`  skip   ${f} (already applied)`); continue; }
  const sql = readFileSync(join(dir, f), 'utf8');
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('insert into _migrations (name) values ($1)', [f]);
    await client.query('commit');
    console.log(`  applied ${f}`);
    applied++;
  } catch (e) {
    await client.query('rollback');
    console.error(`  FAILED  ${f}\n          ${e.message}`);
    await client.end();
    process.exit(1);
  }
}

const t = await client.query(`
  select tablename from pg_tables where schemaname = 'public' order by tablename`);
console.log(`\n  ${applied} migration(s) applied. Tables now in public:`);
for (const r of t.rows) console.log(`    ${r.tablename}`);

const rls = await client.query(`
  select c.relname, c.relrowsecurity,
         (select count(*) from pg_policies p where p.tablename = c.relname) as policies
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' order by c.relname`);
console.log('\n  row level security:');
for (const r of rls.rows) {
  const note = r.relname === 'account_secrets' && Number(r.policies) === 0
    ? '  <- locked, no policy, service role only' : '';
  console.log(`    ${r.relname.padEnd(20)} rls=${r.relrowsecurity ? 'on ' : 'OFF'} policies=${r.policies}${note}`);
}
await client.end();
