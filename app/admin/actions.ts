'use server';

import { revalidatePath } from 'next/cache';
import { storagePath } from '@/lib/admin';
import { PHOTO_BUCKET } from '@/lib/constants';
import { getI18n } from '@/lib/i18n-server';
import { rpcErrorText } from '@/lib/rpc-errors';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUser } from '@/lib/supabase/server';

/**
 * Admin menghapus kegiatan. Pengecekan admin dilakukan di fungsi SQL (memakai sesi pengguna),
 * lalu foto-fotonya dihapus dari Storage dengan service role.
 */
export async function deleteActivity(id: string): Promise<{ ok: boolean; error?: string; photosLeft?: number }> {
  const { t } = await getI18n();
  const { supabase, user } = await getUser();
  if (!supabase || !user) return { ok: false, error: t('err.login') };

  const { data, error } = await supabase.rpc('admin_delete_activity', { p_activity_id: id });
  if (error) return { ok: false, error: rpcErrorText(t, error) };

  const paths = ((data ?? []) as string[]).map((u) => storagePath(u, PHOTO_BUCKET)).filter((p): p is string => !!p);
  let photosLeft = 0;
  if (paths.length) {
    const admin = createAdminClient();
    const res = admin ? await admin.storage.from(PHOTO_BUCKET).remove(paths) : null;
    if (!res || res.error) {
      photosLeft = paths.length;
      console.error('[benih] Foto kegiatan tidak terhapus:', res?.error ?? 'SUPABASE_SERVICE_ROLE_KEY kosong');
    }
  }
  revalidatePath('/');
  revalidatePath('/admin');
  return { ok: true, photosLeft };
}
