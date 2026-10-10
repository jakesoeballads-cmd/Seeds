require('dotenv').config();

const config = {
  port: Number(process.env.PORT) || 3000,
  env: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  // Zona waktu untuk menampilkan tanggal dan jam kegiatan.
  timeZone: process.env.TIME_ZONE || 'Asia/Jakarta',

  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',

  midtrans: {
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY || '',
    clientKey: process.env.MIDTRANS_CLIENT_KEY || '',
    // Urutan metode di halaman Snap. QRIS di depan karena paling umum dipakai.
    // Kanal harus aktif di Dashboard Midtrans agar tampil.
    enabledPayments: (process.env.MIDTRANS_ENABLED_PAYMENTS ||
      'other_qris,gopay,shopeepay,bca_va,bni_va,bri_va,permata_va,echannel,other_va,credit_card')
      .split(',').map((s) => s.trim()).filter(Boolean),
  },

  // PayPal (Orders API v2). PayPal tidak mendukung Rupiah, jadi tagihan dibuat
  // dalam PAYPAL_CURRENCY dengan kurs tetap PAYPAL_IDR_RATE (Rupiah per 1 unit).
  paypal: {
    mode: process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox',
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    currency: (process.env.PAYPAL_CURRENCY || 'USD').toUpperCase(),
    idrRate: Number(process.env.PAYPAL_IDR_RATE) || 16000,
  },

  benihPriceIdr: Number(process.env.BENIH_PRICE_IDR) || 2000,
  // Potongan penarikan saldo untuk pengembangan platform, dalam basis poin (250 = 2,5%).
  withdrawalFeeBps: Math.round((Number(process.env.WITHDRAWAL_FEE_PERCENT) || 2.5) * 100),
};

config.isProduction = config.env === 'production';
// Tanpa server key, pembayaran berjalan dalam mode simulasi.
config.midtrans.simulated = !config.midtrans.serverKey;
config.paypal.simulated = !config.paypal.clientId || !config.paypal.clientSecret;

module.exports = config;
