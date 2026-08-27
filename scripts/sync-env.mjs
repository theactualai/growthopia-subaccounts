// Push everything in .env up to Vercel.
//
// You fill in one local file; this mirrors it to Production, Preview and
// Development on the Vercel project. Blank values are skipped, so you can run it
// repeatedly as you fill things in and it only syncs what is actually set.
//
// PROXY_* stays local - it is for scripts/proxy-check.mjs and the deployed app
// has no use for it.
//
// Usage:
//   node scripts/sync-env.mjs --dry-run    show what would sync, no changes
//   node scripts/sync-env.mjs              sync it

import { readFileSync, existsSync } from 'node:fs';

const DRY = process.argv.includes('--dry-run');
const PROJECT = 'growthopia-subaccounts';
const SKIP = [/^PROXY_/, /^VERCEL_TOKEN$/, /^VERCEL_TEAM/];
const TARGETS = ['production', 'preview', 'development'];

if (!existsSync('.env')) {
  console.error('No .env file. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const env = {};
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && m[2]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const token = env.VERCEL_TOKEN;
if (!token) {
  console.error('VERCEL_TOKEN is not set in .env.');
  console.error('Create one at https://vercel.com/account/tokens and add it as VERCEL_TOKEN=...');
  process.exit(1);
}
const team = env.VERCEL_TEAM_SLUG ?? 'growthopia';

const toSync = Object.entries(env).filter(([k]) => !SKIP.some((re) => re.test(k)));
if (!toSync.length) {
  console.log('Nothing to sync - every variable is still blank.');
  process.exit(0);
}

// Anything not NEXT_PUBLIC_ is a secret, so mark it sensitive: Vercel then
// refuses to display it again in the dashboard or the API.
const body = toSync.map(([key, value]) => ({
  key,
  value,
  type: key.startsWith('NEXT_PUBLIC_') ? 'encrypted' : 'sensitive',
  target: TARGETS,
}));

console.log(`\nSyncing ${body.length} variable(s) to ${PROJECT} (${TARGETS.join(', ')}):\n`);
for (const v of body) {
  const shown = v.type === 'sensitive' ? `${v.value.slice(0, 4)}${'*'.repeat(8)}` : v.value.slice(0, 40);
  console.log(`  ${v.key.padEnd(38)} ${v.type.padEnd(10)} ${shown}`);
}

if (DRY) {
  console.log('\nDry run, nothing sent.\n');
  process.exit(0);
}

const url = `https://api.vercel.com/v10/projects/${PROJECT}/env?upsert=true&slug=${team}`;
const res = await fetch(url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const out = await res.json();

if (!res.ok) {
  console.error(`\nFailed (${res.status}): ${out.error?.message ?? JSON.stringify(out).slice(0, 300)}`);
  if (res.status === 403) console.error('Check the token has access to the growthopia team.');
  process.exit(1);
}

const created = Array.isArray(out.created) ? out.created.length : out.created ? 1 : 0;
console.log(`\nSynced ${created}. ${out.failed?.length ? `${out.failed.length} failed:` : 'No failures.'}`);
for (const f of out.failed ?? []) console.error(`  ${f.error.key ?? ''}: ${f.error.message}`);
console.log('\nRedeploy for these to take effect: Vercel > Deployments > ... > Redeploy.\n');
