import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, authToken } from './lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Two ways in:
 *  - a personal sign-in (Supabase), which opens the live data that person is allowed to see
 *  - the shared demo password, which opens invented sample data kept in the browser
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/login') || pathname.startsWith('/api/login') || pathname.startsWith('/api/logout')) return NextResponse.next();

  if (SUPABASE_URL && SUPABASE_KEY) {
    let res = NextResponse.next({ request: req });
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    });
    // getUser checks the session with Supabase and refreshes it when it is close to expiring.
    const { data } = await supabase.auth.getUser();
    if (data.user) return res;
  }

  const demo = req.cookies.get(AUTH_COOKIE)?.value;
  if (demo && demo === (await authToken())) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icon.png|brand/).*)'],
};
