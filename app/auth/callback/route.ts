import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/supabase/config';
import { RECOVERY_COOKIE } from '@/lib/constants';

/** Tujuan kembali setelah login Google atau konfirmasi email. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next') ?? '/dashboard';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/dashboard';

  // Di balik proxy hosting, request.url bisa berisi alamat internal; pakai SITE_URL bila ada.
  const origin = SITE_URL || url.origin;

  const supabase = await createClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const res = NextResponse.redirect(new URL(next, origin));
      if (next === '/atur-password') res.cookies.delete(RECOVERY_COOKIE);
      return res;
    }
  }
  return NextResponse.redirect(new URL(next === '/atur-password' ? '/atur-password' : '/masuk', origin));
}
