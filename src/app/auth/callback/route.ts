// Google sends the user back here. Exchange the code for a session, then check
// the domain before letting them any further in.

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { emailAllowed } from '@/lib/auth';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=exchange_failed`);

  const { data } = await supabase.auth.getUser();
  if (!emailAllowed(data.user?.email)) {
    // Authenticated with Google, but not one of ours. End the session rather
    // than leaving a valid cookie sitting in their browser.
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/auth/denied`);
  }

  return NextResponse.redirect(`${origin}${next.startsWith('/') ? next : '/'}`);
}
