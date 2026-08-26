// Returns six digits. Never the secret.
//
// This is the shape the Supabase Edge Function should keep: the secret is read
// server side, the code is computed server side, and only the code crosses the
// wire. Swapping the store for Supabase does not change this contract.

import { NextResponse } from 'next/server';
import { secretFor, accounts } from '@/lib/store';
import { totp } from '@/lib/totp';
import { record } from '@/lib/audit';

export async function POST(req: Request) {
  const { accountId } = await req.json().catch(() => ({ accountId: null }));
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return NextResponse.json({ error: 'unknown account' }, { status: 404 });

  const secret = secretFor(account.id);
  if (!secret) return NextResponse.json({ error: 'no authenticator enrolled' }, { status: 404 });

  const { code, secondsLeft } = totp(secret);
  // Real deployment takes the actor from the Google SSO session, not the client.
  record('alex@growthopia', 'totp.viewed', account.id, `${account.platform} ${account.handle}`);
  return NextResponse.json({ code, secondsLeft });
}
