// Go / no-go across every layer, as structured data.
//
// The script and the dashboard both call this, so a junior operator sees the
// same verdict the CLI gives, and neither can drift from the other.
//
// It exists to catch two failures that look identical to working:
//   - a proxy in one country paired with a phone number from another
//   - a browser profile bound to an IP that was replaced out from under it

// Explicit .ts extensions so this resolves identically under Next's bundler and
// under plain `node --experimental-strip-types`, which the CLI wrapper uses.
// Without them the dashboard builds fine and the script dies at import.
import * as ws from './webshare.ts';
import * as gl from './gologin.ts';
import * as cf from './cloudflare.ts';
import * as ss from './spaceship.ts';

export type Severity = 'block' | 'warn' | 'ok';
export type Finding = { severity: Severity; area: string; message: string };

export type ProxyRow = {
  address: string; port: number; city: string | null; country: string;
  flagged: boolean | null; areaCodes: string[] | null; boundTo: string | null;
};
export type ProfileRow = { name: string; protocol: string; host: string | null; where: string; ok: boolean };
export type DomainRow = { domain: string; zone: string; routing: string; catchAll: string | null };

export type Preflight = {
  findings: Finding[];
  proxies: ProxyRow[];
  profiles: ProfileRow[];
  domains: DomainRow[];
  verdict: 'go' | 'no-go';
  checkedAt: string;
};

const GL_OWN = /gologin|floppydata/i;

export async function runPreflight(): Promise<Preflight> {
  const findings: Finding[] = [];
  const add = (severity: Severity, area: string, message: string) =>
    findings.push({ severity, area, message });

  let proxyList: ws.WsProxy[] = [];
  let reps: ws.IpReputation[] = [];
  const proxies: ProxyRow[] = [];
  const profiles: ProfileRow[] = [];
  const domains: DomainRow[] = [];

  // --- proxies -------------------------------------------------------------
  try {
    proxyList = (await ws.listProxies()).results;
    const nonUs = proxyList.filter((p) => p.country_code !== 'US');
    if (nonUs.length) {
      add('block', 'Proxies',
        `${nonUs.length} proxy/proxies are outside the US (${[...new Set(nonUs.map((p) => p.country_code))].join(', ')}). A foreign IP with a US phone number is the mismatch that stops platforms sending codes.`);
    }
    reps = await ws.reputations(proxyList.map((p) => p.proxy_address));
    const clean = reps.filter((r) => r.clean).length;
    if (!clean) add('block', 'Proxies', 'Every proxy is flagged as a proxy or hosting by public databases.');
    else if (clean < proxyList.length) {
      add('warn', 'Proxies', `${proxyList.length - clean} of ${proxyList.length} proxies are publicly flagged. Use only the unflagged ones for account creation.`);
    }
  } catch (e) {
    add('block', 'Proxies', `Webshare unreachable: ${e instanceof Error ? e.message : 'unknown error'}`);
  }

  // --- browser profiles ----------------------------------------------------
  let profileList: gl.GlProfile[] = [];
  try {
    profileList = (await gl.listProfiles()).profiles ?? [];
    for (const p of profileList) {
      const host = p.proxy?.host ?? null;
      const match = proxyList.find((x) => x.proxy_address === host);
      const own = host && GL_OWN.test(host);
      let where: string;
      let ok = false;

      if (!host) { where = 'no proxy attached'; add('warn', 'Profiles', `"${p.name}" has no proxy attached.`); }
      else if (own) { where = "GoLogin's own proxy"; }
      else if (!match) {
        where = 'NOT in your Webshare list';
        add('block', 'Profiles',
          `"${p.name}" points at ${host}, which is not one of your current proxies. Replacing a proxy leaves the profile pointing at an IP you no longer own, and it looks completely normal until a platform disagrees.`);
      } else if (match.country_code !== 'US') {
        where = `${match.country_code} ${match.city_name ?? ''}`;
        add('block', 'Profiles', `"${p.name}" is on a ${match.country_code} IP.`);
      } else {
        const rep = reps.find((r) => r.ip === match.proxy_address);
        where = `${match.city_name}, US`;
        if (rep && !rep.clean) {
          add('block', 'Profiles', `"${p.name}" is on ${match.proxy_address}, which public databases flag. Rebind it to a clean IP.`);
        } else { ok = true; }
      }
      profiles.push({ name: p.name, protocol: p.proxy?.mode ?? 'none', host, where, ok });
    }
  } catch (e) {
    add('block', 'Profiles', `GoLogin unreachable: ${e instanceof Error ? e.message : 'unknown error'}`);
  }

  for (const p of proxyList) {
    const rep = reps.find((r) => r.ip === p.proxy_address);
    const bound = profileList.find((x) => x.proxy?.host === p.proxy_address);
    proxies.push({
      address: p.proxy_address, port: p.port, city: p.city_name, country: p.country_code,
      flagged: rep ? !rep.clean : null,
      areaCodes: ws.areaCodesFor(p.city_name),
      boundTo: bound?.name ?? null,
    });
  }

  // --- domains and email ---------------------------------------------------
  try {
    const d = await ss.listDomains();
    for (const dom of d.ok ? (d.result.items ?? []) : []) {
      const name = dom.name ?? dom.unicodeName;
      const z = await cf.findZone(name);
      if (!z.ok || !z.result) {
        domains.push({ domain: name, zone: 'no zone', routing: '-', catchAll: null });
        add('block', 'Email', `${name} has no Cloudflare zone.`);
        continue;
      }
      const zone = z.result;
      const st = await cf.emailRoutingStatus(zone.id);
      const rules = await cf.listRules(zone.id);
      const ca = rules.ok ? rules.result.find((r: any) => r.matchers?.[0]?.type === 'all') : null;
      const dest = ca?.actions?.[0]?.value?.[0] ?? null;
      domains.push({
        domain: name,
        zone: zone.status,
        routing: st.ok ? (st.result.enabled ? st.result.status : 'disabled') : 'unknown',
        catchAll: ca?.enabled ? dest : null,
      });
      if (zone.status !== 'active') add('block', 'Email', `${name}: zone is ${zone.status}.`);
      else if (!ca?.enabled) add('block', 'Email', `${name}: no catch-all rule.`);
    }
  } catch (e) {
    add('block', 'Email', `Domain check failed: ${e instanceof Error ? e.message : 'unknown error'}`);
  }

  return {
    findings,
    proxies,
    profiles,
    domains,
    verdict: findings.some((f) => f.severity === 'block') ? 'no-go' : 'go',
    checkedAt: new Date().toISOString(),
  };
}
