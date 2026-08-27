// Point a GoLogin profile at one of your current Webshare proxies.
//
// Run this after any Webshare replacement. Profiles keep the old host string,
// so a replaced proxy leaves every profile silently pointing at an IP you no
// longer own - which looks identical to working until a platform disagrees.
//
//   node --experimental-strip-types scripts/bind-proxy.mjs "<profile name>" [city]

import { readFileSync } from 'node:fs';
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && m[2]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const ws = await import('../src/lib/webshare.ts');
const gl = await import('../src/lib/gologin.ts');

const wantName = process.argv[2];
const wantCity = process.argv[3] ?? 'New York';
if (!wantName) { console.error('usage: bind-proxy.mjs "<profile name>" [city]'); process.exit(1); }

const { profiles } = await gl.listProfiles();
const profile = profiles.find((p) => p.name === wantName);
if (!profile) { console.error(`no profile named "${wantName}"`); process.exit(1); }

const { results } = await ws.listProxies();
const inCity = results.filter((p) => p.country_code === 'US' && p.city_name === wantCity && p.valid);
if (!inCity.length) { console.error(`no valid US proxy in ${wantCity}`); process.exit(1); }

// Reputation first, then availability. A flagged IP in the right city is worse
// than a clean one in the next city over.
console.log(`  checking reputation of ${inCity.length} ${wantCity} proxies...`);
const reps = await ws.reputations(inCity.map((p) => p.proxy_address));
const used = new Set(profiles.map((p) => p.proxy?.host).filter(Boolean));
const clean = inCity.filter((p) => reps.find((r) => r.ip === p.proxy_address)?.clean);
const flagged = inCity.length - clean.length;
if (flagged) console.log(`  ${flagged} of ${inCity.length} flagged by public databases, skipping those`);

const pool = clean.length ? clean : [];
if (!pool.length) {
  console.error(`\n  NO CLEAN PROXY in ${wantCity}. Every one is flagged as proxy or hosting.`);
  console.error(`  Replace them on Webshare, or pass --allow-flagged to bind anyway.\n`);
  if (!process.argv.includes('--allow-flagged')) process.exit(1);
}
const candidates = pool.length ? pool : inCity;
const pick = candidates.find((p) => !used.has(p.proxy_address)) ?? candidates[0];

// HTTP, not SOCKS5: measured 2026-08-26, Microsoft 502s over SOCKS5 on the same IP.
await gl.setProxy(profile.id, {
  mode: 'http',
  host: pick.proxy_address,
  port: pick.port,
  username: pick.username,
  password: pick.password,
});

console.log(`\n  ${profile.name}  ->  ${pick.proxy_address}:${pick.port}  (${pick.city_name}, ${pick.country_code}, http)`);
const codes = ws.areaCodesFor(pick.city_name);
if (codes) console.log(`  request a TextVerified number with area code ${codes.join(' / ')}\n`);
