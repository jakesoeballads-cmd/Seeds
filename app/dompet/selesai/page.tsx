import type { Metadata } from 'next';
import Link from 'next/link';
import { getI18n } from '@/lib/i18n-server';
import { getUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Benih' };
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ order_id?: string; status?: string }> };

/** Hasil pembayaran. Status diambil dari database (bukan dari URL) bila transaksi ditemukan. */
export default async function FinishPage({ searchParams }: Props) {
  const { t } = await getI18n();
  const q = await searchParams;
  const orderId = typeof q.order_id === 'string' ? q.order_id.slice(0, 80) : '';
  let status = q.status === 'cancelled' ? 'failed' : 'pending';
  const { supabase, user } = await getUser();
  if (supabase && user && orderId) {
    const { data } = await supabase.from('transactions').select('status').eq('order_id', orderId).eq('user_id', user.id).maybeSingle();
    if (data?.status) status = data.status;
  }

  return (
    <section className="card narrow stack tight">
      {status === 'success' ? (
        <>
          <h1>{t('fin.thanks')}</h1>
          <p className="alert success">{t('fin.success')}</p>
        </>
      ) : status === 'failed' ? (
        <>
          <h1>{t('fin.cancelTitle')}</h1>
          <p>{t('fin.failed')}</p>
        </>
      ) : (
        <>
          <h1>{t('fin.thanks')}</h1>
          <p>{t('fin.pending')}</p>
          {orderId && (
            <p className="muted">
              {t('pay.order')}: <code>{orderId}</code>
            </p>
          )}
        </>
      )}
      <Link className="btn" href="/dompet">
        {t('fin.back')}
      </Link>
    </section>
  );
}
