// Handle availability checking.
//
// No platform publishes an availability API, so the usual trick is to fetch the
// public profile URL and read the status code. That only actually works on one
// of our three platforms. Measured 2026-08-26 against a known-real handle and a
// known-nonsense one:
//
//   YouTube    404 vs 200   <- works, this is a real signal
//   Instagram  200 vs 200   <- useless, unauthenticated IG serves the same
//                              600KB JS shell either way
//   TikTok     200 vs 200   <- useless, same shell for both
//
// oEmbed does not help: TikTok and YouTube both reject profile URLs (400/404),
// they only resolve individual videos.
//
// So rather than print a confident wrong answer for two platforms out of three,
// we report what we know and hand back a link for the rest. If you want real
// Instagram and TikTok checks, that needs an authenticated session or a paid
// scraping API - wire it into `externalCheck` below.

export type Platform = 'instagram' | 'tiktok' | 'youtube';
export type Verdict = 'available' | 'taken' | 'manual';

export type CheckResult = {
  handle: string;
  platform: Platform;
  verdict: Verdict;
  url: string;
  note?: string;
};

const PROFILE_URL: Record<Platform, (h: string) => string> = {
  instagram: (h) => `https://www.instagram.com/${h}/`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
  youtube: (h) => `https://www.youtube.com/@${h}`,
};

// Only YouTube distinguishes a missing profile by status code.
const PROBEABLE: Platform[] = ['youtube'];

export function validateHandle(handle: string, platform: Platform): string | null {
  const h = handle.trim();
  if (!h) return 'empty';
  if (platform === 'instagram') {
    if (!/^[a-z0-9._]{1,30}$/i.test(h)) return 'letters, numbers, dots and underscores only, max 30';
    if (/^[._]|[._]$/.test(h)) return 'cannot start or end with a dot or underscore';
    if (/\.\./.test(h)) return 'no consecutive dots';
  }
  if (platform === 'tiktok') {
    if (!/^[a-z0-9._]{2,24}$/i.test(h)) return 'letters, numbers, dots and underscores only, 2-24 characters';
    if (/\.$/.test(h)) return 'cannot end with a dot';
  }
  if (platform === 'youtube') {
    if (!/^[a-z0-9._-]{3,30}$/i.test(h)) return 'letters, numbers, dots, dashes and underscores only, 3-30 characters';
  }
  return null;
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';

const cache = new Map<string, CheckResult>();

async function probe(handle: string, platform: Platform): Promise<CheckResult> {
  const url = PROFILE_URL[platform](handle);
  const key = `${platform}:${handle.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const invalid = validateHandle(handle, platform);
  if (invalid) {
    const r: CheckResult = { handle, platform, verdict: 'manual', url, note: `invalid: ${invalid}` };
    cache.set(key, r);
    return r;
  }

  if (!PROBEABLE.includes(platform)) {
    const r: CheckResult = { handle, platform, verdict: 'manual', url, note: 'no reliable public check' };
    cache.set(key, r);
    return r;
  }

  let result: CheckResult;
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) result = { handle, platform, verdict: 'available', url };
    else if (res.status === 200) result = { handle, platform, verdict: 'taken', url };
    else result = { handle, platform, verdict: 'manual', url, note: `status ${res.status}` };
  } catch (e) {
    result = { handle, platform, verdict: 'manual', url, note: e instanceof Error ? e.message : 'request failed' };
  }
  cache.set(key, result);
  return result;
}

// Small concurrency cap with a pause between waves. Hammering gets you a 429
// and a useless answer, so going slower returns more.
export async function checkMany(
  handles: string[],
  platforms: Platform[],
  concurrency = 4,
): Promise<CheckResult[]> {
  const jobs = handles.flatMap((h) => platforms.map((p) => ({ h, p })));
  const out: CheckResult[] = [];
  for (let i = 0; i < jobs.length; i += concurrency) {
    const wave = jobs.slice(i, i + concurrency);
    out.push(...(await Promise.all(wave.map((j) => probe(j.h, j.p)))));
    if (i + concurrency < jobs.length) await new Promise((r) => setTimeout(r, 300));
  }
  return out;
}

// Yahoo has no availability endpoint, so an address can only be confirmed by
// attempting signup. We validate the shape and leave the verdict open.
export function emailSuggestion(local: string) {
  const ok = /^[a-z0-9._-]{4,32}$/i.test(local) && !/^[._-]|[._-]$/.test(local);
  return {
    address: `${local}@yahoo.com`,
    valid: ok,
    note: ok ? 'shape is valid, confirm at signup' : 'invalid shape for a Yahoo local part',
  };
}
