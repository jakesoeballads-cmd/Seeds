const config = require('../config');
const { supabaseAdmin } = require('../config/supabase');
const { donorBadge, volunteerBadge } = require('./badges');

// Rincian penarikan dalam Rupiah. Perhitungan yang sama dilakukan oleh fungsi
// SQL request_withdrawal; fungsi ini untuk pratinjau dan tes.
function calcWithdrawal(benihAmount, priceIdr = config.benihPriceIdr, feeBps = config.withdrawalFeeBps) {
  const grossIdr = benihAmount * priceIdr;
  const feeIdr = Math.round((grossIdr * feeBps) / 10000);
  return { grossIdr, feeIdr, netIdr: grossIdr - feeIdr };
}

// Data dashboard member: saldo, total donasi + badge, dan Benih yang
// terkumpul dari setiap kegiatan yang diadakan member tersebut.
async function getDashboard(userId) {
  const [profileRes, programsRes, donationsRes, participationRes] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('full_name, avatar_url, benih_balance, benih_donated, volunteer_points')
      .eq('id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('programs')
      .select('id, title, location_name, start_at, status, benih_collected, benih_target')
      .eq('organizer_id', userId)
      .order('start_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('donations')
      .select('benih_amount, created_at, program:programs(id, title)')
      .eq('donor_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
    // Rekam jejak partisipasi kegiatan.
    supabaseAdmin
      .from('program_participants')
      .select('role, status, agreed_benih, joined_at, program:programs(id, title, organizer_name, location_name, start_at)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false })
      .limit(100),
  ]);
  for (const r of [profileRes, programsRes, donationsRes, participationRes]) {
    if (r.error) throw r.error;
  }

  const profile = profileRes.data || { full_name: '', benih_balance: 0, benih_donated: 0, volunteer_points: 0 };
  const participations = participationRes.data || [];
  const programs = programsRes.data || [];
  return {
    fullName: profile.full_name,
    avatarUrl: profile.avatar_url,
    balance: profile.benih_balance,
    balanceIdr: profile.benih_balance * config.benihPriceIdr,
    donated: profile.benih_donated,
    badge: donorBadge(profile.benih_donated),
    volunteerPoints: profile.volunteer_points,
    volunteerBadge: volunteerBadge(profile.volunteer_points),
    participations,
    volunteerEvents: participations.filter((p) => p.role === 'volunteer' && p.status === 'attended').length,
    programs,
    totalReceived: programs.reduce((sum, p) => sum + Number(p.benih_collected), 0),
    recentDonations: donationsRes.data || [],
  };
}

module.exports = { calcWithdrawal, getDashboard };
