/**
 * Hanya bagian asal (https://xxxx.supabase.co) yang dipakai. Bila yang ditempel adalah
 * alamat REST (…/rest/v1/), jalurnya dibuang agar tidak menjadi /rest/v1/rest/v1.
 */
function originOnly(raw: string) {
  const v = raw.trim();
  try {
    return new URL(v).origin;
  } catch {
    return v.replace(/\/$/, '');
  }
}

export const SUPABASE_URL = originOnly(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
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

/** Tombol login Google hanya tampil setelah provider Google diaktifkan di Supabase (isi 'true'). */
export const GOOGLE_LOGIN_ENABLED = (process.env.NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN ?? '').trim().toLowerCase() === 'true';
