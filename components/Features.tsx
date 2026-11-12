import Link from 'next/link';
import { mdiAccountGroup, mdiArrowRight, mdiCalendarPlus, mdiHandHeart } from '@mdi/js';
import type { T } from '@/lib/i18n';
import { Icon } from './Icon';

// Ikon fitur dari MDI; lencananya bergerak pelan saat pita fitur terlihat (lihat PlayOnView).
const icons = [mdiAccountGroup, mdiHandHeart, mdiCalendarPlus];

// Urutan tampil: buat kegiatan, ikuti kegiatan, kumpulkan & donasikan Benih. Ketiganya bisa diklik.
const items = [
  { key: 'feat3', icon: 2, href: '/buat', img: 'buat' },
  { key: 'feat1', icon: 0, href: '/#cari', img: 'ikuti' },
  { key: 'feat2', icon: 1, href: '/dompet', img: 'donasi' },
];

export type FeatureVariant = 'ikon' | 'foto' | 'blok' | 'ilustrasi' | 'ringkas';

function Art({ name }: { name: string }) {
  if (name === 'buat') {
    return (
      <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <circle cx="250" cy="52" r="26" fill="var(--il-sun)" />
        <path d="M0 130 Q80 92 160 118 T320 108 V180 H0Z" fill="var(--il-hill2)" />
        <path d="M0 150 Q90 120 190 146 T320 140 V180 H0Z" fill="var(--il-hill1)" />
        <rect x="92" y="62" width="5" height="78" rx="2" fill="var(--il-ink)" />
        <path d="M97 64 h58 l-12 15 l12 15 h-58Z" fill="var(--il-flag)" />
        <path d="M118 79 h14 M125 72 v14" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
        <path d="M206 146 v-30" stroke="var(--il-ink)" strokeWidth="4" strokeLinecap="round" />
        <path d="M206 124 q-26 -4 -30 -26 q24 2 30 26Z M206 116 q22 -6 26 -28 q-22 4 -26 28Z" fill="var(--il-leaf)" />
        <ellipse cx="206" cy="148" rx="22" ry="5" fill="var(--il-soil)" />
      </svg>
    );
  }
  if (name === 'ikuti') {
    const person = (x: number, c: string, h: number) => (
      <g>
        <circle cx={x} cy={150 - h - 16} r="14" fill="var(--il-skin)" />
        <path d={`M${x - 20} 152 v-${h - 14} q0 -14 20 -14 q20 0 20 14 v${h - 14}Z`} fill={c} />
      </g>
    );
    return (
      <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <circle cx="70" cy="48" r="22" fill="var(--il-sun)" />
        <path d="M0 128 Q100 100 200 124 T320 116 V180 H0Z" fill="var(--il-hill2)" />
        {person(110, 'var(--il-flag)', 58)}
        {person(206, 'var(--il-ink)', 60)}
        {person(158, 'var(--il-leaf)', 70)}
        <path d="M0 150 Q120 136 200 150 T320 146 V180 H0Z" fill="var(--il-hill1)" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path d="M0 140 Q90 118 170 136 T320 128 V180 H0Z" fill="var(--il-hill2)" />
      <circle cx="160" cy="112" r="40" fill="var(--il-sun)" />
      <circle cx="160" cy="112" r="31" fill="none" stroke="var(--il-ink)" strokeOpacity=".25" strokeWidth="3" />
      <path d="M160 128 v-34" stroke="var(--il-ink)" strokeWidth="5" strokeLinecap="round" />
      <path d="M160 104 q-30 -4 -34 -30 q28 2 34 30Z M160 96 q26 -8 30 -32 q-26 4 -30 32Z" fill="var(--il-leaf)" />
      <path d="M232 52 c0 -10 14 -12 16 -2 c2 -10 16 -8 16 2 c0 10 -16 18 -16 18 s-16 -8 -16 -18Z" fill="var(--il-flag)" />
      <path d="M78 60 c0 -7 10 -8 11 -1 c1 -7 11 -6 11 1 c0 7 -11 13 -11 13 s-11 -6 -11 -13Z" fill="var(--il-flag)" opacity=".6" />
      <path d="M0 158 Q100 146 190 158 T320 154 V180 H0Z" fill="var(--il-hill1)" />
    </svg>
  );
}

export function Features({ t, variant = 'ikon' }: { t: T; variant?: FeatureVariant }) {
  return (
    <div className={`features v-${variant}`}>
      {items.map(({ key, icon, href, img }) => (
        <Link className="feature" href={href} key={key}>
          {(variant === 'foto' || variant === 'ringkas') && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="feature-photo" src={`/img/aksi/${img}.webp`} alt="" loading="lazy" />
          )}
          {variant === 'ilustrasi' && <span className="feature-art"><Art name={img} /></span>}
          {variant !== 'ilustrasi' && variant !== 'ringkas' && (
            <span className="feature-badge"><Icon path={icons[icon]} /></span>
          )}
          <span className="feature-body">
            <h3>{t(`${key}.t`)}</h3>
            <p>{t(`${key}.d`)}</p>
          </span>
          {variant !== 'ikon' && <span className="feature-go"><Icon path={mdiArrowRight} /></span>}
        </Link>
      ))}
    </div>
  );
}
