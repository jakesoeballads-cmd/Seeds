-- Skema database Benih tahap 2: saldo Benih, pembelian (Midtrans/PayPal), donasi,
-- penarikan, dan pembayaran tenaga berbayar.
-- Jalankan SETELAH supabase/schema.sql: SQL Editor → New query → tempel seluruh isi file → Run.
-- Aman dijalankan ulang (memakai "if not exists" / "or replace" / drop policy dulu).
--
-- Aturan keamanan:
-- • Saldo TIDAK disimpan di profiles (profil dapat dibaca publik), tapi di tabel wallets
--   yang hanya bisa dibaca pemiliknya.
-- • Browser tidak bisa menulis langsung ke tabel di file ini. Semua perpindahan Benih lewat
--   fungsi security definer yang memakai auth.uid() sebagai pelaku.
-- • settle_transaction & reject_withdrawal hanya untuk server (service role).

-- ───────────── Saldo ─────────────
create table if not exists public.wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  -- Total Benih yang pernah disumbangkan (dasar badge donatur).
  donated bigint not null default 0 check (donated >= 0),
  updated_at timestamptz not null default now()
);

-- ───────────── Transaksi pembelian Benih ─────────────
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  user_id uuid not null references public.profiles (id) on delete cascade,
  benih_amount int not null check (benih_amount > 0),
  gross_amount bigint not null check (gross_amount > 0), -- dalam rupiah
  status text not null default 'pending' check (status in ('pending', 'success', 'failed', 'refunded')),
  provider text not null check (provider in ('midtrans', 'paypal', 'simulation')),
  -- PayPal: id order PayPal, mata uang, dan nominal yang ditagih (bukan rupiah).
  provider_order_id text,
  currency text not null default 'IDR',
  provider_amount numeric(14, 2),
  payment_type text,
  snap_token text,
  redirect_url text,
  raw_notification jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_user_idx on public.transactions (user_id, created_at desc);

-- ───────────── Donasi ke kegiatan ─────────────
-- Bila kegiatan/akun dihapus, catatan donasi tetap ada (kolomnya menjadi null).
create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references public.activities (id) on delete set null,
  donor_id uuid references public.profiles (id) on delete set null,
  organizer_id uuid references public.profiles (id) on delete set null,
  amount int not null check (amount > 0),
  message text check (message is null or char_length(message) <= 280),
  created_at timestamptz not null default now()
);

create index if not exists donations_activity_idx on public.donations (activity_id, created_at desc);
create index if not exists donations_donor_idx on public.donations (donor_id, created_at desc);
create index if not exists donations_organizer_idx on public.donations (organizer_id, created_at desc);

-- ───────────── Penarikan saldo ke rekening ─────────────
-- Harga dan potongan disimpan per baris, jadi perubahan tarif nanti tidak mengubah riwayat.
-- Pencairan dilakukan admin (status pending → paid / rejected).
create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  benih_amount int not null check (benih_amount > 0),
  price_idr int not null check (price_idr > 0), -- harga 1 Benih saat pengajuan
  gross_idr bigint not null, -- benih_amount × price_idr
  fee_bps int not null check (fee_bps between 0 and 10000),
  fee_idr bigint not null, -- potongan pengembangan platform
  net_idr bigint not null check (net_idr > 0), -- yang ditransfer ke pengguna
  bank_name text not null check (char_length(bank_name) between 1 and 100),
  bank_account_number text not null check (bank_account_number ~ '^[0-9]{5,20}$'),
  bank_account_name text not null check (char_length(bank_account_name) between 1 and 140),
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  admin_note text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  check (gross_idr = fee_idr + net_idr)
);

create index if not exists withdrawals_user_idx on public.withdrawals (user_id, created_at desc);

-- ───────────── Row Level Security ─────────────
alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.donations enable row level security;
alter table public.withdrawals enable row level security;

-- Hanya baca. Tidak ada kebijakan insert/update/delete, dan haknya dicabut juga.
revoke insert, update, delete on public.wallets, public.transactions, public.donations, public.withdrawals from anon, authenticated;

drop policy if exists "lihat saldo sendiri" on public.wallets;
create policy "lihat saldo sendiri" on public.wallets for select to authenticated using (user_id = auth.uid());
drop policy if exists "lihat transaksi sendiri" on public.transactions;
create policy "lihat transaksi sendiri" on public.transactions for select to authenticated using (user_id = auth.uid());
drop policy if exists "donatur dan penyelenggara melihat donasi" on public.donations;
create policy "donatur dan penyelenggara melihat donasi" on public.donations for select to authenticated
  using (donor_id = auth.uid() or organizer_id = auth.uid());
drop policy if exists "lihat penarikan sendiri" on public.withdrawals;
create policy "lihat penarikan sendiri" on public.withdrawals for select to authenticated using (user_id = auth.uid());

