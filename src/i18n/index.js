// Terjemahan antarmuka: Bahasa Indonesia (bahasa sumber), English, Deutsch.
// Kunci terjemahan adalah teks Indonesia itu sendiri, jadi teks yang belum
// diterjemahkan tetap tampil dalam Bahasa Indonesia. Variabel ditulis {nama}.
const config = require('../config');

const LANGUAGES = {
  id: { label: 'Bahasa Indonesia', short: 'ID', locale: 'id-ID' },
  en: { label: 'English', short: 'EN', locale: 'en-GB' },
  de: { label: 'Deutsch', short: 'DE', locale: 'de-DE' },
};
const DEFAULT_LANG = 'id';
const COOKIE = 'lang';

const dictionaries = {
  id: {},
  en: require('./en.json'),
  de: require('./de.json'),
};

function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k])));
}

// Nilai kamus boleh berupa { one, other } untuk bentuk jamak; jumlahnya
// diambil dari vars.n (aturan Intl.PluralRules bahasa tersebut).
function pick(entry, lang, vars) {
  if (!entry || typeof entry === 'string') return entry;
  const n = Number(vars && vars.n);
  return entry[new Intl.PluralRules(LANGUAGES[lang].locale).select(n)] || entry.other;
}

function translate(lang, text, vars) {
  const dict = dictionaries[lang] || {};
  return interpolate(pick(dict[text], lang, vars) || text, vars);
}

// ?lang= > cookie > Accept-Language > Bahasa Indonesia.
function pickLanguage(req) {
  const fromQuery = req.query && req.query.lang;
  if (LANGUAGES[fromQuery]) return { lang: fromQuery, fromQuery: true };
  const fromCookie = req.cookies && req.cookies[COOKIE];
  if (LANGUAGES[fromCookie]) return { lang: fromCookie };
  const accepted = String(req.headers['accept-language'] || '')
    .split(',')
    .map((part) => part.split(';')[0].trim().slice(0, 2).toLowerCase());
  return { lang: accepted.find((code) => LANGUAGES[code]) || DEFAULT_LANG };
}

function formatters(lang) {
  const { locale } = LANGUAGES[lang];
  const timeZone = config.timeZone;
  const fmt = (options) => new Intl.DateTimeFormat(locale, { timeZone, ...options });
  const dateFull = fmt({ dateStyle: 'full' });
  const dateMedium = fmt({ dateStyle: 'medium' });
  const time = fmt({ hour: '2-digit', minute: '2-digit' });
  const short = fmt({ dateStyle: 'short', timeStyle: 'short' });
  const dayKey = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' });

  return {
    num: (n) => Number(n || 0).toLocaleString(locale),
    rupiah: (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID'),
    date: (iso, style = 'medium') => (iso ? (style === 'full' ? dateFull : dateMedium).format(new Date(iso)) : ''),
    time: (iso) => (iso ? time.format(new Date(iso)) : ''),
    dateTime: (iso) => (iso ? short.format(new Date(iso)) : ''),
    // "Sabtu, 15 Oktober 2026 · 08.00–11.00"; tanggal selesai ditulis bila berbeda hari.
    schedule(start, end, style = 'medium') {
      if (!start) return '';
      const s = new Date(start);
      const head = `${(style === 'full' ? dateFull : dateMedium).format(s)} · ${time.format(s)}`;
      if (!end) return head;
      const e = new Date(end);
      if (dayKey.format(s) === dayKey.format(e)) return `${head}–${time.format(e)}`;
      return `${head} – ${dateMedium.format(e)} · ${time.format(e)}`;
    },
  };
}

const escapeHtml = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function middleware(req, res, next) {
  const { lang, fromQuery } = pickLanguage(req);
  if (fromQuery) {
    res.cookie(COOKIE, lang, { maxAge: 365 * 24 * 3600 * 1000, sameSite: 'lax', path: '/' });
  }
  const t = (text, vars) => translate(lang, text, vars);
  req.lang = lang;
  req.t = t;
  Object.assign(res.locals, {
    lang,
    t,
    languages: LANGUAGES,
    fmt: formatters(lang),
    currentPath: req.path,
    // Untuk menyisipkan nilai ke terjemahan yang berisi HTML (<%- t(...) %>).
    esc: escapeHtml,
    // Tautan halaman yang sama dalam bahasa lain, query lain tetap dibawa.
    langHref(code) {
      const params = new URLSearchParams(req.query);
      params.set('lang', code);
      return `${req.path}?${params}`;
    },
    // Dikirim ke browser untuk skrip di public/js.
    clientI18n: { lang, locale: LANGUAGES[lang].locale, timeZone: config.timeZone, dict: dictionaries[lang] },
  });
  next();
}

module.exports = { LANGUAGES, DEFAULT_LANG, dictionaries, translate, formatters, middleware };
