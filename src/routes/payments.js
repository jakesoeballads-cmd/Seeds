const express = require('express');
const config = require('../config');
const { supabaseAdmin } = require('../config/supabase');
const { requireAuth, requireDatabase } = require('../middleware/auth');
const midtrans = require('../services/midtrans');
const benih = require('../services/benih');

const router = express.Router();
router.use(requireDatabase);

// POST /api/payments/checkout  { "benih_amount": 50 }
// Membuat transaksi pembelian Benih dan mengembalikan token Snap Midtrans.
router.post('/checkout', requireAuth, async (req, res, next) => {
  try {
    const method = req.body.method === 'paypal' ? 'paypal' : 'midtrans';
    const result = await benih.createPurchase(req.user, req.body.benih_amount, method, req.lang);
    res.status(201).json({
      method,
      currency: result.currency || 'IDR',
      amount: result.amount || String(result.grossAmount),
      order_id: result.orderId,
      benih_amount: result.benihAmount,
      gross_amount: result.grossAmount,
      snap_token: result.token,
      redirect_url: result.redirect_url,
      simulated: result.simulated,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/notification
// Webhook (HTTP Notification) dari Midtrans. Atur URL ini di
// Dashboard Midtrans > Settings > Payment > Notification URL.
router.post('/notification', async (req, res, next) => {
  const notification = req.body || {};
  if (config.midtrans.simulated) {
    return res.status(403).json({ error: req.t('Webhook nonaktif dalam mode simulasi.') });
  }
  if (!midtrans.verifySignature(notification)) {
    return res.status(403).json({ error: req.t('Signature tidak valid.') });
  }

  try {
    const result = await benih.applyNotification(notification);
    console.log(`[midtrans] ${result.orderId} -> ${result.status}`);
    // Midtrans hanya butuh HTTP 200; selain itu notifikasi akan dikirim ulang.
    res.json({ ok: true, status: result.status });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/simulate/:orderId  { "result": "success" | "failed" }
// Hanya tersedia tanpa MIDTRANS_SERVER_KEY. Menjalankan alur webhook yang sama
// agar pencatatan status dan penambahan saldo bisa diuji tanpa Midtrans.
router.post('/simulate/:orderId', requireAuth, async (req, res, next) => {
  try {
    const { data: trx, error } = await supabaseAdmin
      .from('transactions')
      .select('order_id, user_id, gross_amount, provider')
      .eq('order_id', req.params.orderId)
      .maybeSingle();
    if (error) throw error;
    // Hanya transaksi yang memang dibuat dalam mode simulasi (Midtrans atau PayPal).
    if (!trx || trx.user_id !== req.user.id || !['simulation', 'paypal_simulation'].includes(trx.provider)) {
      return res.status(404).json({ error: req.t('Transaksi tidak ditemukan.') });
    }

    const success = req.body.result !== 'failed';
    const result = await benih.applyNotification({
      order_id: trx.order_id,
      gross_amount: String(trx.gross_amount),
      transaction_status: success ? 'settlement' : 'deny',
      payment_type: trx.provider === 'paypal_simulation' ? 'paypal' : 'simulation',
    });
    res.json({ ok: true, status: result.status });
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/history  Riwayat transaksi milik pengguna yang login.
router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('order_id, benih_amount, gross_amount, status, provider, payment_type, currency, provider_amount, created_at, paid_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ transactions: data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
