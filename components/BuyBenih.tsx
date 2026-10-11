'use client';

import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PRICE } from '@/lib/constants';
import { convertFromIdr } from '@/lib/payments/paypal-core';
import { Rich } from './ActivityBits';
import { useI18n } from './I18nProvider';

type State = 'live' | 'simulation' | 'off';
type Snap = { pay: (token: string, opts: Record<string, (r?: unknown) => void>) => void };

export type BuyProps = {
  midtrans: State;
  paypal: State;
  paypalCurrency: string;
  paypalRate: number;
  /** Snap popup: diisi bila NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ada. */
  snapJs: string | null;
  snapClientKey: string | null;
};

/** Form beli Benih: pilih metode (Midtrans atau PayPal), total dihitung langsung. */
export function BuyBenih(p: BuyProps) {
  const { t, f, lang } = useI18n();
  const router = useRouter();
  const first = p.midtrans === 'off' && p.paypal !== 'off' ? 'paypal' : 'midtrans';
  const [method, setMethod] = useState<'midtrans' | 'paypal'>(first);
  const [amount, setAmount] = useState(25);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);

  const none = p.midtrans === 'off' && p.paypal === 'off';
  const idr = (Number.isFinite(amount) ? amount : 0) * PRICE;
  const usd = (n: number) =>
    new Intl.NumberFormat(lang === 'id' ? 'id-ID' : lang === 'de' ? 'de-DE' : 'en-US', { style: 'currency', currency: p.paypalCurrency }).format(n);
  const total = method === 'paypal' ? `${usd(Number(convertFromIdr(idr, p.paypalRate)))} (≈ ${f.rp(idr)})` : f.rp(idr);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000) return setMsg({ kind: 'error', text: t('err.amount') });
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/payments/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ benih_amount: amount, method }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok || !data.redirect_url) {
      setBusy(false);
      return setMsg({ kind: 'error', text: t(data.error || 'err.payment') });
    }
    const snap = (window as unknown as { snap?: Snap }).snap;
    if (method === 'midtrans' && data.snap_token && snap) {
      // Popup Midtrans Snap. Status final tetap dicatat lewat webhook.
      const done = () => router.push(`/dompet/selesai?order_id=${encodeURIComponent(data.order_id)}`);
      snap.pay(data.snap_token, {
        onSuccess: done,
        onPending: done,
        onError: () => {
          setBusy(false);
          setMsg({ kind: 'error', text: t('toast.payFail') });
        },
        onClose: () => {
          setBusy(false);
          router.refresh();
        },
      });
      return;
    }
    setMsg({ kind: 'info', text: t('pay.redirecting') });
    window.location.href = data.redirect_url;
  }

  const label = (s: State) => (s === 'off' ? ` · ${t('method.off')}` : s === 'simulation' ? ` · ${t('method.sim')}` : '');

  return (
    <form className="stack tight" onSubmit={submit}>
      {p.snapJs && p.snapClientKey && p.midtrans === 'live' && <Script src={p.snapJs} data-client-key={p.snapClientKey} strategy="lazyOnload" />}
      {(p.midtrans === 'simulation' || p.paypal === 'simulation') && <p className="alert info">{t('pay.simNotice')}</p>}
      {none && <p className="alert info">{t('pay.noneAvailable')}</p>}
      <label>
        {t('wallet.buyAmount')}
        <input type="number" min={1} max={100000} value={Number.isFinite(amount) ? amount : ''} onChange={(e) => setAmount(e.currentTarget.valueAsNumber)} required />
      </label>
      <fieldset className="role-options" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="stat-label">{t('pay.methods')}</legend>
        <label className="role-option" aria-disabled={p.midtrans === 'off'}>
          <input type="radio" name="method" value="midtrans" checked={method === 'midtrans'} disabled={p.midtrans === 'off'} onChange={() => setMethod('midtrans')} />
          <strong>{t('method.midtrans')}</strong>
          <span className="muted">{label(p.midtrans)}</span>
          <br />
          <span className="muted">{t('method.midtransDesc')}</span>
        </label>
        <label className="role-option" aria-disabled={p.paypal === 'off'}>
          <input type="radio" name="method" value="paypal" checked={method === 'paypal'} disabled={p.paypal === 'off'} onChange={() => setMethod('paypal')} />
          <strong>PayPal</strong>
          <span className="muted">{label(p.paypal)}</span>
          <br />
          <span className="muted">{t('method.paypalDesc', { currency: p.paypalCurrency, rate: f.rp(p.paypalRate) })}</span>
        </label>
      </fieldset>
      <p className="muted" style={{ margin: 0 }} aria-live="polite">
        <Rich text={t('wallet.total', { total: `<strong>${total}</strong>`, price: f.rp(PRICE) })} />
      </p>
      {msg && (
        <p className={`alert ${msg.kind}`} role="status">
          {msg.text}
        </p>
      )}
      <button className="btn" type="submit" disabled={busy || none || (method === 'midtrans' ? p.midtrans : p.paypal) === 'off'}>
        {t('wallet.pay')}
      </button>
    </form>
  );
}
