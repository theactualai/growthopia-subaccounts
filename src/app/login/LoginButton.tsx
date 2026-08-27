'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function LoginButton({ next }: { next?: string }) {
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    const supabase = supabaseBrowser();
    const redirect = new URL('/auth/callback', window.location.origin);
    if (next) redirect.searchParams.set('next', next);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirect.toString(),
        // Ask Google to show the account chooser rather than silently reusing
        // whichever account the browser last used.
        queryParams: { prompt: 'select_account' },
      },
    });
  }

  return (
    <button onClick={signIn} disabled={busy} style={{ padding: '10px 18px', fontSize: 15 }}>
      {busy ? 'Redirecting…' : 'Sign in with Google'}
    </button>
  );
}
