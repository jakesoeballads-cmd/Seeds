import 'server-only';
import { randomBytes } from 'node:crypto';
import { PRICE } from '@/lib/constants';
import type { Lang } from '@/lib/i18n';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE_URL } from '@/lib/supabase/config';
import { PAYMENT_SIMULATION, methodState, paypalConfig, type Method } from './config';
import { createSnapTransaction, mapStatus, type MidtransNotification } from './midtrans';
import { captureOrder, createOrder } from './paypal';
import { convertFromIdr, isPaid } from './paypal-core';

export const MIN_BENIH = 1;
export const MAX_BENIH = 100000;

/** Kesalahan dengan kunci terjemahan (messages/*.json) dan status HTTP. */
export class PayError extends Error {
  constructor(public key: string, public status = 400) {
    super(key);
  }
}

const PAYPAL_LOCALES: Record<Lang, string> = { id: 'id-ID', en: 'en-US', de: 'de-DE' };

export function parseBenihAmount(v: unknown) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < MIN_BENIH || n > MAX_BENIH) throw new PayError('err.amount');
  return n;
}

/** Alamat website untuk tautan kembali dari Midtrans/PayPal. */
export function siteOrigin(req: Request) {
  if (SITE_URL) return SITE_URL;
  const h = req.headers;
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (host) return `${h.get('x-forwarded-proto') ?? 'https'}://${host}`;
  return new URL(req.url).origin;
}

function admin() {
  const a = createAdminClient();
  if (!a) throw new PayError('err.unavailable', 503);
  return a;
}

const newOrderId = () => `BENIH-${Date.now()}-${randomBytes(4).toString('hex')}`;

type User = { id: string; email?: string | null };
export type CheckoutResult = { method: Method; order_id: string; redirect_url: string; snap_token?: string };

/** Membuat transaksi pending lalu meminta halaman pembayaran ke Midtrans/PayPal (atau simulasi). */
export async function createPurchase(user: User, amountInput: unknown, method: Method, lang: Lang, origin: string): Promise<CheckoutResult> {
  const benih = parseBenihAmount(amountInput);
  const state = methodState(method);
  if (state === 'off') throw new PayError('err.unavailable', 503);
  const db = admin();
  const orderId = newOrderId();
  const gross = benih * PRICE;
  const simulated = state === 'simulation';
  const paypal = method === 'paypal';
  const providerAmount = paypal ? convertFromIdr(gross, paypalConfig.idrRate) : null;

  const { error } = await db.from('transactions').insert({
    order_id: orderId,
    user_id: user.id,
    benih_amount: benih,
    gross_amount: gross,
    provider: simulated ? 'simulation' : method,
    currency: paypal ? paypalConfig.currency : 'IDR',
    provider_amount: providerAmount,
  });
  if (error) throw new Error(error.message);

  if (simulated) {
    return { method, order_id: orderId, redirect_url: `${origin}/dompet/simulasi/${encodeURIComponent(orderId)}` };
  }

  const fail = async (err: unknown) => {
    await db.from('transactions').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('order_id', orderId);
    console.error('[benih] checkout gagal:', err);
    return new PayError('err.payment', 502);
  };

  if (paypal) {
    const q = `order_id=${encodeURIComponent(orderId)}`;
    let order;
    try {
      order = await createOrder({
        orderId,
        amount: providerAmount!,
        description: `${benih} Benih`,
        returnUrl: `${origin}/dompet/paypal/kembali?${q}`,
        cancelUrl: `${origin}/dompet/paypal/batal?${q}`,
        locale: PAYPAL_LOCALES[lang] ?? 'en-US',
      });
      if (!order.approveUrl) throw new Error('PayPal tidak mengembalikan tautan persetujuan');
    } catch (err) {
      throw await fail(err);
    }
    await db.from('transactions').update({ provider_order_id: order.id, redirect_url: order.approveUrl }).eq('order_id', orderId);
    return { method, order_id: orderId, redirect_url: order.approveUrl };
  }

  let snap;
  try {
    snap = await createSnapTransaction({
      orderId,
      grossAmount: gross,
      benihAmount: benih,
      unitPrice: PRICE,
      email: user.email ?? undefined,
      finishUrl: `${origin}/dompet/selesai`,
    });
  } catch (err) {
    throw await fail(err);
  }
  await db.from('transactions').update({ snap_token: snap.token, redirect_url: snap.redirect_url }).eq('order_id', orderId);
  return { method, order_id: orderId, redirect_url: snap.redirect_url, snap_token: snap.token };
}

