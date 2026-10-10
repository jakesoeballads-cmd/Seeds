const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { loadUser } = require('./middleware/auth');

const app = express();
const root = path.join(__dirname, '..');

app.set('view engine', 'ejs');
app.set('views', path.join(root, 'views'));
app.disable('x-powered-by');

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(root, 'public')));
app.use(loadUser);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/pages'));
app.use('/api/programs', require('./routes/programs'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/wallet', require('./routes/wallet'));

app.use((req, res) => {
  if (req.originalUrl.startsWith('/api/')) return res.status(404).json({ error: 'Tidak ditemukan.' });
  res.status(404).render('error', { title: 'Tidak ditemukan', message: 'Halaman tidak ditemukan.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // MulterError: unggahan foto terlalu besar atau terlalu banyak.
  const status = err.status || (err.name === 'MulterError' ? 400 : 500);
  if (status >= 500) console.error(err);
  const multerMessages = { LIMIT_FILE_SIZE: 'Ukuran foto maksimal 5 MB.', LIMIT_FILE_COUNT: 'Maksimal 5 foto.' };
  const message = status >= 500 ? 'Terjadi kesalahan pada server.' : multerMessages[err.code] || err.message;
  if (req.originalUrl.startsWith('/api/')) return res.status(status).json({ error: message });
  res.status(status).render('error', { title: 'Kesalahan', message });
});

module.exports = app;
