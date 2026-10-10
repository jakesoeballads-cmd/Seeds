// Pesan antar-member: pesan langsung (direct_messages) dan percakapan kegiatan
// antara penyelenggara dan tenaga berbayar (program_messages). Kotak masuk
// menggabungkan keduanya.
const { supabaseAdmin } = require('../config/supabase');
const { httpError } = require('./programs');

const MAX_LENGTH = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Id dari URL dipakai di filter PostgREST (.or), jadi wajib berbentuk UUID.
function assertMemberId(id) {
  if (!UUID.test(String(id))) throw httpError(404, 'Member tidak ditemukan.');
  return String(id);
}

function cleanBody(body) {
  const text = String(body || '').trim();
  if (!text || text.length > MAX_LENGTH) throw httpError(400, 'Pesan harus 1-2000 karakter.');
  return text;
}

async function profilesById(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabaseAdmin.from('profiles').select('id, full_name, avatar_url').in('id', ids);
  if (error) throw error;
  return Object.fromEntries(data.map((p) => [p.id, p]));
}

async function myProgramIds(userId) {
  const { data, error } = await supabaseAdmin.from('programs').select('id').eq('organizer_id', userId).limit(500);
  if (error) throw error;
  return data.map((p) => p.id);
}

// Daftar percakapan, terbaru di atas.
async function listConversations(userId) {
  const programIds = await myProgramIds(userId);
  const queries = [
    supabaseAdmin
      .from('direct_messages')
      .select('sender_id, recipient_id, body, read_at, created_at')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(500),
    supabaseAdmin
      .from('program_messages')
      .select('program_id, participant_id, sender_id, body, read_at, created_at, program:programs(title, organizer_id, organizer_name)')
      .eq('participant_id', userId)
      .order('created_at', { ascending: false })
      .limit(500),
  ];
  if (programIds.length) {
    queries.push(
      supabaseAdmin
        .from('program_messages')
        .select('program_id, participant_id, sender_id, body, read_at, created_at, program:programs(title, organizer_id, organizer_name)')
        .in('program_id', programIds)
        .order('created_at', { ascending: false })
        .limit(500)
    );
  }
  const results = await Promise.all(queries);
  for (const r of results) if (r.error) throw r.error;
  const [direct, asParticipant, asOrganizer = { data: [] }] = results;

  const threads = new Map();
  const add = (key, m, thread) => {
    const unread = m.sender_id !== userId && !m.read_at ? 1 : 0;
    const existing = threads.get(key);
    if (existing) {
      existing.unread += unread;
      return;
    }
    threads.set(key, { ...thread, lastBody: m.body, lastAt: m.created_at, lastFromMe: m.sender_id === userId, unread });
  };

  for (const m of direct.data) {
    const other = m.sender_id === userId ? m.recipient_id : m.sender_id;
    add(`dm:${other}`, m, { kind: 'direct', otherId: other, url: `/pesan/${other}` });
  }
  for (const m of [...asParticipant.data, ...asOrganizer.data]) {
    const p = m.program || {};
    const iAmOrganizer = p.organizer_id === userId;
    const other = iAmOrganizer ? m.participant_id : p.organizer_id;
    add(`pg:${m.program_id}:${m.participant_id}`, m, {
      kind: 'program',
      otherId: other,
      otherName: iAmOrganizer ? null : p.organizer_name,
      programTitle: p.title,
      url: iAmOrganizer ? `/kegiatan/${m.program_id}/pesan/${m.participant_id}` : `/kegiatan/${m.program_id}/pesan`,
    });
  }

  const list = [...threads.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  const people = await profilesById([...new Set(list.map((c) => c.otherId))]);
  return list.map((c) => {
    const person = people[c.otherId] || {};
    return { ...c, otherName: c.otherName || person.full_name || '', avatarUrl: person.avatar_url || null };
  });
}

async function unreadCount(userId) {
  const programIds = await myProgramIds(userId);
  const counts = [
    supabaseAdmin.from('direct_messages').select('id', { count: 'exact', head: true }).eq('recipient_id', userId).is('read_at', null),
    supabaseAdmin.from('program_messages').select('id', { count: 'exact', head: true })
      .eq('participant_id', userId).neq('sender_id', userId).is('read_at', null),
  ];
  if (programIds.length) {
    counts.push(
      supabaseAdmin.from('program_messages').select('id', { count: 'exact', head: true })
        .in('program_id', programIds).neq('sender_id', userId).is('read_at', null)
    );
  }
  const results = await Promise.all(counts);
  return results.reduce((sum, r) => sum + (r.error ? 0 : r.count || 0), 0);
}

// Lawan bicara pesan langsung. Member dengan profil terkunci hanya bisa
// dihubungi bila sudah pernah mengirim pesan, atau bila ia penyelenggara kegiatan.
async function getRecipient(senderId, recipientId) {
  assertMemberId(recipientId);
  if (senderId === recipientId) throw httpError(400, 'Kamu tidak bisa mengirim pesan ke diri sendiri.');
  const { data: person, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, avatar_url, is_private')
    .eq('id', recipientId)
    .maybeSingle();
  if (error && error.code !== '22P02') throw error;
  if (!person) throw httpError(404, 'Member tidak ditemukan.');
  return person;
}

async function canStartConversation(senderId, person) {
  if (!person.is_private) return true;
  const [replied, organizes] = await Promise.all([
    supabaseAdmin.from('direct_messages').select('id', { count: 'exact', head: true })
      .eq('sender_id', person.id).eq('recipient_id', senderId),
    supabaseAdmin.from('programs').select('id', { count: 'exact', head: true })
      .eq('organizer_id', person.id).eq('status', 'published'),
  ]);
  return (replied.count || 0) > 0 || (organizes.count || 0) > 0;
}

async function getDirectThread(userId, otherId) {
  assertMemberId(otherId);
  const { data, error } = await supabaseAdmin
    .from('direct_messages')
    .select('id, sender_id, body, created_at')
    .or(`and(sender_id.eq.${userId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${userId})`)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  return data;
}

async function markDirectRead(userId, otherId) {
  const { error } = await supabaseAdmin
    .from('direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', userId)
    .eq('sender_id', otherId)
    .is('read_at', null);
  if (error) throw error;
}

async function markProgramRead(programId, participantId, userId) {
  const { error } = await supabaseAdmin
    .from('program_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('program_id', programId)
    .eq('participant_id', participantId)
    .neq('sender_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

async function sendDirect(senderId, recipientId, body) {
  const text = cleanBody(body);
  const person = await getRecipient(senderId, recipientId);
  if (!(await canStartConversation(senderId, person))) {
    throw httpError(403, 'Member ini mengunci profilnya dan belum bisa menerima pesan darimu.');
  }
  const { data, error } = await supabaseAdmin
    .from('direct_messages')
    .insert({ sender_id: senderId, recipient_id: recipientId, body: text })
    .select('id, sender_id, body, created_at')
    .single();
  if (error) throw error;
  return data;
}

module.exports = {
  assertMemberId,
  listConversations,
  unreadCount,
  getRecipient,
  canStartConversation,
  getDirectThread,
  markDirectRead,
  markProgramRead,
  sendDirect,
};
