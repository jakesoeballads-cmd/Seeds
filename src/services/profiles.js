const { supabaseAdmin } = require('../config/supabase');
const { donorBadge, volunteerBadge } = require('./badges');
const { httpError } = require('./programs');

const LIMITS = { full_name: 80, bio: 500, city: 80 };
const TOO_LONG = {
  full_name: 'Nama terlalu panjang (maks. {max} karakter).',
  bio: 'Bio terlalu panjang (maks. {max} karakter).',
  city: 'Kota terlalu panjang (maks. {max} karakter).',
};

// Profil publik member. Saldo Benih dan penarikan tidak pernah ikut: itu hanya
// tampil di dashboard pemiliknya. Profil yang dikunci (is_private) hanya
// menampilkan nama dan foto kepada orang lain.
async function getPublicProfile(memberId, viewerId) {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, avatar_url, bio, city, is_private, benih_donated, volunteer_points, created_at')
    .eq('id', memberId)
    .maybeSingle();
  if (error && error.code !== '22P02') throw error; // 22P02: id bukan UUID
  if (!profile) return null;

  const isOwner = viewerId === profile.id;
  const base = { id: profile.id, fullName: profile.full_name, avatarUrl: profile.avatar_url, isPrivate: profile.is_private, isOwner };
  if (profile.is_private && !isOwner) return { ...base, locked: true };

  const [programsRes, participationRes] = await Promise.all([
    supabaseAdmin
      .from('programs')
      .select('id, title, location_name, organizer_name, organizer_type, start_at, end_at, benih_collected, benih_target')
      .eq('organizer_id', profile.id)
      .eq('status', 'published')
      .order('start_at', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('program_participants')
      .select('role, status, program:programs(id, title, organizer_id, organizer_name, start_at, end_at, status)')
      .eq('user_id', profile.id)
      .neq('status', 'cancelled')
      .order('joined_at', { ascending: false })
      .limit(50),
  ]);
  for (const r of [programsRes, participationRes]) if (r.error) throw r.error;

  const participations = (participationRes.data || []).filter((x) => x.program && x.program.status === 'published');
  return {
    ...base,
    locked: false,
    bio: profile.bio,
    city: profile.city,
    memberSince: profile.created_at,
    donated: profile.benih_donated,
    badge: donorBadge(profile.benih_donated),
    volunteerPoints: profile.volunteer_points,
    volunteerBadge: volunteerBadge(profile.volunteer_points),
    programs: programsRes.data || [],
    participations,
    // Organisasi/komunitas yang paling sering dipakai member ini sebagai nama penyelenggara.
    organizerNames: [...new Set((programsRes.data || []).map((p) => p.organizer_name))].slice(0, 5),
  };
}

async function getOwnProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, avatar_url, bio, city, is_private')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data || { id: userId, full_name: '', bio: '', city: '', is_private: false };
}

function cleanText(value, field) {
  const text = String(value == null ? '' : value).trim();
  if (text.length > LIMITS[field]) throw httpError(400, TOO_LONG[field], { max: LIMITS[field] });
  return text;
}

async function updateProfile(userId, body) {
  const fullName = cleanText(body.full_name, 'full_name');
  if (fullName.length < 2) throw httpError(400, 'Nama minimal 2 karakter.');
  const row = {
    full_name: fullName,
    bio: cleanText(body.bio, 'bio') || null,
    city: cleanText(body.city, 'city') || null,
    // Checkbox: ada di form = dicentang.
    is_private: body.is_private === 'on' || body.is_private === true || body.is_private === 'true',
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin.from('profiles').update(row).eq('id', userId);
  if (error) throw error;
  return row;
}

module.exports = { getPublicProfile, getOwnProfile, updateProfile, LIMITS };
