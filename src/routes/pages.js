const express = require('express');
const config = require('../config');
const { supabaseAdmin, isConfigured } = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  res.render('index', { title: 'Beranda', mapsKey: config.googleMapsApiKey });
});

router.get('/program/baru', requireAuth, (req, res) => {
  res.render('program-new', { title: 'Buat Kegiatan', mapsKey: config.googleMapsApiKey });
});

router.get('/benih', requireAuth, async (req, res, next) => {
  try {
    let balance = 0;
    let earned = 0;
    if (isConfigured) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('benih_balance, benih_earned')
        .eq('id', req.user.id)
        .maybeSingle();
      balance = data ? data.benih_balance : 0;
      earned = data ? data.benih_earned : 0;
    }
    res.render('benih', {
      title: 'Beli Benih',
      balance,
      earned,
      price: config.benihPriceIdr,
      feePercent: config.withdrawalFeeBps / 100,
      feeBps: config.withdrawalFeeBps,
      simulated: config.midtrans.simulated,
      clientKey: config.midtrans.clientKey,
      snapJsUrl: config.midtrans.isProduction
        ? 'https://app.midtrans.com/snap/snap.js'
        : 'https://app.sandbox.midtrans.com/snap/snap.js',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/benih/simulasi/:orderId', requireAuth, (req, res) => {
  if (!config.midtrans.simulated) return res.redirect('/benih');
  res.render('benih-simulate', { title: 'Simulasi Pembayaran', orderId: req.params.orderId });
});

router.get('/benih/selesai', requireAuth, (req, res) => {
  res.render('benih-finish', { title: 'Pembayaran', orderId: req.query.order_id || null });
});

module.exports = router;
