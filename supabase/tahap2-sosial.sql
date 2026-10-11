-- Benih tahap 2: profil member publik + pesan (pesan langsung & percakapan kegiatan).
-- Jalankan SETELAH supabase/schema.sql: SQL Editor → New query → tempel seluruh isi file → Run.
-- Aman dijalankan ulang (memakai "if not exists" / "or replace" / drop policy dulu).

-- ───────────── Detail profil (bio, kota, kunci profil) ─────────────
-- Tabel profiles bisa dibaca publik, jadi data yang bisa dikunci disimpan terpisah.
create table if not exists public.profile_details (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  bio text check (bio is null or char_length(bio) <= 500),
  city text check (city is null or char_length(city) <= 80),
  is_private boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.profile_details enable row level security;

drop policy if exists "detail profil dapat dibaca" on public.profile_details;
create policy "detail profil dapat dibaca" on public.profile_details for select
  using (user_id = auth.uid() or not is_private);
drop policy if exists "buat detail profil sendiri" on public.profile_details;
create policy "buat detail profil sendiri" on public.profile_details for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "ubah detail profil sendiri" on public.profile_details;
create policy "ubah detail profil sendiri" on public.profile_details for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Apakah member mengunci profilnya (baris terkunci tidak terlihat lewat RLS, jadi dicek di sini).
create or replace function public.profile_is_private(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_private from public.profile_details where user_id = p_user), false);
$$;

-- Profil publik untuk halaman /member/[id]. Saldo tidak pernah ikut.
-- Profil terkunci: orang lain hanya mendapat locked = true (nama tetap dari tabel profiles).
create or replace function public.member_public(p_user uuid)
returns table (locked boolean, is_private boolean, bio text, city text, attended_count int)
language plpgsql stable security definer set search_path = public as $$
declare
  d public.profile_details%rowtype;
  v_owner boolean := auth.uid() is not null and auth.uid() = p_user;
begin
  select * into d from public.profile_details where user_id = p_user;
  if coalesce(d.is_private, false) and not v_owner then
    return query select true, true, null::text, null::text, null::int;
    return;
  end if;
  return query select
    false,
    coalesce(d.is_private, false),
    d.bio,
    d.city,
    (select count(*)::int from public.participants p
      where p.user_id = p_user and p.role = 'volunteer' and p.status = 'attended');
end;
$$;

revoke all on function public.profile_is_private(uuid) from public;
revoke all on function public.member_public(uuid) from public;
grant execute on function public.profile_is_private(uuid) to anon, authenticated;
grant execute on function public.member_public(uuid) to anon, authenticated;

-- ───────────── Pesan langsung ─────────────
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint direct_messages_not_self check (sender_id <> recipient_id)
);

create index if not exists direct_messages_sender_idx on public.direct_messages (sender_id, created_at desc);
create index if not exists direct_messages_recipient_idx on public.direct_messages (recipient_id, created_at desc);

