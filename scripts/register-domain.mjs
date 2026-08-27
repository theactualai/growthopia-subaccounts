// Register one domain and hand it to Cloudflare.
//
// Dry run by default. Nothing spends money without --confirm.
//
//   node --experimental-strip-types scripts/register-domain.mjs <domain>
//   node --experimental-strip-types scripts/register-domain.mjs <domain> --confirm

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && m[2]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const ss = await import('../src/lib/spaceship.ts');

const domain = process.argv[2];
const CONFIRM = process.argv.includes('--confirm');
if (!domain) { console.error('usage: register-domain.mjs <domain> [--confirm]'); process.exit(1); }

const REGISTRANT = {
  firstName: 'Alex',
  lastName: 'Ivanoff',
  email: process.env.CLOUDFLARE_DESTINATION_EMAIL ?? 'alex@growthopia.io',
  phone: '+1.6097310153',
  address1: '957 Atlantic Ave Apt 513',
  city: 'Brooklyn',
  stateProvince: 'NY',
  postalCode: '11238',
  country: 'US',
};

// Contact IDs are reused across every registration; cache the first one.
const CACHE = '.spaceship-contact.json';
let contactId = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')).contactId : null;

console.log(`\nDomain:   ${domain}`);
console.log(`Term:     1 year, auto-renew ON`);
console.log(`Privacy:  high (details hidden from public WHOIS)`);
console.log(`Contact:  ${contactId ? `reusing ${contactId}` : 'will create from registrant details'}`);

if (!CONFIRM) {
  console.log('\nDRY RUN. Nothing was charged. Re-run with --confirm to register.\n');
  process.exit(0);
}

if (!contactId) {
  console.log('\nCreating contact...');
  const c = await ss.saveContact(REGISTRANT);
  if (!c.ok) { console.error(`  FAILED ${c.status}: ${c.error}`); process.exit(1); }
  contactId = c.result.contactId;
  writeFileSync(CACHE, JSON.stringify({ contactId }, null, 1));
  console.log(`  contact created: ${contactId} (cached for future registrations)`);
}

console.log('\nRegistering (this charges your card)...');
const r = await ss.registerDomain(domain, { contactId, years: 1, autoRenew: true, privacy: 'high' });
if (!r.ok) { console.error(`  FAILED ${r.status}: ${r.error}`); process.exit(1); }
console.log('  registered.');

const info = await ss.getDomain(domain);
if (info.ok) {
  console.log(`\n  name:       ${info.result.name}`);
  console.log(`  expires:    ${info.result.expirationDate ?? '?'}`);
  console.log(`  nameservers: ${(info.result.nameservers?.hosts ?? []).join(', ') || '(registrar default)'}`);
}
console.log('');
