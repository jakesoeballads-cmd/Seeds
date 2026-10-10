# Benih

Platform kegiatan pelestarian lingkungan. Member membuat kegiatan (reforestasi, mangrove, bersih pantai, dll.) yang tampil di peta, member lain bisa mengikutinya, dan **Benih** adalah mata uang di platform ini yang dibeli lewat payment gateway.

## Model Benih

- **1 Benih = Rp2.000** (`BENIH_PRICE_IDR`).
- Member membeli Benih lewat Midtrans. Benih masuk ke `benih_balance` dan bisa dipakai untuk **berdonasi** ke kegiatan member lain.
- Donasi berpindah ke `benih_balance` penyelenggara kegiatan, tercatat di `programs.benih_collected` (Benih yang didapat per event) dan menambah `profiles.benih_donated` donatur. Penyelenggara tidak bisa berdonasi ke kegiatannya sendiri.
- Seluruh `benih_balance` (hasil beli maupun donasi) bisa **ditarik** ke rekening. Penarikan dipotong **2,5%** untuk pengembangan platform (`WITHDRAWAL_FEE_PERCENT`). Contoh: 100 Benih = Rp200.000, potongan Rp5.000, diterima Rp195.000.
- **Badge donatur** ditentukan dari total Benih yang disumbangkan (`src/services/badges.js`): 🌰 Penabur Benih (≥1), 🌱 Tunas (≥50), 🌿 Pohon Muda (≥250), 🌳 Pohon Rindang (≥1.000), 🏞️ Penjaga Hutan (≥5.000).
- **Dashboard** (`/dashboard`) menampilkan Benih yang dimiliki, Benih yang disumbangkan beserta badge, dan Benih yang didapat dari setiap event yang diadakan.
- Pengajuan penarikan langsung mengurangi saldo dan berstatus `pending`; admin mentransfer lalu menandai `paid`, atau memanggil `reject_withdrawal` yang mengembalikan saldo.

Stack: Node.js + Express, EJS, Supabase (database + auth), Google Maps JavaScript API, Midtrans Snap.

## Kegiatan dan peserta

- Kegiatan bisa dilihat semua pengunjung (member maupun bukan) di beranda dan di `/kegiatan/:id`, lengkap dengan nama penginisiasi (perorangan, komunitas, organisasi, atau badan usaha) dan foto.
- Penyelenggara bisa mengunggah hingga 5 foto (JPG/PNG/WebP, maks. 5 MB) saat membuat kegiatan. Foto disimpan di bucket Supabase Storage `program-photos`.
- Saat mengikuti kegiatan, member memilih:
  - **Relawan**: tanpa imbal balik Benih. Setelah penyelenggara mengonfirmasi kehadiran, relawan mendapat 10 poin relawan. Poin menentukan **badge relawan**: 🤝 Relawan (10), 🙌 Relawan Aktif (50), 💪 Relawan Tangguh (150), 🦸 Pahlawan Lingkungan (300).
  - **Tenaga berbayar**: diarahkan ke percakapan dengan penyelenggara (`/kegiatan/:id/pesan`) untuk menyepakati Benih. Penyelenggara mencatat kesepakatan, lalu membayar dari saldonya setelah pekerjaan selesai.
- Kegiatan bisa dibagikan ke WhatsApp, Facebook, X, Threads, atau dengan menyalin tautan.
- Dashboard menampilkan rekam jejak partisipasi beserta peran dan statusnya.

## Masuk dengan akun sosial

Tombol **Google**, **Facebook**, dan **X** memakai Supabase Auth (alur PKCE).

1. Di Supabase Dashboard > Authentication > Providers, aktifkan Google, Facebook, dan Twitter (X), lalu isi Client ID/Secret dari masing-masing developer console.
2. Di Authentication > URL Configuration, tambahkan `https://benih.earth/auth/callback` (dan `http://localhost:3000/auth/callback` untuk lokal) ke Redirect URLs.

Instagram dan Threads tidak menyediakan login untuk aplikasi pihak ketiga, jadi belum bisa dipakai untuk masuk.

## Pembayaran dengan QRIS

Checkout Midtrans Snap menampilkan QRIS di urutan pertama (`MIDTRANS_ENABLED_PAYMENTS`, kode `other_qris`). QRIS harus diaktifkan di Dashboard Midtrans agar muncul. Pengguna bisa memindai kode dengan aplikasi bank atau e-wallet apa pun.

## Pembayaran dengan PayPal

