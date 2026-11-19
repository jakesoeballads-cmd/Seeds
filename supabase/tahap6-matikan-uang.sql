-- Benih tahap 6: matikan fitur uang di database.
-- Jalankan SETELAH semua file tahap sebelumnya: SQL Editor → New query → tempel → Run. Aman dijalankan ulang.
--
-- Pasangan dari saklar NEXT_PUBLIC_ENABLE_PAYMENTS (lib/features.ts). Saklar itu menyembunyikan
-- fitur di aplikasi, tetapi pengguna yang login tetap bisa memanggil fungsi database langsung
-- dengan anon key. File ini menutup jalur itu:
--   • donasi Benih ke kegiatan (donate_benih)
--   • pembayaran tenaga berbayar (pay_participant)
--   • pengajuan tarik saldo (request_withdrawal)
--   • pendaftaran sebagai tenaga berbayar (hanya relawan yang boleh mendaftar)
--
-- Tetap berjalan: notifikasi Midtrans (settle_transaction, service role) agar transaksi yang
-- sempat dibayar tetap tercatat, dan admin tetap bisa memproses penarikan yang sudah diajukan
-- (tabel withdrawals, reject_withdrawal).
--
-- Untuk menyalakan lagi: supabase/aktifkan-uang.sql.

revoke execute on function public.donate_benih(uuid, int, text) from public, anon, authenticated;
revoke execute on function public.pay_participant(uuid) from public, anon, authenticated;
revoke execute on function public.request_withdrawal(int, text, text, text) from public, anon, authenticated;

drop policy if exists "daftar diri sendiri" on public.participants;
create policy "daftar diri sendiri" on public.participants for insert to authenticated with check (
  user_id = auth.uid()
  and agreed_benih is null
  and role = 'volunteer' and status = 'registered'
);
