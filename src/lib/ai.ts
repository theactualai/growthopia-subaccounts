// Two providers for the same job.
//
// Local dev shells out to the `claude` CLI so it runs on Alex's Claude
// subscription with no API key. Anything with ANTHROPIC_API_KEY set - Vercel
// included - uses the SDK. Vercel has no CLI, so the key is required there.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export type Provider = 'api' | 'cli' | 'none';

export function provider(): Provider {
  if (process.env.ANTHROPIC_API_KEY) return 'api';
  if (process.env.VERCEL) return 'none';
  return 'cli';
}

const SCHEMA = {
  type: 'object',
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          handle: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['handle', 'why'],
        additionalProperties: false,
      },
    },
  },
  required: ['ideas'],
  additionalProperties: false,
} as const;

export type AiIdea = { handle: string; why: string };

function buildPrompt(brand: string, primaryHandle: string, about: string, keywords: string[], count: number) {
  return [
    `Suggest ${count} social media handle ideas for a business that is opening additional, openly-branded accounts.`,
    '',
    `Business name: ${brand}`,
    `Existing handle: @${primaryHandle}`,
    about ? `What they do: ${about}` : '',
    keywords.length ? `Service lines, formats or locations to work in: ${keywords.join(', ')}` : '',
    '',
    'Rules:',
    '- Every handle must read as obviously belonging to this business. Someone seeing it should know it is the same company.',
    '- Build on the existing handle or the business name. Add a content format, service line, location or role.',
    '- Do not invent personal names or personas. These are branded business accounts, not people.',
    '- Lowercase. Letters, numbers, dots and underscores only. 3 to 30 characters.',
    '- No consecutive dots. Do not start or end with a dot or underscore.',
    '- Vary the shape: some short, some descriptive, some with separators, some without.',
    '',
    'Return JSON only, no prose: {"ideas":[{"handle":"...","why":"one short line"}]}',
  ].filter(Boolean).join('\n');
}

async function viaCli(prompt: string): Promise<AiIdea[]> {
  const { stdout } = await run('claude', ['-p', prompt], {
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
  });
  const match = stdout.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('claude CLI returned no JSON');
  return JSON.parse(match[0]).ideas ?? [];
}

async function viaApi(prompt: string): Promise<AiIdea[]> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();
  const res = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 4000,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: prompt }],
  } as any);
  const text = res.content.find((b: any) => b.type === 'text') as any;
  return JSON.parse(text?.text ?? '{"ideas":[]}').ideas ?? [];
}

export async function generateIdeas(
  brand: string,
  primaryHandle: string,
  about: string,
  keywords: string[],
  count = 20,
): Promise<{ ideas: AiIdea[]; provider: Provider }> {
  const p = provider();
  const prompt = buildPrompt(brand, primaryHandle, about, keywords, count);
  if (p === 'none') throw new Error('Set ANTHROPIC_API_KEY - the claude CLI is not available in this environment');
  const ideas = p === 'api' ? await viaApi(prompt) : await viaCli(prompt);
  return { ideas, provider: p };
}
