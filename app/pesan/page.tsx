import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { LocalTime } from '@/components/LocalTime';
import { getI18n } from '@/lib/i18n-server';
import { getConversations } from '@/lib/social';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getUser } from '@/lib/supabase/server';
import type { Conversation } from '@/lib/types';

export const metadata: Metadata = { title: 'Pesan' };
export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const { t } = await getI18n();
  if (!isSupabaseConfigured) return <p className="alert info narrow">{t('err.needSupabase')}</p>;
  const { supabase, user } = await getUser();
  if (!user || !supabase) redirect('/masuk?next=/pesan');

  let list: Conversation[] = [];
  let failed = false;
  try {
    list = await getConversations(supabase, user.id);
  } catch (err) {
    console.error('[benih] Gagal memuat pesan:', err);
    failed = true;
  }

  return (
    <section className="card narrow stack tight" style={{ maxWidth: 640 }}>
      <h1>{t('msg.title')}</h1>
      {failed && <p className="alert error">{t('msg.loadFail')}</p>}
      {list.length === 0 ? (
        <p className="muted">{t('msg.empty')}</p>
      ) : (
        <ul className="inbox">
          {list.map((c) => (
            <li key={c.url} className={c.unread ? 'unread' : ''}>
              <Link href={c.url}>
                <Avatar name={c.otherName} />
                <span className="inbox-text">
                  <span className="inbox-top">
                    <strong>{c.otherName || t('member.title')}</strong>
                    <LocalTime iso={c.lastAt} />
                  </span>
                  <span className="inbox-tag">{c.kind === 'activity' ? `🌱 ${c.activityTitle}` : t('msg.direct')}</span>
                  <span className="inbox-preview">
                    {c.lastFromMe ? t('msg.you') + ' ' : ''}
                    {c.lastBody}
                  </span>
                </span>
                {c.unread > 0 && <span className="unread-dot" aria-label={t('msg.unread', { n: c.unread })} />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
