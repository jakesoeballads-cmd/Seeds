import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, isSupabaseConfigured } from './config';

const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();

/** Kunci service role terisi (dan Supabase terhubung). Hanya dibaca di server. */
export const isAdminConfigured = Boolean(isSupabaseConfigured && SERVICE_ROLE_KEY);

let admin: SupabaseClient | null = null;

/**
 * Klien Supabase dengan service role: melewati RLS. HANYA untuk membuat transaksi pembelian
 * dan mencatat hasil pembayaran (settle_transaction). Jangan pernah diimpor dari komponen client.
 */
export function createAdminClient() {
  if (!isAdminConfigured) return null;
  admin ??= createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return admin;
}
