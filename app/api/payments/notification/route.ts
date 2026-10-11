import { NextResponse } from 'next/server';
import { midtransConfig } from '@/lib/payments/config';
import { verifySignature, type MidtransNotification } from '@/lib/payments/midtrans';
import { PayError, applyMidtransNotification } from '@/lib/payments/purchase';

export const dynamic = 'force-dynamic';

/**
 * Webhook (HTTP Notification) dari Midtrans. Atur di Dashboard Midtrans →
 * Settings → Payment → Notification URL: https://<domain>/api/payments/notification
 * Saldo ditambah oleh settle_transaction secara idempoten, jadi notifikasi ganda aman.
 */
export async function POST(req: Request) {
  if (!midtransConfig.serverKey) return NextResponse.json({ error: 'disabled' }, { status: 403 });
  const n = (await req.json().catch(() => null)) as MidtransNotification | null;
  if (!n || typeof n !== 'object') return NextResponse.json({ error: 'bad request' }, { status: 400 });
  if (!verifySignature(n)) return NextResponse.json({ error: 'invalid signature' }, { status: 403 });
  try {
    const r = await applyMidtransNotification(n);
    console.log(`[midtrans] ${r.orderId} -> ${r.status}`);
    // Midtrans hanya butuh HTTP 200; selain itu notifikasi dikirim ulang.
    return NextResponse.json({ ok: true, status: r.status });
  } catch (err) {
    if (err instanceof PayError) return NextResponse.json({ error: err.key }, { status: err.status });
    console.error('[midtrans] notifikasi gagal:', err);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
