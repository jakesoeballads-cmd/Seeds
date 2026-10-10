const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const { supabase, isConfigured } = require('../config/supabase');
const { setSessionCookies, clearSessionCookies } = require('../middleware/auth');

const router = express.Router();

// Hanya izinkan redirect ke path lokal agar tidak bisa dipakai untuk open redirect.
function safeNext(next) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

function notConfigured(res, view, extra = {}) {
  return res.status(503).render(view, {
    title: view === 'register' ? 'Daftar' : 'Masuk',
    error: 'Supabase belum dikonfigurasi. Isi variabel SUPABASE_* di .env.',
    values: {},
    next: '/',
    ...extra,
  });
}

router.get('/register', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('register', { title: 'Daftar', error: null, info: null, values: {} });
});

router.post('/register', async (req, res, next) => {
  if (!isConfigured) return notConfigured(res, 'register', { info: null });
  const { full_name: fullName = '', email = '', password = '' } = req.body;
  const values = { full_name: fullName, email };

  if (!fullName.trim() || !email.trim() || password.length < 8) {
    return res.status(400).render('register', {
      title: 'Daftar',
      error: 'Nama dan email wajib diisi, kata sandi minimal 8 karakter.',
      info: null,
      values,
    });
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${config.appUrl}/login`,
      },
    });
    if (error) {
      return res.status(400).render('register', { title: 'Daftar', error: error.message, info: null, values });
    }

    // Jika konfirmasi email dimatikan di Supabase, sesi langsung tersedia.
    if (data.session) {
      setSessionCookies(res, data.session);
      return res.redirect('/');
    }
    return res.render('register', {
      title: 'Daftar',
      error: null,
      info: 'Pendaftaran berhasil. Cek email kamu untuk konfirmasi, lalu masuk.',
      values: {},
    });
  } catch (err) {
    next(err);
  }
});

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('login', { title: 'Masuk', error: null, values: {}, next: safeNext(req.query.next) });
});

router.post('/login', async (req, res, next) => {
  const redirectTo = safeNext(req.body.next);
  if (!isConfigured) return notConfigured(res, 'login', { next: redirectTo });
  const { email = '', password = '' } = req.body;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      return res.status(401).render('login', {
        title: 'Masuk',
        error: 'Email atau kata sandi salah.',
        values: { email },
        next: redirectTo,
      });
    }
    setSessionCookies(res, data.session);
    return res.redirect(redirectTo);
  } catch (err) {
    next(err);
  }
});

// ---- Masuk/daftar dengan akun sosial (Supabase Auth OAuth, alur PKCE) ----
// Aktifkan provider di Supabase Dashboard > Authentication > Providers, lalu
// tambahkan `${APP_URL}/auth/callback` ke Redirect URLs.
// Nama di URL -> nama provider di Supabase.
const OAUTH_PROVIDERS = { google: 'google', facebook: 'facebook', x: 'twitter' };
const VERIFIER_COOKIE = 'sb-oauth-verifier';
const NEXT_COOKIE = 'sb-oauth-next';
const STORAGE_KEY = 'benih-oauth';

// Klien sekali pakai dengan penyimpanan di memori, supaya code verifier PKCE
// bisa disimpan di cookie antara redirect ke provider dan callback.
function pkceClient(initial = {}) {
  const store = new Map(Object.entries(initial));
  const client = createClient(config.supabase.url, config.supabase.anonKey, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: STORAGE_KEY,
      storage: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, v),
        removeItem: (k) => store.delete(k),
      },
    },
  });
  return { client, store };
}

const tempCookie = { httpOnly: true, sameSite: 'lax', secure: config.isProduction, maxAge: 10 * 60 * 1000, path: '/' };

router.get('/auth/:provider', async (req, res, next) => {
  const provider = OAUTH_PROVIDERS[req.params.provider];
  if (!provider) return next();
  if (!isConfigured) return res.redirect('/login');
  try {
    const { client, store } = pkceClient();
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${config.appUrl}/auth/callback`, skipBrowserRedirect: true },
    });
    if (error) throw error;
    res.cookie(VERIFIER_COOKIE, store.get(`${STORAGE_KEY}-code-verifier`), tempCookie);
    res.cookie(NEXT_COOKIE, safeNext(req.query.next), tempCookie);
    res.redirect(data.url);
  } catch (err) {
    next(err);
  }
});

router.get('/auth/callback', async (req, res, next) => {
  const verifier = req.cookies[VERIFIER_COOKIE];
  const redirectTo = safeNext(req.cookies[NEXT_COOKIE]);
  res.clearCookie(VERIFIER_COOKIE, tempCookie);
  res.clearCookie(NEXT_COOKIE, tempCookie);

  const renderError = (message) =>
    res.status(400).render('login', { title: 'Masuk', error: message, values: {}, next: redirectTo });

  if (req.query.error) return renderError('Masuk dengan akun sosial dibatalkan atau ditolak.');
  if (!req.query.code || !verifier) return renderError('Sesi masuk kedaluwarsa. Silakan coba lagi.');
  try {
    const { client } = pkceClient({ [`${STORAGE_KEY}-code-verifier`]: verifier });
    const { data, error } = await client.auth.exchangeCodeForSession(String(req.query.code));
    if (error) return renderError('Gagal masuk dengan akun sosial. Silakan coba lagi.');
    setSessionCookies(res, data.session);
    res.redirect(redirectTo === '/' ? '/dashboard' : redirectTo);
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  clearSessionCookies(res);
  res.redirect('/');
});

module.exports = router;
