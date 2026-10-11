import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ActivityChat } from '@/components/ActivityChat';
import { getActivity } from '@/lib/data';
import { getI18n } from '@/lib/i18n-server';
import { getUser } from '@/lib/supabase/server';
import type { ChatMessage, Participant } from '@/lib/types';

export const metadata: Metadata = { title: 'Pesan' };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

/** Percakapan tenaga berbayar dengan penyelenggara kegiatan. */
export default async function ParticipantChatPage({ params }: Props) {
  const { id } = await params;
  const { t, f } = await getI18n();
  const [a, { supabase, user }] = await Promise.all([getActivity(id), getUser()]);
  if (!a) notFound();
  if (!supabase) return <p className="alert info narrow">{t('err.needSupabase')}</p>;
  if (!user) redirect(`/masuk?next=${encodeURIComponent(`/kegiatan/${a.id}/pesan`)}`);
  if (user.id === a.owner_id) redirect(`/kegiatan/${a.id}`);

  const [{ data: join }, { data: msgs }, { data: owner }] = await Promise.all([
    supabase.from('participants').select('id, activity_id, user_id, role, status, agreed_benih, created_at').eq('activity_id', a.id).eq('user_id', user.id).maybeSingle(),
    supabase
      .from('activity_messages')
      .select('id, sender_id, body, created_at, read_at')
      .eq('activity_id', a.id)
      .eq('participant_id', user.id)
      .order('created_at', { ascending: true })
      .limit(500),
    supabase.from('profiles').select('full_name').eq('id', a.owner_id).maybeSingle(),
  ]);

  const p = join as Participant | null;
  if (!p || p.role !== 'paid') {
    return (
      <section className="card narrow stack tight">
        <h1>{a.title}</h1>
        <p className="alert info">{t('chat.notPaid')}</p>
        <Link className="btn" href={`/kegiatan/${a.id}`}>{t('chat.back')}</Link>
      </section>
    );
  }

  return (
    <ActivityChat
      t={t}
      num={f.num}
      activity={a}
      join={p}
      me={user.id}
      otherId={a.owner_id}
      otherName={owner?.full_name || a.org_name}
      organizer={false}
      messages={(msgs ?? []) as ChatMessage[]}
    />
  );
}
