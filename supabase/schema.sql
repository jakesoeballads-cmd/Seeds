-- Skema awal Benih.earth untuk Supabase (PostgreSQL).
-- Jalankan di Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profil pengguna (1:1 dengan auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text not null default '',
  role          text not null default 'member' check (role in ('member', 'admin')),
  benih_balance bigint not null default 0 check (benih_balance >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Buat profil otomatis setiap ada pendaftaran baru.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Program / kegiatan pelestarian lingkungan
-- ---------------------------------------------------------------------------
create table if not exists public.programs (
  id               uuid primary key default gen_random_uuid(),
  organizer_id     uuid not null references public.profiles (id) on delete cascade,
  title            text not null check (char_length(title) >= 3),
  description      text,
  category         text not null default 'reforestasi',
  location_name    text,
  lat              double precision not null check (lat between -90 and 90),
  lng              double precision not null check (lng between -180 and 180),
  start_at         timestamptz not null,
  end_at           timestamptz,
  max_participants integer check (max_participants is null or max_participants > 0),
  benih_reward     integer not null default 0 check (benih_reward >= 0),
  status           text not null default 'published' check (status in ('draft', 'published', 'cancelled', 'done')),
  created_at       timestamptz not null default now()
);

create index if not exists programs_lat_lng_idx on public.programs (lat, lng);
create index if not exists programs_start_at_idx on public.programs (start_at);

create table if not exists public.program_participants (
  program_id uuid not null references public.programs (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (program_id, user_id)
);

-- Program dalam radius tertentu, diurutkan dari yang terdekat (rumus haversine).
-- Untuk data besar, pertimbangkan ekstensi PostGIS.
create or replace function public.nearby_programs(p_lat double precision, p_lng double precision, p_radius_km double precision default 25)
returns table (
  id uuid, title text, description text, category text, location_name text,
  lat double precision, lng double precision, start_at timestamptz, end_at timestamptz,
  benih_reward integer, max_participants integer, distance_km double precision
)
language sql stable
as $$
  select * from (
    select p.id, p.title, p.description, p.category, p.location_name,
           p.lat, p.lng, p.start_at, p.end_at, p.benih_reward, p.max_participants,
           6371 * 2 * asin(sqrt(
             power(sin(radians(p.lat - p_lat) / 2), 2) +
             cos(radians(p_lat)) * cos(radians(p.lat)) *
             power(sin(radians(p.lng - p_lng) / 2), 2)
           )) as distance_km
    from public.programs p
    where p.status = 'published'
      and coalesce(p.end_at, p.start_at) >= now()
      -- Saring kasar dengan bounding box agar indeks lat/lng terpakai.
      and p.lat between p_lat - p_radius_km / 111.0 and p_lat + p_radius_km / 111.0
  ) x
  where x.distance_km <= p_radius_km
  order by x.distance_km
  limit 200;
$$;

-- Bergabung ke program dengan pengecekan kuota.
create or replace function public.join_program(p_program_id uuid, p_user_id uuid)
returns public.program_participants
language plpgsql
security definer set search_path = public
as $$
declare
  v_program public.programs;
  v_count   integer;
  v_row     public.program_participants;
begin
  select * into v_program from public.programs where id = p_program_id for update;
  if not found or v_program.status <> 'published' then
    raise exception 'Program tidak tersedia.';
  end if;

  select count(*) into v_count from public.program_participants where program_id = p_program_id;
  if v_program.max_participants is not null and v_count >= v_program.max_participants then
    raise exception 'Kuota peserta sudah penuh.';
  end if;

  insert into public.program_participants (program_id, user_id)
  values (p_program_id, p_user_id)
  on conflict (program_id, user_id) do nothing
  returning * into v_row;

  if v_row is null then
    raise exception 'Kamu sudah terdaftar di program ini.';
  end if;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Transaksi pembelian Benih
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id               uuid primary key default gen_random_uuid(),
  order_id         text not null unique,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  benih_amount     integer not null check (benih_amount > 0),
  gross_amount     bigint not null check (gross_amount > 0),   -- dalam Rupiah
  status           text not null default 'pending' check (status in ('pending', 'success', 'failed', 'refunded')),
  provider         text not null default 'midtrans',
  payment_type     text,
  snap_token       text,
  redirect_url     text,
  raw_notification jsonb,
  paid_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists transactions_user_id_idx on public.transactions (user_id, created_at desc);

-- Mencatat hasil pembayaran secara atomik dan idempoten.
-- Saldo Benih hanya bertambah sekali, saat status pertama kali menjadi 'success'.
-- Transaksi yang sudah final (success/refunded) tidak bisa kembali ke pending/failed.
create or replace function public.settle_transaction(
  p_order_id text, p_status text, p_payment_type text, p_raw jsonb
)
returns public.transactions
language plpgsql
security definer set search_path = public
as $$
declare
  v_trx public.transactions;
begin
  select * into v_trx from public.transactions where order_id = p_order_id for update;
  if not found then
    raise exception 'Transaksi % tidak ditemukan', p_order_id;
  end if;

  if v_trx.status = 'refunded'
     or (v_trx.status = 'success' and p_status <> 'refunded')
     or v_trx.status = p_status then
    return v_trx;
  end if;

  update public.transactions
     set status = p_status,
         payment_type = coalesce(p_payment_type, payment_type),
         raw_notification = p_raw,
         paid_at = case when p_status = 'success' then now() else paid_at end,
         updated_at = now()
   where id = v_trx.id
  returning * into v_trx;

  if p_status = 'success' then
    update public.profiles
       set benih_balance = benih_balance + v_trx.benih_amount, updated_at = now()
     where id = v_trx.user_id;
  end if;
  -- Catatan: penarikan saldo untuk refund belum ditangani di tahap awal ini.

  return v_trx;
end;
$$;

-- Fungsi yang mengubah saldo hanya boleh dipanggil server (service role).
revoke execute on function public.settle_transaction(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.join_program(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Server memakai service role (melewati RLS). Kebijakan di bawah membatasi
-- akses langsung dari browser dengan anon key.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.programs enable row level security;
alter table public.program_participants enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "pengguna melihat profil sendiri" on public.profiles;
create policy "pengguna melihat profil sendiri" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "program published terlihat publik" on public.programs;
create policy "program published terlihat publik" on public.programs
  for select using (status = 'published' or auth.uid() = organizer_id);

drop policy if exists "peserta melihat keikutsertaan sendiri" on public.program_participants;
create policy "peserta melihat keikutsertaan sendiri" on public.program_participants
  for select using (auth.uid() = user_id);

drop policy if exists "pengguna melihat transaksi sendiri" on public.transactions;
create policy "pengguna melihat transaksi sendiri" on public.transactions
  for select using (auth.uid() = user_id);
