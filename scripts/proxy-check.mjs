// Proxy reachability and reputation check.
//
// Answers three questions when a signup page will not load:
//   1. Is it the proxy or the browser?  (this hits the host directly, no GoLogin)
//   2. Is it the protocol?              (tries socks5h and http on the same IP)
//   3. Is the IP already burned?        (asks whether it is flagged as proxy/hosting)
//
// socks5h vs socks5 matters: the h resolves DNS through the proxy. Plain socks5
// resolves locally, which leaks your real DNS and breaks hosts that geo-route,
// and Microsoft geo-routes heavily. If socks5h works and socks5 does not, that
// is your answer.
//
// Usage:
//   node scripts/proxy-check.mjs                        # reads .env
//   node scripts/proxy-check.mjs host port user pass

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';

const run = promisify(execFile);

const HOSTS = [
  ['Microsoft login',  'https://login.live.com/'],
  ['Outlook signup',   'https://signup.live.com/'],
  ['Yahoo login',      'https://login.yahoo.com/'],
  ['Google accounts',  'https://accounts.google.com/'],
  ['Instagram',        'https://www.instagram.com/'],
  ['TikTok',           'https://www.tiktok.com/'],
];

function envProxy() {
  if (!existsSync('.env')) return {};
  const out = {};
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const [aHost, aPort, aUser, aPass] = process.argv.slice(2);
const e = envProxy();
const host = aHost ?? e.PROXY_HOST;
const port = aPort ?? e.PROXY_PORT;
const user = aUser ?? e.PROXY_USER;
const pass = aPass ?? e.PROXY_PASS;

if (!host || !port) {
  console.error('Need proxy details. Put PROXY_HOST / PROXY_PORT / PROXY_USER / PROXY_PASS in .env,');
  console.error('or pass them: node scripts/proxy-check.mjs <host> <port> <user> <pass>');
  process.exit(1);
}

const auth = user ? `${user}:${pass}@` : '';
const PROTOCOLS = [
  ['socks5h', `socks5h://${auth}${host}:${port}`],
  ['http',    `http://${auth}${host}:${port}`],
];

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';

async function curl(proxy, url, extra = []) {
  try {
    const { stdout } = await run('curl', [
      '-s', '-o', '/dev/null', '--max-time', '20',
      '-w', '%{http_code} %{time_total}',
      '--proxy', proxy, '-A', UA, ...extra, url,
    ]);
    const [code, time] = stdout.trim().split(' ');
    return { code, time: `${Math.round(parseFloat(time) * 1000)}ms` };
  } catch (err) {
    const m = String(err.stderr || err.message).match(/curl: \(\d+\)[^\n]*/);
    return { code: 'FAIL', time: '-', error: m ? m[0] : 'connection failed' };
  }
}

async function egressIp(proxy) {
  try {
    const { stdout } = await run('curl', ['-s', '--max-time', '15', '--proxy', proxy, 'https://api.ipify.org']);
    return stdout.trim();
  } catch { return null; }
}

async function reputation(ip) {
  try {
    const { stdout } = await run('curl', ['-s', '--max-time', '15',
      `http://ip-api.com/json/${ip}?fields=status,country,city,isp,as,proxy,hosting`]);
    return JSON.parse(stdout);
  } catch { return null; }
}

console.log(`\nProxy ${host}:${port}${user ? ` (user ${user})` : ''}\n${'='.repeat(64)}`);

for (const [name, proxy] of PROTOCOLS) {
  console.log(`\n--- ${name} ---`);
  const ip = await egressIp(proxy);
  if (!ip) { console.log('  cannot reach the proxy at all on this protocol'); continue; }

  const rep = await reputation(ip);
  console.log(`  egress IP : ${ip}`);
  if (rep && rep.status === 'success') {
    console.log(`  location  : ${rep.city}, ${rep.country}`);
    console.log(`  network   : ${rep.isp} (${rep.as})`);
    const flags = [rep.proxy && 'FLAGGED AS PROXY', rep.hosting && 'FLAGGED AS HOSTING/DATACENTER'].filter(Boolean);
    console.log(`  flags     : ${flags.length ? flags.join(', ') : 'none - looks residential'}`);
    if (flags.length) console.log('              ^ if a public database sees this, so does Microsoft');
  }

  console.log('');
  for (const [label, url] of HOSTS) {
    const r = await curl(proxy, url);
    const verdict =
      r.code === 'FAIL' ? `blocked or unreachable (${r.error})`
      : r.code.startsWith('2') ? 'ok'
      : r.code.startsWith('3') ? 'redirect (usually fine)'
      : r.code === '403' ? 'refused - IP reputation'
      : r.code === '429' ? 'rate limited'
      : `unexpected ${r.code}`;
    console.log(`  ${label.padEnd(18)} ${String(r.code).padEnd(6)} ${r.time.padStart(7)}  ${verdict}`);
  }
}

console.log(`\n${'='.repeat(64)}`);
console.log('Reading this:');
console.log('  Everything fails on both protocols  -> proxy creds or the proxy is down.');
console.log('  socks5h works, http does not        -> switch GoLogin to SOCKS5, or the reverse.');
console.log('  Most hosts fine, Microsoft blocked  -> that IP is burned for Microsoft. Ask');
console.log('                                         Webshare to replace it, or move that');
console.log('                                         signup to a different identity.');
console.log('  Flagged as proxy/hosting            -> shared static residential is not clean.');
console.log('                                         Replacement IPs from the same pool may');
console.log('                                         behave the same way.\n');
