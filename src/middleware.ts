// Every route is private except the login flow itself.
//
// This runs before any page renders, so an unauthenticated request never reaches
// a component that could leak data. It also refreshes the Supabase session
// cookie, which Server Components cannot do themselves.

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { emailAllowed } from '@/lib/auth';

const PUBLIC = ['/login', '/auth/callback', '/auth/denied'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // getUser, not getSession: this revalidates against Supabase rather than
  // trusting a cookie the browser handed us.
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email ?? null;
  const path = request.nextUrl.pathname;

  if (PUBLIC.some((p) => path.startsWith(p))) return response;

  if (!data.user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  if (!emailAllowed(email)) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/denied';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Everything except Next internals and static files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
