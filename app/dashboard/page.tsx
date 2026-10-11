import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { when } from '@/components/ActivityBits';
import { DONOR_BADGES, POINTS, PRICE, VOLUNTEER_BADGES, badgeInfo, type Badge } from '@/lib/constants';
import type { T } from '@/lib/i18n';
import { getI18n } from '@/lib/i18n-server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getUser } from '@/lib/supabase/server';
import type { Activity, JoinWithActivity } from '@/lib/types';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { t, f } = await getI18n();
  if (!isSupabaseConfigured) return <p className="alert info narrow">{t('err.needSupabase')}</p>;
  const { supabase, user } = await getUser();
  if (!user || !supabase) redirect('/masuk?next=/dashboard');

  const [{ data: profile }, { data: joinsData }, { data: mineData }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    supabase
      .from('participants')
      .select('id, activity_id, user_id, role, status, agreed_benih, created_at, activity:activities(id, title, org_name, date, start_time, end_time)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('activities')
      .select('id, title, location_name, date, start_time, end_time, participant_count, collected_benih, target_benih')
      .eq('owner_id', user.id)
      .order('date', { ascending: false }),
  ]);

  const joins = (joinsData ?? []) as unknown as JoinWithActivity[];
  const mine = (mineData ?? []) as unknown as Activity[];
  const attended = joins.filter((j) => j.role === 'volunteer' && j.status === 'attended').length;
  const points = attended * POINTS;
  const donated = 0; // Donasi aktif di tahap pembayaran.
  const balance = 0;
  const received = mine.reduce((s, a) => s + a.collected_benih, 0);
  const db = badgeInfo(DONOR_BADGES, donated);
  const vb = badgeInfo(VOLUNTEER_BADGES, points);
  const name = profile?.full_name?.split(' ')[0] || user.email?.split('@')[0] || '';

  return (
    <div className="stack">
      <h1>{t('dash.hello', { name })}</h1>
      <div className="row">
        <Link className="btn small ghost" href={`/member/${user.id}`}>{t('profile.viewPublic')}</Link>
        <Link className="btn small ghost" href="/profil">{t('member.edit')}</Link>
      </div>
      <div className="stats">
        <div className="stat">
          <span className="stat-label">{t('dash.owned')}</span>
          <span className="stat-value">🌱 {f.num(balance)}</span>
          <Link className="btn small" href="/dompet">{t('dash.buyWithdraw')}</Link>
        </div>
        <div className="stat">
          <span className="stat-label">{t('dash.donated')}</span>
          <span className="stat-value">💚 {f.num(donated)}</span>
          <BadgeTile t={t} b={db} unit="Benih" num={f.num} />
        </div>
        <div className="stat">
          <span className="stat-label">{t('dash.points')}</span>
          <span className="stat-value">🤝 {f.num(points)}</span>
          <BadgeTile t={t} b={vb} unit={t('unit.points')} num={f.num} />
          <span className="muted">{t('dash.volEvents', { n: attended, p: POINTS })}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{t('dash.received')}</span>
          <span className="stat-value">🌳 {f.num(received)}</span>
          <span className="muted">{t('dash.fromN', { n: mine.length })}</span>
          <Link className="btn small" href="/buat">{t('home.ctaCreate')}</Link>
        </div>
      </div>

      <section className="card stack tight">
        <h2>{t('dash.history')}</h2>
        {joins.length === 0 ? (
          <p className="muted">
            {t('dash.noJoins')} <Link href="/">{t('nav.explore')}</Link>
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('th.activity')}</th>
                  <th>{t('th.date')}</th>
                  <th>{t('th.role')}</th>
                  <th>{t('th.status')}</th>
                </tr>
              </thead>
              <tbody>
                {joins.map((j) => (
                  <tr key={j.id}>
                    <td>
                      {j.activity ? <Link href={`/kegiatan/${j.activity.id}`}>{j.activity.title}</Link> : '—'}
                      {j.activity && (
                        <>
                          <br />
                          <span className="muted">{t('by', { name: j.activity.org_name })}</span>
                        </>
                      )}
                    </td>
                    <td>{j.activity ? when(t, f, j.activity) : ''}</td>
                    <td>{j.role === 'paid' ? t('role.paid') : t('role.vol')}</td>
                    <td>
                      <span className={`badge ${j.status}`}>{t('st.' + j.status)}</span>
                      {j.role === 'volunteer' && j.status === 'attended' && (
                        <>
                          <br />
                          <span className="muted">{t('dash.plusPoints', { n: POINTS })}</span>
                        </>
                      )}
                      {j.agreed_benih ? (
                        <>
                          <br />
                          <span className="muted">{f.num(j.agreed_benih)} Benih</span>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card stack tight">
        <h2>{t('dash.mine')}</h2>
        {mine.length === 0 ? (
          <p className="muted">
            {t('dash.noMine')} <Link href="/buat">{t('home.ctaCreate')}</Link>
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('th.activity')}</th>
                  <th>{t('th.date')}</th>
                  <th>{t('th.participants')}</th>
                  <th>{t('th.collected')}</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/kegiatan/${a.id}`}>{a.title}</Link>
                      <br />
                      <span className="muted">{a.location_name}</span>
                    </td>
                    <td>{when(t, f, a)}</td>
                    <td>{f.num(a.participant_count)}</td>
                    <td>
                      <strong>{f.num(a.collected_benih)}</strong>
                      {a.target_benih ? ' / ' + f.num(a.target_benih) : ''}
                      <br />
                      <span className="muted">{f.rp(a.collected_benih * PRICE)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="badge-columns">
        <section className="card stack tight">
          <h2>{t('dash.donorBadges')}</h2>
          <BadgeList t={t} tiers={DONOR_BADGES} total={donated} req={(x) => t('badge.donorReq', { n: f.num(x.min) })} />
        </section>
        <section className="card stack tight">
          <h2>{t('dash.volBadges')}</h2>
          <BadgeList t={t} tiers={VOLUNTEER_BADGES} total={points} req={(x) => t('badge.volReq', { pts: f.num(x.min), n: x.min / POINTS })} />
        </section>
      </div>
    </div>
  );
}

function BadgeTile({ t, b, unit, num }: { t: T; b: ReturnType<typeof badgeInfo>; unit: string; num: (n: number) => string }) {
  return (
    <>
      {b.current ? (
        <span className="badge-pill">
          {b.current.icon} {t(b.current.key)}
        </span>
      ) : (
        <span className="muted">{t('badge.none')}</span>
      )}
      {b.next ? (
        <>
          <div className="bar" style={{ width: '100%' }}>
            <div style={{ width: `${Math.round(b.progress * 100)}%` }} />
          </div>
          <span className="muted">{t('badge.toNext', { n: num(b.remaining), unit, badge: `${b.next.icon} ${t(b.next.key)}` })}</span>
        </>
      ) : (
        <span className="muted">{t('badge.max')}</span>
      )}
    </>
  );
}

function BadgeList({ t, tiers, total, req }: { t: T; tiers: Badge[]; total: number; req: (b: Badge) => string }) {
  return (
    <ul className="badge-list">
      {tiers.map((x) => (
        <li key={x.key} className={total >= x.min ? 'earned' : ''}>
          {x.icon} <strong>{t(x.key)}</strong> <span className="muted">{req(x)}</span>
        </li>
      ))}
    </ul>
  );
}
