# Benih

Tempat bagi para environmentalist untuk berkontribusi dan saling mendukung untuk pelestarian lingkungan.
Sebuah proyek PT Daya Reforestasi Indonesia (Dareindo).

Dibangun dengan **Next.js** (App Router), **Supabase** (akun, database, foto), dan **Leaflet + OpenStreetMap** (peta). Tersedia dalam Bahasa Indonesia, English, dan Deutsch.

## Status

**Tahap 1 (sudah ada di repo ini)**
- Beranda dengan peta dan daftar kegiatan terdekat (radius 10/25/50 km dari lokasimu)
- Halaman kegiatan: galeri foto, ikut sebagai relawan atau tenaga berbayar, bagikan ke WhatsApp/Facebook/X/Threads
- Penyelenggara: konfirmasi kehadiran relawan (+10 poin) dan catat kesepakatan Benih dengan tenaga berbayar
- Buat kegiatan: unggah hingga 5 foto, pilih lokasi di peta
- Daftar & masuk dengan email atau Google
- Dashboard: poin relawan, badge, riwayat kegiatan, kegiatan yang kamu adakan

**Tahap 2 (berikutnya)**
- Beli Benih dan donasi lewat Midtrans (QRIS, e-wallet, VA), dicatat lewat webhook
- Tarik saldo ke rekening (potongan 2,5%)
- Pesan antara penyelenggara dan tenaga berbayar

Tanpa variabel Supabase, aplikasi tetap berjalan dalam **mode contoh** (data contoh, login nonaktif), jadi tampilannya bisa dicek dulu.

## 1. Siapkan Supabase

1. Buat proyek di [supabase.com](https://supabase.com) (region Singapore paling dekat).
2. Buka **SQL Editor → New query**, tempel seluruh isi [`supabase/schema.sql`](supabase/schema.sql), lalu **Run**.
3. **Authentication → URL Configuration**:
   - Site URL: `https://domain-benih-anda.com`
   - Redirect URLs: tambahkan `https://domain-benih-anda.com/auth/callback` (dan `http://localhost:3000/auth/callback` untuk lokal)
4. Login Google (opsional): **Authentication → Providers → Google**, isi Client ID & Secret dari Google Cloud Console.
5. Catat **Project URL** dan **anon public key** dari **Project Settings → API**.

## 2. Jalankan di komputer (opsional)

```bash
cp .env.example .env.local   # lalu isi nilainya
npm install
npm run dev                  # buka http://localhost:3000
```

## 3. Deploy di Hostinger (Aplikasi Web Node.js)

1. hPanel → **Buat website → Aplikasi Web Node.js → Import Git Repository** → pilih repo ini.
2. Pengaturan build (biasanya terdeteksi otomatis sebagai Next.js):
   - Node.js: 20 atau lebih baru
   - Build command: `npm run build`
   - Start command: `npm start`
3. **Environment variables**: isi `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan `NEXT_PUBLIC_SITE_URL` (lihat `.env.example`).
4. Deploy. Setiap push ke `main` akan memicu build ulang.
5. Hubungkan domain Benih di hPanel, lalu arahkan nameserver domain di Namecheap ke Hostinger.

## Struktur

```
app/            halaman (beranda, kegiatan/[id], buat, dashboard, masuk, daftar, dompet)
components/     komponen UI (peta, formulir, kotak ikut kegiatan, dll.)
lib/            i18n, konstanta (harga, poin, badge), data, klien Supabase
messages/       teks UI: id.json, en.json, de.json
supabase/       skema database + aturan keamanan (RLS)
```

## Aturan penting

- 1 Benih = Rp2.000. Penarikan dipotong 2,5% untuk pengembangan platform.
- Relawan mendapat 10 poin per kegiatan setelah kehadirannya dikonfirmasi penyelenggara.
- Keamanan data dijaga oleh Row Level Security di Supabase: peserta hanya melihat pendaftarannya sendiri, penyelenggara hanya mengelola peserta kegiatannya, dan angka Benih terkumpul tidak bisa diubah langsung dari aplikasi.
