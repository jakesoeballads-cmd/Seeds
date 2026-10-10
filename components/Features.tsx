import { PRICE } from '@/lib/constants';
import type { T } from '@/lib/i18n';

const icons = [
  <svg key="1" viewBox="0 0 96 96" aria-hidden="true" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><circle cx="48" cy="40" r="22" stroke="currentColor" /><path d="M48 62v20M36 82h24" stroke="currentColor" /><path d="M39 40l7 7 13-14" stroke="#74ac00" strokeWidth="6" /></svg>,
  <svg key="2" viewBox="0 0 96 96" aria-hidden="true" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><path d="M48 80S16 60 16 38a16 16 0 0 1 32-6 16 16 0 0 1 32 6c0 22-32 42-32 42Z" stroke="currentColor" /><path d="M48 66V44M48 50c-8 0-12-5-12-12 8 0 12 5 12 12Zm0-4c0-7 4-12 12-12 0 7-4 12-12 12Z" fill="#74ac00" stroke="#74ac00" strokeWidth="3" /></svg>,
  <svg key="3" viewBox="0 0 96 96" aria-hidden="true" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><rect x="16" y="22" width="64" height="56" rx="8" stroke="currentColor" /><path d="M16 38h64M32 14v14M64 14v14" stroke="currentColor" /><path d="M48 48v20M38 58h20" stroke="#74ac00" strokeWidth="6" /></svg>,
  <svg key="4" viewBox="0 0 96 96" aria-hidden="true" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><circle cx="48" cy="40" r="22" stroke="currentColor" /><path d="M36 58l-6 24 18-9 18 9-6-24" stroke="currentColor" /><path d="M48 28l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1Z" fill="#74ac00" stroke="none" /></svg>,
];

export function Features({ t, rp }: { t: T; rp: (n: number) => string }) {
  return (
    <div className="features">
      {[1, 2, 3, 4].map((n, i) => (
        <div className="feature" key={n}>
          {icons[i]}
          <h3>{t(`feat${n}.t`)}</h3>
          <p>{t(`feat${n}.d`, { price: rp(PRICE) })}</p>
        </div>
      ))}
    </div>
  );
}
