'use client';

import { useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { useI18n } from './I18nProvider';

export const UNREAD_EVENT = 'benih:unread';

/** Lencana jumlah pesan belum dibaca. Diperbarui berkala dan setelah percakapan dibaca. */
export function UnreadBadge({ initial }: { initial: number }) {
  const { t } = useI18n();
  const [n, setN] = useState(initial);

  useEffect(() => setN(initial), [initial]);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    const refresh = async () => {
      const { data, error } = await supabase.rpc('unread_message_count');
      if (!error) setN(Number(data) || 0);
    };
    const tick = () => document.visibilityState === 'visible' && refresh();
    const id = window.setInterval(tick, 30000);
    window.addEventListener(UNREAD_EVENT, refresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(UNREAD_EVENT, refresh);
    };
  }, []);

  if (!n) return null;
  return (
    <span className="count-badge" aria-label={t('msg.unread', { n })}>
      {n > 99 ? '99+' : n}
    </span>
  );
}
