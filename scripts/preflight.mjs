// Go / no-go check across every layer before anyone attempts a signup.
//
// The one thing this exists to catch: a proxy in one country paired with a phone
// number from another. That mismatch is on the SMS provider's own list of things
// that make a platform silently stop sending codes, and it cost us a full day.

import { readFileSync } from 'node:fs';
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && m[2]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const ws = await import('../src/lib/webshare.ts');
const gl = await import('../src/lib/gologin.ts');
const cf = await import('../src/lib/cloudflare.ts');
const ss = await import('../src/lib/spaceship.ts');

let blockers = 0;
const bad = (s) => { blockers++; console.log(`  BLOCK  ${s}`); };
const ok = (s) => console.log(`  ok     ${s}`);
const warn = (s) => console.log(`  warn   ${s}`);

console.log('\nPROXIES');
let proxies = [];
let reps = [];
try {
  const p = await ws.listProxies();
  proxies = p.results;
  const byCountry = {};
  for (const x of proxies) byCountry[x.country_code] = (byCountry[x.country_code] ?? 0) + 1;
  console.log(`  ${p.count} proxies: ${Object.entries(byCountry).map(([c, n]) => `${c}×${n}`).join(', ')}`);
  const nonUs = proxies.filter((x) => x.country_code !== 'US');
  if (nonUs.length) bad(`${nonUs.length} proxy/proxies not in the US: ${[...new Set(nonUs.map(x=>x.country_code + ' ' + (x.city_name??'')))].join(', ')}`);
  else ok('all proxies are US');
  const dead = proxies.filter((x) => !x.valid);
  if (dead.length) warn(`${dead.length} proxy/proxies reported invalid`);
  const us = proxies.filter((x) => x.country_code === 'US');
  console.log(`  checking reputation of ${us.length} IPs (paced, takes ~${Math.ceil(us.length * 1.4)}s)...`);
  reps = await ws.reputations(us.map((x) => x.proxy_address));
  const cleanIps = reps.filter((r) => r.clean).length;
  if (!cleanIps) bad('every proxy is flagged as proxy or hosting by public databases');
  else ok(`${cleanIps} of ${us.length} proxies are unflagged`);
  for (const x of us) {
    const rep = reps.find((r) => r.ip === x.proxy_address);
    const codes = ws.areaCodesFor(x.city_name);
    const mark = rep?.lookupFailed ? 'lookup failed' : rep?.clean ? 'clean' : 'FLAGGED';
    console.log(`         ${x.proxy_address.padEnd(16)} ${(x.city_name ?? '?').padEnd(12)} ${mark.padEnd(13)} area code ${codes ? codes.join('/') : '(city not mapped)'}`);
  }
} catch (e) { bad(`Webshare: ${e.message}`); }

console.log('\nBROWSER PROFILES');
try {
  const r = await gl.listProfiles();
  const list = r.profiles ?? [];
  console.log(`  ${r.allProfilesCount ?? list.length} profile(s)`);
  if (!list.length) warn('no profiles yet');
  // A profile on GoLogin's own geolocation proxy is a different mechanism and
  // not part of this pipeline - report it, don't block on it.
  const GL_OWN = /gologin|floppydata/i;
  for (const p of list.slice(0, 20)) {
    const px = p.proxy;
    const mode = px?.mode ?? 'none';
    const host = px?.host ? `${px.host}:${px.port}` : '(none)';
    const match = proxies.find((x) => x.proxy_address === px?.host);
    const gologinOwn = px?.host && GL_OWN.test(px.host);
    const where = match ? `${match.country_code} ${match.city_name ?? ''}`
      : gologinOwn ? "GoLogin's own proxy, not Webshare"
      : 'NOT in your Webshare list';
    console.log(`         ${p.name.padEnd(24)} ${mode.padEnd(12)} ${host.padEnd(30)} ${where}`);

    if (mode === 'none' || !px?.host) { warn(`"${p.name}" has no proxy attached`); continue; }
    if (gologinOwn) { warn(`"${p.name}" uses GoLogin's built-in proxy - fine, but outside this pipeline`); continue; }
    if (!match) {
      // The dangerous case: bound to an IP you no longer own. Replacing proxies
      // on Webshare does not update the profiles pointing at the old ones.
      bad(`"${p.name}" points at ${px.host}, which is NOT in your Webshare list. Stale after a proxy replacement - rebind it or the signup runs on an IP you do not control.`);
      continue;
    }
    if (match.country_code !== 'US') { bad(`"${p.name}" is on a ${match.country_code} IP`); continue; }
    const rep = reps.find((r) => r.ip === match.proxy_address);
    if (rep && !rep.clean) bad(`"${p.name}" is on ${match.proxy_address}, which public databases flag as ${rep.flaggedProxy ? 'a proxy' : 'hosting'}. Rebind to a clean IP.`);
    else ok(`"${p.name}" -> ${match.city_name}, US, unflagged`);
  }
} catch (e) { bad(`GoLogin: ${e.message}`); }

console.log('\nDOMAINS AND EMAIL');
try {
  const d = await ss.listDomains();
  const items = d.ok ? (d.result.items ?? []) : [];
  if (!items.length) warn('no domains on the Spaceship account');
  for (const dom of items) {
    const name = dom.name ?? dom.unicodeName;
    const z = await cf.findZone(name);
    if (!z.ok || !z.result) { bad(`${name}: no Cloudflare zone`); continue; }
    const zone = z.result;
    const st = await cf.emailRoutingStatus(zone.id);
    const rules = await cf.listRules(zone.id);
    const catchAll = rules.ok ? rules.result.find((r) => r.matchers?.[0]?.type === 'all') : null;
    const dest = catchAll?.actions?.[0]?.value?.[0];
    if (zone.status !== 'active') bad(`${name}: zone ${zone.status}`);
    else if (!st.ok || !st.result.enabled) bad(`${name}: email routing not enabled`);
    else if (!catchAll?.enabled) bad(`${name}: no catch-all rule`);
    else ok(`${name}: active, catch-all -> ${dest}`);
  }
} catch (e) { bad(`Spaceship/Cloudflare: ${e.message}`); }

console.log('\n' + '='.repeat(58));
console.log(blockers === 0
  ? '  GO. Every layer lines up.\n'
  : `  NO-GO. ${blockers} blocker(s) above. Fix before spending an attempt.\n`);
