export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
export const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

function validUrl(u: string) {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' || x.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Variabel Supabase diisi tapi formatnya salah (mis. URL tanpa https://). */
export const supabaseConfigInvalid = Boolean((SUPABASE_URL || SUPABASE_ANON_KEY) && !(validUrl(SUPABASE_URL) && SUPABASE_ANON_KEY));

/** Tanpa variabel Supabase yang valid, aplikasi berjalan dalam mode contoh (data contoh, tanpa login). */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && validUrl(SUPABASE_URL));

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/$/, '');
