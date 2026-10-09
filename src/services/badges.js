// Badge donatur berdasarkan total Benih yang pernah disumbangkan.
// Urutkan dari ambang terkecil. Ubah daftar ini untuk menyesuaikan tingkatan.
const DONOR_BADGES = [
  { key: 'penabur', name: 'Penabur Benih', icon: '🌰', min: 1 },
  { key: 'tunas', name: 'Tunas', icon: '🌱', min: 50 },
  { key: 'pohon-muda', name: 'Pohon Muda', icon: '🌿', min: 250 },
  { key: 'pohon-rindang', name: 'Pohon Rindang', icon: '🌳', min: 1000 },
  { key: 'penjaga-hutan', name: 'Penjaga Hutan', icon: '🏞️', min: 5000 },
];

// Mengembalikan badge saat ini (null bila belum pernah menyumbang), badge
// berikutnya, dan berapa Benih lagi untuk mencapainya.
function donorBadge(totalDonated) {
  const total = Number(totalDonated) || 0;
  let current = null;
  let next = null;
  for (const badge of DONOR_BADGES) {
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

module.exports = { DONOR_BADGES, donorBadge };
