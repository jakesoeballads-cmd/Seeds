const crypto = require('crypto');
const config = require('../config');
const { supabaseAdmin } = require('../config/supabase');
const midtrans = require('./midtrans');

const MIN_BENIH = 1;
const MAX_BENIH = 100000;

function parseBenihAmount(value) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < MIN_BENIH || amount > MAX_BENIH) {
    throw Object.assign(new Error(`Jumlah Benih harus bilangan bulat ${MIN_BENIH}-${MAX_BENIH}.`), { status: 400 });
  }
  return amount;
}

function newOrderId() {
  return `BENIH-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

// Membuat transaksi pending di database lalu meminta token Snap ke Midtrans.
async function createPurchase(user, benihAmountInput) {
  const benihAmount = parseBenihAmount(benihAmountInput);
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

module.exports = { createPurchase, applyNotification, parseBenihAmount };
