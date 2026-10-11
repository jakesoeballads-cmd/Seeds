import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Rich } from '@/components/ActivityBits';
import { BuyBenih } from '@/components/BuyBenih';
import { WithdrawForm } from '@/components/WithdrawForm';
import { FEE_BPS, PRICE } from '@/lib/constants';
import { getI18n } from '@/lib/i18n-server';
import { methodState, midtransConfig, paypalConfig } from '@/lib/payments/config';
import { snapJsUrl } from '@/lib/payments/midtrans';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getUser } from '@/lib/supabase/server';
import { getWallet } from '@/lib/wallet';

export const metadata: Metadata = { title: 'Benih' };
export const dynamic = 'force-dynamic';

type Trx = { order_id: string; benih_amount: number; gross_amount: number; status: string; provider: string; currency: string; provider_amount: number | null; created_at: string };
type Wd = { id: string; benih_amount: number; fee_idr: number; net_idr: number; bank_name: string; status: string; created_at: string };

/** Saldo, beli Benih (Midtrans/PayPal), tarik ke rekening, dan riwayatnya. */
export default async function WalletPage() {
  const { t, f, lang } = await getI18n();
  // Mode contoh: tampilan tetap muncul (saldo 0, pembelian belum tersedia) dengan pemberitahuan.
  let wallet = { balance: 0, donated: 0 };
  let trxData: unknown[] | null = null;
  let wdData: unknown[] | null = null;
  if (isSupabaseConfigured) {
    const { supabase, user } = await getUser();
    if (!user || !supabase) redirect('/masuk?next=/dompet');
    const [w, trxRes, wdRes] = await Promise.all([
      getWallet(supabase, user.id),
      supabase
        .from('transactions')
        .select('order_id, benih_amount, gross_amount, status, provider, currency, provider_amount, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('withdrawals')
        .select('id, benih_amount, fee_idr, net_idr, bank_name, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30),
    ]);
    wallet = w;
    trxData = trxRes.data;
    wdData = wdRes.data;
  }
  const trx = (trxData ?? []) as Trx[];
  const wds = (wdData ?? []) as Wd[];
  const locale = lang === 'id' ? 'id-ID' : lang === 'de' ? 'de-DE' : 'en-US';
  const paid = (x: Trx) =>
    x.currency !== 'IDR' && x.provider_amount != null
      ? new Intl.NumberFormat(locale, { style: 'currency', currency: x.currency }).format(Number(x.provider_amount))
      : f.rp(x.gross_amount);
  const via = (x: Trx) => (x.currency !== 'IDR' ? 'PayPal' : x.provider === 'simulation' ? t('method.sim') : 'Midtrans');

  return (
    <div className="stack narrow">
      <section className="card stack tight">
        <h1>{t('wallet.title')}</h1>
        {!isSupabaseConfigured && <p className="alert info">{t('err.needSupabase')}</p>}
        <p style={{ margin: 0 }}>
          <Rich text={t('wallet.balance', { v: `🌱 ${f.num(wallet.balance)} Benih` })} />{' '}
          <span className="muted">({f.rp(wallet.balance * PRICE)})</span>
        </p>
        <p className="muted" style={{ margin: 0 }}>{t('wallet.note')}</p>
        <BuyBenih
          midtrans={methodState('midtrans')}
          paypal={methodState('paypal')}
          paypalCurrency={paypalConfig.currency}
          paypalRate={paypalConfig.idrRate}
          snapJs={midtransConfig.clientKey ? snapJsUrl() : null}
          snapClientKey={midtransConfig.clientKey || null}
        />
      </section>

      <section className="card stack tight">
        <h2>{t('wd.title')}</h2>
        <p className="muted" style={{ margin: 0 }}>{t('wd.fee', { pct: f.pct(FEE_BPS) })}</p>
        <WithdrawForm balance={wallet.balance} />
        <h3 style={{ margin: '8px 0 0' }}>{t('wd.history')}</h3>
        {wds.length === 0 ? (
          <p className="muted">{t('wd.none')}</p>
        ) : (
          <ul className="history">
            {wds.map((w) => (
              <li key={w.id}>
                <span>
                  {t('wd.item', { n: f.num(w.benih_amount), net: f.rp(w.net_idr) })}
                  <br />
                  <span className="muted">
                    {t('wd.itemFee', { fee: f.rp(w.fee_idr) })} · {w.bank_name} · {f.date(w.created_at)}
                  </span>
                </span>
                <span className={`badge ${w.status}`}>{t('st.' + w.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack tight">
        <h2>{t('buy.history')}</h2>
        {trx.length === 0 ? (
          <p className="muted">{t('buy.none')}</p>
        ) : (
          <ul className="history">
            {trx.map((x) => (
              <li key={x.order_id}>
                <span>
                  {f.num(x.benih_amount)} Benih · {paid(x)}
                  <br />
                  <span className="muted">
                    {via(x)} · {f.date(x.created_at)}
                  </span>
                </span>
                <span className={`badge ${x.status}`}>{t('st.' + x.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link className="btn ghost" href="/dashboard">
        ← {t('nav.dashboard')}
      </Link>
    </div>
  );
}
