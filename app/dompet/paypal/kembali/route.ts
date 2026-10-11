import { NextResponse } from 'next/server';
import { PayError, completePaypalPurchase, siteOrigin } from '@/lib/payments/purchase';
import { getUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Kembali dari PayPal setelah pembeli menyetujui (?order_id=…&token=<id order PayPal>). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = siteOrigin(req);
  const orderId = url.searchParams.get('order_id') ?? '';
  const { user } = await getUser();
  if (!user) return NextResponse.redirect(`${origin}/masuk?next=${encodeURIComponent('/dompet/paypal/kembali' + url.search)}`);
  let status = 'pending';
  try {
    status = await completePaypalPurchase(user, orderId, url.searchParams.get('token') ?? '');
  } catch (err) {
    if (!(err instanceof PayError)) console.error('[paypal] capture gagal:', err);
    status = err instanceof PayError && err.status === 404 ? 'notfound' : 'pending';
  }
  return NextResponse.redirect(`${origin}/dompet/selesai?order_id=${encodeURIComponent(orderId)}&status=${status}`);
}
