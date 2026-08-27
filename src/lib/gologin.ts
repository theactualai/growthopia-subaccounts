// GoLogin adapter: browser profiles and the proxy bound to each one.

const API = 'https://api.gologin.com';

export type GlProfile = {
  id: string;
  name: string;
  proxy?: { mode: string; host?: string; port?: number; username?: string; autoProxyRegion?: string };
  os?: string;
  createdAt?: string;
};

function headers() {
  const token = process.env.GOLOGIN_API_TOKEN;
  if (!token) throw new Error('GOLOGIN_API_TOKEN is not set');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function gl<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(25000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(body).slice(0, 250)}`);
  return body as T;
}

export const listProfiles = () =>
  gl<{ profiles: GlProfile[]; allProfilesCount: number }>('/browser/v2?page=1&limit=100');

export const getProfile = (id: string) => gl<GlProfile>(`/browser/${id}`);

/** Bind a proxy to a profile. Protocol matters: HTTP beat SOCKS5 on Microsoft. */
export const setProxy = (id: string, p: { mode: 'http' | 'socks5'; host: string; port: number; username: string; password: string }) =>
  gl(`/browser/${id}/proxy`, { method: 'PATCH', body: JSON.stringify(p) });
