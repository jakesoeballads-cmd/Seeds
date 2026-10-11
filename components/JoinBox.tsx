'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { POINTS } from '@/lib/constants';
import { getBrowserClient } from '@/lib/supabase/client';
import type { Participant, Role } from '@/lib/types';
import { Rich } from './ActivityBits';
import { useI18n } from './I18nProvider';

export function JoinBox({ activityId, join, full }: { activityId: string; join: Participant | null; full: boolean }) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const supabase = getBrowserClient();
    if (!supabase) return setError(t('err.needSupabase'));
    const role = new FormData(e.currentTarget).get('role') as Role;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from('participants')
      .insert({ activity_id: activityId, role, status: role === 'paid' ? 'negotiating' : 'registered' });
    setBusy(false);
    if (error) return setError(/kuota/i.test(error.message) ? t('join.full') : t('err.generic', { msg: error.message }));
    setMsg(role === 'paid' ? t('toast.joinPaid') : t('toast.joinVol'));
    router.refresh();
  }

  async function cancel() {
    const supabase = getBrowserClient();
    if (!supabase || !join) return;
    setBusy(true);
    const { error } = await supabase.from('participants').delete().eq('id', join.id);
    setBusy(false);
    if (error) return setError(t('err.generic', { msg: error.message }));
    setMsg(null);
    router.refresh();
  }

  if (join) {
    const canCancel = join.status === 'registered' || join.status === 'negotiating';
    return (
      <>
        {msg && <p className="alert success" role="status">{msg}</p>}
        {join.role === 'volunteer' ? (
          <>
            <p className="alert success">
              <Rich text={t('join.asVol', { status: t('st.' + join.status) })} />
            </p>
            <p className="muted">{join.status === 'attended' ? t('join.volDone', { n: POINTS }) : t('join.volWait', { n: POINTS })}</p>
          </>
        ) : (
          <>
            <p className="alert info">
              <Rich text={t('join.asPaid', { status: t('st.' + join.status) })} />
              {join.agreed_benih ? ` · ${f.num(join.agreed_benih)} Benih` : ''}
            </p>
            <Link className="btn small" href={`/kegiatan/${activityId}/pesan`}>
              💬 {t('chat.open')}
            </Link>
          </>
        )}
        {canCancel && (
          <button className="btn small ghost" type="button" onClick={cancel} disabled={busy}>
            {t('join.cancel')}
          </button>
        )}
        {error && <p className="alert error" role="alert">{error}</p>}
      </>
    );
  }

  if (full) return <p className="alert info">{t('join.full')}</p>;

  return (
    <form onSubmit={submit}>
      <div className="role-options" role="radiogroup" aria-label={t('join.as')}>
        <label className="role-option">
          <input type="radio" name="role" value="volunteer" defaultChecked />
          <strong>{t('role.vol')}</strong>
          <br />
          <span className="muted">{t('role.volDesc')}</span>
        </label>
        <label className="role-option">
          <input type="radio" name="role" value="paid" />
          <strong>{t('role.paid')}</strong>
          <br />
          <span className="muted">{t('role.paidDesc')}</span>
        </label>
      </div>
      {error && <p className="alert error" role="alert">{error}</p>}
      <button className="btn" type="submit" disabled={busy}>
        {t('join.submit')}
      </button>
    </form>
  );
}
