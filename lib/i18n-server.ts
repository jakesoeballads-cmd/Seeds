import { cookies } from 'next/headers';
import { LANG_COOKIE, isLang, makeFormat, makeT, type Lang } from './i18n';

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : 'id';
}

export async function getI18n() {
  const lang = await getLang();
  return { lang, t: makeT(lang), f: makeFormat(lang) };
}
