// Badge donatur berdasarkan total Benih yang pernah disumbangkan.
// Urutkan dari ambang terkecil. Ubah daftar ini untuk menyesuaikan tingkatan.
const DONOR_BADGES = [
  { key: 'penabur', name: 'Penabur Benih', icon: '🌰', min: 1 },
  { key: 'tunas', name: 'Tunas', icon: '🌱', min: 50 },
  { key: 'pohon-muda', name: 'Pohon Muda', icon: '🌿', min: 250 },
  { key: 'pohon-rindang', name: 'Pohon Rindang', icon: '🌳', min: 1000 },
  { key: 'penjaga-hutan', name: 'Penjaga Hutan', icon: '🏞️', min: 5000 },
];

// Badge relawan berdasarkan poin relawan tanpa imbal balik. Setiap kehadiran
// yang dikonfirmasi penyelenggara memberi VOLUNTEER_POINTS_PER_EVENT poin.
const VOLUNTEER_POINTS_PER_EVENT = 10;
const VOLUNTEER_BADGES = [
  { key: 'relawan', name: 'Relawan', icon: '🤝', min: 10 },
  { key: 'relawan-aktif', name: 'Relawan Aktif', icon: '🙌', min: 50 },
  { key: 'relawan-tangguh', name: 'Relawan Tangguh', icon: '💪', min: 150 },
  { key: 'pahlawan-lingkungan', name: 'Pahlawan Lingkungan', icon: '🦸', min: 300 },
];

// Mengembalikan badge saat ini (null bila belum mencapai tingkat pertama),
// badge berikutnya, dan berapa lagi untuk mencapainya.
function badgeFor(tiers, value) {
  const total = Number(value) || 0;
  let current = null;
  let next = null;
  for (const badge of tiers) {
    if (total >= badge.min) current = badge;
    else {
      next = badge;
      break;
    }
  }
  const floor = current ? current.min : 0;
  return {
    current,
    next,
    remaining: next ? next.min - total : 0,
    progress: next ? Math.min(1, (total - floor) / (next.min - floor)) : 1,
  };
}

const donorBadge = (totalDonated) => badgeFor(DONOR_BADGES, totalDonated);
const volunteerBadge = (points) => badgeFor(VOLUNTEER_BADGES, points);

module.exports = { DONOR_BADGES, VOLUNTEER_BADGES, VOLUNTEER_POINTS_PER_EVENT, donorBadge, volunteerBadge };
