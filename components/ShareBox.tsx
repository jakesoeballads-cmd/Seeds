'use client';

import { useEffect, useState } from 'react';
import { useI18n } from './I18nProvider';

export function ShareBox({ title, url: givenUrl }: { title: string; url: string }) {
  const { t } = useI18n();
  // Bila SITE_URL belum diatur, pakai alamat halaman yang sedang dibuka.
  const [url, setUrl] = useState(givenUrl);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!/^https?:\/\//.test(givenUrl)) setUrl(window.location.origin + givenUrl);
  }, [givenUrl]);

  const text = t('share.text', { title });
  const e = encodeURIComponent;
  const links = [
    ['WhatsApp', `https://wa.me/?text=${e(text + ' ' + url)}`],
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`],
    ['X', `https://x.com/intent/post?text=${e(text)}&url=${e(url)}`],
    ['Threads', `https://www.threads.net/intent/post?text=${e(text + ' ' + url)}`],
  ];

  return (
    <section className="card stack tight">
      <h2>{t('share.title')}</h2>
      <div className="share">
        {links.map(([name, href]) => (
          <a key={name} className="btn small ghost" target="_blank" rel="noopener noreferrer" href={href}>
            {name}
          </a>
        ))}
        <button
          className="btn small ghost"
          type="button"
          onClick={() =>
            navigator.clipboard?.writeText(url).then(
              () => setCopied(t('toast.copied')),
              () => setCopied(t('toast.copyManual', { url })),
            )
          }
        >
          {t('share.copy')}
        </button>
      </div>
      {copied && <p className="muted" role="status" style={{ fontSize: '.85rem', margin: 0 }}>{copied}</p>}
      <p className="muted" style={{ fontSize: '.85rem' }}>{t('share.ig', { url })}</p>
    </section>
  );
}
