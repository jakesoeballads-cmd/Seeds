const crypto = require('crypto');
const config = require('../config');
const { supabaseAdmin } = require('../config/supabase');
const midtrans = require('./midtrans');
const paypal = require('./paypal');

const PAYPAL_LOCALES = { id: 'id-ID', en: 'en-US', de: 'de-DE' };

const MIN_BENIH = 1;
const MAX_BENIH = 100000;

function parseBenihAmount(value) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < MIN_BENIH || amount > MAX_BENIH) {
    throw Object.assign(new Error('Jumlah Benih harus bilangan bulat {min}-{max}.'), {
      status: 400,
      vars: { min: MIN_BENIH, max: MAX_BENIH },
    });
  }
  return amount;
}

function newOrderId() {
  return `BENIH-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

// Membuat transaksi pending di database lalu meminta token Snap ke Midtrans,
// atau order ke PayPal bila method === 'paypal'.
async function createPurchase(user, benihAmountInput, method = 'midtrans', lang = 'id') {
  const benihAmount = parseBenihAmount(benihAmountInput);
  if (method === 'paypal') return createPaypalPurchase(user, benihAmount, lang);
  const unitPrice = config.benihPriceIdr;
  const grossAmount = benihAmount * unitPrice;
  const orderId = newOrderId();

  const { error: insertError } = await supabaseAdmin.from('transactions').insert({
    order_id: orderId,
    user_id: user.id,
    benih_amount: benihAmount,
    gross_amount: grossAmount,
    status: 'pending',
    provider: config.midtrans.simulated ? 'simulation' : 'midtrans',
  });
  if (insertError) throw insertError;

  let snap;
  try {
    snap = await midtrans.createSnapTransaction({
      orderId,
      grossAmount,
      itemName: `${benihAmount} Benih`,
      quantity: benihAmount,
      unitPrice,
      customer: { email: user.email },
    });
  } catch (err) {
    await supabaseAdmin.from('transactions').update({ status: 'failed' }).eq('order_id', orderId);
    throw err;
  }

  await supabaseAdmin
    .from('transactions')
    .update({ snap_token: snap.token, redirect_url: snap.redirect_url })
    .eq('order_id', orderId);

  return { orderId, benihAmount, grossAmount, ...snap };
}

async function createPaypalPurchase(user, benihAmount, lang) {
  const grossAmount = benihAmount * config.benihPriceIdr;
  const orderId = newOrderId();
  const amount = paypal.convertFromIdr(grossAmount);
  const simulated = config.paypal.simulated;

  const { error: insertError } = await supabaseAdmin.from('transactions').insert({
    order_id: orderId,
    user_id: user.id,
    benih_amount: benihAmount,
    gross_amount: grossAmount,
    status: 'pending',
    provider: simulated ? 'paypal_simulation' : 'paypal',
    currency: config.paypal.currency,
    provider_amount: amount,
  });
  if (insertError) throw insertError;

  if (simulated) {
    const redirectUrl = `${config.appUrl}/benih/simulasi/${encodeURIComponent(orderId)}`;
    return { orderId, benihAmount, grossAmount, currency: config.paypal.currency, amount, redirect_url: redirectUrl, simulated: true };
  }

  let order;
  try {
    const q = `order_id=${encodeURIComponent(orderId)}`;
    order = await paypal.createOrder({
      orderId,
      amount,
      description: `${benihAmount} Benih`,
      returnUrl: `${config.appUrl}/benih/paypal/kembali?${q}`,
      cancelUrl: `${config.appUrl}/benih/paypal/batal?${q}`,
      locale: PAYPAL_LOCALES[lang] || 'en-US',
    });
  } catch (err) {
    await supabaseAdmin.from('transactions').update({ status: 'failed' }).eq('order_id', orderId);
    throw err;
  }
  await supabaseAdmin
    .from('transactions')
    .update({ provider_order_id: order.id, redirect_url: order.approveUrl })
    .eq('order_id', orderId);
  return { orderId, benihAmount, grossAmount, currency: config.paypal.currency, amount, redirect_url: order.approveUrl, simulated: false };
}

// Pembeli kembali dari PayPal: capture order lalu catat hasilnya. Hanya
// transaksi milik pengguna ini, dan token PayPal harus sama dengan order kita.
async function completePaypalPurchase(user, orderId, paypalToken) {
  const { data: trx, error } = await supabaseAdmin
    .from('transactions')
    .select('order_id, user_id, provider, provider_order_id, currency, provider_amount, status')
    .eq('order_id', orderId)
    .maybeSingle();
  if (error) throw error;
  if (!trx || trx.user_id !== user.id || trx.provider !== 'paypal') {
    throw Object.assign(new Error('Transaksi tidak ditemukan.'), { status: 404 });
  }
  if (trx.status !== 'pending') return trx.status;
  if (!paypalToken || paypalToken !== trx.provider_order_id) {
    throw Object.assign(new Error('Transaksi tidak ditemukan.'), { status: 404 });
  }

  const capture = await paypal.captureOrder(trx.provider_order_id);
  let status = 'pending';
  if (paypal.isPaid(capture, trx)) status = 'success';
  else if (['DECLINED', 'FAILED'].includes(capture.captureStatus) || capture.status === 'VOIDED') status = 'failed';
  if (status === 'pending') return status;

  const { error: rpcError } = await supabaseAdmin.rpc('settle_transaction', {
    p_order_id: trx.order_id,
    p_status: status,
    p_payment_type: 'paypal',
    p_raw: capture.raw,
  });
  if (rpcError) throw rpcError;
  return status;
}

async function cancelPaypalPurchase(user, orderId) {
  const { data: trx, error } = await supabaseAdmin
    .from('transactions')
    .select('order_id, user_id, provider, status')
    .eq('order_id', orderId)
    .maybeSingle();
  if (error) throw error;
  if (!trx || trx.user_id !== user.id || trx.provider !== 'paypal' || trx.status !== 'pending') return;
  const { error: rpcError } = await supabaseAdmin.rpc('settle_transaction', {
    p_order_id: trx.order_id,
    p_status: 'failed',
    p_payment_type: 'paypal',
    p_raw: { cancelled_by_buyer: true },
  });
  if (rpcError) throw rpcError;
}

// Mencatat hasil pembayaran. Penambahan saldo dilakukan oleh fungsi SQL
// settle_transaction secara atomik dan idempoten, jadi notifikasi ganda dari
// Midtrans tidak menambah saldo dua kali.
async function applyNotification(notification) {
  const { data: trx, error } = await supabaseAdmin
    .from('transactions')
    .select('order_id, gross_amount')
    .eq('order_id', notification.order_id)
    .maybeSingle();
  if (error) throw error;
  if (!trx) throw Object.assign(new Error('Transaksi tidak ditemukan.'), { status: 404 });

  if (Number(notification.gross_amount) !== Number(trx.gross_amount)) {
    throw Object.assign(new Error('Nominal pembayaran tidak cocok.'), { status: 400 });
  }

  const status = midtrans.mapStatus(notification);
  const { data, error: rpcError } = await supabaseAdmin.rpc('settle_transaction', {
    p_order_id: notification.order_id,
    p_status: status,
    p_payment_type: notification.payment_type || null,
    p_raw: notification,
  });
  if (rpcError) throw rpcError;
  return { orderId: notification.order_id, status, transaction: data };
}

module.exports = { createPurchase, applyNotification, parseBenihAmount, completePaypalPurchase, cancelPaypalPurchase };
