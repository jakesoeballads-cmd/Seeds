import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProgressBar, when } from '@/components/ActivityBits';
import { Avatar } from '@/components/Avatar';
import { POINTS, VOLUNTEER_BADGES, badgeInfo } from '@/lib/constants';
import { getI18n } from '@/lib/i18n-server';
import { getMember } from '@/lib/social';
import { getUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { t } = await getI18n();
  const { supabase } = await getUser();
  const res = await getMember(supabase, (await params).id);
  return { title: res?.member.full_name || t('member.title') };
}

/** Profil publik member. Saldo Benih tidak pernah ditampilkan di sini. */
export default async function MemberPage({ params }: Props) {
  const { id } = await params;
  const { t, f } = await getI18n();
  const { supabase, user } = await getUser();
  const res = await getMember(supabase, id);
  if (!res) notFound();
  const { member: m, activities } = res;

  const isOwner = !!user && user.id === m.id;
  const name = m.full_name || (supabase ? t('member.title') : t('member.sampleName'));
  const points = m.attended * POINTS;
  const vb = badgeInfo(VOLUNTEER_BADGES, points);
  const dmPath = `/pesan/${m.id}`;

  return (
    <div className="stack">
      <section className="profile-head">
        <Avatar name={name} large />
        <div>
          <h1>
            {name}
            {m.is_private && (
              <>
                {' '}
                <span title={t('member.lockedTitle')} aria-label={t('member.lockedTitle')}>🔒</span>
              </>
            )}
          </h1>
          {!m.locked && (
            <>
              <p className="muted">
                {m.city && <>📍 {m.city} · </>}
                {m.created_at ? t('member.since', { date: f.date(m.created_at) }) : t('member.sample')}
              </p>
              {m.bio && <p className="bio">{m.bio}</p>}
            </>
          )}
          {!isOwner && !m.locked && supabase && (
            <div className="row">
              <Link className="btn small" href={user ? dmPath : `/masuk?next=${encodeURIComponent(dmPath)}`}>
                ✉️ {t('member.send')}
              </Link>
            </div>
          )}
          {isOwner && (
            <>
              <div className="row">
                <Link className="btn small" href="/profil">{t('member.edit')}</Link>
                <Link className="btn small ghost" href="/dashboard">{t('nav.dashboard')}</Link>
              </div>
              {m.is_private && <p className="alert info">{t('member.ownLocked')}</p>}
            </>
          )}
        </div>
      </section>

      {m.locked ? (
        <section className="card narrow locked stack tight">
          <p className="lock-big" aria-hidden="true">🔒</p>
          <h2>{t('member.lockedTitle')}</h2>
          <p className="muted">{t('member.lockedText')}</p>
          <Link className="btn" href="/">{t('member.backHome')}</Link>
        </section>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <span className="stat-label">{t('dash.points')}</span>
              <span className="stat-value">🤝 {f.num(points)}</span>
              {vb.current ? (
                <span className="badge-pill">
                  {vb.current.icon} {t(vb.current.key)}
                </span>
              ) : (
                <span className="muted">{t('badge.none')}</span>
              )}
            </div>
            <div className="stat">
              <span className="stat-label">{t('member.organized')}</span>
              <span className="stat-value">🌳 {f.num(activities.length)}</span>
            </div>
          </div>
          <section className="card stack tight">
            <h2>{t('member.activities')}</h2>
            {activities.length === 0 ? (
              <p className="muted">{t('member.noActivities')}</p>
            ) : (
              <ul className="activity-list">
                {activities.map((a) => (
                  <li key={a.id}>
                    <Link href={`/kegiatan/${a.id}`}>
                      <strong>{a.title}</strong>
                    </Link>
                    <span className="muted">
                      {when(t, f, a)} · {a.location_name}
                    </span>
                    <span className="muted">
                      {t('by', { name: a.org_name })} · <span className="org-type">{t('org.' + a.org_type)}</span> · 🌱 {f.num(a.collected_benih)}
                      {a.target_benih ? ' / ' + f.num(a.target_benih) : ''} Benih
                    </span>
                    <ProgressBar a={a} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
