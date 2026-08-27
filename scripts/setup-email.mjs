// Take a registered domain the rest of the way: Cloudflare zone, nameservers,
// email routing, catch-all. Safe to re-run - every step checks current state first.
//
//   node --experimental-strip-types scripts/setup-email.mjs <domain>

import { readFileSync } from 'node:fs';
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && m[2]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const cf = await import('../src/lib/cloudflare.ts');
const ss = await import('../src/lib/spaceship.ts');

const domain = process.argv[2];
if (!domain) { console.error('usage: setup-email.mjs <domain>'); process.exit(1); }
const dest = process.env.CLOUDFLARE_DESTINATION_EMAIL;

console.log(`\n${domain}  ->  ${dest}\n${'='.repeat(52)}`);

// 1. zone
let zone = (await cf.findZone(domain)).ok ? (await cf.findZone(domain)).result : null;
if (!zone) {
  const c = await cf.createZone(domain);
  if (!c.ok) { console.error(`zone create FAILED ${c.status}: ${c.errors}`); process.exit(1); }
  zone = c.result;
  console.log(`1. zone created`);
} else console.log(`1. zone already exists`);
console.log(`   id ${zone.id}  status ${zone.status}`);
console.log(`   nameservers: ${zone.name_servers.join(', ')}`);

// 2. nameservers at the registrar
const info = await ss.getDomain(domain);
const current = info.ok ? (info.result.nameservers?.hosts ?? []) : [];
const wanted = zone.name_servers;
if (wanted.every((h) => current.includes(h))) {
  console.log(`2. nameservers already pointed at Cloudflare`);
} else {
  // A just-registered domain is not immediately visible to the nameserver
  // endpoint, which reports a misleading "Domain transfer not found". Retry.
  let n = await ss.setNameservers(domain, wanted);
  for (let i = 0; !n.ok && i < 5; i++) {
    console.log(`2. not ready yet (${n.error}) - retrying in 20s`);
    await new Promise((r) => setTimeout(r, 20000));
    n = await ss.setNameservers(domain, wanted);
  }
  console.log(n.ok ? `2. nameservers set at Spaceship` : `2. FAILED: ${n.error}`);
  if (!n.ok) process.exit(1);
}

// 3. wait for delegation
if (zone.status !== 'active') {
  console.log(`3. waiting for delegation (checks every 30s, up to 10 min)...`);
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 30000));
    const s = await cf.zoneStatus(domain);
    process.stdout.write(`   ${(i + 1) * 30}s: ${s}\n`);
    if (s === 'active') { zone.status = 'active'; break; }
  }
} else console.log(`3. zone already active`);

if (zone.status !== 'active') {
  console.log(`\n   Still pending. DNS delegation can take longer - re-run this script later.`);
  console.log(`   Everything before this point is done and does not need repeating.\n`);
  process.exit(0);
}

// 4. email routing MX records
const en = await cf.enableEmailRouting(zone.id);
console.log(en.ok ? `4. email routing enabled, MX records written` : `4. ${en.errors}`);

// 5. catch-all
const ca = await cf.setCatchAll(zone.id, dest);
console.log(ca.ok ? `5. catch-all -> ${dest}` : `5. FAILED: ${ca.errors}`);

console.log(`\nTest it: send an email to anything@${domain} and watch ${dest}\n`);
