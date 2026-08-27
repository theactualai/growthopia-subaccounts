'use client';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function SignOut() {
  async function out() {
    await supabaseBrowser().auth.signOut();
    window.location.href = '/login';
  }
  return (
    <button onClick={out} style={{ fontSize: 12, padding: '3px 9px' }}>Sign out</button>
  );
}
