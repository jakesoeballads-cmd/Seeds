// PayPal Checkout lewat Orders API v2: server membuat order, pembeli menyetujui
// di PayPal, lalu server meng-capture order saat pembeli kembali. Saldo Benih
// hanya bertambah setelah capture berstatus COMPLETED dengan nominal yang cocok.
const config = require('../config');

const API = config.paypal.mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

// Rupiah -> mata uang PayPal, dibulatkan ke atas ke sen agar tidak kurang bayar.
function convertFromIdr(idr, rate = config.paypal.idrRate) {
  return (Math.ceil((idr / rate) * 100) / 100).toFixed(2);
}

async function accessToken() {
  const auth = Buffer.from(`${config.paypal.clientId}:${config.paypal.clientSecret}`).toString('base64');
  const res = await fetch(`${API}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PayPal auth gagal: HTTP ${res.status}`);
  return data.access_token;
}

async function call(path, body, requestId) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
      // Idempoten: request ulang dengan id yang sama tidak membuat order/capture ganda.
      'PayPal-Request-Id': requestId,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data.details && data.details[0] && data.details[0].issue) || data.name || `HTTP ${res.status}`;
    throw Object.assign(new Error(`PayPal menolak permintaan: ${detail}`), { paypal: data });
  }
  return data;
}

// Mengembalikan { id, approveUrl }.
async function createOrder({ orderId, amount, description, returnUrl, cancelUrl, locale }) {
  const data = await call(
    '/v2/checkout/orders',
    {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: orderId,
        custom_id: orderId,
        description,
        amount: { currency_code: config.paypal.currency, value: amount },
      }],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'Benih',
            locale,
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        },
      },
    },
    `create-${orderId}`
  );
  const link = (data.links || []).find((l) => l.rel === 'payer-action' || l.rel === 'approve');
  return { id: data.id, approveUrl: link && link.href };
}

// Capture order yang sudah disetujui. Mengembalikan ringkasan untuk dicocokkan.
async function captureOrder(paypalOrderId) {
  const data = await call(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, null, `capture-${paypalOrderId}`);
  const unit = (data.purchase_units || [])[0] || {};
  const capture = ((unit.payments && unit.payments.captures) || [])[0] || {};
  return {
    status: data.status, // COMPLETED bila dana berhasil ditarik
    captureStatus: capture.status,
    customId: capture.custom_id || unit.custom_id || unit.reference_id,
    currency: capture.amount && capture.amount.currency_code,
    value: capture.amount && capture.amount.value,
    raw: data,
  };
}

// Hasil capture dianggap lunas hanya bila semua data cocok dengan transaksi kita.
function isPaid(capture, trx) {
  return (
    capture.status === 'COMPLETED' &&
    capture.captureStatus === 'COMPLETED' &&
    capture.customId === trx.order_id &&
    capture.currency === trx.currency &&
    Number(capture.value) === Number(trx.provider_amount)
  );
}

module.exports = { convertFromIdr, createOrder, captureOrder, isPaid };
