import { supabaseServer } from './server';
import { emailAllowed, isAdmin, type SessionUser } from '@/lib/auth';

/** The signed-in user, or null. Returns null for anyone off-domain. */
export async function currentUser(): Promise<SessionUser | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const email = data.user.email ?? null;
  if (!emailAllowed(email)) return null;
  return {
    email: email!,
    name: data.user.user_metadata?.full_name,
    avatar: data.user.user_metadata?.avatar_url,
    admin: isAdmin(email),
  };
}
