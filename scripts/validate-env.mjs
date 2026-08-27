// Prove each credential works before anything is built on top of it.
// Never prints a secret - only whether it authenticates and what it can see.

import { readFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && m[2]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const ok = (s) => `  OK    ${s}`;
const bad = (s) => `  FAIL  ${s}`;
const skip = (s) => `  --    ${s}`;

async function j(url, opts) {
  const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(20000) });
  let body; try { body = await r.json(); } catch { body = {}; }
  return { status: r.status, body };
}

console.log('\nCLOUDFLARE');
if (!env.CLOUDFLARE_API_TOKEN) console.log(skip('no token'));
else {
  const v = await j('https://api.cloudflare.com/client/v4/user/tokens/verify',
    { headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` } });
  console.log(v.body?.success ? ok(`token active (${v.body.result.status})`) : bad(JSON.stringify(v.body.errors ?? v.status)));
  if (v.body?.success) {
    const a = await j('https://api.cloudflare.com/client/v4/accounts',
      { headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` } });
    if (a.body?.success && a.body.result.length) {
      for (const acct of a.body.result) console.log(ok(`account: ${acct.name}  id=${acct.id}`));
    } else console.log(bad(`cannot list accounts: ${JSON.stringify(a.body.errors ?? a.status)}`));

    const z = await j('https://api.cloudflare.com/client/v4/zones?per_page=5',
      { headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` } });
    console.log(z.body?.success
      ? ok(`zones visible: ${z.body.result.length}${z.body.result.length ? ' (' + z.body.result.map(x=>x.name).join(', ') + ')' : ''}`)
      : bad(`cannot list zones: ${JSON.stringify(z.body.errors ?? z.status)}`));
  }
}

console.log('\nSPACESHIP');
if (!env.SPACESHIP_API_KEY) console.log(skip('no key'));
else {
  const r = await j('https://spaceship.dev/api/v1/domains?take=5&skip=0',
    { headers: { 'X-Api-Key': env.SPACESHIP_API_KEY, 'X-Api-Secret': env.SPACESHIP_API_SECRET } });
  if (r.status === 200) {
    const items = r.body.items ?? r.body.data ?? [];
    console.log(ok(`authenticated, ${r.body.total ?? items.length} domain(s) on the account`));
    for (const d of items.slice(0, 5)) console.log(`        ${d.name ?? d.unicodeName ?? JSON.stringify(d).slice(0,60)}`);
  } else console.log(bad(`${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`));
}

console.log('\nSUPABASE');
if (!env.NEXT_PUBLIC_SUPABASE_URL) console.log(skip('no url'));
else {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` },
    signal: AbortSignal.timeout(20000),
  });
  console.log(r.ok ? ok(`project reachable, secret key accepted (${r.status})`) : bad(`${r.status} ${await r.text().then(t=>t.slice(0,150))}`));
}

console.log('\nVERCEL');
if (!env.VERCEL_TOKEN) console.log(skip('VERCEL_TOKEN not set - cannot sync env vars for you'));
else {
  // Project-scoped tokens (vcp_ prefix) cannot read /v2/user or /v2/teams -
  // only the project they are scoped to. Check what we actually need instead.
  const u = await j('https://api.vercel.com/v9/projects?limit=5', { headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}` } });
  console.log(u.status === 200
    ? ok(`can reach project(s): ${u.body.projects.map((p) => p.name).join(', ')}`)
    : bad(`${u.status}: ${u.body.error?.message ?? ''}`));
}

console.log('\nANTHROPIC');
console.log(env.ANTHROPIC_API_KEY ? ok('key present') : skip('blank - handle finder falls back to rule-based ideas on Vercel'));
console.log('');
