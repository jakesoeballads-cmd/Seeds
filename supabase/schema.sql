-- Skema database Benih (tahap 1: akun, kegiatan, peserta, foto).
-- Jalankan sekali di Supabase: SQL Editor → New query → tempel seluruh isi file → Run.
-- Aman dijalankan ulang (memakai "if not exists" / "or replace" / drop policy dulu).

-- ───────────── Profil pengguna ─────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

-- Profil dibuat otomatis saat pengguna mendaftar (email atau Google).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────── Kegiatan ─────────────
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 140),
  category text not null default 'reforest' check (category in ('reforest', 'mangrove', 'beach', 'edu')),
  org_name text not null check (char_length(org_name) between 1 and 140),
  org_type text not null default 'perorangan' check (org_type in ('perorangan', 'komunitas', 'organisasi', 'badan_usaha')),
  description text not null default '' check (char_length(description) <= 4000),
  location_name text not null check (char_length(location_name) between 1 and 200),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  date date not null,
  start_time time not null,
  end_time time not null,
  max_participants int check (max_participants is null or max_participants > 0),
  target_benih int check (target_benih is null or target_benih > 0),
  collected_benih int not null default 0,
  participant_count int not null default 0,
  photos text[] not null default '{}' check (cardinality(photos) <= 5),
  created_at timestamptz not null default now(),
  constraint end_after_start check (end_time > start_time)
);

create index if not exists activities_date_idx on public.activities (date);

-- ───────────── Peserta ─────────────
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  role text not null check (role in ('volunteer', 'paid')),
  status text not null check (status in ('registered', 'attended', 'negotiating', 'agreed', 'paid')),
  agreed_benih int check (agreed_benih is null or agreed_benih > 0),
  created_at timestamptz not null default now(),
  unique (activity_id, user_id)
);

create index if not exists participants_user_idx on public.participants (user_id);

-- Jumlah peserta disimpan di kegiatan agar bisa dibaca publik tanpa membuka data peserta.
-- Juga menolak pendaftaran bila kuota penuh atau bila penyelenggara mendaftar di kegiatannya sendiri.
create or replace function public.participants_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a public.activities%rowtype;
begin
  if tg_op = 'INSERT' then
    select * into a from public.activities where id = new.activity_id for update;
    if a.owner_id = new.user_id then
      raise exception 'Penyelenggara tidak perlu mendaftar di kegiatannya sendiri';
    end if;
    if a.max_participants is not null and a.participant_count >= a.max_participants then
      raise exception 'Kuota peserta sudah penuh';
    end if;
    update public.activities set participant_count = participant_count + 1 where id = new.activity_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.activities set participant_count = greatest(participant_count - 1, 0) where id = old.activity_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists participants_count_trg on public.participants;
create trigger participants_count_trg
  after insert or delete on public.participants
  for each row execute function public.participants_count();

-- Penyelenggara hanya boleh mengubah status & kesepakatan; peserta tidak bisa mengubah status sendiri.
create or replace function public.participants_guard()
returns trigger language plpgsql as $$
begin
  if new.activity_id <> old.activity_id or new.user_id <> old.user_id or new.role <> old.role then
    raise exception 'Kolom ini tidak boleh diubah';
  end if;
  if new.role = 'volunteer' and new.status not in ('registered', 'attended') then
    raise exception 'Status relawan tidak valid';
  end if;
  if new.role = 'paid' and new.status not in ('negotiating', 'agreed', 'paid') then
    raise exception 'Status tenaga berbayar tidak valid';
  end if;
  -- Status "paid" baru boleh diset oleh sistem pembayaran (tahap berikutnya).
  if new.status = 'paid' and old.status <> 'paid' then
    raise exception 'Pembayaran dicatat oleh sistem pembayaran';
  end if;
  return new;
end;
$$;

drop trigger if exists participants_guard_trg on public.participants;
create trigger participants_guard_trg
  before update on public.participants
  for each row execute function public.participants_guard();

-- ───────────── Row Level Security ─────────────
alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.participants enable row level security;

drop policy if exists "profil dapat dibaca" on public.profiles;
create policy "profil dapat dibaca" on public.profiles for select using (true);
drop policy if exists "ubah profil sendiri" on public.profiles;
create policy "ubah profil sendiri" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "kegiatan dapat dibaca" on public.activities;
create policy "kegiatan dapat dibaca" on public.activities for select using (true);
drop policy if exists "buat kegiatan sendiri" on public.activities;
create policy "buat kegiatan sendiri" on public.activities for insert to authenticated
  with check (owner_id = auth.uid() and collected_benih = 0 and participant_count = 0);
drop policy if exists "ubah kegiatan sendiri" on public.activities;
create policy "ubah kegiatan sendiri" on public.activities for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "hapus kegiatan sendiri" on public.activities;
create policy "hapus kegiatan sendiri" on public.activities for delete to authenticated using (owner_id = auth.uid());

-- Penyelenggara tidak boleh mengubah angka Benih terkumpul, jumlah peserta, atau pemilik secara langsung.
-- (Fungsi security definer seperti participants_count berjalan sebagai pemilik tabel, jadi tetap boleh.)
create or replace function public.activities_guard()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.owner_id := old.owner_id;
    new.collected_benih := old.collected_benih;
    new.participant_count := old.participant_count;
  end if;
  return new;
end;
$$;

drop trigger if exists activities_guard_trg on public.activities;
create trigger activities_guard_trg
  before update on public.activities
  for each row execute function public.activities_guard();

drop policy if exists "lihat pendaftaran" on public.participants;
create policy "lihat pendaftaran" on public.participants for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.activities a where a.id = activity_id and a.owner_id = auth.uid())
);
drop policy if exists "daftar diri sendiri" on public.participants;
create policy "daftar diri sendiri" on public.participants for insert to authenticated with check (
  user_id = auth.uid()
  and agreed_benih is null
  and ((role = 'volunteer' and status = 'registered') or (role = 'paid' and status = 'negotiating'))
);
drop policy if exists "penyelenggara kelola peserta" on public.participants;
create policy "penyelenggara kelola peserta" on public.participants for update to authenticated using (
  exists (select 1 from public.activities a where a.id = activity_id and a.owner_id = auth.uid())
);
drop policy if exists "batalkan pendaftaran sendiri" on public.participants;
create policy "batalkan pendaftaran sendiri" on public.participants for delete to authenticated using (
  user_id = auth.uid() and status in ('registered', 'negotiating')
);

-- ───────────── Penyimpanan foto ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('activity-photos', 'activity-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "unggah foto ke folder sendiri" on storage.objects;
create policy "unggah foto ke folder sendiri" on storage.objects for insert to authenticated with check (
  bucket_id = 'activity-photos' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "hapus foto sendiri" on storage.objects;
create policy "hapus foto sendiri" on storage.objects for delete to authenticated using (
  bucket_id = 'activity-photos' and (storage.foldername(name))[1] = auth.uid()::text
);
