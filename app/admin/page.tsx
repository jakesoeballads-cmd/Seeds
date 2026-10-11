import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { when } from '@/components/ActivityBits';
import { AdminDeleteActivity } from '@/components/AdminDeleteActivity';
import { AdminWithdrawals, type AdminWithdrawal } from '@/components/AdminWithdrawals';
import { isAdmin } from '@/lib/admin';
import { getI18n } from '@/lib/i18n-server';
import { sampleActivities } from '@/lib/sample';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getUser } from '@/lib/supabase/server';
import type { Activity } from '@/lib/types';

export const metadata: Metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

type ActivityRow = Pick<Activity, 'id' | 'owner_id' | 'title' | 'org_name' | 'location_name' | 'date' | 'start_time' | 'end_time' | 'participant_count' | 'collected_benih'>;
type Processed = { id: string; user_id: string; net_idr: number; status: string; admin_note: string | null; processed_at: string | null };

/** Data contoh agar tampilan panel bisa dilihat sebelum Supabase terhubung. */
function demoData() {
  const ago = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
  const pending: AdminWithdrawal[] = [
    { id: 'w1', user_id: 'sample', name: 'Komunitas Hijau Srengseng', benih_amount: 300, fee_idr: 15000, net_idr: 585000, bank_name: 'BCA', bank_account_number: '1234567890', bank_account_name: 'Komunitas Hijau Srengseng', created_at: ago(0) },
    { id: 'w2', user_id: 'sample', name: 'Rina Wulandari', benih_amount: 50, fee_idr: 2500, net_idr: 97500, bank_name: 'BRI', bank_account_number: '002301009876543', bank_account_name: 'Rina Wulandari', created_at: ago(1) },
  ];
  const processed: (Processed & { name: string })[] = [
    { id: 'w3', user_id: 'sample', name: 'Yayasan Pesisir Lestari', net_idr: 1950000, status: 'paid', admin_note: null, processed_at: ago(2) },
    { id: 'w4', user_id: 'sample', name: 'Dedi Kurniawan', net_idr: 48750, status: 'rejected', admin_note: 'Nama rekening tidak cocok', processed_at: ago(3) },
  ];
  return { pending, processed, activities: sampleActivities() as ActivityRow[] };
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { t, f } = await getI18n();
  const q = ((await searchParams).q ?? '').trim().slice(0, 100);
  const demo = !isSupabaseConfigured;

  let pending: AdminWithdrawal[] = [];
  let processed: (Processed & { name: string })[] = [];
  let activities: ActivityRow[] = [];

  if (demo) {
    ({ pending, processed, activities } = demoData());
    if (q) activities = activities.filter((a) => a.title.toLowerCase().includes(q.toLowerCase()));
  } else {
    const { supabase, user } = await getUser();
    if (!user || !supabase) redirect('/masuk?next=/admin');
    if (!(await isAdmin(supabase))) notFound();

    let actQuery = supabase
      .from('activities')
      .select('id, owner_id, title, org_name, location_name, date, start_time, end_time, participant_count, collected_benih')
      .order('created_at', { ascending: false })
      .limit(50);
    if (q) actQuery = actQuery.ilike('title', `%${q.replace(/[%_\\]/g, '\\$&')}%`);

    const [pendRes, procRes, actRes] = await Promise.all([
      supabase
        .from('withdrawals')
        .select('id, user_id, benih_amount, fee_idr, net_idr, bank_name, bank_account_number, bank_account_name, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
      supabase
        .from('withdrawals')
        .select('id, user_id, net_idr, status, admin_note, processed_at')
        .neq('status', 'pending')
        .order('processed_at', { ascending: false })
        .limit(20),
      actQuery,
    ]);
    const pend = (pendRes.data ?? []) as Omit<AdminWithdrawal, 'name'>[];
    const proc = (procRes.data ?? []) as Processed[];
    activities = (actRes.data ?? []) as ActivityRow[];

    const ids = [...new Set([...pend, ...proc].map((w) => w.user_id))];
    const { data: profs } = ids.length
      ? await supabase.from('profiles').select('id, full_name').in('id', ids)
      : { data: [] as { id: string; full_name: string | null }[] };
    const nameOf = (id: string) => (profs ?? []).find((p) => p.id === id)?.full_name || t('admin.member');
    pending = pend.map((w) => ({ ...w, name: nameOf(w.user_id) }));
    processed = proc.map((w) => ({ ...w, name: nameOf(w.user_id) }));
  }

  const totalNet = pending.reduce((s, w) => s + w.net_idr, 0);

  return (
    <div className="stack">
      <h1>{t('admin.title')}</h1>
      {demo && <p className="alert info">{t('admin.demo')}</p>}

      <div className="stats">
        <div className="stat">
          <span className="stat-label">{t('admin.statPending')}</span>
          <span className="stat-value">{f.num(pending.length)}</span>
          <span className="muted">{t('admin.statToTransfer', { v: f.rp(totalNet) })}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{t('admin.statActivities')}</span>
          <span className="stat-value">{f.num(activities.length)}{activities.length >= 50 ? '+' : ''}</span>
        </div>
      </div>

      <section className="card stack tight" id="penarikan">
        <h2>{t('admin.wdTitle')}</h2>
        <p className="muted" style={{ margin: 0 }}>{t('admin.wdHelp')}</p>
        <AdminWithdrawals items={pending} demo={demo} />
        {processed.length > 0 && (
          <>
            <h3 style={{ margin: '12px 0 0' }}>{t('admin.wdProcessed')}</h3>
            <ul className="history">
              {processed.map((w) => (
                <li key={w.id}>
                  <span>
                    {w.name} · {f.rp(w.net_idr)}
                    {w.admin_note && <><br /><span className="muted">{w.admin_note}</span></>}
                  </span>
                  <span className={`badge ${w.status}`}>{t('st.' + w.status)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card stack tight" id="kegiatan">
        <h2>{t('admin.actTitle')}</h2>
        <form className="row admin-search" action="/admin#kegiatan">
          <input name="q" defaultValue={q} placeholder={t('admin.searchPh')} aria-label={t('admin.searchPh')} />
          <button className="btn small" type="submit">{t('admin.search')}</button>
        </form>
        {activities.length === 0 ? (
          <p className="muted">{t('admin.noActivities')}</p>
        ) : (
          <ul className="admin-list">
            {activities.map((a) => (
              <li key={a.id} className="admin-item admin-activity">
                <div>
                  <Link href={`/kegiatan/${a.id}`}><strong>{a.title}</strong></Link>
                  <br />
                  <span className="muted">
                    {t('by', { name: '' })}<Link href={`/member/${a.owner_id}`}>{a.org_name}</Link> · {a.location_name}
                  </span>
                  <br />
                  <span className="muted">
                    {when(t, f, a)} · 👥 {f.num(a.participant_count)} · 🌱 {f.num(a.collected_benih)}
                  </span>
                </div>
                <AdminDeleteActivity id={a.id} title={a.title} demo={demo} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
