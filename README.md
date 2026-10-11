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

**Tahap 2 sosial (sudah ada)**
- Profil member publik (`/member/[id]`) yang bisa dikunci, dan ubah profil di `/profil`
- Pesan langsung (`/pesan`) dan percakapan negosiasi penyelenggara ↔ tenaga berbayar (`/kegiatan/[id]/pesan`)
- Foto layar penuh di galeri kegiatan, peta Google Maps + cari lokasi kota lain, menu bawah melayang di ponsel
**Tahap 2: Benih & pembayaran**
- Beli Benih lewat Midtrans (QRIS, e-wallet, VA; dicatat lewat webhook) atau PayPal (USD)
- Donasi Benih ke kegiatan, bayar tenaga berbayar yang sudah disepakati
- Tarik saldo ke rekening (potongan 2,5%), riwayat pembelian & penarikan di halaman Dompet

Tanpa variabel Supabase, aplikasi tetap berjalan dalam **mode contoh** (data contoh, login nonaktif), jadi tampilannya bisa dicek dulu.

## 1. Siapkan Supabase

1. Buat proyek di [supabase.com](https://supabase.com) (region Singapore paling dekat).
2. Buka **SQL Editor → New query**, tempel seluruh isi [`supabase/schema.sql`](supabase/schema.sql), lalu **Run**.
3. Lalu jalankan juga [`supabase/tahap2-sosial.sql`](supabase/tahap2-sosial.sql) dengan cara yang sama (profil member + pesan). Aman dijalankan ulang.
4. **Authentication → URL Configuration**:
   - Site URL: `https://domain-benih-anda.com`
   - Redirect URLs: tambahkan `https://domain-benih-anda.com/auth/callback` (dan `http://localhost:3000/auth/callback` untuk lokal)
5. Login Google (opsional): **Authentication → Providers → Google**, isi Client ID & Secret dari Google Cloud Console.
6. Catat **Project URL** dan **anon public key** dari **Project Settings → API**.

### Google Maps (opsional)

Isi `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` agar peta beranda dan formulir buat kegiatan memakai Google Maps, dan pencarian lokasi memakai Google Geocoder.
Di [Google Cloud Console](https://console.cloud.google.com/google/maps-apis) aktifkan **Maps JavaScript API**, **Maps Embed API**, dan **Geocoding API** untuk kunci tersebut, lalu batasi kuncinya ke domain Benih.
Tanpa kunci, peta memakai Leaflet + OpenStreetMap, pencarian memakai OpenStreetMap Nominatim, dan bagian "Lokasi" di halaman kegiatan memakai embed Google Maps biasa.

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
3. **Environment variables**: isi `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan `NEXT_PUBLIC_SITE_URL` (lihat `.env.example`), serta `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` bila memakai Google Maps.
4. Deploy. Setiap push ke `main` akan memicu build ulang.
5. Hubungkan domain Benih di hPanel, lalu arahkan nameserver domain di Namecheap ke Hostinger.

## Tahap 2: Benih & pembayaran

1. Supabase → **SQL Editor → New query**: tempel seluruh isi [`supabase/tahap2-benih.sql`](supabase/tahap2-benih.sql) lalu **Run** (setelah `schema.sql`; aman dijalankan ulang).
2. Hostinger → **Environment variables**, tambahkan (lihat penjelasan di `.env.example`):
   - `SUPABASE_SERVICE_ROLE_KEY` (rahasia, dari Supabase → Project Settings → API)
   - Midtrans: `MIDTRANS_SERVER_KEY`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION`
   - PayPal: `PAYPAL_MODE`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_CURRENCY` (USD), `PAYPAL_IDR_RATE` (16000)
   - `PAYMENT_SIMULATION=false` (isi `true` hanya untuk uji coba tanpa kunci Midtrans/PayPal)
3. Dashboard Midtrans → **Settings → Payment → Notification URL**: `https://<domain>/api/payments/notification`.
   Aktifkan juga kanal QRIS/e-wallet/VA yang diinginkan di Dashboard Midtrans.
4. Deploy ulang. Metode yang kuncinya belum diisi tampil sebagai "belum tersedia".
5. Penarikan dicairkan manual oleh admin: lihat tabel `withdrawals` di Supabase, transfer ke rekening,
   lalu ubah `status` menjadi `paid`. Untuk menolak (saldo kembali): `select reject_withdrawal('<id>', 'alasan');`

Uji fungsi PayPal: `npm test`.

## Tahap 3: panel admin

1. Supabase → **SQL Editor → New query**: tempel seluruh isi [`supabase/tahap3-admin.sql`](supabase/tahap3-admin.sql) lalu **Run** (setelah file tahap 2; aman dijalankan ulang).
2. Jadikan akunmu admin (ganti emailnya), lalu **Run**:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'email-kamu@contoh.com'
   on conflict do nothing;
   ```
3. Masuk ke benih.earth: menu **Admin** muncul di atas, dan halamannya ada di `/admin`.

Di panel admin kamu bisa memproses penarikan saldo (transfer manual lewat bank, lalu "Sudah ditransfer", atau "Tolak" agar saldo Benih kembali ke member) dan menghapus kegiatan beserta fotonya. Tombol "Hapus kegiatan" juga muncul di halaman kegiatan untuk admin. Menghapus foto dari Storage butuh `SUPABASE_SERVICE_ROLE_KEY`.

## Struktur

```
app/            halaman (beranda, kegiatan/[id], buat, dashboard, masuk, daftar, dompet)
components/     komponen UI (peta, formulir, kotak ikut kegiatan, dll.)
lib/            i18n, konstanta (harga, poin, badge), data, klien Supabase
messages/       teks UI: id.json, en.json, de.json
supabase/       skema database + aturan keamanan (RLS); tahap2-benih.sql untuk saldo & pembayaran
tests/          tes kecil (node --test)
```

## Aturan penting

- 1 Benih = Rp2.000. Penarikan dipotong 2,5% untuk pengembangan platform.
- Relawan mendapat 10 poin per kegiatan setelah kehadirannya dikonfirmasi penyelenggara.
- Keamanan data dijaga oleh Row Level Security di Supabase: peserta hanya melihat pendaftarannya sendiri, penyelenggara hanya mengelola peserta kegiatannya, dan angka Benih terkumpul tidak bisa diubah langsung dari aplikasi.
