import 'server-only';
import { isAdminConfigured } from '@/lib/supabase/admin';

const env = (k: string) => (process.env[k] ?? '').trim();

/** Mode simulasi hanya aktif bila PAYMENT_SIMULATION=true. Jangan aktifkan di website live. */
export const PAYMENT_SIMULATION = env('PAYMENT_SIMULATION').toLowerCase() === 'true';

export const midtransConfig = {
  serverKey: env('MIDTRANS_SERVER_KEY'),
  clientKey: env('NEXT_PUBLIC_MIDTRANS_CLIENT_KEY'),
  isProduction: env('MIDTRANS_IS_PRODUCTION').toLowerCase() === 'true',
  // QRIS di depan karena paling umum dipakai. Kanal harus aktif di Dashboard Midtrans.
  enabledPayments: ['other_qris', 'gopay', 'shopeepay', 'bca_va', 'bni_va', 'bri_va', 'permata_va', 'echannel', 'other_va', 'credit_card'],
};

export const paypalConfig = {
  mode: env('PAYPAL_MODE') === 'live' ? 'live' : 'sandbox',
  clientId: env('PAYPAL_CLIENT_ID'),
  clientSecret: env('PAYPAL_CLIENT_SECRET'),
  currency: (env('PAYPAL_CURRENCY') || 'USD').toUpperCase(),
  idrRate: Number(env('PAYPAL_IDR_RATE')) > 0 ? Number(env('PAYPAL_IDR_RATE')) : 16000,
};

export type Method = 'midtrans' | 'paypal';
/** live = penyedia asli, simulation = halaman simulasi lokal, off = belum tersedia. */
export type MethodState = 'live' | 'simulation' | 'off';

export function methodState(m: Method): MethodState {
  if (!isAdminConfigured) return 'off';
  const hasKeys = m === 'midtrans' ? !!midtransConfig.serverKey : !!(paypalConfig.clientId && paypalConfig.clientSecret);
  if (hasKeys) return 'live';
  return PAYMENT_SIMULATION ? 'simulation' : 'off';
}
