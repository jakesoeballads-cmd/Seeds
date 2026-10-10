import type { T } from '@/lib/i18n';
import type { Activity } from '@/lib/types';

type F = { num: (n: number) => string; date: (d: string) => string; longDate: (d: string) => string; hm: (s?: string | null) => string };

export function ProgressBar({ a }: { a: Pick<Activity, 'collected_benih' | 'target_benih'> }) {
  if (!a.target_benih) return null;
  const w = Math.min(100, (a.collected_benih / a.target_benih) * 100);
  return (
    <div className="bar">
      <div style={{ width: `${w}%` }} />
    </div>
  );
}

export function collectedText(t: T, f: F, a: Pick<Activity, 'collected_benih' | 'target_benih'>) {
  return t('collected', { n: f.num(a.collected_benih) + (a.target_benih ? ' / ' + f.num(a.target_benih) : '') });
}

export function when(t: T, f: F, a: { date: string; start_time?: string | null; end_time?: string | null }, long = false) {
  const d = long ? f.longDate(a.date) : f.date(a.date);
  return a.start_time && a.end_time ? `${d} · ${t('time.range', { start: f.hm(a.start_time), end: f.hm(a.end_time) })}` : d;
}

/** Menampilkan teks terjemahan yang berisi <strong>…</strong> tanpa dangerouslySetInnerHTML. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(<strong>.*?<\/strong>)/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^<strong>(.*)<\/strong>$/);
        return m ? <strong key={i}>{m[1]}</strong> : <span key={i}>{p}</span>;
      })}
    </>
  );
}
