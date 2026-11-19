-- Menyalakan lagi fitur uang Benih di database (kebalikan dari tahap6-matikan-uang.sql).
-- JANGAN dijalankan sebelum ada pendapat hukum tertulis tentang izin uang elektronik/transfer
-- dana (Bank Indonesia), izin Pengumpulan Uang dan Barang, dan perpajakan.
-- Nyalakan juga NEXT_PUBLIC_ENABLE_PAYMENTS=true di Hostinger lalu build ulang, dan perbarui
-- Syarat Penggunaan serta Kebijakan Privasi (lib/legal.ts).

grant execute on function public.donate_benih(uuid, int, text) to authenticated;
grant execute on function public.pay_participant(uuid) to authenticated;
grant execute on function public.request_withdrawal(int, text, text, text) to authenticated;

drop policy if exists "daftar diri sendiri" on public.participants;
create policy "daftar diri sendiri" on public.participants for insert to authenticated with check (
  user_id = auth.uid()
  and agreed_benih is null
  and ((role = 'volunteer' and status = 'registered') or (role = 'paid' and status = 'negotiating'))
);
