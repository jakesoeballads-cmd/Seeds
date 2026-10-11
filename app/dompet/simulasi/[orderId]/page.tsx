import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { SimulatePay } from '@/components/SimulatePay';
import { getI18n } from '@/lib/i18n-server';
import { PAYMENT_SIMULATION } from '@/lib/payments/config';
import { getUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Benih' };
export const dynamic = 'force-dynamic';

/** Halaman simulasi pembayaran. Hanya ada bila PAYMENT_SIMULATION=true. */
export default async function SimulatePage({ params }: { params: Promise<{ orderId: string }> }) {
  if (!PAYMENT_SIMULATION) notFound();
  const { orderId } = await params;
  const { t } = await getI18n();
  const { user } = await getUser();
  if (!user) redirect(`/masuk?next=${encodeURIComponent('/dompet/simulasi/' + orderId)}`);
  return (
    <section className="card narrow stack tight">
      <h1>{t('pay.simTitle')}</h1>
      <p>
        {t('pay.order')}: <code>{orderId}</code>
      </p>
      <p className="alert info">{t('pay.simText')}</p>
      <SimulatePay orderId={orderId} />
    </section>
  );
}
