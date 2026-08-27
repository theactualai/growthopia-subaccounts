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

// Which of those is not already bound to another profile.
const used = new Set(profiles.map((p) => p.proxy?.host).filter(Boolean));
const pick = inCity.find((p) => !used.has(p.proxy_address)) ?? inCity[0];

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
