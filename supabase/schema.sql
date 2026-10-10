-- Skema awal Benih.earth untuk Supabase (PostgreSQL).
-- Jalankan di Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profil pengguna (1:1 dengan auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text not null default '',
  avatar_url    text,
  role          text not null default 'member' check (role in ('member', 'admin')),
  -- Saldo Benih: hasil pembelian + donasi yang diterima. Bisa didonasikan atau ditarik.
  benih_balance bigint not null default 0 check (benih_balance >= 0),
  -- Total Benih yang pernah disumbangkan pengguna (dasar badge donatur).
  benih_donated bigint not null default 0 check (benih_donated >= 0),
  -- Poin relawan tanpa imbal balik (dasar badge relawan). Bertambah saat
  -- penyelenggara mengonfirmasi kehadiran relawan.
  volunteer_points integer not null default 0 check (volunteer_points >= 0),
  -- Profil publik: bisa dilihat member lain kecuali dikunci (is_private).
  bio           text check (char_length(bio) <= 500),
  city          text check (char_length(city) <= 80),
  is_private    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Untuk database yang dibuat sebelum kolom profil publik ada.
alter table public.profiles add column if not exists bio text check (char_length(bio) <= 500);
alter table public.profiles add column if not exists city text check (char_length(city) <= 80);
alter table public.profiles add column if not exists is_private boolean not null default false;

-- Buat profil otomatis setiap ada pendaftaran baru.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Login sosial (Google, Facebook, X) mengisi metadata dengan nama dan foto.
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
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
  -- Nama penginisiasi yang ditampilkan: orang, komunitas, organisasi, atau badan usaha.
  organizer_name   text not null check (char_length(organizer_name) between 2 and 120),
  organizer_type   text not null default 'perorangan'
                   check (organizer_type in ('perorangan', 'komunitas', 'organisasi', 'badan_usaha')),
  -- URL publik foto kegiatan di Supabase Storage (bucket program-photos), maks. 5.
  photo_urls       text[] not null default '{}' check (cardinality(photo_urls) <= 5),
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

-- Peserta kegiatan.
--   volunteer: relawan tanpa imbal balik. registered -> attended (+poin relawan)
--   paid:      tenaga berbayar Benih. negotiating -> agreed (Benih disepakati) -> paid
create table if not exists public.program_participants (
  program_id   uuid not null references public.programs (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         text not null default 'volunteer' check (role in ('volunteer', 'paid')),
  status       text not null default 'registered'
               check (status in ('registered', 'attended', 'negotiating', 'agreed', 'paid', 'cancelled')),
  agreed_benih integer check (agreed_benih is null or agreed_benih > 0),
  joined_at    timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (program_id, user_id)
);

create index if not exists program_participants_user_idx on public.program_participants (user_id, joined_at desc);

-- Percakapan antara penyelenggara dan peserta (terutama tenaga berbayar untuk
-- membicarakan imbal balik Benih). Satu percakapan = (program_id, participant_id).
create table if not exists public.program_messages (
  id             uuid primary key default gen_random_uuid(),
  program_id     uuid not null,
  participant_id uuid not null,
  sender_id      uuid not null references public.profiles (id) on delete cascade,
  body           text not null check (char_length(body) between 1 and 2000),
  created_at     timestamptz not null default now(),
  foreign key (program_id, participant_id) references public.program_participants (program_id, user_id) on delete cascade
);

create index if not exists program_messages_thread_idx on public.program_messages (program_id, participant_id, created_at);
-- Dibaca oleh penerima (bukan pengirim); null = belum dibaca.
alter table public.program_messages add column if not exists read_at timestamptz;

-- ---------------------------------------------------------------------------
-- Pesan langsung antar-member (di luar percakapan kegiatan)
-- ---------------------------------------------------------------------------
create table if not exists public.direct_messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 2000),
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists direct_messages_sender_idx on public.direct_messages (sender_id, created_at desc);
create index if not exists direct_messages_recipient_idx on public.direct_messages (recipient_id, created_at desc);

-- Program dalam radius tertentu, diurutkan dari yang terdekat (rumus haversine).
-- Untuk data besar, pertimbangkan ekstensi PostGIS.
-- Kolom hasil berubah (organizer_id), jadi fungsi lama dihapus dulu.
drop function if exists public.nearby_programs(double precision, double precision, double precision);
create or replace function public.nearby_programs(p_lat double precision, p_lng double precision, p_radius_km double precision default 25)
returns table (
  id uuid, title text, description text, category text, location_name text,
  organizer_id uuid, organizer_name text, organizer_type text, photo_urls text[],
  lat double precision, lng double precision, start_at timestamptz, end_at timestamptz,
  benih_target integer, benih_collected bigint, max_participants integer, distance_km double precision
)
language sql stable
as $$
  select * from (
    select p.id, p.title, p.description, p.category, p.location_name,
           p.organizer_id, p.organizer_name, p.organizer_type, p.photo_urls,
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
-- p_role: 'volunteer' (relawan) atau 'paid' (tenaga berbayar Benih, lanjut
-- bernegosiasi dengan penyelenggara lewat program_messages).
create or replace function public.join_program(p_program_id uuid, p_user_id uuid, p_role text default 'volunteer')
returns public.program_participants
language plpgsql
security definer set search_path = public
as $$
declare
  v_program public.programs;
  v_count   integer;
  v_row     public.program_participants;
begin
  if p_role not in ('volunteer', 'paid') then
    raise exception 'Pilih peran: relawan atau tenaga berbayar.';
  end if;

  select * into v_program from public.programs where id = p_program_id for update;
  if not found or v_program.status <> 'published' then
    raise exception 'Program tidak tersedia.';
  end if;
  if v_program.organizer_id = p_user_id then
    raise exception 'Kamu adalah penyelenggara kegiatan ini.';
  end if;

  select count(*) into v_count from public.program_participants
   where program_id = p_program_id and status <> 'cancelled';
  if v_program.max_participants is not null and v_count >= v_program.max_participants then
    raise exception 'Kuota peserta sudah penuh.';
  end if;

  insert into public.program_participants (program_id, user_id, role, status)
  values (p_program_id, p_user_id, p_role, case when p_role = 'paid' then 'negotiating' else 'registered' end)
  on conflict (program_id, user_id) do nothing
  returning * into v_row;

  if v_row is null then
    raise exception 'Kamu sudah terdaftar di program ini.';
  end if;
  return v_row;
end;
$$;

-- Penyelenggara mengonfirmasi kehadiran relawan: relawan mendapat poin.
create or replace function public.confirm_volunteer(p_program_id uuid, p_user_id uuid, p_organizer_id uuid, p_points integer default 10)
returns public.program_participants
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.program_participants;
begin
  if not exists (select 1 from public.programs where id = p_program_id and organizer_id = p_organizer_id) then
    raise exception 'Hanya penyelenggara yang bisa mengonfirmasi kehadiran.';
  end if;

  update public.program_participants
     set status = 'attended', updated_at = now()
   where program_id = p_program_id and user_id = p_user_id
     and role = 'volunteer' and status = 'registered'
  returning * into v_row;
  if not found then
    raise exception 'Relawan tidak ditemukan atau sudah dikonfirmasi.';
  end if;

  update public.profiles
     set volunteer_points = volunteer_points + p_points, updated_at = now()
   where id = p_user_id;
  return v_row;
end;
$$;

-- Penyelenggara mencatat jumlah Benih yang disepakati dengan tenaga berbayar.
create or replace function public.set_paid_agreement(p_program_id uuid, p_user_id uuid, p_organizer_id uuid, p_benih integer)
returns public.program_participants
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.program_participants;
begin
  if p_benih is null or p_benih <= 0 then
    raise exception 'Jumlah Benih harus lebih dari 0.';
  end if;
  if not exists (select 1 from public.programs where id = p_program_id and organizer_id = p_organizer_id) then
    raise exception 'Hanya penyelenggara yang bisa menetapkan imbal balik.';
  end if;

  update public.program_participants
     set agreed_benih = p_benih, status = 'agreed', updated_at = now()
   where program_id = p_program_id and user_id = p_user_id
     and role = 'paid' and status in ('negotiating', 'agreed')
  returning * into v_row;
  if not found then
    raise exception 'Tenaga berbayar tidak ditemukan atau sudah dibayar.';
  end if;
  return v_row;
end;
$$;

-- Penyelenggara membayar tenaga berbayar sesuai kesepakatan (saldo ke saldo).
create or replace function public.pay_participant(p_program_id uuid, p_user_id uuid, p_organizer_id uuid)
returns public.program_participants
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.program_participants;
begin
  if not exists (select 1 from public.programs where id = p_program_id and organizer_id = p_organizer_id) then
    raise exception 'Hanya penyelenggara yang bisa membayar peserta.';
  end if;

  select * into v_row from public.program_participants
   where program_id = p_program_id and user_id = p_user_id for update;
  if not found or v_row.role <> 'paid' or v_row.status <> 'agreed' then
    raise exception 'Belum ada kesepakatan Benih, atau peserta sudah dibayar.';
  end if;

  update public.profiles
     set benih_balance = benih_balance - v_row.agreed_benih, updated_at = now()
   where id = p_organizer_id and benih_balance >= v_row.agreed_benih;
  if not found then
    raise exception 'Saldo Benih penyelenggara tidak cukup.';
  end if;

  update public.profiles
     set benih_balance = benih_balance + v_row.agreed_benih, updated_at = now()
   where id = p_user_id;

  update public.program_participants
     set status = 'paid', updated_at = now()
   where program_id = p_program_id and user_id = p_user_id
  returning * into v_row;
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
  -- PayPal: id order PayPal, mata uang, dan nominal yang ditagih (bukan Rupiah).
  provider_order_id text,
  currency         text not null default 'IDR',
  provider_amount  numeric(14, 2),
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
alter table public.transactions add column if not exists provider_order_id text;
alter table public.transactions add column if not exists currency text not null default 'IDR';
alter table public.transactions add column if not exists provider_amount numeric(14, 2);

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
revoke execute on function public.join_program(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.confirm_volunteer(uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.set_paid_agreement(uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.pay_participant(uuid, uuid, uuid) from public, anon, authenticated;
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
alter table public.program_messages enable row level security;
alter table public.direct_messages enable row level security;

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

drop policy if exists "peserta dan penyelenggara melihat percakapan" on public.program_messages;
create policy "peserta dan penyelenggara melihat percakapan" on public.program_messages
  for select using (
    auth.uid() = participant_id
    or auth.uid() = (select organizer_id from public.programs where id = program_id)
  );

drop policy if exists "pengirim dan penerima melihat pesan langsung" on public.direct_messages;
create policy "pengirim dan penerima melihat pesan langsung" on public.direct_messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- ---------------------------------------------------------------------------
-- Storage: foto kegiatan (publik untuk dibaca; unggah lewat server)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('program-photos', 'program-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
