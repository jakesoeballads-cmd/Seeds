import 'server-only';
import { paypalConfig } from './config';
import type { CaptureSummary } from './paypal-core';

// PayPal Checkout lewat Orders API v2: server membuat order, pembeli menyetujui di PayPal,
// lalu server meng-capture order saat pembeli kembali.

const api = () => (paypalConfig.mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');

async function accessToken() {
  const auth = Buffer.from(`${paypalConfig.clientId}:${paypalConfig.clientSecret}`).toString('base64');
  const res = await fetch(`${api()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PayPal auth gagal: HTTP ${res.status}`);
  return data.access_token as string;
}

async function call(path: string, body: unknown, requestId: string) {
  const res = await fetch(`${api()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
      // Idempoten: permintaan ulang dengan id yang sama tidak membuat order/capture ganda.
      'PayPal-Request-Id': requestId,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.details?.[0]?.issue || data?.name || `HTTP ${res.status}`;
    throw new Error(`PayPal menolak permintaan: ${detail}`);
  }
  return data;
}

type OrderInput = { orderId: string; amount: string; description: string; returnUrl: string; cancelUrl: string; locale: string };

export async function createOrder(i: OrderInput): Promise<{ id: string; approveUrl: string | undefined }> {
  const data = await call(
    '/v2/checkout/orders',
    {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: i.orderId,
          custom_id: i.orderId,
          description: i.description,
          amount: { currency_code: paypalConfig.currency, value: i.amount },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'Benih',
            locale: i.locale,
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
            return_url: i.returnUrl,
            cancel_url: i.cancelUrl,
          },
        },
      },
    },
    `create-${i.orderId}`,
  );
  const link = (data.links || []).find((l: { rel: string }) => l.rel === 'payer-action' || l.rel === 'approve');
  return { id: data.id, approveUrl: link?.href };
}

/** Capture order yang sudah disetujui. Mengembalikan ringkasan untuk dicocokkan dengan isPaid. */
export async function captureOrder(paypalOrderId: string): Promise<CaptureSummary & { raw: unknown }> {
  const data = await call(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, null, `capture-${paypalOrderId}`);
  const unit = data.purchase_units?.[0] ?? {};
  const capture = unit.payments?.captures?.[0] ?? {};
  return {
    status: data.status,
    captureStatus: capture.status,
    customId: capture.custom_id || unit.custom_id || unit.reference_id,
    currency: capture.amount?.currency_code,
    value: capture.amount?.value,
    raw: data,
  };
}
