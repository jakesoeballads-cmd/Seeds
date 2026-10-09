const express = require('express');
const config = require('../config');
const { supabaseAdmin } = require('../config/supabase');
const { requireAuth, requireDatabase } = require('../middleware/auth');
const { parseBenihAmount } = require('../services/benih');
const { calcWithdrawal } = require('../services/wallet');

const router = express.Router();
router.use(requireDatabase, requireAuth);

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

// GET /api/wallet  Saldo Benih (untuk donasi) dan hasil donasi (bisa ditarik).
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('benih_balance, benih_earned')
      .eq('id', req.user.id)
      .maybeSingle();
    if (error) throw error;
    res.json({
      benih_balance: data ? data.benih_balance : 0,
      benih_earned: data ? data.benih_earned : 0,
      price_idr: config.benihPriceIdr,
      withdrawal_fee_percent: config.withdrawalFeeBps / 100,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/wallet/withdrawals
// { "benih_amount": 100, "bank_name": "BCA", "bank_account_number": "123", "bank_account_name": "Nama" }
// Menarik Benih hasil donasi ke rekening, dipotong biaya pengembangan platform.
router.post('/withdrawals', async (req, res, next) => {
  try {
    const amount = parseBenihAmount(req.body.benih_amount);
    const bankName = String(req.body.bank_name || '').trim();
    const accountNumber = String(req.body.bank_account_number || '').replace(/\s+/g, '');
    const accountName = String(req.body.bank_account_name || '').trim();
    if (!bankName || !accountName || !/^\d{5,20}$/.test(accountNumber)) {
      throw badRequest('Lengkapi nama bank, nomor rekening (angka), dan nama pemilik rekening.');
    }

    const { data, error } = await supabaseAdmin.rpc('request_withdrawal', {
      p_user_id: req.user.id,
      p_amount: amount,
      p_price_idr: config.benihPriceIdr,
      p_fee_bps: config.withdrawalFeeBps,
      p_bank_name: bankName,
      p_bank_account_number: accountNumber,
      p_bank_account_name: accountName,
    });
    if (error) {
      if (error.code === 'P0001') throw badRequest(error.message);
      throw error;
    }
    res.status(201).json({ withdrawal: data });
  } catch (err) {
    next(err);
  }
});

// GET /api/wallet/withdrawals  Riwayat penarikan.
router.get('/withdrawals', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('withdrawals')
      .select('id, benih_amount, gross_idr, fee_idr, net_idr, bank_name, status, created_at, processed_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ withdrawals: data });
  } catch (err) {
    next(err);
  }
});

// GET /api/wallet/withdrawals/preview?benih_amount=100  Rincian potongan.
router.get('/withdrawals/preview', (req, res, next) => {
  try {
    const amount = parseBenihAmount(req.query.benih_amount);
    res.json({ benih_amount: amount, fee_percent: config.withdrawalFeeBps / 100, ...calcWithdrawal(amount) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
