'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from './I18nProvider';
import { UnreadBadge } from './UnreadBadge';

const icon = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

/** Menu bawah melayang ala Threads, hanya tampil di layar ponsel (≤760px). */
export function BottomNav({ userId, unread }: { userId: string | null; unread: number }) {
  const { t } = useI18n();
  const path = usePathname() ?? '/';
  const cur = (on: boolean) => (on ? ({ 'aria-current': 'page' } as const) : {});
  const isMsg = path.startsWith('/pesan') || /^\/kegiatan\/[^/]+\/pesan/.test(path);
  const isProfile = ['/dashboard', '/profil', '/masuk', '/daftar'].includes(path) || (!!userId && path === `/member/${userId}`);

  return (
    <nav className="bottom-nav" aria-label={t('bn.label')}>
      <Link href="/" {...cur(path === '/')}>
        {icon(<path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />)}
        <span>{t('bn.home')}</span>
      </Link>
      <Link href="/#cari">
        {icon(
          <>
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </>,
        )}
        <span>{t('bn.search')}</span>
      </Link>
      <Link href={userId ? '/buat' : '/masuk?next=/buat'} className="create" {...cur(path === '/buat')}>
        {icon(<path d="M12 5v14M5 12h14" />)}
        <span>{t('bn.create')}</span>
      </Link>
      <Link href={userId ? '/pesan' : '/masuk?next=/pesan'} {...cur(isMsg)}>
        {icon(<path d="M4 5.5h16v11H9l-5 4z" />)}
        <span>{t('bn.messages')}</span>
        {userId && <UnreadBadge initial={unread} />}
      </Link>
      <Link href={userId ? '/dashboard' : '/masuk'} {...cur(isProfile)}>
        {icon(
          <>
            <circle cx="12" cy="8.5" r="4" />
            <path d="M4.5 20.5c1.2-4 4-6 7.5-6s6.3 2 7.5 6" />
          </>,
        )}
        <span>{userId ? t('bn.profile') : t('nav.loginShort')}</span>
      </Link>
    </nav>
  );
}