Di halaman Benih, pembeli bisa memilih Midtrans (QRIS, bank, e-wallet) atau PayPal. PayPal tidak menerima rupiah, jadi tagihan dikonversi ke `PAYPAL_CURRENCY` (bawaan USD) dengan kurs tetap `PAYPAL_IDR_RATE` (bawaan 16000) dan dibulatkan ke atas per sen. Jumlah Benih yang masuk tetap sesuai pesanan.

Alurnya memakai PayPal Orders v2: server membuat order, pembeli menyetujui di PayPal, lalu kembali ke `/benih/paypal/kembali` dan server menangkap (capture) pembayaran serta memeriksa status, mata uang, nominal, dan id order sebelum Benih ditambahkan. Untuk mengaktifkan: buat aplikasi di developer.paypal.com, isi `PAYPAL_CLIENT_ID` dan `PAYPAL_CLIENT_SECRET`, dan pakai `PAYPAL_MODE=sandbox` sampai siap, lalu `live`. Tanpa kredensial, PayPal berjalan dalam mode simulasi.

## Pesan antar-member

Member bisa saling mengirim pesan langsung dari profil member (tombol "Kirim pesan") atau dari halaman kegiatan ("Pesan penyelenggara"). Kotak masuk di `/pesan` menggabungkan pesan langsung dan percakapan kegiatan dengan pelamar tenaga berbayar, dan jumlah pesan belum dibaca tampil di menu. Member yang mengunci profilnya hanya bisa dihubungi oleh orang yang pernah ia kirimi pesan, atau bila ia penyelenggara kegiatan yang sudah terbit.

## Foto dan peta kegiatan

Foto di halaman kegiatan bisa diklik untuk dilihat layar penuh (geser atau tombol panah untuk pindah foto, Esc untuk menutup). Lokasi kegiatan ditampilkan dengan Google Maps beserta tautan "Buka di Google Maps" dan "Petunjuk arah". Dengan `GOOGLE_MAPS_API_KEY`, aktifkan juga **Maps Embed API** pada kunci yang sama; tanpa kunci, peta tetap tampil memakai embed Google Maps biasa.

## Profil member

Setiap member punya profil publik di `/member/:id`: nama, foto, kota, bio, badge, kegiatan yang diadakan, dan rekam jejak partisipasi. Nama penyelenggara di beranda dan halaman kegiatan membuka profil ini. Saldo Benih dan penarikan tidak pernah tampil di profil publik.

Member mengubah profilnya di `/profil`. Bila **Kunci profil** dicentang (`profiles.is_private`), orang lain hanya melihat nama dan foto; kegiatannya tetap tampil di beranda.

## Cari lokasi lain

Kotak pencarian di beranda mencari kota atau daerah mana pun (mis. dari Jerman mencari kegiatan di Bandung). Dengan `GOOGLE_MAPS_API_KEY` dipakai Google Geocoder; tanpa key dipakai OpenStreetMap Nominatim. Tombol **Lokasiku** kembali ke lokasi pengunjung.

Di layar ponsel, menu utama pindah ke bar melayang di bawah (Beranda, Cari, Buat, Benih, Profil).

## Bahasa

Antarmuka tersedia dalam Bahasa Indonesia (bawaan), English, dan Deutsch. Pengunjung memilih lewat tombol ID / EN / DE di header (`?lang=en`, disimpan di cookie `lang`); tanpa pilihan, bahasa mengikuti `Accept-Language` browser.

- Teks Indonesia di kode adalah kunci terjemahan: `t('Jam mulai')` di view EJS dan di `public/js`.
- Terjemahan ada di `src/i18n/en.json` dan `src/i18n/de.json`. Bentuk jamak ditulis `{ "one": …, "other": … }`.
- Pesan galat dari server dan dari fungsi SQL ikut diterjemahkan.
- `npm test` gagal bila ada teks `t(...)` baru yang belum diterjemahkan.

Jadwal kegiatan diisi sebagai tanggal + jam mulai + jam selesai, dan dibaca dalam zona waktu `TIME_ZONE` (bawaan `Asia/Jakarta`).

## Struktur folder

```
.
├── server.js                 # Titik masuk: menjalankan server
├── src/
│   ├── app.js                # Konfigurasi Express, middleware, routing, error handler
│   ├── config/
│   │   ├── index.js          # Membaca .env
│   │   └── supabase.js       # Klien Supabase (anon + service role)
│   ├── middleware/auth.js    # Sesi via cookie, requireAuth
│   ├── routes/
│   │   ├── auth.js           # /register, /login, /logout
│   │   ├── pages.js          # Halaman: beranda, buat kegiatan, beli Benih
│   │   ├── programs.js       # API /api/programs
│   │   ├── payments.js       # API /api/payments (checkout, webhook, riwayat)
│   │   └── wallet.js         # API /api/wallet (saldo, penarikan)
│   └── services/
│       ├── midtrans.js       # Snap API, verifikasi signature, pemetaan status
│       ├── benih.js          # Logika pembelian & pencatatan pembayaran
│       ├── wallet.js         # Data dashboard & perhitungan potongan penarikan
│       └── badges.js         # Tingkatan badge donatur
├── views/                    # Template EJS
├── public/                   # CSS & JavaScript browser
├── supabase/schema.sql       # Tabel, fungsi SQL, dan RLS
└── test/                     # Tes (node --test)
```

