'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { mdiAccountCircleOutline, mdiMagnify, mdiMessageTextOutline, mdiPlus } from '@mdi/js';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { useI18n } from './I18nProvider';
import { UnreadBadge } from './UnreadBadge';

/** Menu bawah melayang ala Threads, hanya tampil di layar ponsel (≤760px). */
export function BottomNav({ userId, unread }: { userId: string | null; unread: number }) {
  const { t } = useI18n();
  const path = usePathname() ?? '/';
  const cur = (on: boolean) => (on ? ({ 'aria-current': 'page' } as const) : {});
  const isMsg = path.startsWith('/pesan') || /^\/kegiatan\/[^/]+\/pesan/.test(path);
  const isProfile = ['/dashboard', '/profil', '/masuk', '/daftar'].includes(path) || (!!userId && path === `/member/${userId}`);

  return (
    <nav className="bottom-nav" aria-label={t('bn.label')}>
      <Link href="/" className="home-logo" aria-label={t('bn.home')} {...cur(path === '/')}>
        <Logo height={44} />
      </Link>
      <Link href="/#cari">
        <Icon path={mdiMagnify} />
        <span>{t('bn.search')}</span>
      </Link>
      <Link href={userId ? '/buat' : '/masuk?next=/buat'} className="create" {...cur(path === '/buat')}>
        <Icon path={mdiPlus} />
        <span>{t('bn.create')}</span>
      </Link>
      <Link href={userId ? '/pesan' : '/masuk?next=/pesan'} {...cur(isMsg)}>
        <Icon path={mdiMessageTextOutline} />
        <span>{t('bn.messages')}</span>
        {userId && <UnreadBadge initial={unread} />}
      </Link>
      <Link href={userId ? '/dashboard' : '/masuk'} {...cur(isProfile)}>
        <Icon path={mdiAccountCircleOutline} />
        <span>{userId ? t('bn.profile') : t('nav.loginShort')}</span>
      </Link>
    </nav>
  );
}
