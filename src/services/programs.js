const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');

const ORGANIZER_TYPES = {
  perorangan: 'Perorangan',
  komunitas: 'Komunitas',
  organisasi: 'Organisasi',
  badan_usaha: 'Badan usaha',
};

const PHOTO_BUCKET = 'program-photos';
const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

// Memanggil fungsi SQL; pesan `raise exception` (P0001) diteruskan sebagai 400.
async function rpc(name, params) {
  const { data, error } = await supabaseAdmin.rpc(name, params);
  if (error) {
    if (error.code === 'P0001') throw httpError(400, error.message);
    if (error.code === '22P02') throw httpError(404, 'Data tidak ditemukan.');
    throw error;
  }
  return data;
}

// Mengunggah foto kegiatan ke Supabase Storage dan mengembalikan URL publiknya.
async function uploadPhotos(files, userId) {
  if (files.length > MAX_PHOTOS) throw httpError(400, `Maksimal ${MAX_PHOTOS} foto.`);
  const urls = [];
  for (const file of files) {
    const ext = PHOTO_TYPES[file.mimetype];
    if (!ext) throw httpError(400, 'Foto harus berformat JPG, PNG, atau WebP.');
    if (file.size > MAX_PHOTO_BYTES) throw httpError(400, 'Ukuran foto maksimal 5 MB.');
    const path = `${userId}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) throw error;
    urls.push(supabaseAdmin.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl);
  }
  return urls;
}

async function getProgram(id) {
  const { data, error } = await supabaseAdmin
    .from('programs')
    .select('*')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle();
  if (error && error.code !== '22P02') throw error; // 22P02: id bukan UUID
  return data || null;
}

async function getParticipation(programId, userId) {
  const { data, error } = await supabaseAdmin
    .from('program_participants')
    .select('role, status, agreed_benih, joined_at')
    .eq('program_id', programId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Daftar peserta untuk penyelenggara.
async function getParticipants(programId) {
  const { data, error } = await supabaseAdmin
    .from('program_participants')
    .select('user_id, role, status, agreed_benih, joined_at, profile:profiles(full_name, avatar_url)')
    .eq('program_id', programId)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return data;
}

async function countParticipants(programId) {
  const { count, error } = await supabaseAdmin
    .from('program_participants')
    .select('user_id', { count: 'exact', head: true })
    .eq('program_id', programId)
    .neq('status', 'cancelled');
  if (error) throw error;
  return count || 0;
}

// Pengguna boleh membaca/menulis percakapan bila ia pesertanya atau penyelenggaranya.
async function assertConversationAccess(program, participantId, userId) {
  if (userId !== participantId && userId !== program.organizer_id) {
    throw httpError(403, 'Kamu tidak punya akses ke percakapan ini.');
  }
  const participation = await getParticipation(program.id, participantId);
  if (!participation) throw httpError(404, 'Peserta tidak ditemukan.');
  return participation;
}

async function getMessages(programId, participantId) {
  const { data, error } = await supabaseAdmin
    .from('program_messages')
    .select('id, sender_id, body, created_at')
    .eq('program_id', programId)
    .eq('participant_id', participantId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  return data;
}

async function sendMessage(programId, participantId, senderId, body) {
  const text = String(body || '').trim();
  if (!text || text.length > 2000) throw httpError(400, 'Pesan harus 1-2000 karakter.');
  const { data, error } = await supabaseAdmin
    .from('program_messages')
    .insert({ program_id: programId, participant_id: participantId, sender_id: senderId, body: text })
    .select('id, sender_id, body, created_at')
    .single();
  if (error) throw error;
  return data;
}

module.exports = {
  ORGANIZER_TYPES,
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  httpError,
  rpc,
  uploadPhotos,
  getProgram,
  getParticipation,
  getParticipants,
  countParticipants,
  assertConversationAccess,
  getMessages,
  sendMessage,
};
