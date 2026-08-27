// CLI wrapper around the same check the dashboard runs.
import { readFileSync } from 'node:fs';
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && m[2]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const { runPreflight } = await import('../src/lib/preflight.ts');
const pf = await runPreflight();

console.log('\nPROXIES');
for (const p of pf.proxies) {
  console.log(`  ${`${p.address}:${p.port}`.padEnd(22)} ${(p.city ?? '?').padEnd(12)} ${(p.flagged ? 'FLAGGED' : 'clean').padEnd(9)} ${p.boundTo ? '-> ' + p.boundTo : ''}`);
}
console.log('\nPROFILES');
for (const p of pf.profiles) console.log(`  ${p.name.padEnd(24)} ${p.protocol.padEnd(12)} ${(p.host ?? '-').padEnd(24)} ${p.where}`);
console.log('\nDOMAINS');
for (const d of pf.domains) console.log(`  ${d.domain.padEnd(24)} ${d.zone.padEnd(10)} ${d.routing.padEnd(10)} ${d.catchAll ?? 'no catch-all'}`);
console.log('\n' + '='.repeat(60));
for (const f of pf.findings) console.log(`  ${f.severity.toUpperCase().padEnd(6)} ${f.area}: ${f.message}`);
console.log(pf.verdict === 'go' ? '\n  GO. Every layer lines up.\n' : `\n  NO-GO. Fix the blockers above.\n`);
