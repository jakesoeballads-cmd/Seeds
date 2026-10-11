-- Tahap 3: panel admin (hapus kegiatan, proses penarikan saldo).
-- Jalankan sekali di Supabase SQL Editor setelah schema.sql, tahap2-sosial.sql, dan tahap2-benih.sql.
-- Aman dijalankan ulang.
--
-- Menjadikan akun kamu admin (ganti emailnya), jalankan sekali setelah file ini:
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'email-kamu@contoh.com'
--   on conflict do nothing;

-- ───────────── Daftar admin ─────────────
create table if not exists public.admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
revoke insert, update, delete on public.admins from anon, authenticated;
drop policy if exists "lihat status admin sendiri" on public.admins;
create policy "lihat status admin sendiri" on public.admins for select to authenticated using (user_id = auth.uid());

-- Apakah pengguna yang sedang masuk adalah admin.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ───────────── Admin melihat semua penarikan ─────────────
drop policy if exists "admin melihat semua penarikan" on public.withdrawals;
create policy "admin melihat semua penarikan" on public.withdrawals for select to authenticated using (public.is_admin());

-- ───────────── Hapus kegiatan ─────────────
-- Mengembalikan daftar URL foto agar server bisa menghapus filenya dari Storage.
-- Pendaftar dan percakapan kegiatan ikut terhapus (on delete cascade); catatan donasi tetap ada.
create or replace function public.admin_delete_activity(p_activity_id uuid)
returns text[] language plpgsql security definer set search_path = public as $$
declare
  v_photos text[];
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang bisa melakukan ini.' using hint = 'admin';
  end if;
  delete from public.activities where id = p_activity_id returning photos into v_photos;
  if not found then
    raise exception 'Kegiatan tidak ditemukan.' using hint = 'notFound';
  end if;
  return coalesce(v_photos, '{}');
end;
$$;

-- ───────────── Proses penarikan ─────────────
-- Tandai sudah ditransfer ke rekening member.
create or replace function public.admin_mark_withdrawal_paid(p_withdrawal_id uuid, p_note text default null)
returns public.withdrawals language plpgsql security definer set search_path = public as $$
declare
  v_row public.withdrawals;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang bisa melakukan ini.' using hint = 'admin';
  end if;
  update public.withdrawals
     set status = 'paid', admin_note = nullif(trim(p_note), ''), processed_at = now()
   where id = p_withdrawal_id and status = 'pending'
  returning * into v_row;
  if not found then
    raise exception 'Penarikan tidak ditemukan atau sudah diproses.' using hint = 'processed';
  end if;
  return v_row;
end;
$$;

-- Tolak penarikan: saldo Benih dikembalikan ke member (memakai reject_withdrawal dari tahap 2).
create or replace function public.admin_reject_withdrawal(p_withdrawal_id uuid, p_note text default null)
returns public.withdrawals language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang bisa melakukan ini.' using hint = 'admin';
  end if;
  if not exists (select 1 from public.withdrawals where id = p_withdrawal_id and status = 'pending') then
    raise exception 'Penarikan tidak ditemukan atau sudah diproses.' using hint = 'processed';
  end if;
  return public.reject_withdrawal(p_withdrawal_id, nullif(trim(p_note), ''));
end;
$$;

revoke execute on function public.admin_delete_activity(uuid) from public, anon;
revoke execute on function public.admin_mark_withdrawal_paid(uuid, text) from public, anon;
revoke execute on function public.admin_reject_withdrawal(uuid, text) from public, anon;
grant execute on function public.admin_delete_activity(uuid) to authenticated;
grant execute on function public.admin_mark_withdrawal_paid(uuid, text) to authenticated;
grant execute on function public.admin_reject_withdrawal(uuid, text) to authenticated;
