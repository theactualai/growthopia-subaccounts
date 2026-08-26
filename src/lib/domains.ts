// Domain availability via RDAP.
//
// Unlike social handles, domains have an authoritative free lookup. RDAP is the
// registry's own protocol and replaced WHOIS: 404 means nobody owns it, 200
// returns the registration record. No scraping, no API key, no guessing.
//
// This is the one availability check in the codebase you can actually trust.
// Registration date matters as much as the yes/no - a domain registered last
// month carries a lower per-domain account cap than an aged one.

export type DomainResult = {
  domain: string;
  available: boolean | null;      // null = lookup failed
  registeredOn?: string;
  ageDays?: number;
  note?: string;
};

// rdap.org bootstraps to whichever registry runs the TLD.
const RDAP = (d: string) => `https://rdap.org/domain/${d}`;

const cache = new Map<string, DomainResult>();

// The rdap.org bootstrap redirect is occasionally slow enough to time out on a
// cold lookup, so a single retry with a longer window turns most "unknown"
// results into real ones.
export async function checkDomain(domain: string, attempt = 0): Promise<DomainResult> {
  const d = domain.trim().toLowerCase();
  const hit = cache.get(d);
  if (hit) return hit;

  let out: DomainResult;
  try {
    const res = await fetch(RDAP(d), {
      headers: { Accept: 'application/rdap+json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(attempt === 0 ? 10000 : 20000),
    });
    if (res.status === 404) {
      out = { domain: d, available: true };
    } else if (res.ok) {
      const body: any = await res.json();
      const reg = body.events?.find((e: any) => e.eventAction === 'registration')?.eventDate;
      const ageDays = reg ? Math.floor((Date.now() - Date.parse(reg)) / 86400000) : undefined;
      out = { domain: d, available: false, registeredOn: reg?.slice(0, 10), ageDays };
    } else {
      out = { domain: d, available: null, note: `registry returned ${res.status}` };
    }
  } catch (e) {
    if (attempt === 0) return checkDomain(d, 1);
    out = { domain: d, available: null, note: e instanceof Error ? e.message : 'lookup failed' };
  }
  if (out.available !== null) cache.set(d, out);
  return out;
}

export async function checkDomains(domains: string[], concurrency = 4): Promise<DomainResult[]> {
  const out: DomainResult[] = [];
  for (let i = 0; i < domains.length; i += concurrency) {
    out.push(...(await Promise.all(domains.slice(i, i + concurrency).map(checkDomain))));
    if (i + concurrency < domains.length) await new Promise((r) => setTimeout(r, 250));
  }
  return out;
}
