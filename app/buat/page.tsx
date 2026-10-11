import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CreateForm } from '@/components/CreateForm';
import { getI18n } from '@/lib/i18n-server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Buat Kegiatan' };
export const dynamic = 'force-dynamic';

export default async function CreatePage() {
  const { t } = await getI18n();
  if (!isSupabaseConfigured) {
    return <p className="alert info narrow">{t('err.needSupabase')}</p>;
  }
  const { supabase, user } = await getUser();
  if (!user || !supabase) redirect('/masuk?next=/buat');

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  return <CreateForm userId={user.id} defaultOrg={profile?.full_name ?? ''} />;
}
