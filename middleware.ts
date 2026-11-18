import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, authToken } from './lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Set while a signed-in person is looking at the Prototype on purpose. */
const VIEW_COOKIE = 'c127_view';

/**
 * Two ways in:
 *  - a personal sign-in (Supabase), which opens the Live tool (/live) and the Prototype
 *  - the shared demo password, which opens only the Prototype: invented sample data
 *    kept in the browser. It never opens the Live tool.
 *
 * Someone with a personal sign-in always lands in the Live tool. That matters for
 * people who were signed in before the Live tool existed: the site's front page
 * is the Prototype, so without this they would open the site and still see the
 * old screens. They reach the Prototype only by choosing it in the sidebar.
 */
export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  if (pathname.startsWith('/api/login') || pathname.startsWith('/api/logout')) return NextResponse.next();
  const liveTool = pathname === '/live' || pathname.startsWith('/live/');
  const onLogin = pathname.startsWith('/login');

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
    if (data.user) {
      const toLive = () => {
        const url = req.nextUrl.clone();
        url.pathname = '/live';
        url.search = '';
        const redirect = NextResponse.redirect(url);
        // Keep any refreshed session cookies on the way.
        res.cookies.getAll().forEach((c) => redirect.cookies.set(c));
        return redirect;
      };
      if (liveTool) {
        res.cookies.delete(VIEW_COOKIE);
        return res;
      }
      if (onLogin) return toLive();
      // The sidebar's Prototype switch links to /?view=prototype. The choice lasts while they keep using it.
      const chosePrototype = searchParams.get('view') === 'prototype' || req.cookies.get(VIEW_COOKIE)?.value === 'prototype';
      if (!chosePrototype) return toLive();
      res.cookies.set(VIEW_COOKIE, 'prototype', { path: '/', sameSite: 'lax', maxAge: 60 * 60 });
      return res;
    }
  }

  if (onLogin) return NextResponse.next();
  const demo = req.cookies.get(AUTH_COOKIE)?.value;
  if (!liveTool && demo && demo === (await authToken())) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|brand/).*)'],
};
