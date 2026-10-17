import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetPasswordForm } from '@/components/PasswordForms';
import { getI18n } from '@/lib/i18n-server';
import { getUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Atur password' };
export const dynamic = 'force-dynamic';

export default async function SetPasswordPage() {
  const { t } = await getI18n();
  const { user } = await getUser();
  // Tanpa sesi (tautan kedaluwarsa atau dibuka langsung), minta tautan baru.
  if (!user) {
    return (
      <section className="card narrow stack tight">
        <h1>{t('pw.newTitle')}</h1>
        <p className="alert info">{t('pw.expired')}</p>
        <Link className="btn" href="/lupa-password">{t('pw.send')}</Link>
      </section>
    );
  }
  return <ResetPasswordForm />;
}
