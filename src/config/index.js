require('dotenv').config();

const config = {
  port: Number(process.env.PORT) || 3000,
  env: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL || 'http://localhost:3000',

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
  },

  benihPriceIdr: Number(process.env.BENIH_PRICE_IDR) || 1000,
};

config.isProduction = config.env === 'production';
// Tanpa server key, pembayaran berjalan dalam mode simulasi.
config.midtrans.simulated = !config.midtrans.serverKey;

module.exports = config;
