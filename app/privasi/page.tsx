import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { getI18n } from '@/lib/i18n-server';
import { PRIVACY } from '@/lib/legal';

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = await getI18n();
  return { title: PRIVACY[lang].title };
}

export default async function PrivacyPage() {
  const { lang } = await getI18n();
  return <LegalPage doc={PRIVACY[lang]} />;
}
