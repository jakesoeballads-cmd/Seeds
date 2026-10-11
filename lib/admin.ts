import type { SupabaseClient } from '@supabase/supabase-js';

/** Apakah pengguna yang login terdaftar di tabel admins (fungsi SQL is_admin). */
export async function isAdmin(supabase: SupabaseClient | null): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.rpc('is_admin');
    return !error && data === true;
  } catch {
    return false;
  }
}

/** Path file di bucket dari URL publik Supabase Storage (…/object/public/<bucket>/<path>). */
export function storagePath(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i < 0 ? null : decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
}
