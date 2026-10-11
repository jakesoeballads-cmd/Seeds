'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { useI18n } from './I18nProvider';

type Values = { full_name: string; bio: string; city: string; is_private: boolean };

/** Ubah nama, bio, kota, dan kunci profil. */
export function ProfileForm({ userId, initial }: { userId: string; initial: Values }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const supabase = getBrowserClient();
    if (!supabase) return setMsg({ ok: false, text: t('err.needSupabase') });
    const fd = new FormData(e.currentTarget);
    const v = (k: string) => String(fd.get(k) ?? '').trim();
    const fullName = v('full_name');
    if (fullName.length < 2) return setMsg({ ok: false, text: t('profile.nameMin') });
    setBusy(true);
    setMsg(null);
    const [a, b] = await Promise.all([
      supabase.from('profiles').update({ full_name: fullName }).eq('id', userId),
      supabase.from('profile_details').upsert({
        user_id: userId,
        bio: v('bio') || null,
        city: v('city') || null,
        is_private: fd.get('is_private') === 'on',
        updated_at: new Date().toISOString(),
      }),
    ]);
    setBusy(false);
    const error = a.error ?? b.error;
    setMsg(error ? { ok: false, text: t('err.generic', { msg: error.message }) } : { ok: true, text: t('profile.saved') });
    if (!error) router.refresh();
  }

  return (
    <section className="card narrow stack tight">
      <h1>{t('profile.title')}</h1>
      <form onSubmit={submit}>
        <label>
          {t('profile.name')}
          <input name="full_name" required minLength={2} maxLength={80} defaultValue={initial.full_name} />
        </label>
        <label>
          {t('profile.city')}
          <input name="city" maxLength={80} defaultValue={initial.city} placeholder={t('profile.cityPh')} />
        </label>
        <label>
          {t('profile.bio')}
          <textarea name="bio" rows={4} maxLength={500} defaultValue={initial.bio} placeholder={t('profile.bioPh')} />
        </label>
        <label className="check">
          <input type="checkbox" name="is_private" defaultChecked={initial.is_private} />
          <span>
            <strong>{t('profile.lock')}</strong>
            <br />
            <span className="muted">{t('profile.lockHelp')}</span>
          </span>
        </label>
        {msg && (
          <p className={`alert ${msg.ok ? 'success' : 'error'}`} role="status">
            {msg.text}
          </p>
        )}
        <div className="row">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? t('btn.saving') : t('btn.save')}
          </button>
          <Link className="btn ghost" href={`/member/${userId}`}>
            {t('profile.viewPublic')}
          </Link>
        </div>
      </form>
    </section>
  );
}
