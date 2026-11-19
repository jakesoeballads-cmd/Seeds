/**
 * Saklar fitur uang Benih: beli Benih, donasi ke kegiatan, tenaga berbayar, dan tarik saldo.
 *
 * MATI secara bawaan sampai ada pendapat hukum tertulis (izin uang elektronik/transfer dana
 * Bank Indonesia, izin Pengumpulan Uang dan Barang, dan perpajakan). Untuk menyalakan:
 * isi NEXT_PUBLIC_ENABLE_PAYMENTS=true di Environment Variables Hostinger, build ulang,
 * lalu jalankan supabase/aktifkan-uang.sql. Lihat README bagian "Saklar fitur uang".
 */
export const PAYMENTS_ENABLED = (process.env.NEXT_PUBLIC_ENABLE_PAYMENTS ?? '').trim().toLowerCase() === 'true';
