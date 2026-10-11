import Link from 'next/link';
import { getI18n } from '@/lib/i18n-server';
import { getUnreadCount } from '@/lib/social';
import { getUser } from '@/lib/supabase/server';
import { BottomNav } from './BottomNav';
import { UnreadBadge } from './UnreadBadge';

export async function Nav() {
  const { t } = await getI18n();
  const { supabase, user } = await getUser();

  if (!user) {
    return (
      <>
      <BottomNav userId={null} unread={0} />
      <nav className="main-nav">
        <Link className="navlink" href="/">{t('nav.explore')}</Link>
        <Link className="pill" href="/masuk">
          <span className="leaf">♥</span> {t('nav.donate')}
        </Link>
        <Link className="navlink" href="/masuk">{t('nav.login')}</Link>
      </nav>
      </>
    );
  }

  const unread = await getUnreadCount(supabase);

  return (
    <>
    <BottomNav userId={user.id} unread={unread} />
    <nav className="main-nav">
      <Link className="navlink" href="/">{t('nav.explore')}</Link>
      <Link className="navlink" href="/dashboard">{t('nav.dashboard')}</Link>
      <Link className="navlink" href="/buat">{t('nav.create')}</Link>
      <Link className="navlink nav-badge" href="/pesan">
        {t('nav.messages')} <UnreadBadge initial={unread} />
      </Link>
      <Link className="pill" href="/dompet">
        <span className="leaf">♥</span> {t('nav.buy')}
      </Link>
      <form action="/keluar" method="post">
        <button className="navlink" type="submit">{t('nav.logout')}</button>
      </form>
    </nav>
    </>
  );
}
