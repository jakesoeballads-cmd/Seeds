import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './config';

/** Klien Supabase untuk Server Component, Server Action, dan Route Handler. Null di mode contoh. */
export async function createClient() {
  if (!isSupabaseConfigured) return null;
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Dipanggil dari Server Component: sesi diperbarui oleh middleware.
        }
      },
    },
  });
}

export async function getUser() {
  const supabase = await createClient();
  if (!supabase) return { supabase, user: null };
  try {
    const { data } = await supabase.auth.getUser();
    return { supabase, user: data.user };
  } catch (err) {
    console.error('[benih] Gagal membaca sesi Supabase:', err);
    return { supabase, user: null };
  }
}
