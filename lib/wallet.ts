import type { SupabaseClient } from '@supabase/supabase-js';

export type Wallet = { balance: number; donated: number };

/** Saldo milik pengguna yang login (RLS: hanya pemilik). Dompet dibuat saat pertama dipakai. */
export async function getWallet(supabase: SupabaseClient | null, userId: string): Promise<Wallet> {
  if (!supabase) return { balance: 0, donated: 0 };
  try {
    const { data } = await supabase.from('wallets').select('balance, donated').eq('user_id', userId).maybeSingle();
    return { balance: Number(data?.balance ?? 0), donated: Number(data?.donated ?? 0) };
  } catch (err) {
    console.error('[benih] Gagal memuat saldo:', err);
    return { balance: 0, donated: 0 };
  }
}
