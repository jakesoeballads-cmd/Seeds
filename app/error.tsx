'use client';

import { useEffect } from 'react';
import { useI18n } from '@/components/I18nProvider';

/** Halaman cadangan bila terjadi error tak terduga, agar pengguna tidak melihat layar kosong. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="card narrow stack tight empty">
      <h1>🌱</h1>
      <p>{t('err.page')}</p>
      {error.digest && <p className="muted" style={{ fontSize: '.8rem' }}>Kode: {error.digest}</p>}
      <button className="btn" type="button" onClick={reset}>
        {t('err.retry')}
      </button>
    </section>
  );
}
