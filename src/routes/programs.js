const express = require('express');
const multer = require('multer');
const config = require('../config');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { requireAuth, requireDatabase } = require('../middleware/auth');
const { parseBenihAmount } = require('../services/benih');
const svc = require('../services/programs');
const { markProgramRead } = require('../services/messages');
const { VOLUNTEER_POINTS_PER_EVENT } = require('../services/badges');

const router = express.Router();
router.use(requireDatabase);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: svc.MAX_PHOTO_BYTES, files: svc.MAX_PHOTOS },
});

const badRequest = (message) => svc.httpError(400, message);

function parseCoordinate(value, min, max, name) {
  const n = Number(value);
  if (value === undefined || value === '' || !Number.isFinite(n) || n < min || n > max) {
    throw svc.httpError(400, '{name} tidak valid.', { name });
  }
  return n;
}

// Memuat program dari :id ke req.program, atau 404.
async function loadProgram(req, res, next) {
  try {
    req.program = await svc.getProgram(req.params.id);
    if (!req.program) return res.status(404).json({ error: req.t('Program tidak ditemukan.') });
    next();
  } catch (err) {
    next(err);
  }
}

function requireOrganizer(req, res, next) {
  if (req.program.organizer_id === req.user.id) return next();
  return res.status(403).json({ error: req.t('Hanya penyelenggara kegiatan yang bisa melakukan ini.') });
}

const LIST_COLUMNS =
  'id, title, description, category, location_name, organizer_id, organizer_name, organizer_type, photo_urls, lat, lng, start_at, end_at, benih_target, benih_collected, max_participants';

