// Brand-extension handle ideas.
//
// Everything here builds names that visibly belong to the client's brand: the
// base handle plus a format, service line or location. Same job as a domain
// search - give the client a shortlist of names they could actually register.

export type Idea = { handle: string; pattern: string; why: string };

const FORMAT = ['clips', 'shorts', 'reels', 'daily', 'tv', 'media', 'studio', 'live'];
const ROLE = ['hq', 'co', 'official', 'team', 'group', 'insider', 'app'];

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// "360 BnB Solutions" -> ["360bnbsolutions", "360bnb", "bnbsolutions", "360bs"]
export function baseForms(brand: string, primaryHandle?: string): string[] {
  const words = brand.toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean);
  const full = words.join('');
  const forms = new Set<string>();
  if (primaryHandle) forms.add(clean(primaryHandle));
  forms.add(full);
  if (words.length > 1) {
    forms.add(words.slice(0, -1).join(''));           // drop the trailing "solutions"
    forms.add(words.slice(1).join(''));
    forms.add(words.map((w) => (/^\d+$/.test(w) ? w : w[0])).join('')); // initials, digits kept
  }
  return [...forms].filter((f) => f.length >= 3 && f.length <= 24);
}

export function ruleIdeas(
  brand: string,
  primaryHandle: string,
  keywords: string[] = [],
  limit = 40,
): Idea[] {
  const bases = baseForms(brand, primaryHandle);
  const out: Idea[] = [];
  const seen = new Set<string>();
  const add = (handle: string, pattern: string, why: string) => {
    const h = handle.toLowerCase();
    if (h.length < 3 || h.length > 30 || seen.has(h)) return;
    seen.add(h);
    out.push({ handle: h, pattern, why });
  };

  for (const base of bases) {
    for (const sep of ['', '.', '_']) {
      for (const w of FORMAT) add(`${base}${sep}${w}`, 'content format', `${brand} account for ${w}`);
      for (const w of ROLE) add(`${base}${sep}${w}`, 'brand role', `${brand} ${w} account`);
      for (const w of keywords.map(clean).filter(Boolean)) {
        add(`${base}${sep}${w}`, 'service or place', `${brand} account for ${w}`);
        add(`${w}${sep}${base}`, 'service or place', `${w} branch of ${brand}`);
      }
    }
  }
  return out.slice(0, limit);
}

// Email local parts. Kept boring on purpose - these are operational mailboxes
// tied to a client account, not identities.
export function emailIdeas(brand: string, primaryHandle: string, count = 6): string[] {
  const base = baseForms(brand, primaryHandle)[0] ?? clean(brand);
  const out: string[] = [];
  for (const w of ['team', 'media', 'social', 'hq', 'studio', 'accounts', 'clips', 'daily']) {
    out.push(`${base}.${w}`);
    if (out.length >= count) break;
  }
  return out;
}
