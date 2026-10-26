import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CreateForm } from '@/components/CreateForm';
import { editLocked } from '@/lib/constants';
import { getActivity } from '@/lib/data';
import { getI18n } from '@/lib/i18n-server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit Kegiatan' };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function EditActivityPage({ params }: Props) {
  const { id } = await params;
  const { t } = await getI18n();
  if (!isSupabaseConfigured) {
    return <p className="alert info narrow">{t('err.needSupabase')}</p>;
  }
  const [a, { supabase, user }] = await Promise.all([getActivity(id), getUser()]);
  if (!a) notFound();
  if (!user || !supabase) redirect(`/masuk?next=/kegiatan/${id}/ubah`);
  if (user.id !== a.owner_id) redirect(`/kegiatan/${id}`);

  if (editLocked(a)) {
    return (
      <section className="card stack tight narrow">
        <h1>{t('edit.title')}</h1>
        <p className="alert info">{t('edit.locked')}</p>
        <div><Link className="btn ghost" href={`/kegiatan/${id}`}>{t('edit.back')}</Link></div>
      </section>
    );
  }
  return <CreateForm userId={user.id} defaultOrg={a.org_name} activity={a} />;
}
