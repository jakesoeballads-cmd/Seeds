const express = require('express');
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

router.post('/logout', (req, res) => {
  clearSessionCookies(res);
  res.redirect('/');
});

module.exports = router;
