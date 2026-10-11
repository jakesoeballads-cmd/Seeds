import { sampleActivities } from './sample';
import { createClient } from './supabase/server';
import type { Activity, Conversation, Member } from './types';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Supa = NonNullable<Awaited<ReturnType<typeof createClient>>>;

/** Profil member untuk /member/[id]. Di mode contoh hanya ada member "sample". */
export async function getMember(supabase: Supa | null, id: string): Promise<{ member: Member; activities: Activity[] } | null> {
  if (!supabase) {
    if (id !== 'sample') return null;
    return {
      member: { id, full_name: null, created_at: null, locked: false, is_private: false, bio: null, city: 'Jakarta', attended: 3 },
      activities: sampleActivities(),
    };
  }
  if (!UUID_RE.test(id)) return null;
  try {
    const [{ data: profile }, { data: pub }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, created_at').eq('id', id).maybeSingle(),
      supabase.rpc('member_public', { p_user: id }).maybeSingle(),
    ]);
    if (!profile) return null;
    const p = (pub ?? {}) as Partial<{ locked: boolean; is_private: boolean; bio: string | null; city: string | null; attended_count: number | null }>;
    const member: Member = {
      id: profile.id,
      full_name: profile.full_name,
      created_at: profile.created_at,
      locked: !!p.locked,
      is_private: !!p.is_private,
      bio: p.bio ?? null,
      city: p.city ?? null,
      attended: p.attended_count ?? 0,
    };
    if (member.locked) return { member, activities: [] };
    const { data } = await supabase
      .from('activities')
      .select('id, owner_id, title, category, org_name, org_type, location_name, date, start_time, end_time, collected_benih, target_benih')
      .eq('owner_id', id)
      .order('date', { ascending: false })
      .limit(50);
    return { member, activities: (data ?? []) as unknown as Activity[] };
  } catch (err) {
    console.error('[benih] Gagal memuat profil member:', err);
    return null;
  }
}

type DmRow = { sender_id: string; recipient_id: string; body: string; read_at: string | null; created_at: string };
type AmRow = {
  activity_id: string;
  participant_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  activity: { title: string; owner_id: string; org_name: string } | null;
};

/** Kotak masuk: pesan langsung + percakapan kegiatan, terbaru di atas. RLS membatasi ke percakapan milik user. */
export async function getConversations(supabase: Supa, me: string): Promise<Conversation[]> {
  const [dm, am] = await Promise.all([
    supabase
      .from('direct_messages')
      .select('sender_id, recipient_id, body, read_at, created_at')
      .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('activity_messages')
      .select('activity_id, participant_id, sender_id, body, read_at, created_at, activity:activities(title, owner_id, org_name)')
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  const threads = new Map<string, Omit<Conversation, 'otherName'> & { orgName?: string }>();
  const add = (key: string, m: { sender_id: string; body: string; read_at: string | null; created_at: string }, base: Pick<Conversation, 'kind' | 'otherId' | 'url' | 'activityTitle'> & { orgName?: string }) => {
    const unread = m.sender_id !== me && !m.read_at ? 1 : 0;
    const t = threads.get(key);
    if (t) {
      t.unread += unread;
      return;
    }
    threads.set(key, { ...base, lastBody: m.body, lastAt: m.created_at, lastFromMe: m.sender_id === me, unread });
  };

  for (const m of (dm.data ?? []) as DmRow[]) {
    const other = m.sender_id === me ? m.recipient_id : m.sender_id;
    add(`dm:${other}`, m, { kind: 'direct', otherId: other, url: `/pesan/${other}`, activityTitle: null });
  }
  for (const m of (am.data ?? []) as unknown as AmRow[]) {
    if (!m.activity) continue;
    const organizer = m.activity.owner_id === me;
    add(`act:${m.activity_id}:${m.participant_id}`, m, {
      kind: 'activity',
      otherId: organizer ? m.participant_id : m.activity.owner_id,
      orgName: organizer ? undefined : m.activity.org_name,
      activityTitle: m.activity.title,
      url: organizer ? `/kegiatan/${m.activity_id}/pesan/${m.participant_id}` : `/kegiatan/${m.activity_id}/pesan`,
    });
  }

  const list = [...threads.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  const ids = [...new Set(list.map((c) => c.otherId))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabase.from('profiles').select('id, full_name').in('id', ids);
    for (const p of data ?? []) names.set(p.id, p.full_name ?? '');
  }
  return list.map(({ orgName, ...c }) => ({ ...c, otherName: names.get(c.otherId) || orgName || '' }));
}

/** Jumlah pesan belum dibaca untuk lencana menu. 0 bila tabel pesan belum ada. */
export async function getUnreadCount(supabase: Supa | null): Promise<number> {
  if (!supabase) return 0;
  try {
    const { data, error } = await supabase.rpc('unread_message_count');
    return error ? 0 : Number(data) || 0;
  } catch {
    return 0;
  }
}
