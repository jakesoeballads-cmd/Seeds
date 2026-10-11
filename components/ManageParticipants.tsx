'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { POINTS } from '@/lib/constants';
import { rpcErrorText } from '@/lib/rpc-errors';
import { getBrowserClient } from '@/lib/supabase/client';
import type { Participant } from '@/lib/types';
import { useI18n } from './I18nProvider';

export function ManageParticipants({ participants }: { participants: Participant[] }) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function update(p: Participant, patch: Partial<Participant>, okText: string) {
    const supabase = getBrowserClient();
    if (!supabase) return;
    setBusyId(p.id);
    const { error } = await supabase.from('participants').update(patch).eq('id', p.id);
    setBusyId(null);
    setMsg(error ? { ok: false, text: t('err.generic', { msg: error.message }) } : { ok: true, text: okText });
    if (!error) router.refresh();
  }

  const name = (p: Participant) => p.profile?.full_name || '—';

  // Membayar tenaga berbayar yang sudah disepakati (fungsi SQL pay_participant).
  async function pay(p: Participant) {
    const supabase = getBrowserClient();
    if (!supabase || !p.agreed_benih) return;
    if (!window.confirm(t('pay.confirm', { n: f.num(p.agreed_benih), name: name(p) }))) return;
    setBusyId(p.id);
    const { error } = await supabase.rpc('pay_participant', { p_participant_id: p.id });
    setBusyId(null);
    if (error) return setMsg({ ok: false, text: error.hint === 'balance' ? t('toast.payLow') : rpcErrorText(t, error) });
    setMsg({ ok: true, text: t('toast.paidTo', { n: f.num(p.agreed_benih), name: name(p) }) });
    router.refresh();
  }

  return (
    <section className="card stack tight">
      <h2>{t('manage.title')}</h2>
      <p className="muted">{t('manage.help', { n: POINTS })}</p>
      {msg && (
        <p className={`alert ${msg.ok ? 'success' : 'error'}`} role="status">
          {msg.text}
        </p>
      )}
      {participants.length === 0 ? (
        <p className="muted">—</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('th.name')}</th>
                <th>{t('th.role')}</th>
                <th>{t('th.status')}</th>
                <th>{t('th.action')}</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.id}>
                  <td>{name(p)}</td>
                  <td>{p.role === 'paid' ? t('role.paid') : t('role.vol')}</td>
                  <td>
                    <span className={`badge ${p.status}`}>{t('st.' + p.status)}</span>
                    {p.agreed_benih ? (
                      <>
                        <br />
                        <span className="muted">{f.num(p.agreed_benih)} Benih</span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    <div className="row">
                      {p.role === 'volunteer' && p.status === 'registered' && (
                        <button
                          className="btn small"
                          disabled={busyId === p.id}
                          onClick={() => update(p, { status: 'attended' }, t('toast.attendOther', { name: name(p), n: POINTS }))}
                        >
                          {t('btn.confirmAttend')}
                        </button>
                      )}
                      {p.role === 'paid' && p.status === 'agreed' && p.agreed_benih ? (
                        <button className="btn small" type="button" disabled={busyId === p.id} onClick={() => pay(p)}>
                          {t('btn.payN', { n: f.num(p.agreed_benih) })}
                        </button>
                      ) : null}
                      {p.role === 'paid' && p.status !== 'paid' && (
                        <form
                          className="row"
                          style={{ flexDirection: 'row', gap: 6 }}
                          onSubmit={(e) => {
                            e.preventDefault();
                            const n = Number(new FormData(e.currentTarget).get('agreed'));
                            if (!Number.isInteger(n) || n < 1) return setMsg({ ok: false, text: t('err.min') });
                            update(p, { agreed_benih: n, status: 'agreed' }, t('toast.agreed', { n: f.num(n), name: name(p) }));
                          }}
                        >
                          <input
                            name="agreed"
                            type="number"
                            min={1}
                            defaultValue={p.agreed_benih ?? ''}
                            placeholder="Benih"
                            style={{ width: 90 }}
                            aria-label={t('agree.label')}
                          />
                          <button className="btn small ghost" type="submit" disabled={busyId === p.id}>
                            {t('btn.save')}
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
