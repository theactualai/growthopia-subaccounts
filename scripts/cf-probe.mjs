// Find out exactly what the Cloudflare token can do, before we spend money on a
// domain and discover a permission is missing halfway through provisioning.
import { readFileSync } from 'node:fs';
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && m[2]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const cf = await import('../src/lib/cloudflare.ts');

const show = (label, r) =>
  console.log(`  ${r.ok ? 'OK   ' : 'FAIL '} ${label.padEnd(34)} ${r.ok ? '' : r.errors}`);

console.log('\nToken');
show('verify', await cf.verifyToken());

console.log('\nDestination addresses (account scope)');
const list = await cf.listDestinations();
show('list', list);
if (list.ok) {
  const want = process.env.CLOUDFLARE_DESTINATION_EMAIL;
  const found = list.result.find((d) => d.email === want);
  if (found) {
    console.log(`       ${want}: ${found.verified ? 'VERIFIED' : 'pending - click the link Cloudflare emailed'}`);
  } else {
    console.log(`       ${want} not registered yet, adding it...`);
    const add = await cf.addDestination(want);
    show('add destination', add);
    if (add.ok) console.log(`       check ${want} for a verification link from Cloudflare`);
  }
}

console.log('\nZones');
const zones = await cf.findZone('example-does-not-exist-12345.com');
show('list/search zones', zones);
