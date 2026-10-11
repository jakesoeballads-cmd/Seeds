'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { useI18n } from './I18nProvider';

/** Penyelenggara mencatat jumlah Benih yang disepakati (status menjadi "Disepakati"). */
export function AgreeForm({ participantId, name, current }: { participantId: string; name: string; current: number | null }) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const n = Number(new FormData(e.currentTarget).get('agreed'));
    if (!Number.isInteger(n) || n < 1) return setMsg({ ok: false, text: t('err.min') });
    const supabase = getBrowserClient();
    if (!supabase) return setMsg({ ok: false, text: t('err.needSupabase') });
    setBusy(true);
    const { error } = await supabase.from('participants').update({ agreed_benih: n, status: 'agreed' }).eq('id', participantId);
    setBusy(false);
    setMsg(error ? { ok: false, text: t('err.generic', { msg: error.message }) } : { ok: true, text: t('toast.agreed', { n: f.num(n), name }) });
    if (!error) router.refresh();
  }

  return (
    <form className="agree-form" onSubmit={submit}>
      <label>
        {t('agree.label')}
        <span className="row">
          <input name="agreed" type="number" min={1} defaultValue={current ?? ''} placeholder="Benih" style={{ width: 120 }} />
          <button className="btn small" type="submit" disabled={busy}>
            {t('agree.save')}
          </button>
        </span>
      </label>
      {msg && (
        <p className={`alert ${msg.ok ? 'success' : 'error'}`} role="status">
          {msg.text}
        </p>
      )}
    </form>
  );
}