-- ───────────── Fungsi bantu ─────────────
-- Membuat dompet bila belum ada, lalu mengunci dompet-dompet itu dalam urutan id yang
-- sama agar dua transfer yang berlawanan arah tidak saling menunggu (deadlock).
create or replace function public.lock_wallets(p_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.wallets (user_id)
  select distinct u from unnest(p_ids) u where u is not null
  on conflict (user_id) do nothing;
  perform 1 from public.wallets where user_id = any (p_ids) order by user_id for update;
end;
$$;

-- ───────────── Mencatat hasil pembayaran (server saja) ─────────────
-- Atomik dan idempoten: saldo hanya bertambah sekali, saat status pertama kali 'success'.
-- Transaksi yang sudah final (success/refunded) tidak bisa kembali ke pending/failed.
create or replace function public.settle_transaction(p_order_id text, p_status text, p_payment_type text, p_raw jsonb)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  v_trx public.transactions;
begin
  if p_status not in ('pending', 'success', 'failed', 'refunded') then
    raise exception 'Status tidak valid: %', p_status;
  end if;

  select * into v_trx from public.transactions where order_id = p_order_id for update;
  if not found then
    raise exception 'Transaksi % tidak ditemukan', p_order_id using hint = 'notFound';
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
    insert into public.wallets (user_id, balance) values (v_trx.user_id, v_trx.benih_amount)
    on conflict (user_id) do update set balance = wallets.balance + excluded.balance, updated_at = now();
  end if;
  -- Catatan: refund belum mengurangi saldo; ditangani manual oleh admin.
  return v_trx;
end;
$$;

-- ───────────── Donasi Benih ke kegiatan ─────────────
create or replace function public.donate_benih(p_activity_id uuid, p_amount int, p_message text default null)
returns public.donations
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_msg text := nullif(trim(coalesce(p_message, '')), '');
  v_row public.donations;
begin
  if v_uid is null then
    raise exception 'Harus masuk terlebih dahulu.' using hint = 'auth';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 100000 then
    raise exception 'Jumlah donasi tidak valid.' using hint = 'amount';
  end if;
  if v_msg is not null and char_length(v_msg) > 280 then
    raise exception 'Pesan terlalu panjang.' using hint = 'message';
  end if;

  select owner_id into v_owner from public.activities where id = p_activity_id for update;
  if not found then
    raise exception 'Kegiatan tidak ditemukan.' using hint = 'notFound';
  end if;
  if v_owner = v_uid then
    raise exception 'Tidak bisa berdonasi ke kegiatan sendiri.' using hint = 'self';
  end if;

  perform public.lock_wallets(array[v_uid, v_owner]);

  update public.wallets
     set balance = balance - p_amount, donated = donated + p_amount, updated_at = now()
   where user_id = v_uid and balance >= p_amount;
  if not found then
    raise exception 'Saldo Benih tidak cukup.' using hint = 'balance';
  end if;

  update public.wallets set balance = balance + p_amount, updated_at = now() where user_id = v_owner;
  update public.activities set collected_benih = collected_benih + p_amount where id = p_activity_id;

  insert into public.donations (activity_id, donor_id, organizer_id, amount, message)
  values (p_activity_id, v_uid, v_owner, p_amount, v_msg)
  returning * into v_row;
  return v_row;
end;
$$;

-- ───────────── Penarikan saldo ─────────────
-- Harga (Rp2.000) dan potongan (250 bps = 2,5%) ditetapkan di sini, bukan dikirim dari
-- browser, agar tidak bisa diubah pengguna. Samakan dengan PRICE & FEE_BPS di lib/constants.ts.
create or replace function public.request_withdrawal(
  p_amount int, p_bank_name text, p_bank_account_number text, p_bank_account_name text
)
returns public.withdrawals
language plpgsql security definer set search_path = public as $$
declare
  c_price constant int := 2000;
  c_fee_bps constant int := 250;
  v_uid uuid := auth.uid();
  v_bank text := trim(coalesce(p_bank_name, ''));
  v_acc text := regexp_replace(coalesce(p_bank_account_number, ''), '\s', '', 'g');
  v_name text := trim(coalesce(p_bank_account_name, ''));
  v_gross bigint;
  v_fee bigint;
  v_row public.withdrawals;
begin
  if v_uid is null then
    raise exception 'Harus masuk terlebih dahulu.' using hint = 'auth';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 100000 then
    raise exception 'Jumlah penarikan tidak valid.' using hint = 'amount';
  end if;
  if v_bank = '' or char_length(v_bank) > 100 or v_name = '' or char_length(v_name) > 140 or v_acc !~ '^[0-9]{5,20}$' then
    raise exception 'Lengkapi nama bank, nomor rekening (angka), dan nama pemilik rekening.' using hint = 'bank';
  end if;

  perform public.lock_wallets(array[v_uid]);
  update public.wallets set balance = balance - p_amount, updated_at = now()
   where user_id = v_uid and balance >= p_amount;
  if not found then
    raise exception 'Saldo Benih tidak cukup.' using hint = 'balance';
  end if;

  v_gross := p_amount::bigint * c_price;
  v_fee := round(v_gross * c_fee_bps / 10000.0);

  insert into public.withdrawals (
    user_id, benih_amount, price_idr, gross_idr, fee_bps, fee_idr, net_idr,
    bank_name, bank_account_number, bank_account_name
  ) values (
    v_uid, p_amount, c_price, v_gross, c_fee_bps, v_fee, v_gross - v_fee, v_bank, v_acc, v_name
  )
  returning * into v_row;
  return v_row;
end;
$$;

-- Admin menolak penarikan (server/SQL Editor saja): saldo dikembalikan ke pengguna.
-- Menandai sudah ditransfer: update public.withdrawals set status = 'paid', processed_at = now() where id = '…';
create or replace function public.reject_withdrawal(p_withdrawal_id uuid, p_note text default null)
returns public.withdrawals
language plpgsql security definer set search_path = public as $$
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
  insert into public.wallets (user_id, balance) values (v_row.user_id, v_row.benih_amount)
  on conflict (user_id) do update set balance = wallets.balance + excluded.balance, updated_at = now();
  return v_row;
end;
$$;

-- ───────────── Membayar tenaga berbayar ─────────────
-- Penyelenggara membayar peserta berbayar yang sudah disepakati: saldo pindah dari
-- penyelenggara ke peserta, status agreed → paid.
create or replace function public.pay_participant(p_participant_id uuid)
returns public.participants
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_p public.participants;
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'Harus masuk terlebih dahulu.' using hint = 'auth';
  end if;

  select * into v_p from public.participants where id = p_participant_id for update;
  if not found then
    raise exception 'Peserta tidak ditemukan.' using hint = 'notFound';
  end if;
  select owner_id into v_owner from public.activities where id = v_p.activity_id;
  if v_owner is distinct from v_uid then
    raise exception 'Hanya penyelenggara yang bisa membayar.' using hint = 'notOwner';
  end if;
  if v_p.role <> 'paid' or v_p.status <> 'agreed' or coalesce(v_p.agreed_benih, 0) < 1 then
    raise exception 'Belum ada kesepakatan yang bisa dibayar.' using hint = 'notAgreed';
  end if;

  perform public.lock_wallets(array[v_uid, v_p.user_id]);
  update public.wallets set balance = balance - v_p.agreed_benih, updated_at = now()
   where user_id = v_uid and balance >= v_p.agreed_benih;
  if not found then
    raise exception 'Saldo Benih tidak cukup.' using hint = 'balance';
  end if;
  update public.wallets set balance = balance + v_p.agreed_benih, updated_at = now() where user_id = v_p.user_id;

  update public.participants set status = 'paid' where id = v_p.id returning * into v_p;
  return v_p;
end;
$$;

-- ───────────── Penjaga tabel peserta (menggantikan versi tahap 1) ─────────────
-- Sama seperti sebelumnya, ditambah: status "paid" hanya boleh diset oleh fungsi pembayaran
-- (pay_participant), dan baris yang sudah dibayar tidak bisa diubah dari browser.
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
  -- Fungsi security definer berjalan sebagai pemilik tabel, bukan 'authenticated'/'anon'.
  if current_user in ('authenticated', 'anon') then
    if new.status = 'paid' and old.status <> 'paid' then
      raise exception 'Pembayaran dicatat oleh sistem pembayaran';
    end if;
    if old.status = 'paid' and (new.status <> old.status or new.agreed_benih is distinct from old.agreed_benih) then
      raise exception 'Pembayaran sudah dicatat dan tidak bisa diubah';
    end if;
  end if;
  return new;
end;
$$;

-- ───────────── Hak menjalankan fungsi ─────────────
revoke execute on function public.lock_wallets(uuid[]) from public, anon, authenticated;
revoke execute on function public.settle_transaction(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.reject_withdrawal(uuid, text) from public, anon, authenticated;
revoke execute on function public.donate_benih(uuid, int, text) from public, anon;
revoke execute on function public.request_withdrawal(int, text, text, text) from public, anon;
revoke execute on function public.pay_participant(uuid) from public, anon;

grant execute on function public.settle_transaction(text, text, text, jsonb) to service_role;
grant execute on function public.reject_withdrawal(uuid, text) to service_role;
grant execute on function public.donate_benih(uuid, int, text) to authenticated;
grant execute on function public.request_withdrawal(int, text, text, text) to authenticated;
grant execute on function public.pay_participant(uuid) to authenticated;
