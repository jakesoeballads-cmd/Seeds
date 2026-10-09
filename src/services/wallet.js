const config = require('../config');
const { supabaseAdmin } = require('../config/supabase');
const { donorBadge } = require('./badges');

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
  const [profileRes, programsRes, donationsRes] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('full_name, benih_balance, benih_donated')
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
  ]);
  for (const r of [profileRes, programsRes, donationsRes]) {
    if (r.error) throw r.error;
  }

  const profile = profileRes.data || { full_name: '', benih_balance: 0, benih_donated: 0 };
  const programs = programsRes.data || [];
  return {
    fullName: profile.full_name,
    balance: profile.benih_balance,
    balanceIdr: profile.benih_balance * config.benihPriceIdr,
    donated: profile.benih_donated,
    badge: donorBadge(profile.benih_donated),
    programs,
    totalReceived: programs.reduce((sum, p) => sum + Number(p.benih_collected), 0),
    recentDonations: donationsRes.data || [],
  };
}

module.exports = { calcWithdrawal, getDashboard };