-- ───────────── Percakapan kegiatan (penyelenggara ↔ tenaga berbayar) ─────────────
-- Dikunci per (kegiatan, user peserta) agar riwayat tetap ada walau status pendaftaran berubah.
create table if not exists public.activity_messages (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  participant_id uuid not null references public.profiles (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists activity_messages_thread_idx on public.activity_messages (activity_id, participant_id, created_at);
create index if not exists activity_messages_participant_idx on public.activity_messages (participant_id, created_at desc);

alter table public.direct_messages enable row level security;
alter table public.activity_messages enable row level security;

-- Hanya dua orang yang terlibat yang bisa membaca. Menulis hanya lewat fungsi di bawah.
drop policy if exists "pengirim dan penerima membaca pesan langsung" on public.direct_messages;
create policy "pengirim dan penerima membaca pesan langsung" on public.direct_messages for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "peserta dan penyelenggara membaca percakapan" on public.activity_messages;
create policy "peserta dan penyelenggara membaca percakapan" on public.activity_messages for select to authenticated
  using (
    participant_id = auth.uid()
    or exists (select 1 from public.activities a where a.id = activity_id and a.owner_id = auth.uid())
  );

-- Boleh mengirim pesan langsung ke member ini? Profil terkunci hanya menerima pesan
-- dari orang yang pernah ia kirimi pesan, atau dari siapa saja bila ia mengadakan kegiatan.
create or replace function public.can_message(p_recipient uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
    and p_recipient <> auth.uid()
    and exists (select 1 from public.profiles where id = p_recipient)
    and (
      not public.profile_is_private(p_recipient)
      or exists (select 1 from public.direct_messages where sender_id = p_recipient and recipient_id = auth.uid())
      or exists (select 1 from public.activities where owner_id = p_recipient)
    );
$$;

create or replace function public.send_direct_message(p_recipient uuid, p_body text)
returns public.direct_messages language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_row public.direct_messages;
begin
  if v_me is null then raise exception 'Harus masuk terlebih dahulu'; end if;
  if p_recipient = v_me then raise exception 'Tidak bisa mengirim pesan ke diri sendiri'; end if;
  if char_length(v_body) not between 1 and 2000 then raise exception 'Pesan harus 1-2000 karakter'; end if;
  if not exists (select 1 from public.profiles where id = p_recipient) then raise exception 'Member tidak ditemukan'; end if;
  if not public.can_message(p_recipient) then
    raise exception 'Member ini mengunci profilnya dan belum bisa menerima pesan darimu';
  end if;
  insert into public.direct_messages (sender_id, recipient_id, body)
  values (v_me, p_recipient, v_body)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.send_activity_message(p_activity uuid, p_participant uuid, p_body text)
returns public.activity_messages language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_owner uuid;
  v_row public.activity_messages;
begin
  if v_me is null then raise exception 'Harus masuk terlebih dahulu'; end if;
  if char_length(v_body) not between 1 and 2000 then raise exception 'Pesan harus 1-2000 karakter'; end if;
  select owner_id into v_owner from public.activities where id = p_activity;
  if v_owner is null then raise exception 'Kegiatan tidak ditemukan'; end if;
  if v_me <> p_participant and v_me <> v_owner then raise exception 'Kamu tidak terlibat dalam percakapan ini'; end if;
  if not exists (
    select 1 from public.participants where activity_id = p_activity and user_id = p_participant and role = 'paid'
  ) then
    raise exception 'Percakapan hanya untuk tenaga berbayar kegiatan ini';
  end if;
  insert into public.activity_messages (activity_id, participant_id, sender_id, body)
  values (p_activity, p_participant, v_me, v_body)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.mark_direct_read(p_other uuid)
returns void language sql security definer set search_path = public as $$
  update public.direct_messages set read_at = now()
  where recipient_id = auth.uid() and sender_id = p_other and read_at is null;
$$;

create or replace function public.mark_activity_read(p_activity uuid, p_participant uuid)
returns void language sql security definer set search_path = public as $$
  update public.activity_messages m set read_at = now()
  where m.activity_id = p_activity and m.participant_id = p_participant
    and m.sender_id <> auth.uid() and m.read_at is null
    and (
      m.participant_id = auth.uid()
      or exists (select 1 from public.activities a where a.id = m.activity_id and a.owner_id = auth.uid())
    );
$$;

-- Jumlah pesan belum dibaca (untuk lencana "Pesan" di menu). Berjalan dengan RLS pemanggil.
create or replace function public.unread_message_count()
returns int language sql stable set search_path = public as $$
  select (
    (select count(*) from public.direct_messages where recipient_id = auth.uid() and read_at is null)
    + (select count(*) from public.activity_messages where sender_id <> auth.uid() and read_at is null)
  )::int;
$$;

revoke all on function public.can_message(uuid) from public;
revoke all on function public.send_direct_message(uuid, text) from public;
revoke all on function public.send_activity_message(uuid, uuid, text) from public;
revoke all on function public.mark_direct_read(uuid) from public;
revoke all on function public.mark_activity_read(uuid, uuid) from public;
revoke all on function public.unread_message_count() from public;
grant execute on function public.can_message(uuid) to authenticated;
grant execute on function public.send_direct_message(uuid, text) to authenticated;
grant execute on function public.send_activity_message(uuid, uuid, text) to authenticated;
grant execute on function public.mark_direct_read(uuid) to authenticated;
grant execute on function public.mark_activity_read(uuid, uuid) to authenticated;
grant execute on function public.unread_message_count() to authenticated;
