import Link from 'next/link';
import { mdiArrowRight } from '@mdi/js';
import type { T } from '@/lib/i18n';
import { Icon } from './Icon';

// Urutan tampil: buat kegiatan (paling menonjol), ikuti kegiatan, kumpulkan & donasikan Benih.
// Foto dari Unsplash (Unsplash License): buat = Eyoel Kahssay, ikuti = Vitaly Gariev, donasi = Noah Buscher.
const items = [
  { key: 'feat3', href: '/buat', img: 'buat' },
  { key: 'feat1', href: '/#cari', img: 'ikuti' },
  { key: 'feat2', href: '/dompet', img: 'donasi' },
];

export function Features({ t }: { t: T }) {
  return (
    <div className="features">
      {items.map(({ key, href, img }) => (
        <Link className="feature" href={href} key={key}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="feature-photo" src={`/img/aksi/${img}.webp`} alt="" loading="lazy" width={120} height={120} />
          <span className="feature-body">
            <h3>{t(`${key}.t`)}</h3>
            <p>{t(`${key}.d`)}</p>
          </span>
          <span className="feature-go"><Icon path={mdiArrowRight} /></span>
        </Link>
      ))}
    </div>
  );
}
