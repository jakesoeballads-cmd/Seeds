-- Benih tahap 4: jenis member (perorangan / yayasan-NGO / badan usaha) dan foto profil.
-- Jalankan SETELAH schema.sql dan file tahap2/tahap3: SQL Editor → New query → tempel seluruh isi file → Run.
-- Aman dijalankan ulang (memakai "if not exists" / "or replace" / drop dulu).

-- ───────────── Kolom baru di profiles (tabel ini memang publik) ─────────────
alter table public.profiles add column if not exists member_type text;
alter table public.profiles add column if not exists avatar_url text;

alter table public.profiles drop constraint if exists profiles_member_type_check;
alter table public.profiles add constraint profiles_member_type_check
  check (member_type is null or member_type in ('perorangan', 'yayasan_ngo', 'badan_usaha'));

-- Foto profil hanya boleh dari bucket "avatars" di Storage Benih sendiri.
alter table public.profiles drop constraint if exists profiles_avatar_url_check;
alter table public.profiles add constraint profiles_avatar_url_check
  check (avatar_url is null or (avatar_url like 'https://%' and avatar_url like '%/storage/v1/object/public/avatars/%'));

-- Jenis member diisi saat mendaftar dengan email (metadata member_type).
-- Pendaftar lewat Google memilihnya nanti di halaman Profil.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_type text := new.raw_user_meta_data ->> 'member_type';
begin
  if v_type not in ('perorangan', 'yayasan_ngo', 'badan_usaha') then v_type := null; end if;
  insert into public.profiles (id, full_name, member_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    v_type
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ───────────── Penyimpanan foto profil ─────────────
-- Foto dikompres di browser (±512 px, WebP/JPEG) sebelum diunggah, jadi batas 1 MB cukup.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "lihat foto profil sendiri" on storage.objects;
create policy "lihat foto profil sendiri" on storage.objects for select to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "unggah foto profil sendiri" on storage.objects;
create policy "unggah foto profil sendiri" on storage.objects for insert to authenticated with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "hapus foto profil sendiri" on storage.objects;
create policy "hapus foto profil sendiri" on storage.objects for delete to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
