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

Tanpa `MIDTRANS_SERVER_KEY`, pembayaran berjalan dalam **mode simulasi**: setelah checkout kamu diarahkan ke halaman lokal untuk memilih "berhasil" atau "gagal", dan hasilnya diproses lewat alur yang sama dengan webhook Midtrans. Tanpa `GOOGLE_MAPS_API_KEY`, daftar program tetap tampil tanpa peta.

## API

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/api/programs?lat=&lng=&radius_km=` | Program di sekitar lokasi, terdekat dulu |
| GET | `/api/programs/:id` | Detail program |
| POST | `/api/programs` | Buat kegiatan (login) |
| POST | `/api/programs/:id/join` | Ikuti kegiatan (login) |
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
