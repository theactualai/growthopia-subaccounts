// The cost model from the Math tab of the Subaccount Database sheet.
// Ladders are vendor list prices. Update them here and in the sheet together.

export type Billing = 'monthly' | 'annual';
export type PhoneStrategy = 'A' | 'B' | 'C' | 'D';

export const GOLOGIN = [
  { plan: 'Professional', profiles: 10,   monthly: 9,   annual: 4.5 },
  { plan: 'Professional', profiles: 50,   monthly: 49,  annual: 24.5 },
  { plan: 'Professional', profiles: 100,  monthly: 79,  annual: 39.5 },
  { plan: 'Business',     profiles: 300,  monthly: 119, annual: 59.5 },
  { plan: 'Business',     profiles: 500,  monthly: 179, annual: 89.5 },
  { plan: 'Enterprise',   profiles: 1000, monthly: 299, annual: 149.5 },
  { plan: 'Custom',       profiles: 2000, monthly: 449, annual: 224.5 },
];

// Webshare static residential, three exclusivity tiers.
//
// 2026-08-27, measured live: the SHARED tier could not get past Instagram's
// signup CAPTCHA - infinite loop. Switching to DEDICATED cleared it immediately
// on the same account. So shared is not a viable tier for account creation, only
// for cheaper work afterwards. Model dedicated by default.
export const PROXY_PER_IP = {
  shared: 0.30,     // fails Instagram signup CAPTCHA - do not use for signups
  private: 0.429,   // shared with up to 2 other users, untested here
  dedicated: 0.825, // exclusive, confirmed working for Instagram signup
} as const;

export type ProxyTier = keyof typeof PROXY_PER_IP;

// Bundle pricing for the shared tier, kept for comparison. The 20-proxy minimum
// is why shared cost per client was lumpy rather than smooth.
export const WEBSHARE = [
  { proxies: 20,    monthly: 6,     annual: 4 },
  { proxies: 100,   monthly: 30,    annual: 20.01 },
  { proxies: 500,   monthly: 142.5, annual: 95.05 },
  { proxies: 1000,  monthly: 270,   annual: 180.09 },
  { proxies: 10000, monthly: 2250,  annual: 1500.75 },
];

export type Assumptions = {
  accountsPerPlatform: number;
  platforms: number;
  maxProfilesPerIdentity: number;
  clientLifetimeMonths: number;
  billing: Billing;
  phoneStrategy: PhoneStrategy;
  retainedRentalsPerClient: number;
  rentalPerNumber: number;
  retryFactor: number;
  budgetCeiling: number;
  proxyTier: ProxyTier;
  codeInstagram: number;
  codeTikTok: number;
  codeYouTube: number;
  codeMail: number;
};

export const DEFAULTS: Assumptions = {
  accountsPerPlatform: 3,
  platforms: 3,
  maxProfilesPerIdentity: 9,
  clientLifetimeMonths: 12,
  billing: 'annual',
  phoneStrategy: 'A',
  retainedRentalsPerClient: 2,
  rentalPerNumber: 5,
  retryFactor: 1.25,
  budgetCeiling: 15,
  proxyTier: 'dedicated',
  codeInstagram: 0.5,
  codeTikTok: 0.75,
  codeYouTube: 0.75,
  codeMail: 0.5,
};

const fits = <T extends { [k: string]: any }>(rows: T[], key: keyof T, need: number) =>
  rows.find((r) => r[key] >= need) ?? rows[rows.length - 1];

export const profilesPerClient = (a: Assumptions) => a.accountsPerPlatform * a.platforms;
export const identitiesPerClient = (a: Assumptions) =>
  Math.max(1, Math.ceil(profilesPerClient(a) / a.maxProfilesPerIdentity));

export function phoneCosts(a: Assumptions) {
  const p = profilesPerClient(a);
  const oneTime =
    (a.accountsPerPlatform * a.codeInstagram +
      a.accountsPerPlatform * a.codeTikTok +
      a.accountsPerPlatform * a.codeYouTube +
      p * a.codeMail) * a.retryFactor;
  const A = oneTime / a.clientLifetimeMonths;
  return {
    oneTime,
    A,
    B: A + a.retainedRentalsPerClient * a.rentalPerNumber,
    C: p * a.rentalPerNumber,
    D: (p * a.rentalPerNumber) / a.clientLifetimeMonths,
  };
}

export function modelRow(clients: number, a: Assumptions) {
  const ids = clients * identitiesPerClient(a);
  const gl = fits(GOLOGIN, 'profiles', ids);
  const proxyMonthly = ids * PROXY_PER_IP[a.proxyTier];
  const glCost = a.billing === 'annual' ? gl.annual : gl.monthly;

  const phone = phoneCosts(a);
  const infra = glCost / clients + proxyMonthly / clients;
  const total = infra + phone[a.phoneStrategy];
  return {
    clients,
    socialProfiles: clients * profilesPerClient(a),
    identities: ids,
    goLoginPlan: `${gl.plan} ${gl.profiles}`,
    goLoginPerClient: glCost / clients,
    proxyTier: a.proxyTier,
    proxyPerClient: proxyMonthly / clients,
    infra,
    phone: phone[a.phoneStrategy],
    total,
    agencyMonthly: total * clients,
    underCeiling: total <= a.budgetCeiling,
  };
}

export const CLIENT_STEPS = [5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 200, 250];
export const buildModel = (a: Assumptions) => CLIENT_STEPS.map((c) => modelRow(c, a));
