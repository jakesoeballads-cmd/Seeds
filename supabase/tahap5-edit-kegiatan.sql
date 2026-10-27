-- Benih tahap 5: penyelenggara bisa mengedit kegiatannya, kecuali dalam 2 hari (48 jam) sebelum kegiatan dimulai.
-- Jalankan SETELAH schema.sql dan file tahap2–tahap4: SQL Editor → New query → tempel seluruh isi file → Run.
-- Aman dijalankan ulang ("or replace" / drop dulu).

-- Waktu mulai kegiatan. Tanggal & jam disimpan sebagai waktu lokal Indonesia (WIB).
create or replace function public.activity_starts_at(d date, t time)
returns timestamptz language sql immutable as $$
  select (d + t) at time zone 'Asia/Jakarta';
$$;

-- Penyelenggara tidak boleh mengubah angka Benih terkumpul, jumlah peserta, atau pemilik secara langsung,
-- dan tidak boleh mengedit kegiatan yang dimulai kurang dari 2 hari lagi (atau memindahkannya ke waktu itu).
-- (Fungsi security definer seperti participants_count berjalan sebagai pemilik tabel, jadi tetap boleh.)
create or replace function public.activities_guard()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.owner_id := old.owner_id;
    new.collected_benih := old.collected_benih;
    new.participant_count := old.participant_count;
    if public.activity_starts_at(old.date, old.start_time) - now() < interval '2 days' then
      raise exception 'Kegiatan tidak bisa diedit dalam 2 hari sebelum dimulai' using hint = 'editLocked';
    end if;
    if public.activity_starts_at(new.date, new.start_time) - now() < interval '2 days' then
      raise exception 'Jadwal baru harus paling cepat 2 hari dari sekarang' using hint = 'editDate';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists activities_guard_trg on public.activities;
create trigger activities_guard_trg
  before update on public.activities
  for each row execute function public.activities_guard();
