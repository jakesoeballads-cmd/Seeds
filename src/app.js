const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { loadUser } = require('./middleware/auth');
const i18n = require('./i18n');
const { isConfigured } = require('./config/supabase');
const { unreadCount } = require('./services/messages');

// Lencana jumlah pesan belum dibaca di menu, hanya untuk halaman HTML.
async function unreadMessages(req, res, next) {
  res.locals.unread = 0;
  if (!req.user || !isConfigured || req.method !== 'GET' || req.path.startsWith('/api/')) return next();
  try {
    res.locals.unread = await unreadCount(req.user.id);
  } catch (err) {
    console.error('[unread]', err.message);
  }
  next();
}

const app = express();
const root = path.join(__dirname, '..');

app.set('view engine', 'ejs');
app.set('views', path.join(root, 'views'));
app.disable('x-powered-by');

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(root, 'public')));
app.use(i18n.middleware);
app.use(loadUser);
app.use(unreadMessages);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/pages'));
app.use('/api/programs', require('./routes/programs'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/messages', require('./routes/messages'));

app.use((req, res) => {
  if (req.originalUrl.startsWith('/api/')) return res.status(404).json({ error: req.t('Tidak ditemukan.') });
  res.status(404).render('error', { title: req.t('Tidak ditemukan'), message: req.t('Halaman tidak ditemukan.') });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // MulterError: unggahan foto terlalu besar atau terlalu banyak.
  const status = err.status || (err.name === 'MulterError' ? 400 : 500);
  if (status >= 500) console.error(err);
  const multerMessages = { LIMIT_FILE_SIZE: 'Ukuran foto maksimal 5 MB.', LIMIT_FILE_COUNT: 'Maksimal {n} foto.' };
  const raw = status >= 500 ? 'Terjadi kesalahan pada server.' : multerMessages[err.code] || err.message;
  // Pesan galat (termasuk dari fungsi SQL) diterjemahkan sesuai bahasa pengunjung.
  const message = req.t(raw, err.vars || { n: 5 });
  // Kode stabil agar skrip browser tidak bergantung pada teks pesan.
  const code = /tidak cukup/.test(raw) ? 'insufficient_balance' : undefined;
  if (req.originalUrl.startsWith('/api/')) return res.status(status).json({ error: message, code });
  res.status(status).render('error', { title: req.t('Kesalahan'), message });
});

module.exports = app;
