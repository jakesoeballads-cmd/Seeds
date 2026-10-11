import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { I18nProvider } from '@/components/I18nProvider';
import { LangSelect } from '@/components/LangSelect';
import { Nav } from '@/components/Nav';
import { Logo } from '@/components/Logo';
import { getI18n } from '@/lib/i18n-server';
import { isSupabaseConfigured, supabaseConfigInvalid } from '@/lib/supabase/config';

export const metadata: Metadata = {
  title: { default: 'Benih', template: '%s · Benih' },
  description: 'Tempat para environmentalist berkontribusi dan saling mendukung untuk pelestarian lingkungan.',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#74ac00',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, t } = await getI18n();
  return (
    <html lang={lang}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Courier+Prime&family=Lato:wght@400;700;900&family=Source+Serif+4:opsz,wght@8..60,600&display=swap"
        />
      </head>
      <body>
        <I18nProvider lang={lang}>
          {!isSupabaseConfigured && <div className="notice">{t(supabaseConfigInvalid ? 'setup.invalid' : 'setup.notice')}</div>}
          <header className="topbar">
            <Link className="brand" href="/" aria-label={t('brand.label')}>
              <Logo />
              Benih
            </Link>
            <Nav />
            <LangSelect />
          </header>
          <main className="container">{children}</main>
          <footer className="footer">© {new Date().getFullYear()} PT Daya Reforestasi Indonesia</footer>
        </I18nProvider>
      </body>
    </html>
  );
}