type TrxRow = {
  order_id: string;
  user_id: string;
  provider: string;
  provider_order_id: string | null;
  currency: string;
  provider_amount: string | number | null;
  gross_amount: number;
  status: string;
};
const TRX_COLUMNS = 'order_id, user_id, provider, provider_order_id, currency, provider_amount, gross_amount, status';

async function findTrx(orderId: string) {
  const { data, error } = await admin().from('transactions').select(TRX_COLUMNS).eq('order_id', orderId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as TrxRow | null;
}

async function settle(orderId: string, status: string, paymentType: string | null, raw: unknown) {
  const { error } = await admin().rpc('settle_transaction', {
    p_order_id: orderId,
    p_status: status,
    p_payment_type: paymentType,
    p_raw: raw ?? {},
  });
  if (error) throw new Error(error.message);
}

/** Pembeli kembali dari PayPal: capture order, cocokkan, lalu catat hasilnya. */
export async function completePaypalPurchase(user: User, orderId: string, paypalToken: string) {
  const trx = await findTrx(orderId);
  if (!trx || trx.user_id !== user.id || trx.provider !== 'paypal') throw new PayError('err.notFound', 404);
  if (trx.status !== 'pending') return trx.status;
  if (!paypalToken || paypalToken !== trx.provider_order_id) throw new PayError('err.notFound', 404);

  const capture = await captureOrder(trx.provider_order_id);
  let status = 'pending';
  if (isPaid(capture, trx)) status = 'success';
  else if (['DECLINED', 'FAILED'].includes(capture.captureStatus ?? '') || capture.status === 'VOIDED') status = 'failed';
  if (status !== 'pending') await settle(trx.order_id, status, 'paypal', capture.raw);
  return status;
}

/** Pembeli membatalkan di PayPal. */
export async function cancelPaypalPurchase(user: User, orderId: string) {
  const trx = await findTrx(orderId);
  if (!trx || trx.user_id !== user.id || trx.provider !== 'paypal' || trx.status !== 'pending') return;
  await settle(trx.order_id, 'failed', 'paypal', { cancelled_by_buyer: true });
}

/** Notifikasi Midtrans yang signature-nya sudah diverifikasi. Nominal harus sama persis. */
export async function applyMidtransNotification(n: MidtransNotification) {
  const trx = n.order_id ? await findTrx(n.order_id) : null;
  if (!trx || trx.provider !== 'midtrans') throw new PayError('err.notFound', 404);
  if (Number(n.gross_amount) !== Number(trx.gross_amount)) throw new PayError('err.amountMismatch', 400);
  const status = mapStatus(n);
  await settle(trx.order_id, status, n.payment_type ?? null, n);
  return { orderId: trx.order_id, status };
}

/** Mode simulasi: hasil dipilih pembeli dan dicatat lewat fungsi yang sama. */
export async function simulatePurchase(user: User, orderId: string, success: boolean) {
  if (!PAYMENT_SIMULATION) throw new PayError('err.notFound', 404);
  const trx = await findTrx(orderId);
  if (!trx || trx.user_id !== user.id || trx.provider !== 'simulation') throw new PayError('err.notFound', 404);
  const status = success ? 'success' : 'failed';
  await settle(trx.order_id, status, trx.currency === 'IDR' ? 'simulation' : 'paypal', { simulated: true, result: status });
  return status;
}

