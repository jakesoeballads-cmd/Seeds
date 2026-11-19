import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { PAYMENTS_ENABLED } from '@/lib/features';
import { getI18n } from '@/lib/i18n-server';
import { TERMS } from '@/lib/legal';

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = await getI18n();
  return { title: TERMS[lang].title };
}

/** Bagian "Pembayaran dan donasi" menyatakan fitur uang mati; tampil hanya selama saklarnya mati. */
const PAYMENTS_SECTION = 5;

export default async function TermsPage() {
  const { lang } = await getI18n();
  const doc = TERMS[lang];
  const sections = PAYMENTS_ENABLED ? doc.sections.filter((_, i) => i !== PAYMENTS_SECTION) : doc.sections;
  return <LegalPage doc={{ ...doc, sections }} />;
}
