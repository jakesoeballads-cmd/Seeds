import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/supabase/config';
import { RECOVERY_COOKIE } from '@/lib/constants';

/**
 * Bila Redirect URL di Supabase belum mengizinkan /auth/callback, tautan email jatuh ke Site URL
 * (beranda) dengan ?code=… atau ?error_code=…. Teruskan ke tempat yang benar.
 */
function strayAuthRedirect(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname.startsWith('/auth/')) return null;
  const recovery = request.cookies.has(RECOVERY_COOKIE);
  const code = searchParams.get('code');
  if (code) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/callback';
    url.search = '';
    url.searchParams.set('code', code);
    url.searchParams.set('next', recovery ? '/atur-password' : '/dashboard');
    return NextResponse.redirect(url);
  }
  if (recovery && searchParams.has('error_code') && pathname !== '/atur-password') {
    const url = request.nextUrl.clone();
    url.pathname = '/atur-password';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return null;
}

/** Memperbarui sesi login Supabase di setiap permintaan. */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured) return response;
  const stray = strayAuthRedirect(request);
  if (stray) return stray;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  try {
    await supabase.auth.getUser();
  } catch (err) {
    console.error('[benih] middleware: sesi Supabase gagal diperbarui', err);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
