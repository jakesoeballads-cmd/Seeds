'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from './I18nProvider';

export function SimulatePay({ orderId }: { orderId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(result: 'success' | 'failed') {
    setBusy(true);
    const res = await fetch(`/api/payments/simulate/${encodeURIComponent(orderId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setBusy(false);
      return setError(t(data.error || 'err.payment'));
    }
    router.push(`/dompet/selesai?order_id=${encodeURIComponent(orderId)}`);
  }

  return (
    <>
      <div className="row">
        <button className="btn" type="button" disabled={busy} onClick={() => choose('success')}>
          {t('pay.ok')}
        </button>
        <button className="btn ghost" type="button" disabled={busy} onClick={() => choose('failed')}>
          {t('pay.fail')}
        </button>
      </div>
      {error && <p className="alert error" role="alert">{error}</p>}
    </>
  );
}
