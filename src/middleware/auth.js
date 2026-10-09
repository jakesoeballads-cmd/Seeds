const config = require('../config');
const { supabase, isConfigured } = require('../config/supabase');

const ACCESS_COOKIE = 'sb-access-token';
const REFRESH_COOKIE = 'sb-refresh-token';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProduction,
  path: '/',
};

function setSessionCookies(res, session) {
  res.cookie(ACCESS_COOKIE, session.access_token, { ...cookieOptions, maxAge: session.expires_in * 1000 });
  res.cookie(REFRESH_COOKIE, session.refresh_token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
}

function clearSessionCookies(res) {
  res.clearCookie(ACCESS_COOKIE, cookieOptions);
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
}

// Membaca sesi dari cookie (atau header Authorization: Bearer) dan mengisi
// req.user. Tidak menolak request; gunakan requireAuth untuk itu.
async function loadUser(req, res, next) {
  req.user = null;
  res.locals.user = null;
  if (!isConfigured) return next();

  const bearer = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const accessToken = bearer || req.cookies[ACCESS_COOKIE];
  const refreshToken = req.cookies[REFRESH_COOKIE];

  try {
    if (accessToken) {
      const { data, error } = await supabase.auth.getUser(accessToken);
      if (!error && data.user) {
        req.user = data.user;
      }
    }

    // Access token kedaluwarsa: coba perbarui dengan refresh token.
    if (!req.user && refreshToken && !bearer) {
      const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
      if (!error && data.session) {
        setSessionCookies(res, data.session);
        req.user = data.user;
      } else {
        clearSessionCookies(res);
      }
    }
  } catch (err) {
    console.error('[auth] gagal memuat sesi:', err.message);
  }

  res.locals.user = req.user;
  next();
}

function requireAuth(req, res, next) {
  if (req.user) return next();
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
  }
  return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
}

function requireDatabase(req, res, next) {
  if (isConfigured) return next();
  return res.status(503).json({ error: 'Database belum dikonfigurasi. Isi variabel SUPABASE_* di .env.' });
}

module.exports = {
  loadUser,
  requireAuth,
  requireDatabase,
  setSessionCookies,
  clearSessionCookies,
};
