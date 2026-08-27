// Webshare adapter.
//
// The country column is the field that actually matters. A French IP paired
// with a US phone number is the single mismatch that cost us a signup and three
// SMS attempts, so anything that reads proxies here also reports where they are.

const API = 'https://proxy.webshare.io/api/v2';

export type WsProxy = {
  id: string;
  proxy_address: string;
  port: number;
  username: string;
  password: string;
  country_code: string;
  city_name: string | null;
  valid: boolean;
};

function headers() {
  const key = process.env.WEBSHARE_API_KEY;
  if (!key) throw new Error('WEBSHARE_API_KEY is not set');
  return { Authorization: `Token ${key}`, 'Content-Type': 'application/json' };
}

async function ws<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(25000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(body).slice(0, 250)}`);
  return body as T;
}

export const listProxies = () =>
  ws<{ count: number; results: WsProxy[] }>('/proxy/list/?mode=direct&page=1&page_size=100');

export const subscription = () => ws<any>('/subscription/');

export const replacementsLeft = () =>
  ws<any>('/proxy/replace/stats/').catch(() => null);

/** Area codes that match a proxy's city, so the phone and the IP agree. */
export const AREA_CODES: Record<string, string[]> = {
  'New York': ['212', '646', '917', '718', '347', '929'],
  Brooklyn: ['718', '347', '929'],
  'Los Angeles': ['213', '310', '323', '424', '818'],
  Chicago: ['312', '773', '872'],
  Miami: ['305', '786'],
  Dallas: ['214', '469', '972'],
  Houston: ['713', '281', '832'],
  Atlanta: ['404', '470', '678'],
  Phoenix: ['602', '480', '623'],
  Seattle: ['206', '425'],
  Denver: ['303', '720'],
  Boston: ['617', '857'],
};

export const areaCodesFor = (city: string | null) =>
  city ? (AREA_CODES[city] ?? null) : null;


// Independent reputation lookup.
//
// Webshare labels every static residential IP by city and never tells you
// whether public databases have it flagged. Measured 2026-08-27: 6 of 10 US IPs
// on this account come back flagged as proxy, including every address in the
// 9.249.x.x (Astound) range. Anything a free lookup can see, a platform can see,
// so treat "flagged" as disqualifying for account creation.
export type IpReputation = {
  ip: string;
  country?: string;
  city?: string;
  isp?: string;
  flaggedProxy: boolean;
  flaggedHosting: boolean;
  clean: boolean;
  lookupFailed?: boolean;
};

const repCache = new Map<string, IpReputation>();

export async function reputation(ip: string): Promise<IpReputation> {
  const hit = repCache.get(ip);
  if (hit) return hit;
  let out: IpReputation;
  try {
    const r = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,isp,proxy,hosting`,
      { signal: AbortSignal.timeout(12000) },
    );
    const j: any = await r.json();
    if (j.status !== 'success') throw new Error(j.message ?? 'lookup failed');
    out = {
      ip, country: j.countryCode, city: j.city, isp: j.isp,
      flaggedProxy: Boolean(j.proxy), flaggedHosting: Boolean(j.hosting),
      clean: !j.proxy && !j.hosting,
    };
  } catch {
    // Unknown is not clean. Never let a failed lookup pass as usable.
    out = { ip, flaggedProxy: false, flaggedHosting: false, clean: false, lookupFailed: true };
  }
  repCache.set(ip, out);
  return out;
}

/** ip-api's free tier rate-limits, so this paces itself deliberately. */
export async function reputations(ips: string[]): Promise<IpReputation[]> {
  const out: IpReputation[] = [];
  for (const ip of ips) {
    out.push(await reputation(ip));
    await new Promise((r) => setTimeout(r, 1400));
  }
  return out;
}
