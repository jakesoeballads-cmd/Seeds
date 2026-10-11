import Link from 'next/link';
import { getI18n } from '@/lib/i18n-server';

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <section className="card narrow stack tight empty">
      <h1>404</h1>
      <p>{t('detail.notFound')}</p>
      <Link className="btn" href="/">
        {t('nav.explore')}
      </Link>
    </section>
  );
}