// GET /api/programs?lat=-6.2&lng=106.8&radius_km=25
// Terbuka untuk semua pengunjung (member maupun bukan).
// Dengan lat/lng: program di sekitar lokasi, diurutkan dari yang terdekat.
// Tanpa lat/lng: program mendatang terbaru.
router.get('/', async (req, res, next) => {
  try {
    const { lat, lng } = req.query;
    if (lat !== undefined || lng !== undefined) {
      const radiusKm = Math.min(Number(req.query.radius_km) || 25, 200);
      const { data, error } = await supabase.rpc('nearby_programs', {
        p_lat: parseCoordinate(lat, -90, 90, 'Latitude'),
        p_lng: parseCoordinate(lng, -180, 180, 'Longitude'),
        p_radius_km: radiusKm,
      });
      if (error) throw error;
      return res.json({ programs: data });
    }

    const { data, error } = await supabase
      .from('programs')
      .select(LIST_COLUMNS)
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
      .limit(100);
    if (error) throw error;
    res.json({ programs: data });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', loadProgram, (req, res) => {
  res.json({ program: req.program });
});

// POST /api/programs (multipart/form-data, field foto: "photos", maks. 5)
// Member membuat kegiatan baru.
router.post('/', requireAuth, upload.array('photos', svc.MAX_PHOTOS), async (req, res, next) => {
  try {
    const b = req.body;
    const title = String(b.title || '').trim();
    if (title.length < 3) throw badRequest('Judul minimal 3 karakter.');

    const organizerName = String(b.organizer_name || '').trim();
    if (organizerName.length < 2) throw badRequest('Isi nama penyelenggara (orang, komunitas, organisasi, atau badan usaha).');
    const organizerType = svc.ORGANIZER_TYPES[b.organizer_type] ? b.organizer_type : 'perorangan';

    const startAt = svc.parseLocalDateTime(b.start_at, config.timeZone);
    if (Number.isNaN(startAt.getTime())) throw badRequest('Tanggal atau jam mulai tidak valid.');
    const endAt = b.end_at ? svc.parseLocalDateTime(b.end_at, config.timeZone) : null;
    if (endAt && (Number.isNaN(endAt.getTime()) || endAt <= startAt)) {
      throw badRequest('Jam selesai harus setelah jam mulai.');
    }

    const row = {
      organizer_id: req.user.id,
      organizer_name: organizerName,
      organizer_type: organizerType,
      title,
      description: String(b.description || '').trim() || null,
      category: String(b.category || 'reforestasi'),
      location_name: String(b.location_name || '').trim() || null,
      lat: parseCoordinate(b.lat, -90, 90, 'Latitude'),
      lng: parseCoordinate(b.lng, -180, 180, 'Longitude'),
      start_at: startAt.toISOString(),
      end_at: endAt ? endAt.toISOString() : null,
      max_participants: b.max_participants ? Number(b.max_participants) : null,
      benih_target: b.benih_target ? Number(b.benih_target) : null,
      photo_urls: await svc.uploadPhotos(req.files || [], req.user.id),
    };

    const { data, error } = await supabaseAdmin.from('programs').insert(row).select().single();
    if (error) throw error;
    res.status(201).json({ program: data });
  } catch (err) {
    next(err);
  }
});

// POST /api/programs/:id/join  { "role": "volunteer" | "paid" }
// volunteer: relawan tanpa imbal balik, mendapat poin relawan setelah hadir.
// paid: tenaga berbayar; lanjut ke percakapan dengan penyelenggara.
router.post('/:id/join', requireAuth, loadProgram, async (req, res, next) => {
  try {
    const role = req.body.role === 'paid' ? 'paid' : 'volunteer';
    const participant = await svc.rpc('join_program', {
      p_program_id: req.program.id,
      p_user_id: req.user.id,
      p_role: role,
    });
    res.status(201).json({
      participant,
      chat_url: role === 'paid' ? `/kegiatan/${req.program.id}/pesan` : null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/programs/:id/donate  { "benih_amount": 10, "message": "..." }
router.post('/:id/donate', requireAuth, async (req, res, next) => {
  try {
    const amount = parseBenihAmount(req.body.benih_amount);
    const message = req.body.message ? String(req.body.message).slice(0, 280) : null;
    const donation = await svc.rpc('donate_benih', {
      p_program_id: req.params.id,
      p_donor_id: req.user.id,
      p_amount: amount,
      p_message: message,
    });
    res.status(201).json({ donation });
  } catch (err) {
    next(err);
  }
});

// ---- Penyelenggara mengelola peserta ----

router.get('/:id/participants', requireAuth, loadProgram, requireOrganizer, async (req, res, next) => {
  try {
    res.json({ participants: await svc.getParticipants(req.program.id) });
  } catch (err) {
    next(err);
  }
});

// Konfirmasi kehadiran relawan (+poin relawan).
router.post('/:id/participants/:userId/attended', requireAuth, loadProgram, requireOrganizer, async (req, res, next) => {
  try {
    const participant = await svc.rpc('confirm_volunteer', {
      p_program_id: req.program.id,
      p_user_id: req.params.userId,
      p_organizer_id: req.user.id,
      p_points: VOLUNTEER_POINTS_PER_EVENT,
    });
    res.json({ participant });
  } catch (err) {
    next(err);
  }
});

// Catat Benih yang disepakati dengan tenaga berbayar.  { "benih_amount": 100 }
router.post('/:id/participants/:userId/agreement', requireAuth, loadProgram, requireOrganizer, async (req, res, next) => {
  try {
    const participant = await svc.rpc('set_paid_agreement', {
      p_program_id: req.program.id,
      p_user_id: req.params.userId,
      p_organizer_id: req.user.id,
      p_benih: parseBenihAmount(req.body.benih_amount),
    });
    res.json({ participant });
  } catch (err) {
    next(err);
  }
});

// Bayar tenaga berbayar sesuai kesepakatan (saldo penyelenggara -> peserta).
router.post('/:id/participants/:userId/pay', requireAuth, loadProgram, requireOrganizer, async (req, res, next) => {
  try {
    const participant = await svc.rpc('pay_participant', {
      p_program_id: req.program.id,
      p_user_id: req.params.userId,
      p_organizer_id: req.user.id,
    });
    res.json({ participant });
  } catch (err) {
    next(err);
  }
});

// ---- Percakapan penyelenggara <-> peserta ----
// :participantId adalah user_id peserta pemilik percakapan.

router.get('/:id/messages/:participantId', requireAuth, loadProgram, async (req, res, next) => {
  try {
    await svc.assertConversationAccess(req.program, req.params.participantId, req.user.id);
    await markProgramRead(req.program.id, req.params.participantId, req.user.id);
    res.json({ messages: await svc.getMessages(req.program.id, req.params.participantId) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/messages/:participantId', requireAuth, loadProgram, async (req, res, next) => {
  try {
    await svc.assertConversationAccess(req.program, req.params.participantId, req.user.id);
    const message = await svc.sendMessage(req.program.id, req.params.participantId, req.user.id, req.body.body);
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
