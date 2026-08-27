// Who may sign in, and who is an admin.
//
// Two independent gates. Domain membership decides whether you get in at all;
// the admin list decides what you can see once you are. Google having
// authenticated someone is necessary but never sufficient - a personal Gmail
// authenticates perfectly well and must still be refused.

export const ALLOWED_DOMAIN = process.env.GOOGLE_ALLOWED_DOMAIN ?? 'growthopia.io';

export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'alex@growthopia.io')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function emailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const at = email.lastIndexOf('@');
  if (at === -1) return false;
  // Compare only the part after the final @, so "x@evil.com?@growthopia.io"
  // style addresses cannot slip through a naive endsWith check.
  return email.slice(at + 1).toLowerCase() === ALLOWED_DOMAIN.toLowerCase();
}

export const isAdmin = (email: string | null | undefined): boolean =>
  Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase()));

export type SessionUser = { email: string; name?: string; avatar?: string; admin: boolean };
