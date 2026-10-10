import id from '@/messages/id.json';
import en from '@/messages/en.json';
import de from '@/messages/de.json';

export type Lang = 'id' | 'en' | 'de';
type Plural = { one?: string; other: string };
type Dict = Record<string, string | Plural>;

export const LANGS: Lang[] = ['id', 'en', 'de'];
export const LOCALES: Record<Lang, string> = { id: 'id-ID', en: 'en-GB', de: 'de-DE' };
export const LANG_COOKIE = 'benih.lang';

const DICTS: Record<Lang, Dict> = { id: id as Dict, en: en as Dict, de: de as Dict };

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as string[]).includes(v);
}

export type Vars = Record<string, string | number>;

/** Terjemahan dengan {variabel} dan bentuk jamak (dipilih lewat vars.n atau vars.count). */
export function translate(lang: Lang, key: string, vars: Vars = {}): string {
  let s = DICTS[lang][key] ?? DICTS.id[key] ?? key;
  if (typeof s === 'object') {
    const n = Number(vars.n ?? vars.count ?? 0);
    const rule = new Intl.PluralRules(LOCALES[lang]).select(n) as keyof Plural;
    s = s[rule] ?? s.other;
  }
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export type T = (key: string, vars?: Vars) => string;
export const makeT = (lang: Lang): T => (key, vars) => translate(lang, key, vars);

/** Pemformat angka, rupiah, dan tanggal sesuai bahasa. */
export function makeFormat(lang: Lang) {
  const loc = LOCALES[lang];
  const num = (n: number, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(loc, opts).format(n);
  const toDate = (d: string | Date) => (typeof d === 'string' ? new Date(d.length === 10 ? d + 'T00:00:00' : d) : d);
  const hm = (s?: string | null) => {
    if (!s) return '';
    const [h, m] = s.split(':').map(Number);
    return new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(2000, 0, 1, h, m));
  };
  return {
    num,
    rp: (n: number) => 'Rp' + num(n),
    km: (n: number) => num(n, { maximumFractionDigits: 1 }),
    pct: (bps: number) => num(bps / 10000, { style: 'percent', maximumFractionDigits: 1 }),
    date: (d: string | Date) => new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric' }).format(toDate(d)),
    longDate: (d: string | Date) =>
      new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(toDate(d)),
    hm,
  };
}
