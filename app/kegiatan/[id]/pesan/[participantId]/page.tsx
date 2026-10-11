import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ActivityChat } from '@/components/ActivityChat';
import { getActivity } from '@/lib/data';
import { getI18n } from '@/lib/i18n-server';
import { UUID_RE } from '@/lib/social';
import { getUser } from '@/lib/supabase/server';
import type { ChatMessage, Participant } from '@/lib/types';

export const metadata: Metadata = { title: 'Pesan' };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string; participantId: string }> };

/** Penyelenggara: percakapan dengan satu tenaga berbayar (participantId = id user peserta). */
export default async function OrganizerChatPage({ params }: Props) {
  const { id, participantId } = await params;
  const { t, f } = await getI18n();
  const [a, { supabase, user }] = await Promise.all([getActivity(id), getUser()]);
  if (!a) notFound();
  if (!supabase) return <p className="alert info narrow">{t('err.needSupabase')}</p>;
  if (!user) redirect(`/masuk?next=${encodeURIComponent(`/kegiatan/${a.id}/pesan/${participantId}`)}`);
  if (user.id !== a.owner_id) {
    if (user.id === participantId) redirect(`/kegiatan/${a.id}/pesan`);
    notFound();
  }
  if (!UUID_RE.test(participantId)) notFound();

  const [{ data: join }, { data: msgs }] = await Promise.all([
    supabase
      .from('participants')
      .select('id, activity_id, user_id, role, status, agreed_benih, created_at, profile:profiles(full_name)')
      .eq('activity_id', a.id)
      .eq('user_id', participantId)
      .maybeSingle(),
    supabase
      .from('activity_messages')
      .select('id, sender_id, body, created_at, read_at')
      .eq('activity_id', a.id)
      .eq('participant_id', participantId)
      .order('created_at', { ascending: true })
      .limit(500),
  ]);

  const p = join as unknown as Participant | null;
  if (!p || p.role !== 'paid') notFound();

  return (
    <ActivityChat
      t={t}
      num={f.num}
      activity={a}
      join={p}
      me={user.id}
      otherId={participantId}
      otherName={p.profile?.full_name || t('member.title')}
      organizer
      messages={(msgs ?? []) as ChatMessage[]}
    />
  );
}
