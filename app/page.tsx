import Link from 'next/link';
import { Features } from '@/components/Features';
import { NearbyActivities } from '@/components/NearbyActivities';
import { PlayOnView } from '@/components/PlayOnView';
import { GlobeHero } from '@/components/GlobeHero';
import { Icon } from '@/components/Icon';
import { mdiAccountGroup, mdiPlusCircle } from '@mdi/js';
import { getUpcomingActivities } from '@/lib/data';
import { getI18n } from '@/lib/i18n-server';
import { getUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { t, f } = await getI18n();
  const [{ user }, { activities, error }] = await Promise.all([getUser(), getUpcomingActivities()]);

  return (
    <div className="stack">
      <GlobeHero>
        <div className="inner">
          <h1>{t('home.welcomeTitle')}</h1>
          <p>{t('home.welcomeText')}</p>
          <Link className={user ? 'btn diamond lg' : 'btn aksen lg'} href={user ? '/buat' : '/daftar'}>
            <Icon path={user ? mdiPlusCircle : mdiAccountGroup} />
            {user ? t('home.ctaCreate') : t('home.ctaJoin')}
          </Link>
          <span className="tagline">{t('home.tagline')}</span>
        </div>
      </GlobeHero>
      <PlayOnView className="band full-bleed">
        <div className="inner">
          <h2>{t('home.nearTitle')}</h2>
          <p className="welcome-text">{t('home.nearText')}</p>
          <Features t={t} />
        </div>
      </PlayOnView>
      <h2 style={{ margin: '16px 0 0' }}>{t('home.programs')}</h2>
      {error && <p className="alert error">{t('err.loadActivities')}</p>}
      <NearbyActivities activities={activities} userId={user?.id ?? null} />
    </div>
  );
}
