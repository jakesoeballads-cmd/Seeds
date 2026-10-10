import type { Activity } from './types';

/** Tanggal relatif dari hari ini, format YYYY-MM-DD. */
function day(n: number) {
  const d = new Date(Date.now() + n * 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const base = { owner_id: 'sample', collected_benih: 0, participant_count: 0, photos: [] as string[] };

/** Data contoh dari prototipe, dipakai saat Supabase belum dihubungkan. */
export function sampleActivities(): Activity[] {
  return [
    { ...base, id: 'contoh-1', title: 'Bersih Pantai Ancol', category: 'beach', org_name: 'Rina Wulandari', org_type: 'perorangan',
      location_name: 'Ancol, Jakarta Utara', lat: -6.1225, lng: 106.8335, date: day(5), start_time: '06:30', end_time: '10:00',
      collected_benih: 85, target_benih: 200, max_participants: 50, participant_count: 18,
      description: 'Memungut sampah plastik di sepanjang 1 km garis pantai, lalu memilahnya untuk bank sampah. Karung dan sarung tangan disediakan.' },
    { ...base, id: 'contoh-2', title: 'Tanam 500 Pohon di Hutan Kota Srengseng', category: 'reforest', org_name: 'Komunitas Hijau Srengseng', org_type: 'komunitas',
      location_name: 'Kembangan, Jakarta Barat', lat: -6.2115, lng: 106.7612, date: day(3), start_time: '07:00', end_time: '11:00',
      collected_benih: 340, target_benih: 500, max_participants: 60, participant_count: 23,
      description: 'Menanam 500 bibit trembesi dan mahoni bersama warga. Kami juga butuh tenaga berbayar untuk mengangkut bibit dari persemaian.' },
    { ...base, id: 'contoh-3', title: 'Penanaman Mangrove Muara Angke', category: 'mangrove', org_name: 'Yayasan Pesisir Lestari', org_type: 'organisasi',
      location_name: 'Penjaringan, Jakarta Utara', lat: -6.1035, lng: 106.7685, date: day(8), start_time: '08:00', end_time: '12:00',
      collected_benih: 1210, target_benih: 1500, max_participants: 80, participant_count: 52,
      description: 'Menanam 1.000 bibit mangrove untuk menahan abrasi. Gunakan sepatu boot, perahu disediakan.' },
    { ...base, id: 'contoh-4', title: 'Edukasi Bank Sampah untuk Anak', category: 'edu', org_name: 'Sari Nuraini', org_type: 'perorangan',
      location_name: 'Beji, Depok', lat: -6.3725, lng: 106.8235, date: day(10), start_time: '09:00', end_time: '11:30',
      collected_benih: 42, target_benih: null, max_participants: 20, participant_count: 7,
      description: 'Mengajak anak SD memilah sampah dan menabung di bank sampah. Butuh relawan pendamping kelompok.' },
    { ...base, id: 'contoh-5', title: 'Reforestasi Lahan Kopi Gunung Pancar', category: 'reforest', org_name: 'PT Kopi Lereng Hijau', org_type: 'badan_usaha',
      location_name: 'Babakan Madang, Bogor', lat: -6.5845, lng: 106.9115, date: day(14), start_time: '07:30', end_time: '14:00',
      collected_benih: 610, target_benih: 2000, max_participants: 40, participant_count: 12,
      description: 'Menanam pohon pelindung di sela kebun kopi. Kegiatan ini membuka posisi tenaga berbayar Benih karena kebun dikelola secara komersial.' },
  ];
}
