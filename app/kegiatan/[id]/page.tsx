import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProgressBar, when } from '@/components/ActivityBits';
import { Gallery } from '@/components/Gallery';
import { DonateBox } from '@/components/DonateBox';
import { JoinBox } from '@/components/JoinBox';
import { ManageParticipants } from '@/components/ManageParticipants';
import { ShareBox } from '@/components/ShareBox';
import { getActivity } from '@/lib/data';
import { getI18n } from '@/lib/i18n-server';
import { directionsUrl, embedUrl, openUrl } from '@/lib/maps';
import { photosOf } from '@/lib/scene';
import { SITE_URL } from '@/lib/supabase/config';
import { getUser } from '@/lib/supabase/server';
import type { Participant } from '@/lib/types';
import { getWallet } from '@/lib/wallet';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await getActivity((await params).id);
  return a ? { title: a.title, description: a.description.slice(0, 160) } : {};
}

const PARTICIPANT_COLUMNS = 'id, activity_id, user_id, role, status, agreed_benih, created_at, profile:profiles(full_name)';

export default async function ActivityPage({ params }: Props) {
  const { id } = await params;
  const { t, f, lang } = await getI18n();
  const [a, { supabase, user }] = await Promise.all([getActivity(id), getUser()]);
  if (!a) notFound();

  const own = !!user && user.id === a.owner_id;
  let myJoin: Participant | null = null;
  let participants: Participant[] = [];
  if (supabase && user) {
    if (own) {
      const { data } = await supabase.from('participants').select(PARTICIPANT_COLUMNS).eq('activity_id', a.id).order('created_at');
      participants = (data ?? []) as unknown as Participant[];
    } else {
      const { data } = await supabase.from('participants').select(PARTICIPANT_COLUMNS).eq('activity_id', a.id).eq('user_id', user.id).maybeSingle();
      myJoin = (data as unknown as Participant | null) ?? null;
    }
  }

  // Saldo hanya untuk kotak donasi (bukan pemilik kegiatan).
  const wallet = user && !own ? await getWallet(supabase, user.id) : null;

  const photos = photosOf(a);
  const shareUrl = `${SITE_URL}/kegiatan/${a.id}`;
  const full = a.max_participants != null && a.participant_count >= a.max_participants;

  return (
    <div className="program-layout">
      <article className="stack">
        <Gallery photos={photos} />
        <div className="stack tight">
          <h1>{a.title}</h1>
          <p>
            {t('by', { name: '' })}
            <Link className="org-link" href={`/member/${a.owner_id}`}>
              <strong>{own ? t('me.you') : a.org_name}</strong>
            </Link>{' '}
            <span className="org-type">{t('org.' + a.org_type)}</span>
          </p>
          <p className="muted">
            📅 {when(t, f, a, true)}
            <br />📍 {a.location_name}
            <br />👥{' '}
            {t('detail.participants', {
              n: a.max_participants ?? a.participant_count,
              count: f.num(a.participant_count) + (a.max_participants ? ' / ' + f.num(a.max_participants) : ''),
            })}
          </p>
          <p style={{ maxWidth: '70ch', whiteSpace: 'pre-line' }}>{a.description}</p>
          <div>
            <ProgressBar a={a} />
            <p className="muted" style={{ margin: 0 }}>
              🌱 <strong>{f.num(a.collected_benih)}</strong>
              {a.target_benih ? ' / ' + f.num(a.target_benih) : ''} Benih
            </p>
          </div>
        </div>
        <section className="card stack tight">
          <h2>{t('loc.title')}</h2>
          <p className="muted">📍 {a.location_name}</p>
          <iframe
            className="map-embed"
            src={embedUrl(a.lat, a.lng, { lang })}
            title={t('loc.mapTitle')}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          <div className="row">
            <a className="btn small ghost" href={openUrl(a.lat, a.lng)} target="_blank" rel="noopener noreferrer">
              {t('loc.open')}
            </a>
            <a className="btn small ghost" href={directionsUrl(a.lat, a.lng)} target="_blank" rel="noopener noreferrer">
              {t('loc.directions')}
            </a>
          </div>
        </section>
        {own && <ManageParticipants participants={participants} />}
      </article>
      <aside className="stack">
        <section className="card stack tight">
          <h2>{t('join.title')}</h2>
          {own ? (
            <p className="alert success">{t('join.own')}</p>
          ) : !user ? (
            <>
              <p className="muted">{t('join.loginPrompt')}</p>
              <Link className="btn" href={`/masuk?next=/kegiatan/${a.id}`}>
                {t('join.loginBtn')}
              </Link>
            </>
          ) : (
            <JoinBox activityId={a.id} join={myJoin} full={full} />
          )}
        </section>
        {!own && user && (
          <section className="card stack tight">
            <h2>{t('join.msgOrg')}</h2>
            <p className="muted">{t('msg.askOrg')}</p>
            <Link className="btn ghost" href={`/pesan/${a.owner_id}?tentang=${encodeURIComponent(a.title)}`}>
              ✉️ {t('join.msgOrg')}
            </Link>
          </section>
        )}
        {!own && (
          <section className="card stack tight">
            <h2>{t('support.title')}</h2>
            {wallet ? (
              <DonateBox activityId={a.id} balance={wallet.balance} />
            ) : (
              <>
                <p className="muted">{t('donate.login')}</p>
                <Link className="btn" href={`/masuk?next=/kegiatan/${a.id}`}>
                  {t('join.loginBtn')}
                </Link>
              </>
            )}
          </section>
        )}
        <ShareBox title={a.title} url={shareUrl} />
      </aside>
    </div>
  );
}
