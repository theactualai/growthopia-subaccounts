import { NextResponse } from 'next/server';
import { ruleIdeas, emailIdeas } from '@/lib/names';
import { generateIdeas, provider } from '@/lib/ai';
import { checkMany, emailSuggestion, type Platform } from '@/lib/availability';

export const runtime = 'nodejs';        // child_process for the claude CLI
export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const brand: string = (body.brand ?? '').trim();
  const primaryHandle: string = (body.primaryHandle ?? '').trim().replace(/^@/, '');
  const about: string = (body.about ?? '').trim();
  const keywords: string[] = (body.keywords ?? '').split(',').map((s: string) => s.trim()).filter(Boolean);
  const platforms: Platform[] = body.platforms?.length ? body.platforms : ['instagram', 'tiktok', 'youtube'];
  const useAi: boolean = body.useAi !== false;

  if (!brand) return NextResponse.json({ error: 'brand is required' }, { status: 400 });

  const rules = ruleIdeas(brand, primaryHandle, keywords, 24);
  let ai: { handle: string; why: string }[] = [];
  let aiError: string | null = null;
  let used = provider();

  if (useAi) {
    try {
      const r = await generateIdeas(brand, primaryHandle, about, keywords, 20);
      ai = r.ideas;
      used = r.provider;
    } catch (e) {
      aiError = e instanceof Error ? e.message : 'generation failed';
    }
  }

  // Merge, dedupe, keep the AI ideas first since they read better.
  const seen = new Set<string>();
  const merged = [
    ...ai.map((i) => ({ handle: i.handle.toLowerCase().replace(/^@/, ''), why: i.why, source: 'ai' as const })),
    ...rules.map((i) => ({ handle: i.handle, why: i.why, source: 'rules' as const })),
  ].filter((i) => (seen.has(i.handle) ? false : (seen.add(i.handle), true)));

  const checks = await checkMany(merged.map((m) => m.handle), platforms);

  const results = merged.map((m) => {
    const per = platforms.map((p) => checks.find((c) => c.handle === m.handle && c.platform === p)!);
    return {
      ...m,
      platforms: Object.fromEntries(per.map((c) => [c.platform, { verdict: c.verdict, note: c.note, url: c.url }])),
      // Ranking signal only: nothing we could check came back taken.
      noneTaken: per.every((c) => c.verdict !== 'taken'),
    };
  });

  results.sort((a, b) => Number(b.noneTaken) - Number(a.noneTaken));

  const emails = emailIdeas(brand, primaryHandle).map((local) => emailSuggestion(local));

  return NextResponse.json({ provider: used, aiError, results, emails });
}
