// Cloudflare adapter: zones, DNS and email routing.
//
// The flow this exists to serve:
//   1. createZone()            -> returns the nameservers Cloudflare assigned
//   2. (Spaceship sets those nameservers on the domain)
//   3. zoneStatus()            -> poll until 'active'; DNS delegation is not instant
//   4. enableEmailRouting()    -> writes the MX records
//   5. setCatchAll()           -> every address at the domain forwards to one inbox
//
// Destination addresses are account-scoped and must be verified once by clicking
// a link Cloudflare emails. Everything after that is per-zone.

const API = 'https://api.cloudflare.com/client/v4';

export type CfResult<T> = { ok: true; result: T } | { ok: false; status: number; errors: string };

function creds() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is not set');
  return { token, account };
}

async function cf<T>(path: string, init: RequestInit = {}): Promise<CfResult<T>> {
  const { token } = creds();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(25000),
  });
  const body: any = await res.json().catch(() => ({}));
  if (body?.success) return { ok: true, result: body.result as T };
  return {
    ok: false,
    status: res.status,
    errors: (body?.errors ?? []).map((e: any) => `${e.code}: ${e.message}`).join('; ') || `HTTP ${res.status}`,
  };
}

export const verifyToken = () => cf<{ status: string }>('/user/tokens/verify');

// --- destination addresses (account scope) ---

export const listDestinations = () => {
  const { account } = creds();
  return cf<any[]>(`/accounts/${account}/email/routing/addresses`);
};

/** Sends a verification email. The address is unusable until the link is clicked. */
export const addDestination = (email: string) => {
  const { account } = creds();
  return cf<any>(`/accounts/${account}/email/routing/addresses`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
};

// --- zones ---

export type Zone = { id: string; name: string; status: string; name_servers: string[] };

export const createZone = (name: string) => {
  const { account } = creds();
  return cf<Zone>('/zones', {
    method: 'POST',
    body: JSON.stringify({ name, account: { id: account }, type: 'full' }),
  });
};

export const findZone = async (name: string): Promise<CfResult<Zone | null>> => {
  const r = await cf<Zone[]>(`/zones?name=${encodeURIComponent(name)}`);
  return r.ok ? { ok: true, result: r.result[0] ?? null } : r;
};

export const zoneStatus = async (name: string) => {
  const r = await findZone(name);
  return r.ok ? (r.result?.status ?? 'not-found') : `error: ${r.errors}`;
};

// --- email routing ---

/** Writes the MX and SPF records. Zone must be active first. */
export const enableEmailRouting = (zoneId: string) =>
  cf<any>(`/zones/${zoneId}/email/routing/dns`, { method: 'POST', body: JSON.stringify({}) });

export const emailRoutingStatus = (zoneId: string) =>
  cf<{ enabled: boolean; status: string }>(`/zones/${zoneId}/email/routing`);

/**
 * Catch-all: anything at this domain forwards to `destination`.
 * This is what removes per-address provisioning entirely - invent an address at
 * signup and it already works.
 */
export const setCatchAll = (zoneId: string, destination: string) =>
  cf<any>(`/zones/${zoneId}/email/routing/rules/catch_all`, {
    method: 'PUT',
    body: JSON.stringify({
      enabled: true,
      name: 'catch-all to ops inbox',
      matchers: [{ type: 'all' }],
      actions: [{ type: 'forward', value: [destination] }],
    }),
  });

export const listRules = (zoneId: string) => cf<any[]>(`/zones/${zoneId}/email/routing/rules`);
