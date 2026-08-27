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

// Route to the registry that actually serves the TLD, using IANA's own bootstrap
// file. Guessing the hostname does not work - .com is rdap.verisign.com but .cc
// is tld-rdap.verisign.com, and rdap.org's redirect service times out often
// enough to turn real answers into "unknown". IANA publishes the mapping, so
// fetch it once and cache it for the process.
let bootstrap: Map<string, string> | null = null;

async function rdapBase(tld: string): Promise<string | null> {
  if (!bootstrap) {
    try {
      const res = await fetch('https://data.iana.org/rdap/dns.json', { signal: AbortSignal.timeout(15000) });
      const data: any = await res.json();
      bootstrap = new Map();
      for (const [tlds, urls] of data.services as [string[], string[]][]) {
        for (const t of tlds) bootstrap.set(t, urls[0].replace(/\/$/, ''));
      }
    } catch {
      bootstrap = new Map();     // fall through to rdap.org below
    }
  }
  return bootstrap.get(tld) ?? null;
}

async function RDAP(d: string): Promise<string> {
  const tld = d.split('.').pop() ?? '';
  const base = await rdapBase(tld);
  return base ? `${base}/domain/${d}` : `https://rdap.org/domain/${d}`;
}

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
    const res = await fetch(await RDAP(d), {
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


// TLD shortlist for buying service-line domains.
//
// `renewal` is the number that matters - first-year prices are loss leaders and
// every registrar discounts them. Cheapest Spaceship renewal, checked 2026-08-26.
//
// `riskyShare` is the fraction of registrations in that namespace flagged as
// malicious or high-risk. Above roughly 50% means most of the domains in the TLD
// are bad, and receivers weight that. Below ~15% is unremarkable.
//
// TLD alone does not get mail rejected - domain age, authentication and sender
// reputation dominate. It is a tiebreaker, not a gate. But there is no reason to
// pick a namespace that is more than half abuse when the saving is under $2/yr.
export type TldInfo = {
  tld: string;
  renewal: number;
  registry: string;
  riskyShare: number | null;
  verdict: 'fine' | 'avoid';
  note?: string;
};

export const TLDS: TldInfo[] = [
  { tld: 'com', renewal: 10.18, registry: 'Verisign', riskyShare: null, verdict: 'fine', note: 'Default. Largest namespace, unremarkable reputation.' },
  { tld: 'cc',  renewal: 8.26,  registry: 'Verisign', riskyShare: null, verdict: 'fine', note: 'Run by Verisign, same as .com. Not on the 2026 worst-TLD lists.' },
  { tld: 'co',  renewal: 27.48, registry: '.CO Internet', riskyShare: null, verdict: 'fine', note: 'Clean but pricey to renew.' },
  { tld: 'net', renewal: 12.98, registry: 'Verisign', riskyShare: null, verdict: 'fine' },
  { tld: 'org', renewal: 11.48, registry: 'PIR', riskyShare: null, verdict: 'fine' },
  { tld: 'xyz', renewal: 12.98, registry: 'XYZ.com', riskyShare: 0.549, verdict: 'avoid', note: '55% of registrations flagged risky.' },
  { tld: 'top', renewal: 8.98,  registry: 'Jiangsu Bangning', riskyShare: 0.536, verdict: 'avoid', note: '54% flagged risky. Cheap for a reason.' },
  { tld: 'icu', renewal: 9.98,  registry: 'ShortDot', riskyShare: null, verdict: 'avoid', note: 'Repeatedly in worst-TLD rankings.' },
  { tld: 'sbs', renewal: 9.98,  registry: 'ShortDot', riskyShare: null, verdict: 'avoid', note: 'Repeatedly in worst-TLD rankings.' },
  { tld: 'click', renewal: 12.98, registry: 'Identity Digital', riskyShare: null, verdict: 'avoid' },
];

export const SAFE_TLDS = TLDS.filter((t) => t.verdict === 'fine').map((t) => t.tld);

// Check one name across several TLDs at once.
export async function checkAcrossTlds(name: string, tlds: string[] = SAFE_TLDS) {
  const bare = name.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const results = await checkDomains(tlds.map((t) => `${bare}.${t}`));
  return results.map((r) => {
    const info = TLDS.find((t) => r.domain.endsWith(`.${t.tld}`));
    return { ...r, renewal: info?.renewal ?? null, verdict: info?.verdict ?? 'fine', tldNote: info?.note };
  });
}
