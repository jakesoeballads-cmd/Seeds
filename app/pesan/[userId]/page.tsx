import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { Chat } from '@/components/Chat';
import { getI18n } from '@/lib/i18n-server';
import { UUID_RE } from '@/lib/social';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getUser } from '@/lib/supabase/server';
import type { ChatMessage } from '@/lib/types';

export const metadata: Metadata = { title: 'Pesan' };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ userId: string }>; searchParams: Promise<{ tentang?: string }> };

export default async function DirectMessagePage({ params, searchParams }: Props) {
  const [{ userId }, { tentang }] = await Promise.all([params, searchParams]);
  const { t } = await getI18n();
  if (!isSupabaseConfigured) return <p className="alert info narrow">{t('err.needSupabase')}</p>;
  const { supabase, user } = await getUser();
  const self = `/pesan/${userId}${tentang ? `?tentang=${encodeURIComponent(tentang)}` : ''}`;
  if (!user || !supabase) redirect(`/masuk?next=${encodeURIComponent(self)}`);
  if (!UUID_RE.test(userId)) notFound();
  if (userId === user.id) redirect('/pesan');

  const [{ data: other }, { data: msgs }, { data: canSend }] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('id', userId).maybeSingle(),
    supabase
      .from('direct_messages')
      .select('id, sender_id, body, created_at, read_at')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(500),
    supabase.rpc('can_message', { p_recipient: userId }),
  ]);
  if (!other) notFound();

  const messages = (msgs ?? []) as ChatMessage[];
  const about = tentang?.trim().slice(0, 140);
  const draft = about && messages.length === 0 ? t('msg.aboutDraft', { title: about }) : '';
  const name = other.full_name || t('member.title');

  return (
    <section className="card narrow stack tight" style={{ maxWidth: 640 }}>
      <p>
        <Link href="/pesan">← {t('msg.all')}</Link>
      </p>
      <div className="chat-head">
        <Avatar name={name} />
        <h1>
          <Link className="org-link" href={`/member/${other.id}`}>
            {name}
          </Link>
        </h1>
      </div>
      <Chat me={user.id} target={{ kind: 'direct', otherId: other.id }} initial={messages} draft={draft} canSend={!!canSend} />
    </section>
  );
}
