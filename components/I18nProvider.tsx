'use client';

import { createContext, useContext, useMemo } from 'react';
import { makeFormat, makeT, type Lang } from '@/lib/i18n';

const Ctx = createContext<Lang>('id');

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const lang = useContext(Ctx);
  return useMemo(() => ({ lang, t: makeT(lang), f: makeFormat(lang) }), [lang]);
}
