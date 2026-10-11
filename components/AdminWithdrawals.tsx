'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { rpcErrorText } from '@/lib/rpc-errors';
import { getBrowserClient } from '@/lib/supabase/client';
import { useI18n } from './I18nProvider';

export type AdminWithdrawal = {
  id: string;
  user_id: string;
  name: string;
  benih_amount: number;
  fee_idr: number;
  net_idr: number;
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  created_at: string;
};

/** Penarikan yang menunggu: admin mentransfer manual, lalu menandai sudah ditransfer atau menolak. */
export function AdminWithdrawals({ items, demo }: { items: AdminWithdrawal[]; demo?: boolean }) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function act(w: AdminWithdrawal, fn: 'admin_mark_withdrawal_paid' | 'admin_reject_withdrawal', note: string) {
    const supabase = getBrowserClient();
    if (!supabase || demo) return setMsg({ ok: false, text: t('err.needSupabase') });
    if (fn === 'admin_mark_withdrawal_paid' && !confirm(t('admin.confirmPaid', { net: f.rp(w.net_idr), name: w.bank_account_name }))) return;
    setBusyId(w.id);
    setMsg(null);
    const { error } = await supabase.rpc(fn, { p_withdrawal_id: w.id, p_note: note });
    setBusyId(null);
    if (error) return setMsg({ ok: false, text: rpcErrorText(t, error) });
    setRejecting(null);
    setMsg({ ok: true, text: fn === 'admin_mark_withdrawal_paid' ? t('admin.donePaid') : t('admin.doneRejected') });
    router.refresh();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  }

  return (
    <div className="stack tight">
      {msg && <p className={`alert ${msg.ok ? 'success' : 'error'}`} role="status">{msg.text}</p>}
      {items.length === 0 ? (
        <p className="muted">{t('admin.noPending')}</p>
      ) : (
        <ul className="admin-list">
          {items.map((w) => (
            <li key={w.id} className="admin-item">
              <div className="admin-item-head">
                <a href={`/member/${w.user_id}`}><strong>{w.name}</strong></a>
                <span className="muted">{f.date(w.created_at)}</span>
              </div>
              <p className="admin-amount">
                {f.rp(w.net_idr)}{' '}
                <span className="muted">{t('admin.wdDetail', { n: f.num(w.benih_amount), fee: f.rp(w.fee_idr) })}</span>
              </p>
              <dl className="admin-bank">
                <dt>{t('admin.bank')}</dt><dd>{w.bank_name}</dd>
                <dt>{t('admin.accNo')}</dt>
                <dd>
                  <code>{w.bank_account_number}</code>{' '}
                  <button type="button" className="link-btn" onClick={() => copy(w.bank_account_number)}>
                    {copied === w.bank_account_number ? t('admin.copied') : t('admin.copy')}
                  </button>
                </dd>
                <dt>{t('admin.accName')}</dt><dd>{w.bank_account_name}</dd>
              </dl>
              {rejecting === w.id ? (
                <form
                  className="stack tight"
                  onSubmit={(e) => {
                    e.preventDefault();
                    act(w, 'admin_reject_withdrawal', String(new FormData(e.currentTarget).get('note') ?? ''));
                  }}
                >
                  <label>
                    {t('admin.rejectReason')}
                    <input name="note" maxLength={280} placeholder={t('admin.rejectPh')} required />
                  </label>
                  <div className="row">
                    <button className="btn small danger" type="submit" disabled={busyId === w.id}>{t('admin.rejectConfirm')}</button>
                    <button className="btn small ghost" type="button" onClick={() => setRejecting(null)}>{t('admin.cancel')}</button>
                  </div>
                </form>
              ) : (
                <div className="row">
                  <button className="btn small" type="button" disabled={busyId === w.id} onClick={() => act(w, 'admin_mark_withdrawal_paid', '')}>
                    ✓ {t('admin.markPaid')}
                  </button>
                  <button className="btn small ghost" type="button" disabled={busyId === w.id} onClick={() => setRejecting(w.id)}>
                    {t('admin.reject')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
