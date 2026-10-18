'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { RECOVERY_COOKIE } from '@/lib/constants';
import { useI18n } from './I18nProvider';

type Msg = { ok: boolean; text: string } | null;

/** Lupa password: kirim tautan atur ulang ke email. */
export function ForgotPasswordForm() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const supabase = getBrowserClient();
    if (!supabase) return setMsg({ ok: false, text: t('err.needSupabase') });
    const email = String(new FormData(e.currentTarget).get('email') ?? '').trim();
    setBusy(true);
    setMsg(null);
    // Penanda di browser ini: bila Supabase mengarahkan tautan ke beranda (Redirect URL belum diizinkan),
    // middleware tetap meneruskannya ke halaman ganti password.
    document.cookie = `${RECOVERY_COOKIE}=1; Max-Age=3600; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/atur-password')}`,
    });
    setBusy(false);
    // Pesan yang sama untuk email terdaftar atau tidak, agar daftar member tidak bisa ditebak.
    setMsg(error ? { ok: false, text: t('err.generic', { msg: error.message }) } : { ok: true, text: t('pw.sent') });
  }

  return (
    <section className="card narrow stack tight">
      <h1>{t('pw.forgotTitle')}</h1>
      <p className="muted">{t('pw.forgotSub')}</p>
      <form onSubmit={submit}>
        <label>
          {t('auth.email')}
          <input name="email" type="email" required autoComplete="email" />
        </label>
        {msg && (
          <p className={`alert ${msg.ok ? 'success' : 'error'}`} role="status">
            {msg.text}
          </p>
        )}
        <button className="btn" type="submit" disabled={busy}>
          {t('pw.send')}
        </button>
      </form>
      <p className="muted">
        <Link href="/masuk">← {t('auth.login')}</Link>
      </p>
    </section>
  );
}

/** Atur password baru setelah membuka tautan dari email (pengguna sudah masuk lewat /auth/callback). */
export function ResetPasswordForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const supabase = getBrowserClient();
    if (!supabase) return setMsg({ ok: false, text: t('err.needSupabase') });
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get('password') ?? '');
    if (password !== String(fd.get('confirm') ?? '')) return setMsg({ ok: false, text: t('pw.mismatch') });
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: t('err.generic', { msg: error.message }) });
    setMsg({ ok: true, text: t('pw.changed') });
    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <section className="card narrow stack tight">
      <h1>{t('pw.newTitle')}</h1>
      <form onSubmit={submit}>
        <label>
          {t('pw.new')}
          {t('auth.passMin')}
          <input name="password" type="password" minLength={8} required autoComplete="new-password" />
        </label>
        <label>
          {t('pw.confirm')}
          <input name="confirm" type="password" minLength={8} required autoComplete="new-password" />
        </label>
        {msg && (
          <p className={`alert ${msg.ok ? 'success' : 'error'}`} role="status">
            {msg.text}
          </p>
        )}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? t('btn.saving') : t('pw.save')}
        </button>
      </form>
    </section>
  );
}
