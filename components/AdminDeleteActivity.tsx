'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { deleteActivity } from '@/app/admin/actions';
import { useI18n } from './I18nProvider';

/** Tombol hapus kegiatan untuk admin. Setelah terhapus, pindah ke `after` atau muat ulang daftar. */
export function AdminDeleteActivity({ id, title, after, demo }: { id: string; title: string; after?: string; demo?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!confirm(t('admin.confirmDelete', { title }))) return;
    if (demo) return setError(t('err.needSupabase'));
    setBusy(true);
    setError(null);
    const res = await deleteActivity(id);
    setBusy(false);
    if (!res.ok) return setError(res.error ?? null);
    if (res.photosLeft) alert(t('admin.photosLeft', { n: res.photosLeft }));
    if (after) router.push(after);
    else router.refresh();
  }

  return (
    <>
      <button className="btn small danger" type="button" onClick={run} disabled={busy}>
        🗑 {busy ? t('admin.deleting') : t('admin.delete')}
      </button>
      {error && <p className="alert error" role="alert">{error}</p>}
    </>
  );
}
