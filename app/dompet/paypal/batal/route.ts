import { NextResponse } from 'next/server';
import { cancelPaypalPurchase, siteOrigin } from '@/lib/payments/purchase';
import { getUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Pembeli membatalkan di PayPal: transaksi ditandai gagal, saldo tidak berubah. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = siteOrigin(req);
  const orderId = url.searchParams.get('order_id') ?? '';
  const { user } = await getUser();
  if (user) {
    try {
      await cancelPaypalPurchase(user, orderId);
    } catch (err) {
      console.error('[paypal] batal gagal:', err);
    }
  }
  return NextResponse.redirect(`${origin}/dompet/selesai?order_id=${encodeURIComponent(orderId)}&status=cancelled`);
}
