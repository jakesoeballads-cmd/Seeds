'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FEE_BPS, PRICE } from '@/lib/constants';
import { getBrowserClient } from '@/lib/supabase/client';
import { rpcErrorText } from '@/lib/rpc-errors';
import { useI18n } from './I18nProvider';

/** Rincian penarikan; fungsi SQL request_withdrawal menghitung hal yang sama. */
export function calcWithdrawal(n: number) {
  const gross = n * PRICE;
  const fee = Math.round((gross * FEE_BPS) / 10000);
  return { gross, fee, net: gross - fee };
}

export function WithdrawForm({ balance }: { balance: number }) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [amount, setAmount] = useState(balance > 0 ? Math.min(50, balance) : NaN);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const valid = Number.isInteger(amount) && amount >= 1;
  const b = calcWithdrawal(valid ? amount : 0);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!valid) return setMsg({ ok: false, text: t('err.min') });
    if (amount > balance) return setMsg({ ok: false, text: t('toast.wdExceeds') });
    const supabase = getBrowserClient();
    if (!supabase) return setMsg({ ok: false, text: t('err.needSupabase') });
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.rpc('request_withdrawal', {
      p_amount: amount,
      p_bank_name: String(fd.get('bank') ?? ''),
      p_bank_account_number: String(fd.get('acc') ?? ''),
      p_bank_account_name: String(fd.get('name') ?? ''),
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: rpcErrorText(t, error) });
    setMsg({ ok: true, text: t('toast.wdOk', { net: f.rp(b.net) }) });
    router.refresh();
  }

  const off = balance < 1;
  return (
    <form className="stack tight" onSubmit={submit}>
      <label>
        {t('wd.amount')}
        <input type="number" min={1} max={Math.max(balance, 1)} value={Number.isFinite(amount) ? amount : ''} onChange={(e) => setAmount(e.currentTarget.valueAsNumber)} required disabled={off} />
      </label>
      {valid && (
        <div className="breakdown" aria-live="polite">
          <span>{t('bd.value', { n: f.num(amount) })}</span>
          <span>{f.rp(b.gross)}</span>
          <span>{t('bd.fee', { pct: f.pct(FEE_BPS) })}</span>
          <span>−{f.rp(b.fee)}</span>
          <span className="total">{t('bd.net')}</span>
          <span className="total">{f.rp(b.net)}</span>
        </div>
      )}
      <label>
        {t('wd.bank')}
        <input name="bank" placeholder={t('wd.bankPh')} maxLength={100} required disabled={off} />
      </label>
      <label>
        {t('wd.acc')}
        <input name="acc" inputMode="numeric" pattern="[0-9 ]{5,24}" maxLength={24} required disabled={off} />
      </label>
      <label>
        {t('wd.name')}
        <input name="name" maxLength={140} required disabled={off} />
      </label>
      {msg && (
        <p className={`alert ${msg.ok ? 'success' : 'error'}`} role="status">
          {msg.text}
        </p>
      )}
      <button className="btn" type="submit" disabled={busy || off}>
        {t('wd.submit')}
      </button>
    </form>
  );
}
