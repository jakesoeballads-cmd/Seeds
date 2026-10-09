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
  -- Saldo Benih: hasil pembelian + donasi yang diterima. Bisa didonasikan atau ditarik.
  benih_balance bigint not null default 0 check (benih_balance >= 0),
  -- Total Benih yang pernah disumbangkan pengguna (dasar badge donatur).
  benih_donated bigint not null default 0 check (benih_donated >= 0),
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
  benih_target     integer check (benih_target is null or benih_target > 0),
  benih_collected  bigint not null default 0 check (benih_collected >= 0),
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
  benih_target integer, benih_collected bigint, max_participants integer, distance_km double precision
)
language sql stable
as $$
  select * from (
    select p.id, p.title, p.description, p.category, p.location_name,
           p.lat, p.lng, p.start_at, p.end_at, p.benih_target, p.benih_collected, p.max_participants,
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

-- ---------------------------------------------------------------------------
-- Donasi Benih ke kegiatan
-- Benih berpindah dari saldo donatur ke saldo penyelenggara.
-- ---------------------------------------------------------------------------
create table if not exists public.donations (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references public.programs (id) on delete restrict,
  donor_id     uuid not null references public.profiles (id) on delete restrict,
  organizer_id uuid not null references public.profiles (id) on delete restrict,
  benih_amount integer not null check (benih_amount > 0),
  message      text check (message is null or char_length(message) <= 280),
  created_at   timestamptz not null default now()
);

create index if not exists donations_program_id_idx on public.donations (program_id, created_at desc);
create index if not exists donations_donor_id_idx on public.donations (donor_id, created_at desc);

create or replace function public.donate_benih(
  p_program_id uuid, p_donor_id uuid, p_amount integer, p_message text default null
)
returns public.donations
language plpgsql
security definer set search_path = public
as $$
declare
  v_program public.programs;
  v_row     public.donations;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Jumlah donasi harus lebih dari 0.';
  end if;

  select * into v_program from public.programs where id = p_program_id for update;
  if not found or v_program.status <> 'published' then
    raise exception 'Program tidak tersedia.';
  end if;
  if v_program.organizer_id = p_donor_id then
    raise exception 'Tidak bisa berdonasi ke kegiatan sendiri.';
  end if;

  update public.profiles
     set benih_balance = benih_balance - p_amount,
         benih_donated = benih_donated + p_amount,
         updated_at = now()
   where id = p_donor_id and benih_balance >= p_amount;
  if not found then
    raise exception 'Saldo Benih tidak cukup.';
  end if;

  update public.profiles
     set benih_balance = benih_balance + p_amount, updated_at = now()
   where id = v_program.organizer_id;

  update public.programs
     set benih_collected = benih_collected + p_amount
   where id = p_program_id;

  insert into public.donations (program_id, donor_id, organizer_id, benih_amount, message)
  values (p_program_id, p_donor_id, v_program.organizer_id, p_amount, nullif(trim(p_message), ''))
  returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Penarikan saldo (Benih -> Rupiah), baik Benih hasil beli maupun hasil donasi
-- Potongan platform dihitung saat pengajuan dan disimpan per baris, sehingga
-- perubahan tarif di kemudian hari tidak mengubah riwayat.
-- Pencairan ke rekening dilakukan admin (status pending -> paid / rejected).
-- ---------------------------------------------------------------------------
create table if not exists public.withdrawals (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete restrict,
  benih_amount        integer not null check (benih_amount > 0),
  price_idr           integer not null check (price_idr > 0),   -- harga 1 Benih saat pengajuan
  gross_idr           bigint not null,                           -- benih_amount * price_idr
  fee_bps             integer not null check (fee_bps between 0 and 10000),
  fee_idr             bigint not null,                           -- potongan pengembangan platform
  net_idr             bigint not null check (net_idr > 0),       -- yang ditransfer ke pengguna
  bank_name           text not null,
  bank_account_number text not null,
  bank_account_name   text not null,
  status              text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  admin_note          text,
  processed_at        timestamptz,
  created_at          timestamptz not null default now(),
  check (gross_idr = fee_idr + net_idr)
);

create index if not exists withdrawals_user_id_idx on public.withdrawals (user_id, created_at desc);

create or replace function public.request_withdrawal(
  p_user_id uuid, p_amount integer, p_price_idr integer, p_fee_bps integer,
  p_bank_name text, p_bank_account_number text, p_bank_account_name text
)
returns public.withdrawals
language plpgsql
security definer set search_path = public
as $$
declare
  v_gross bigint;
  v_fee   bigint;
  v_row   public.withdrawals;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Jumlah penarikan harus lebih dari 0.';
  end if;

  update public.profiles
     set benih_balance = benih_balance - p_amount, updated_at = now()
   where id = p_user_id and benih_balance >= p_amount;
  if not found then
    raise exception 'Saldo Benih tidak cukup.';
  end if;

  v_gross := p_amount::bigint * p_price_idr;
  v_fee   := round(v_gross * p_fee_bps / 10000.0);

  insert into public.withdrawals (
    user_id, benih_amount, price_idr, gross_idr, fee_bps, fee_idr, net_idr,
    bank_name, bank_account_number, bank_account_name
  ) values (
    p_user_id, p_amount, p_price_idr, v_gross, p_fee_bps, v_fee, v_gross - v_fee,
    p_bank_name, p_bank_account_number, p_bank_account_name
  )
  returning * into v_row;
  return v_row;
end;
$$;

-- Admin menolak penarikan: saldo dikembalikan ke pengguna.
create or replace function public.reject_withdrawal(p_withdrawal_id uuid, p_note text default null)
returns public.withdrawals
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.withdrawals;
begin
  update public.withdrawals
     set status = 'rejected', admin_note = p_note, processed_at = now()
   where id = p_withdrawal_id and status = 'pending'
  returning * into v_row;
  if not found then
    raise exception 'Penarikan tidak ditemukan atau sudah diproses.';
  end if;

  update public.profiles
     set benih_balance = benih_balance + v_row.benih_amount, updated_at = now()
   where id = v_row.user_id;
  return v_row;
end;
$$;

-- Fungsi yang mengubah saldo hanya boleh dipanggil server (service role).
revoke execute on function public.settle_transaction(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.join_program(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.donate_benih(uuid, uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.request_withdrawal(uuid, integer, integer, integer, text, text, text) from public, anon, authenticated;
revoke execute on function public.reject_withdrawal(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Server memakai service role (melewati RLS). Kebijakan di bawah membatasi
-- akses langsung dari browser dengan anon key.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.programs enable row level security;
alter table public.program_participants enable row level security;
alter table public.transactions enable row level security;
alter table public.donations enable row level security;
alter table public.withdrawals enable row level security;

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

drop policy if exists "donatur dan penyelenggara melihat donasi" on public.donations;
create policy "donatur dan penyelenggara melihat donasi" on public.donations
  for select using (auth.uid() = donor_id or auth.uid() = organizer_id);

drop policy if exists "pengguna melihat penarikan sendiri" on public.withdrawals;
create policy "pengguna melihat penarikan sendiri" on public.withdrawals
  for select using (auth.uid() = user_id);
