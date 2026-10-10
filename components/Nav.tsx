import Link from 'next/link';
import { getI18n } from '@/lib/i18n-server';
import { getUser } from '@/lib/supabase/server';

export async function Nav() {
  const { t } = await getI18n();
  const { user } = await getUser();

  if (!user) {
    return (
      <nav>
        <Link className="navlink" href="/">{t('nav.explore')}</Link>
        <Link className="pill" href="/masuk">
          <span className="leaf">♥</span> {t('nav.donate')}
        </Link>
        <Link className="navlink" href="/masuk">{t('nav.login')}</Link>
      </nav>
    );
  }

  return (
    <nav>
      <Link className="navlink" href="/">{t('nav.explore')}</Link>
      <Link className="navlink" href="/dashboard">{t('nav.dashboard')}</Link>
      <Link className="navlink" href="/buat">{t('nav.create')}</Link>
      <Link className="pill" href="/dompet">
        <span className="leaf">♥</span> {t('nav.buy')}
      </Link>
      <form action="/keluar" method="post">
        <button className="navlink" type="submit">{t('nav.logout')}</button>
      </form>
    </nav>
  );
}
