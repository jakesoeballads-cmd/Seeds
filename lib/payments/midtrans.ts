import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { midtransConfig } from './config';

const snapUrl = () =>
  midtransConfig.isProduction ? 'https://app.midtrans.com/snap/v1/transactions' : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

export const snapJsUrl = () =>
  midtransConfig.isProduction ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js';

type SnapInput = {
  orderId: string;
  grossAmount: number;
  benihAmount: number;
  unitPrice: number;
  email?: string;
  finishUrl: string;
};

/** Membuat transaksi Snap. Mengembalikan token (untuk popup) dan redirect_url. */
export async function createSnapTransaction(i: SnapInput): Promise<{ token: string; redirect_url: string }> {
  const res = await fetch(snapUrl(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${midtransConfig.serverKey}:`).toString('base64'),
    },
    body: JSON.stringify({
      transaction_details: { order_id: i.orderId, gross_amount: i.grossAmount },
      item_details: [{ id: 'BENIH', name: `${i.benihAmount} Benih`, price: i.unitPrice, quantity: i.benihAmount }],
      enabled_payments: midtransConfig.enabledPayments,
      customer_details: i.email ? { email: i.email } : undefined,
      callbacks: { finish: i.finishUrl },
    }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data.error_messages || []).join('; ') || `HTTP ${res.status}`;
    throw new Error(`Midtrans menolak transaksi: ${message}`);
  }
  return { token: data.token, redirect_url: data.redirect_url };
}

export type MidtransNotification = {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
  payment_type?: string;
};

/** signature_key = SHA512(order_id + status_code + gross_amount + server_key) */
export function verifySignature(n: MidtransNotification, serverKey = midtransConfig.serverKey): boolean {
  if (!serverKey || typeof n.signature_key !== 'string') return false;
  const expected = Buffer.from(
    createHash('sha512').update(`${n.order_id ?? ''}${n.status_code ?? ''}${n.gross_amount ?? ''}${serverKey}`).digest('hex'),
  );
  const received = Buffer.from(n.signature_key);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** Status Midtrans → status internal: pending | success | failed | refunded. */
export function mapStatus({ transaction_status, fraud_status }: MidtransNotification) {
  switch (transaction_status) {
    case 'capture':
      return fraud_status === 'accept' ? 'success' : 'pending';
    case 'settlement':
      return 'success';
    case 'deny':
    case 'cancel':
    case 'expire':
    case 'failure':
      return 'failed';
    case 'refund':
    case 'partial_refund':
      return 'refunded';
    default:
      return 'pending';
  }
}
