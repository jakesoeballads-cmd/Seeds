/** Harga 1 Benih dalam rupiah. */
export const PRICE = 2000;
/** Potongan penarikan dalam basis poin (250 = 2,5%). */
export const FEE_BPS = 250;
/** Poin relawan per kegiatan yang kehadirannya dikonfirmasi. */
export const POINTS = 10;

export type Badge = { key: string; icon: string; min: number };

export const DONOR_BADGES: Badge[] = [
  { key: 'bd.sower', icon: '🌰', min: 1 },
  { key: 'bd.sprout', icon: '🌱', min: 50 },
  { key: 'bd.young', icon: '🌿', min: 250 },
  { key: 'bd.shady', icon: '🌳', min: 1000 },
  { key: 'bd.guardian', icon: '🏞️', min: 5000 },
];

export const VOLUNTEER_BADGES: Badge[] = [
  { key: 'bv.vol', icon: '🤝', min: 10 },
  { key: 'bv.active', icon: '🙌', min: 50 },
  { key: 'bv.tough', icon: '💪', min: 150 },
  { key: 'bv.hero', icon: '🦸', min: 300 },
];

export const ORG_TYPES = ['perorangan', 'komunitas', 'organisasi', 'badan_usaha'] as const;
export const CATEGORIES = ['reforest', 'mangrove', 'beach', 'edu'] as const;
export const RADII = [10, 25, 50] as const;

/** Pusat Jakarta, dipakai bila lokasi pengguna tidak tersedia. */
export const DEFAULT_CENTER = { lat: -6.2, lng: 106.8167 };

export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
/** Ukuran foto asli yang boleh dipilih; foto dikompres di browser sebelum diunggah. */
export const MAX_PHOTO_INPUT_BYTES = 25 * 1024 * 1024;
export const PHOTO_BUCKET = 'activity-photos';

export function badgeInfo(tiers: Badge[], total: number) {
  let current: Badge | null = null;
  let next: Badge | null = null;
  for (const b of tiers) {
    if (total >= b.min) current = b;
    else {
      next = b;
      break;
    }
  }
  const floor = current ? current.min : 0;
  return { current, next, remaining: next ? next.min - total : 0, progress: next ? (total - floor) / (next.min - floor) : 1 };
}

/** Jarak dua titik dalam km (rumus haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
