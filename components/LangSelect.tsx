'use client';

import { useRouter } from 'next/navigation';
import { LANG_COOKIE, LANGS, isLang } from '@/lib/i18n';
import { useI18n } from './I18nProvider';

export function LangSelect() {
  const { lang, t } = useI18n();
  const router = useRouter();
  return (
    <select
      className="lang-select"
      value={lang}
      aria-label={t('lang.label')}
      title={t('lang.label')}
      onChange={(e) => {
        const v = e.target.value;
        if (!isLang(v)) return;
        document.cookie = `${LANG_COOKIE}=${v}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
    >
      {LANGS.map((l) => (
        <option key={l} value={l} lang={l}>
          {l.toUpperCase()}
        </option>
      ))}
    </select>
  );
}
