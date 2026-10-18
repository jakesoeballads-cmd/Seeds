import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/supabase/config';

/**
 * Tautan dari email Supabase (template memakai {{ .TokenHash }}): verifikasi token, lalu ke `next`.
 * Berbeda dengan /auth/callback, cara ini tetap jalan walau email dibuka di perangkat/browser lain
 * dan tidak bergantung pada daftar Redirect URLs.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const nextParam = url.searchParams.get('next') ?? (type === 'recovery' ? '/atur-password' : '/dashboard');
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/dashboard';
  const origin = SITE_URL || url.origin;

  const supabase = await createClient();
  if (tokenHash && type && supabase) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  // Tautan kedaluwarsa atau sudah dipakai: untuk reset password, halaman itu menawarkan tautan baru.
  return NextResponse.redirect(new URL(type === 'recovery' ? '/atur-password' : '/masuk', origin));
}
