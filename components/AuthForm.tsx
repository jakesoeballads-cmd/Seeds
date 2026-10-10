'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { useI18n } from './I18nProvider';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

/** Hanya izinkan tujuan internal setelah login. */
function safeNext(next?: string) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

export function AuthForm({ mode, next }: { mode: 'login' | 'register'; next?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = getBrowserClient();
  const isLogin = mode === 'login';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const target = safeNext(next);

  async function google() {
    if (!supabase) return setError(t('err.needSupabase'));
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) setError(t('err.generic', { msg: error.message }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return setError(t('err.needSupabase'));
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '').trim();
    const password = String(fd.get('password') ?? '');
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(target);
        router.refresh();
      } else {
        const fullName = String(fd.get('name') ?? '').trim();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`,
          },
        });
        if (error) throw error;
        if (data.session) {
          router.replace(target);
          router.refresh();
        } else {
          setInfo(t('auth.checkEmail'));
        }
      }
    } catch (err) {
      setError(t('err.generic', { msg: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy(false);
    }
  }

  const kind = isLogin ? t('auth.login') : t('auth.register');
  const other = isLogin ? '/daftar' : '/masuk';
  const otherHref = next ? `${other}?next=${encodeURIComponent(next)}` : other;

  return (
    <section className="card narrow stack tight">
      <h1>{kind}</h1>
      <p className="muted">{isLogin ? t('auth.loginSub') : t('auth.regSub')}</p>
      <div className="social">
        <button type="button" onClick={google}>
          <GoogleIcon /> {t(isLogin ? 'auth.loginWith' : 'auth.regWith', { p: 'Google' })}
        </button>
      </div>
      <div className="divider">{t('auth.orEmail')}</div>
      <form onSubmit={onSubmit}>
        {!isLogin && (
          <label>
            {t('auth.name')}
            <input name="name" required autoComplete="name" />
          </label>
        )}
        <label>
          {t('auth.email')}
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          {t('auth.pass')}
          {isLogin ? '' : t('auth.passMin')}
          <input name="password" type="password" minLength={8} required autoComplete={isLogin ? 'current-password' : 'new-password'} />
        </label>
        {error && <p className="alert error" role="alert">{error}</p>}
        {info && <p className="alert success" role="status">{info}</p>}
        <button className="btn" type="submit" disabled={busy}>
          {kind}
        </button>
      </form>
      <p className="muted">
        {isLogin ? (
          <>
            {t('auth.noAcc')} <Link href={otherHref}>{t('auth.noAccLink')}</Link>
          </>
        ) : (
          <>
            {t('auth.haveAcc')} <Link href={otherHref}>{t('auth.login')}</Link>
          </>
        )}
      </p>
    </section>
  );
}
