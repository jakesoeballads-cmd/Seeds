import Link from 'next/link';
import { mdiAccountGroup, mdiCalendarPlus, mdiHandHeart } from '@mdi/js';
import type { T } from '@/lib/i18n';
import { Icon } from './Icon';

// Ikon fitur dari MDI; lencananya bergerak pelan saat pita fitur terlihat (lihat PlayOnView).
const icons = [mdiAccountGroup, mdiHandHeart, mdiCalendarPlus];

// Urutan tampil: buat kegiatan, ikuti kegiatan, kumpulkan & donasikan Benih. Ketiganya sama besar dan bisa diklik.
const items = [
  { key: 'feat3', icon: 2, href: '/buat' },
  { key: 'feat1', icon: 0, href: '/#cari' },
  { key: 'feat2', icon: 1, href: '/dompet' },
];

export function Features({ t }: { t: T }) {
  return (
    <div className="features">
      {items.map(({ key, icon, href }) => (
        <Link className="feature" href={href} key={key}>
          <span className="feature-badge"><Icon path={icons[icon]} /></span>
          <h3>{t(`${key}.t`)}</h3>
          <p>{t(`${key}.d`)}</p>
        </Link>
      ))}
    </div>
  );
}
