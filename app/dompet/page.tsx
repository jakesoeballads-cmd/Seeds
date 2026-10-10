import type { Metadata } from 'next';
import Link from 'next/link';
import { FEE_BPS, PRICE } from '@/lib/constants';
import { getI18n } from '@/lib/i18n-server';

export const metadata: Metadata = { title: 'Benih' };

/** Beli & tarik Benih: diaktifkan di tahap 2 bersama pembayaran Midtrans. */
export default async function WalletPage() {
  const { t, f } = await getI18n();
  return (
    <section className="card narrow stack tight">
      <h1>{t('wallet.title')}</h1>
      <p className="alert info">{t('soon.text')}</p>
      <p className="muted">
        1 Benih = {f.rp(PRICE)} · {t('wd.fee', { pct: f.pct(FEE_BPS) })}
      </p>
      <Link className="btn ghost" href="/dashboard">
        ← {t('nav.dashboard')}
      </Link>
    </section>
  );
}
