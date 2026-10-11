'use client';

import { useEffect, useState } from 'react';
import { LOCALES } from '@/lib/i18n';
import { useI18n } from './I18nProvider';

/** Waktu pesan di zona waktu pengunjung: hari ini → JJ:MM, selain itu tanggal. */
export function LocalTime({ iso, full }: { iso: string; full?: boolean }) {
  const { lang } = useI18n();
  const [text, setText] = useState('');
  useEffect(() => {
    const d = new Date(iso);
    const loc = LOCALES[lang];
    const hm = new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
    const date = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }).format(d);
    const today = d.toDateString() === new Date().toDateString();
    setText(full ? (today ? hm : `${date} ${hm}`) : today ? hm : date);
  }, [iso, lang, full]);
  return <time dateTime={iso}>{text}</time>;
}
