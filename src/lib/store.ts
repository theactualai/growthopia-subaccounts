// Seed data layer. Everything reads through these functions so swapping in
// Supabase later is a change here and nowhere else.
//
// Secrets live in `identitySecrets`, deliberately in a separate map from the
// records the UI renders. In Supabase this becomes a table with RLS denying all
// client access, readable only by the Edge Function that computes codes.

export type Platform = 'instagram' | 'tiktok' | 'youtube';
export type ResourceStatus = 'active' | 'held' | 'retired' | 'cooldown';

export type Client = {
  id: string;
  name: string;
  primaryHandle: string;
  status: 'active' | 'onboarding' | 'offboarded';
  targetPerPlatform: number;
  startedAt: string;
};

export type Identity = {
  id: string;
  clientId: string | null;
  label: string;
  goLoginProfileId: string;
  proxyId: string;
  status: ResourceStatus;
  assignedAt: string;
  releasedAt: string | null;
};

export type Proxy = {
  id: string;
  vendor: 'webshare';
  ip: string;
  protocol: 'socks5' | 'http';
  tier: 'shared-static-residential';
  monthlyCost: number;
  status: ResourceStatus;
};

export type PhoneResource = {
  id: string;
  vendor: 'textverified';
  masked: string;
  kind: 'one-time' | 'rental';
  monthlyCost: number;
  clientId: string | null;
  status: ResourceStatus;
};

export type EmailIdentity = {
  id: string;
  provider: 'yahoo' | 'other';
  address: string;
  clientId: string | null;
  status: ResourceStatus;
};

export type PlatformAccount = {
  id: string;
  clientId: string;
  platform: Platform;
  handle: string;
  identityId: string;
  emailId: string | null;
  phoneId: string | null;
  twoFactor: 'authenticator' | 'sms' | 'none';
  status: 'live' | 'warming' | 'needs-attention';
  createdAt: string;
};

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();

export const clients: Client[] = [
  { id: 'c-0001', name: '360 BnB Solutions', primaryHandle: '360bnbsolutions', status: 'active', targetPerPlatform: 3, startedAt: iso(48) },
  { id: 'c-0002', name: 'Test Client 2',     primaryHandle: 'testclient2',     status: 'onboarding', targetPerPlatform: 3, startedAt: iso(6) },
];

export const proxies: Proxy[] = [
  { id: 'px-01', vendor: 'webshare', ip: '198.23.243.226', protocol: 'socks5', tier: 'shared-static-residential', monthlyCost: 0.3, status: 'active' },
  { id: 'px-02', vendor: 'webshare', ip: '198.23.243.227', protocol: 'socks5', tier: 'shared-static-residential', monthlyCost: 0.3, status: 'active' },
  { id: 'px-03', vendor: 'webshare', ip: '198.23.243.228', protocol: 'socks5', tier: 'shared-static-residential', monthlyCost: 0.3, status: 'cooldown' },
];

export const identities: Identity[] = [
  { id: 'id-01', clientId: 'c-0001', label: 'Identity A', goLoginProfileId: 'gl_8f21a', proxyId: 'px-01', status: 'active', assignedAt: iso(48), releasedAt: null },
  { id: 'id-02', clientId: 'c-0002', label: 'Identity A', goLoginProfileId: 'gl_3c77b', proxyId: 'px-02', status: 'held',   assignedAt: iso(6),  releasedAt: null },
  { id: 'id-03', clientId: null,     label: 'Pool 01',    goLoginProfileId: 'gl_11d90', proxyId: 'px-03', status: 'cooldown', assignedAt: iso(60), releasedAt: iso(12) },
];

export const phones: PhoneResource[] = [
  { id: 'ph-01', vendor: 'textverified', masked: '+1 (415) ***-**42', kind: 'rental',   monthlyCost: 5, clientId: 'c-0001', status: 'active' },
  { id: 'ph-02', vendor: 'textverified', masked: '+1 (312) ***-**07', kind: 'one-time', monthlyCost: 0, clientId: 'c-0001', status: 'retired' },
];

export const emails: EmailIdentity[] = [
  { id: 'em-01', provider: 'yahoo', address: 'ops-c0001-01@yahoo.com', clientId: 'c-0001', status: 'active' },
  { id: 'em-02', provider: 'yahoo', address: 'ops-c0001-02@yahoo.com', clientId: 'c-0001', status: 'active' },
];

export const accounts: PlatformAccount[] = [
  { id: 'ac-01', clientId: 'c-0001', platform: 'instagram', handle: '(client primary)', identityId: 'id-01', emailId: 'em-01', phoneId: 'ph-01', twoFactor: 'authenticator', status: 'live',    createdAt: iso(48) },
  { id: 'ac-02', clientId: 'c-0001', platform: 'tiktok',    handle: '(client primary)', identityId: 'id-01', emailId: 'em-02', phoneId: null,    twoFactor: 'authenticator', status: 'live',    createdAt: iso(40) },
  { id: 'ac-03', clientId: 'c-0001', platform: 'youtube',   handle: '(client primary)', identityId: 'id-01', emailId: 'em-02', phoneId: null,    twoFactor: 'sms',           status: 'warming', createdAt: iso(3) },
];

// Never rendered. Server-side lookup only. In Supabase this is a locked table.
const identitySecrets: Record<string, string> = {
  'ac-01': 'JBSWY3DPEHPK3PXP',
  'ac-02': 'KRSXG5CTMVRXEZLU',
  'ac-03': 'MFRGGZDFMZTWQ2LK',
};

export const getClient = (id: string) => clients.find((c) => c.id === id);
export const clientAccounts = (id: string) => accounts.filter((a) => a.clientId === id);
export const clientIdentities = (id: string) => identities.filter((i) => i.clientId === id);
export const clientPhones = (id: string) => phones.filter((p) => p.clientId === id);
export const clientEmails = (id: string) => emails.filter((e) => e.clientId === id);
export const proxyFor = (id: string) => proxies.find((p) => p.id === id);
export const secretFor = (accountId: string): string | undefined => identitySecrets[accountId];

// Capacity guardrail: how full an identity is against the configured limit.
export function identityLoad(identityId: string, maxPerIdentity: number) {
  const used = accounts.filter((a) => a.identityId === identityId).length;
  return { used, max: maxPerIdentity, over: used > maxPerIdentity, remaining: Math.max(0, maxPerIdentity - used) };
}

// Recycling: an identity released more than `cooldownDays` ago can be reused.
export function recycleState(identity: Identity, cooldownDays = 30) {
  if (!identity.releasedAt) return { eligible: false, daysLeft: null as number | null, reason: 'still assigned' };
  const days = Math.floor((Date.now() - Date.parse(identity.releasedAt)) / 86400000);
  return days >= cooldownDays
    ? { eligible: true, daysLeft: 0, reason: `released ${days} days ago` }
    : { eligible: false, daysLeft: cooldownDays - days, reason: `released ${days} days ago` };
}
