const crypto = require('crypto');
const config = require('../config');

const SNAP_URL = config.midtrans.isProduction
  ? 'https://app.midtrans.com/snap/v1/transactions'
  : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

function authHeader() {
  return 'Basic ' + Buffer.from(`${config.midtrans.serverKey}:`).toString('base64');
}

// Membuat transaksi Snap. Dalam mode simulasi (tanpa server key) tidak ada
// request ke Midtrans; pengguna diarahkan ke halaman simulasi lokal.
async function createSnapTransaction({ orderId, grossAmount, itemName, quantity, unitPrice, customer }) {
  if (config.midtrans.simulated) {
    return {
      token: `SIMULATED-${orderId}`,
      redirect_url: `${config.appUrl}/benih/simulasi/${encodeURIComponent(orderId)}`,
      simulated: true,
    };
  }

  const body = {
    transaction_details: { order_id: orderId, gross_amount: grossAmount },
    item_details: [{ id: 'BENIH', name: itemName, price: unitPrice, quantity }],
    customer_details: customer,
    callbacks: { finish: `${config.appUrl}/benih/selesai` },
  };

  const response = await fetch(SNAP_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data.error_messages || []).join('; ') || `HTTP ${response.status}`;
    throw new Error(`Midtrans menolak transaksi: ${message}`);
  }
  return { token: data.token, redirect_url: data.redirect_url, simulated: false };
}

// signature_key = SHA512(order_id + status_code + gross_amount + server_key)
function computeSignature({ order_id, status_code, gross_amount }, serverKey = config.midtrans.serverKey) {
  return crypto
    .createHash('sha512')
    .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
    .digest('hex');
}

function verifySignature(notification, serverKey = config.midtrans.serverKey) {
  if (!serverKey || typeof notification.signature_key !== 'string') return false;
  const expected = Buffer.from(computeSignature(notification, serverKey));
  const received = Buffer.from(notification.signature_key);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

// Memetakan status Midtrans ke status internal: pending | success | failed | refunded.
function mapStatus({ transaction_status, fraud_status }) {
  switch (transaction_status) {
    case 'capture':
      return fraud_status === 'accept' ? 'success' : 'pending';
    case 'settlement':
      return 'success';
    case 'pending':
      return 'pending';
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

module.exports = { createSnapTransaction, computeSignature, verifySignature, mapStatus };
