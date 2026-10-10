// Terjemahan untuk skrip di browser. Kamus dikirim server lewat window.BENIH_I18N
// (lihat src/i18n); kuncinya teks Indonesia, variabel ditulis {nama}.
(function () {
  const cfg = window.BENIH_I18N || { lang: 'id', locale: 'id-ID', timeZone: 'Asia/Jakarta', dict: {} };
  const plural = new Intl.PluralRules(cfg.locale);
  const pick = (entry, vars) =>
    !entry || typeof entry === 'string' ? entry : entry[plural.select(Number(vars && vars.n))] || entry.other;
  const t = (text, vars) =>
    (pick(cfg.dict[text], vars) || text).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] !== undefined ? String(vars[k]) : m));
  const dtf = (options) => new Intl.DateTimeFormat(cfg.locale, { timeZone: cfg.timeZone, ...options });
  const medium = dtf({ dateStyle: 'medium' });
  const time = dtf({ hour: '2-digit', minute: '2-digit' });
  const short = dtf({ dateStyle: 'short', timeStyle: 'short' });
  const day = dtf({ year: 'numeric', month: '2-digit', day: '2-digit' });

  window.t = t;
  window.fmt = {
    num: (n) => Number(n || 0).toLocaleString(cfg.locale),
    rupiah: (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID'),
    dateTime: (iso) => short.format(new Date(iso)),
    schedule(start, end) {
      const s = new Date(start);
      const head = `${medium.format(s)} · ${time.format(s)}`;
      if (!end) return head;
      const e = new Date(end);
      return day.format(s) === day.format(e) ? `${head}–${time.format(e)}` : `${head} – ${medium.format(e)} · ${time.format(e)}`;
    },
  };
})();
