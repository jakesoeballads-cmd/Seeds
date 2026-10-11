import Link from 'next/link';
import type { T } from '@/lib/i18n';
import type { Activity, ChatMessage, Participant } from '@/lib/types';
import { AgreeForm } from './AgreeForm';
import { Rich } from './ActivityBits';
import { Avatar } from './Avatar';
import { Chat } from './Chat';

type Props = {
  t: T;
  num: (n: number) => string;
  activity: Pick<Activity, 'id' | 'title'>;
  join: Participant;
  me: string;
  otherId: string;
  otherName: string;
  organizer: boolean;
  messages: ChatMessage[];
};

/** Percakapan negosiasi antara penyelenggara dan tenaga berbayar. */
export function ActivityChat({ t, num, activity, join, me, otherId, otherName, organizer, messages }: Props) {
  let note: string;
  if (join.status === 'paid') note = t('chat.paid', { n: num(join.agreed_benih ?? 0) });
  else if (join.agreed_benih) note = `${t('chat.agreed', { n: num(join.agreed_benih) })} ${organizer ? t('chat.agreedOwn') : t('chat.agreedOther')}`;
  else note = organizer ? t('chat.ownHint') : t('chat.otherHint');

  return (
    <section className="card narrow stack tight" style={{ maxWidth: 640 }}>
      <p>
        <Link href={`/kegiatan/${activity.id}`}>← {activity.title}</Link>
      </p>
      <div className="chat-head">
        <Avatar name={otherName} />
        <h1>
          <Link className="org-link" href={`/member/${otherId}`}>
            {t('chat.title', { name: otherName })}
          </Link>
        </h1>
      </div>
      <p className="alert info">
        <Rich text={note} />
      </p>
      {organizer && join.status !== 'paid' && <AgreeForm participantId={join.id} name={otherName} current={join.agreed_benih} />}
      <Chat
        me={me}
        target={{ kind: 'activity', activityId: activity.id, participantId: join.user_id }}
        initial={messages}
        draft={!organizer && messages.length === 0 ? t('chat.draft') : ''}
      />
    </section>
  );
}
