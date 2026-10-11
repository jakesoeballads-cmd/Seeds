import { NextResponse } from 'next/server';
import { PayError, simulatePurchase } from '@/lib/payments/purchase';
import { getUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Hanya bila PAYMENT_SIMULATION=true. POST { result: 'success' | 'failed' } */
export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { user } = await getUser();
  if (!user) return NextResponse.json({ error: 'err.login' }, { status: 401 });
  const { orderId } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const status = await simulatePurchase(user, orderId, body?.result === 'success');
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    if (err instanceof PayError) return NextResponse.json({ error: err.key }, { status: err.status });
    console.error('[benih] simulasi:', err);
    return NextResponse.json({ error: 'err.payment' }, { status: 500 });
  }
}