## Menjalankan

1. `npm install`
2. `cp .env.example .env` lalu isi nilainya.
3. Buat project di [Supabase](https://supabase.com), buka **SQL Editor**, jalankan isi `supabase/schema.sql`.
4. `npm run dev`, buka http://localhost:3000

Tanpa `MIDTRANS_SERVER_KEY`, pembayaran berjalan dalam **mode simulasi**: setelah checkout kamu diarahkan ke halaman lokal untuk memilih "berhasil" atau "gagal", dan hasilnya diproses lewat alur yang sama dengan webhook Midtrans. Tanpa `GOOGLE_MAPS_API_KEY`, peta memakai embed Google Maps tanpa kunci.

## API

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/api/programs?lat=&lng=&radius_km=` | Program di sekitar lokasi, terdekat dulu |
| GET | `/api/programs/:id` | Detail program |
| POST | `/api/programs` | Buat kegiatan, multipart dengan field `photos` (login) |
| POST | `/api/programs/:id/join` | Ikuti kegiatan, body `{ "role": "volunteer" \| "paid" }` (login) |
| GET | `/api/programs/:id/participants` | Daftar peserta (penyelenggara) |
| POST | `/api/programs/:id/participants/:userId/attended` | Konfirmasi kehadiran relawan, +10 poin (penyelenggara) |
| POST | `/api/programs/:id/participants/:userId/agreement` | Catat Benih yang disepakati, body `{ "benih_amount": 150 }` (penyelenggara) |
| POST | `/api/programs/:id/participants/:userId/pay` | Bayar tenaga berbayar dari saldo penyelenggara (penyelenggara) |
| GET/POST | `/api/programs/:id/messages/:participantId` | Baca/kirim pesan antara peserta dan penyelenggara |
| POST | `/api/programs/:id/donate` | Donasi Benih, body `{ "benih_amount": 10, "message": "..." }` (login) |
| GET | `/api/wallet` | Data dashboard: saldo, total donasi + badge, Benih per event (login) |
| POST | `/api/wallet/withdrawals` | Ajukan penarikan, body `{ benih_amount, bank_name, bank_account_number, bank_account_name }` (login) |
| GET | `/api/wallet/withdrawals` | Riwayat penarikan (login) |
| GET | `/api/wallet/withdrawals/preview?benih_amount=` | Rincian potongan penarikan (login) |
| POST | `/api/payments/checkout` | Beli Benih, body `{ "benih_amount": 50 }` (login) |
| POST | `/api/payments/notification` | Webhook Midtrans |
| POST | `/api/payments/simulate/:orderId` | Simulasi hasil bayar, hanya mode simulasi (login) |
| GET | `/api/payments/history` | Riwayat transaksi (login) |

## Alur pembayaran

1. `POST /api/payments/checkout` membuat baris `transactions` berstatus `pending` lalu meminta token Snap ke Midtrans.
2. Browser membuka popup Snap; pengguna membayar.
3. Midtrans memanggil `POST /api/payments/notification`. Server memverifikasi `signature_key` (SHA512 dari `order_id + status_code + gross_amount + server key`) dan mencocokkan nominal.
4. Fungsi SQL `settle_transaction` memperbarui status (`success`, `failed`, `pending`, `refunded`) dan menambah `benih_balance` sekali saja saat status menjadi `success`, jadi notifikasi ganda aman.

Untuk sandbox Midtrans: isi `MIDTRANS_SERVER_KEY` dan `MIDTRANS_CLIENT_KEY` dari dashboard sandbox, lalu atur **Notification URL** ke `https://<domain>/api/payments/notification` (saat lokal bisa pakai ngrok).

## Catatan keamanan

- `SUPABASE_SERVICE_ROLE_KEY` dan `MIDTRANS_SERVER_KEY` hanya untuk server. Jangan commit `.env`.
- Batasi `GOOGLE_MAPS_API_KEY` per HTTP referrer di Google Cloud Console.
- Sesi disimpan di cookie `httpOnly` + `SameSite=Lax`. Sebelum produksi, tambahkan proteksi CSRF dan rate limiting.
