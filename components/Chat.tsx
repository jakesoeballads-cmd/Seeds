'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import type { ChatMessage } from '@/lib/types';
import { useI18n } from './I18nProvider';
import { LocalTime } from './LocalTime';
import { UNREAD_EVENT } from './UnreadBadge';

export type ChatTarget = { kind: 'direct'; otherId: string } | { kind: 'activity'; activityId: string; participantId: string };

const POLL_MS = 4000;
const COLUMNS = 'id, sender_id, body, created_at, read_at';

/** Percakapan dengan gelembung pesan. Enter mengirim, Shift+Enter membuat baris baru. Pesan baru diambil tiap beberapa detik. */
export function Chat({ me, target, initial, draft = '', canSend = true }: { me: string; target: ChatTarget; initial: ChatMessage[]; draft?: string; canSend?: boolean }) {
  const { t } = useI18n();
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState(draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const key = target.kind === 'direct' ? target.otherId : `${target.activityId}:${target.participantId}`;

  const markRead = useCallback(async () => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    const { error } =
      target.kind === 'direct'
        ? await supabase.rpc('mark_direct_read', { p_other: target.otherId })
        : await supabase.rpc('mark_activity_read', { p_activity: target.activityId, p_participant: target.participantId });
    if (!error) window.dispatchEvent(new Event(UNREAD_EVENT));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const refresh = useCallback(async () => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    const q =
      target.kind === 'direct'
        ? supabase
            .from('direct_messages')
            .select(COLUMNS)
            .or(`and(sender_id.eq.${me},recipient_id.eq.${target.otherId}),and(sender_id.eq.${target.otherId},recipient_id.eq.${me})`)
        : supabase.from('activity_messages').select(COLUMNS).eq('activity_id', target.activityId).eq('participant_id', target.participantId);
    const { data, error } = await q.order('created_at', { ascending: true }).limit(500);
    if (error || !data) return;
    const rows = data as ChatMessage[];
    setMessages((prev) => (prev.length === rows.length && prev.at(-1)?.id === rows.at(-1)?.id ? prev : rows));
    if (rows.some((m) => m.sender_id !== me && !m.read_at)) markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, me, markRead]);

  // Tandai dibaca saat dibuka, lalu ambil pesan baru berkala.
  useEffect(() => {
    if (initial.some((m) => m.sender_id !== me)) markRead();
    const id = window.setInterval(() => document.visibilityState === 'visible' && refresh(), POLL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  // Gulir ke pesan terbaru.
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages.length]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    const supabase = getBrowserClient();
    if (!supabase) return setError(t('err.needSupabase'));
    setBusy(true);
    setError(null);
    const { data, error } =
      target.kind === 'direct'
        ? await supabase.rpc('send_direct_message', { p_recipient: target.otherId, p_body: body })
        : await supabase.rpc('send_activity_message', { p_activity: target.activityId, p_participant: target.participantId, p_body: body });
    setBusy(false);
    if (error) return setError(/mengunci/i.test(error.message) ? t('msg.lockedCant') : t('err.generic', { msg: error.message }));
    setText('');
    if (data) setMessages((prev) => [...prev, data as ChatMessage]);
  }

  return (
    <>
      <div className="chat" ref={list} aria-live="polite">
        {messages.length === 0 && <p className="muted">{t('chat.empty')}</p>}
        {messages.map((m) => (
          <div key={m.id} className={`bubble${m.sender_id === me ? ' mine' : ''}`}>
            {m.body}
            <LocalTime iso={m.created_at} full />
          </div>
        ))}
      </div>
      {canSend ? (
        <form className="chat-form" onSubmit={send}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            maxLength={2000}
            placeholder={t('chat.ph')}
            aria-label={t('chat.label')}
          />
          <button className="btn" type="submit" disabled={busy || !text.trim()}>
            {t('chat.send')}
          </button>
        </form>
      ) : (
        <p className="alert info">{t('msg.lockedCant')}</p>
      )}
      {canSend && <p className="muted chat-hint">{t('chat.enterHint')}</p>}
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
