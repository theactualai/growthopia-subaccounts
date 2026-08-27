// Spaceship adapter: contacts, availability, registration, nameservers.
//
// Registration bills the account's default payment method and is irreversible,
// so every call that spends money is behind an explicit confirm flag in the
// scripts that use this.
//
// Contacts are a one-time bootstrap: there is no endpoint to list them, only to
// create. Once a contact ID exists, store it and reuse it for every future
// registration rather than creating a new contact per domain.

const API = 'https://spaceship.dev/api/v1';

export type SsResult<T> = { ok: true; result: T } | { ok: false; status: number; error: string };

function headers() {
  const key = process.env.SPACESHIP_API_KEY;
  const secret = process.env.SPACESHIP_API_SECRET;
  if (!key || !secret) throw new Error('SPACESHIP_API_KEY / SPACESHIP_API_SECRET are not set');
  return { 'X-Api-Key': key, 'X-Api-Secret': secret, 'Content-Type': 'application/json' };
}

async function ss<T>(path: string, init: RequestInit = {}): Promise<SsResult<T>> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(45000),
  });
  const text = await res.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (res.ok) return { ok: true, result: body as T };
  const detail = body?.detail ?? body?.title ?? body?.raw ?? `HTTP ${res.status}`;
  const fields = body?.data?.map?.((d: any) => `${d.field}: ${d.details}`).join('; ');
  return { ok: false, status: res.status, error: fields ? `${detail} (${fields})` : detail };
}

export type Contact = {
  firstName: string; lastName: string; email: string; phone: string;
  address1: string; city: string; country: string;
  address2?: string; stateProvince?: string; postalCode?: string; organization?: string;
};

/** One-time. Returns a contactId to reuse for every future registration. */
export const saveContact = (c: Contact) =>
  ss<{ contactId: string }>('/contacts', { method: 'PUT', body: JSON.stringify(c) });

export const listDomains = () => ss<{ items: any[]; total: number }>('/domains?take=50&skip=0');

export const getDomain = (domain: string) => ss<any>(`/domains/${domain}`);

export type RegisterOptions = {
  years?: number;
  autoRenew?: boolean;
  privacy?: 'high' | 'public';
  contactId: string;
};

/** Spends money. Irreversible. */
export const registerDomain = (domain: string, o: RegisterOptions) =>
  ss<any>(`/domains/${domain}`, {
    method: 'POST',
    body: JSON.stringify({
      autoRenew: o.autoRenew ?? true,
      years: o.years ?? 1,
      privacyProtection: { level: o.privacy ?? 'high', userConsent: true },
      contacts: {
        registrant: o.contactId,
        admin: o.contactId,
        tech: o.contactId,
        billing: o.contactId,
      },
    }),
  });

/** Point the domain at Cloudflare's nameservers. */
export const setNameservers = (domain: string, hosts: string[]) =>
  ss<any>(`/domains/${domain}/nameservers`, {
    method: 'PUT',
    body: JSON.stringify({ provider: 'custom', hosts }),
  });
