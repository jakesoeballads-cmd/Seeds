const express = require('express');
const config = require('../config');
const { supabaseAdmin, isConfigured } = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { getDashboard } = require('../services/wallet');
const { DONOR_BADGES, VOLUNTEER_BADGES, VOLUNTEER_POINTS_PER_EVENT } = require('../services/badges');
const programs = require('../services/programs');
const profiles = require('../services/profiles');

function needDatabase(req, res, title) {
  if (isConfigured) return false;
  res.status(503).render('error', { title: req.t(title), message: req.t('Database belum dikonfigurasi. Isi variabel SUPABASE_* di .env.') });
  return true;
}

const router = express.Router();

router.get('/', (req, res) => {
  res.render('index', { title: req.t('Beranda'), mapsKey: config.googleMapsApiKey });
});

router.get('/program/baru', requireAuth, (req, res) => {
  const meta = req.user.user_metadata || {};
  res.render('program-new', {
    title: req.t('Buat Kegiatan'),
    mapsKey: config.googleMapsApiKey,
    defaultOrganizer: meta.full_name || meta.name || '',
  });
});

router.get('/benih', requireAuth, async (req, res, next) => {
  try {
    let balance = 0;
    if (isConfigured) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('benih_balance')
        .eq('id', req.user.id)
        .maybeSingle();
      balance = data ? data.benih_balance : 0;
    }
    res.render('benih', {
      title: req.t('Beli & Tarik Benih'),
      balance,
      price: config.benihPriceIdr,
      feePercent: config.withdrawalFeeBps / 100,
      feeBps: config.withdrawalFeeBps,
      simulated: config.midtrans.simulated,
      clientKey: config.midtrans.clientKey,
      snapJsUrl: config.midtrans.isProduction
        ? 'https://app.midtrans.com/snap/snap.js'
        : 'https://app.sandbox.midtrans.com/snap/snap.js',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    if (needDatabase(req, res, 'Dashboard')) return;
    const dashboard = await getDashboard(req.user.id);
    res.render('dashboard', {
      title: req.t('Dashboard'),
      ...dashboard,
      price: config.benihPriceIdr,
      badges: DONOR_BADGES,
      volunteerBadges: VOLUNTEER_BADGES,
      pointsPerEvent: VOLUNTEER_POINTS_PER_EVENT,
    });
  } catch (err) {
    next(err);
  }
});

// Profil publik member. Terbuka untuk semua pengunjung, kecuali bagian yang
// disembunyikan bila member mengunci profilnya.
router.get('/member/:id', async (req, res, next) => {
  try {
    if (needDatabase(req, res, 'Profil')) return;
    const member = await profiles.getPublicProfile(req.params.id, req.user && req.user.id);
    if (!member) return res.status(404).render('error', { title: req.t('Tidak ditemukan'), message: req.t('Member tidak ditemukan.') });
    res.render('member', {
      title: member.fullName || req.t('Member'),
      member,
      organizerTypes: programs.ORGANIZER_TYPES,
      pointsPerEvent: VOLUNTEER_POINTS_PER_EVENT,
    });
  } catch (err) {
    next(err);
  }
});

// Ubah profil sendiri: nama, bio, kota, dan kunci profil.
router.get('/profil', requireAuth, async (req, res, next) => {
  try {
    if (needDatabase(req, res, 'Profil saya')) return;
    res.render('profile-edit', { title: req.t('Profil saya'), profile: await profiles.getOwnProfile(req.user.id), error: null, saved: req.query.saved === '1' });
  } catch (err) {
    next(err);
  }
});

router.post('/profil', requireAuth, async (req, res, next) => {
  try {
    if (needDatabase(req, res, 'Profil saya')) return;
    await profiles.updateProfile(req.user.id, req.body);
    res.redirect('/profil?saved=1');
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).render('profile-edit', {
        title: req.t('Profil saya'),
        profile: { ...req.body, is_private: req.body.is_private === 'on' },
        error: req.t(err.message, err.vars),
        saved: false,
      });
    }
    next(err);
  }
});

// Halaman detail kegiatan: terbuka untuk semua pengunjung.
router.get('/kegiatan/:id', async (req, res, next) => {
  try {
    if (needDatabase(req, res, 'Kegiatan')) return;
    const program = await programs.getProgram(req.params.id);
    if (!program) return res.status(404).render('error', { title: req.t('Tidak ditemukan'), message: req.t('Kegiatan tidak ditemukan.') });

    const isOrganizer = Boolean(req.user && req.user.id === program.organizer_id);
    const [participation, participants, participantCount] = await Promise.all([
      req.user && !isOrganizer ? programs.getParticipation(program.id, req.user.id) : null,
      isOrganizer ? programs.getParticipants(program.id) : null,
      programs.countParticipants(program.id),
    ]);

    res.render('program', {
      title: program.title,
      program,
      isOrganizer,
      participation,
      participants,
      participantCount,
      organizerTypes: programs.ORGANIZER_TYPES,
      shareUrl: `${config.appUrl}/kegiatan/${program.id}`,
      price: config.benihPriceIdr,
      pointsPerEvent: VOLUNTEER_POINTS_PER_EVENT,
    });
  } catch (err) {
    next(err);
  }
});

// Percakapan peserta dengan penyelenggara. Peserta membuka /kegiatan/:id/pesan,
// penyelenggara membuka /kegiatan/:id/pesan/:participantId.
router.get(['/kegiatan/:id/pesan', '/kegiatan/:id/pesan/:participantId'], requireAuth, async (req, res, next) => {
  try {
    if (needDatabase(req, res, 'Pesan')) return;
    const program = await programs.getProgram(req.params.id);
    if (!program) return res.status(404).render('error', { title: req.t('Tidak ditemukan'), message: req.t('Kegiatan tidak ditemukan.') });

    const participantId = req.params.participantId || req.user.id;
    const participation = await programs.assertConversationAccess(program, participantId, req.user.id);
    const isOrganizer = req.user.id === program.organizer_id;
    let otherName = program.organizer_name;
    if (isOrganizer) {
      const { data } = await supabaseAdmin.from('profiles').select('full_name').eq('id', participantId).maybeSingle();
      otherName = (data && data.full_name) || req.t('Peserta');
    }

    res.render('chat', {
      title: req.t('Pesan'),
      program,
      participantId,
      participation,
      isOrganizer,
      otherName,
      messages: await programs.getMessages(program.id, participantId),
    });
  } catch (err) {
    if (err.status === 403 || err.status === 404) {
      return res.status(err.status).render('error', { title: req.t('Pesan'), message: req.t(err.message, err.vars) });
    }
    next(err);
  }
});

router.get('/benih/simulasi/:orderId', requireAuth, (req, res) => {
  if (!config.midtrans.simulated) return res.redirect('/benih');
  res.render('benih-simulate', { title: req.t('Simulasi Pembayaran'), orderId: req.params.orderId });
});

router.get('/benih/selesai', requireAuth, (req, res) => {
  res.render('benih-finish', { title: req.t('Pembayaran'), orderId: req.query.order_id || null });
});

module.exports = router;
