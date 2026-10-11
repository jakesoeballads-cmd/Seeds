'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { rpcErrorText } from '@/lib/rpc-errors';
import { Rich } from './ActivityBits';
import { useI18n } from './I18nProvider';

const CHIPS = [5, 10, 25, 50];

/** Donasi Benih ke kegiatan member lain (fungsi SQL donate_benih). */
export function DonateBox({ activityId, balance }: { activityId: string; balance: number }) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [amount, setAmount] = useState(10);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isInteger(amount) || amount < 1) return setMsg({ ok: false, text: t('err.min') });
    if (amount > balance) return setMsg({ ok: false, text: t('err.balance') });
    const supabase = getBrowserClient();
    if (!supabase) return setMsg({ ok: false, text: t('err.needSupabase') });
    setBusy(true);
    const { error } = await supabase.rpc('donate_benih', { p_activity_id: activityId, p_amount: amount, p_message: message.trim() || null });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: rpcErrorText(t, error) });
    setMsg({ ok: true, text: t('toast.thanks', { n: f.num(amount) }) });
    setMessage('');
    router.refresh();
  }

  return (
    <form className="stack tight" onSubmit={submit}>
      <p className="muted" style={{ margin: 0 }}>
        <Rich text={t('balance.your', { v: `<strong>${f.num(balance)} Benih</strong>` })} />
        {balance < 1 && (
          <>
            {' · '}
            <Link href="/dompet">{t('nav.buy')}</Link>
          </>
        )}
      </p>
      <div className="chips" role="group" aria-label={t('wd.amount')}>
        {CHIPS.map((n) => (
          <button key={n} type="button" className="chip" aria-pressed={amount === n} onClick={() => setAmount(n)}>
            {f.num(n)} Benih
          </button>
        ))}
      </div>
      <label>
        {t('donate.other')}
        <input type="number" min={1} max={100000} value={Number.isFinite(amount) ? amount : ''} onChange={(e) => setAmount(e.currentTarget.valueAsNumber)} required />
      </label>
      <label>
        {t('donate.msg')}
        <input maxLength={280} placeholder={t('donate.msgPh')} value={message} onChange={(e) => setMessage(e.currentTarget.value)} />
      </label>
      {msg && (
        <p className={`alert ${msg.ok ? 'success' : 'error'}`} role="status">
          {msg.text}
        </p>
      )}
      <button className="btn" type="submit" disabled={busy || balance < 1}>
        {t('donate.send')}
      </button>
    </form>
  );
}
