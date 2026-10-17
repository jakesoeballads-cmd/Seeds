import { PRICE } from '@/lib/constants';
import type { T } from '@/lib/i18n';

// Ikon fitur. Bagian hijau bergerak (anim-*) saat pita fitur terlihat; lihat PlayOnView.

const icons = [
  <svg key="1" viewBox="0 0 96 96" aria-hidden="true" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><circle cx="48" cy="40" r="22" stroke="currentColor" /><path d="M48 62v20M36 82h24" stroke="currentColor" /><path className="anim-draw" pathLength={1} d="M39 40l7 7 13-14" stroke="#74ac00" strokeWidth="6" /></svg>,
  <svg key="2" viewBox="0 0 96 96" aria-hidden="true" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><path d="M48 80S16 60 16 38a16 16 0 0 1 32-6 16 16 0 0 1 32 6c0 22-32 42-32 42Z" stroke="currentColor" /><path className="anim-grow" d="M48 66V44M48 50c-8 0-12-5-12-12 8 0 12 5 12 12Zm0-4c0-7 4-12 12-12 0 7-4 12-12 12Z" fill="#74ac00" stroke="#74ac00" strokeWidth="3" /></svg>,
  <svg key="3" viewBox="0 0 96 96" aria-hidden="true" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><rect x="16" y="22" width="64" height="56" rx="8" stroke="currentColor" /><path d="M16 38h64M32 14v14M64 14v14" stroke="currentColor" /><path className="anim-pulse" d="M48 48v20M38 58h20" stroke="#74ac00" strokeWidth="6" /></svg>,
];

// Urutan tampil: buat kegiatan (paling menonjol), ikuti kegiatan, kumpulkan & donasikan Benih.
const items = [
  { key: 'feat3', icon: 2, big: true },
  { key: 'feat1', icon: 0 },
  { key: 'feat2', icon: 1 },
];

export function Features({ t, rp }: { t: T; rp: (n: number) => string }) {
  return (
    <div className="features">
      {items.map(({ key, icon, big }) => (
        <div className={`feature${big ? ' big' : ''}`} key={key}>
          {icons[icon]}
          <h3>{t(`${key}.t`)}</h3>
          <p>{t(`${key}.d`, { price: rp(PRICE) })}</p>
        </div>
      ))}
    </div>
  );
}
