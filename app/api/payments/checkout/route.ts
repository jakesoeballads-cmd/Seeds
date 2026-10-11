import { NextResponse } from 'next/server';
import { getLang } from '@/lib/i18n-server';
import { PayError, createPurchase, siteOrigin } from '@/lib/payments/purchase';
import { getUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** POST { benih_amount, method: 'midtrans' | 'paypal' } → { redirect_url, snap_token? } */
export async function POST(req: Request) {
  const { user } = await getUser();
  if (!user) return NextResponse.json({ error: 'err.login' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const method = body?.method === 'paypal' ? 'paypal' : 'midtrans';
  try {
    const result = await createPurchase(user, body?.benih_amount, method, await getLang(), siteOrigin(req));
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof PayError) return NextResponse.json({ error: err.key }, { status: err.status });
    console.error('[benih] checkout:', err);
    return NextResponse.json({ error: 'err.payment' }, { status: 500 });
  }
}
