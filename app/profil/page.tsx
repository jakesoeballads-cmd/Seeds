import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ProfileForm } from '@/components/ProfileForm';
import { getI18n } from '@/lib/i18n-server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Profil' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const { t } = await getI18n();
  if (!isSupabaseConfigured) return <p className="alert info narrow">{t('err.needSupabase')}</p>;
  const { supabase, user } = await getUser();
  if (!user || !supabase) redirect('/masuk?next=/profil');

  const [{ data: profile }, { data: details }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    supabase.from('profile_details').select('bio, city, is_private').eq('user_id', user.id).maybeSingle(),
  ]);

  return (
    <ProfileForm
      userId={user.id}
      initial={{
        full_name: profile?.full_name ?? '',
        bio: details?.bio ?? '',
        city: details?.city ?? '',
        is_private: !!details?.is_private,
      }}
    />
  );
}
