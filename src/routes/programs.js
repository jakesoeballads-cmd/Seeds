const express = require('express');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { requireAuth, requireDatabase } = require('../middleware/auth');
const { parseBenihAmount } = require('../services/benih');

const router = express.Router();
router.use(requireDatabase);

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function parseCoordinate(value, min, max, name) {
  const n = Number(value);
  if (value === undefined || value === '' || !Number.isFinite(n) || n < min || n > max) {
    throw badRequest(`${name} tidak valid.`);
  }
  return n;
}

// GET /api/programs?lat=-6.2&lng=106.8&radius_km=25
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
      .select('id, title, description, category, location_name, lat, lng, start_at, end_at, benih_target, benih_collected, max_participants')
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
      .limit(100);
    if (error) throw error;
    res.json({ programs: data });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    // Admin client: nama penyelenggara dari tabel profiles (RLS membatasi profil
    // hanya untuk pemiliknya), jadi hanya kolom yang aman yang dipilih.
    const { data, error } = await supabaseAdmin
      .from('programs')
      .select('*, organizer:profiles!programs_organizer_id_fkey(id, full_name)')
      .eq('id', req.params.id)
      .eq('status', 'published')
      .maybeSingle();
    if (error && error.code !== '22P02') throw error; // 22P02: id bukan UUID
    if (!data) return res.status(404).json({ error: 'Program tidak ditemukan.' });
    res.json({ program: data });
  } catch (err) {
    next(err);
  }
});

// Member membuat kegiatan baru.
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const b = req.body;
    const title = String(b.title || '').trim();
    if (title.length < 3) throw badRequest('Judul minimal 3 karakter.');

    const startAt = new Date(b.start_at);
    if (Number.isNaN(startAt.getTime())) throw badRequest('Tanggal mulai tidak valid.');
    const endAt = b.end_at ? new Date(b.end_at) : null;
    if (endAt && (Number.isNaN(endAt.getTime()) || endAt < startAt)) {
      throw badRequest('Tanggal selesai harus setelah tanggal mulai.');
    }

    const row = {
      organizer_id: req.user.id,
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
    };

    const { data, error } = await supabaseAdmin.from('programs').insert(row).select().single();
    if (error) throw error;
    res.status(201).json({ program: data });
  } catch (err) {
    next(err);
  }
});

// Member lain mengikuti kegiatan.
router.post('/:id/join', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.rpc('join_program', {
      p_program_id: req.params.id,
      p_user_id: req.user.id,
    });
    if (error) {
      if (error.code === 'P0001') throw badRequest(error.message);
      throw error;
    }
    res.status(201).json({ participant: data });
  } catch (err) {
    next(err);
  }
});

// Member lain mendonasikan Benih ke kegiatan. Benih masuk ke saldo hasil
// donasi penyelenggara, yang bisa ditarik ke rekening.
router.post('/:id/donate', requireAuth, async (req, res, next) => {
  try {
    const amount = parseBenihAmount(req.body.benih_amount);
    const message = req.body.message ? String(req.body.message).slice(0, 280) : null;
    const { data, error } = await supabaseAdmin.rpc('donate_benih', {
      p_program_id: req.params.id,
      p_donor_id: req.user.id,
      p_amount: amount,
      p_message: message,
    });
    if (error) {
      if (error.code === 'P0001') throw badRequest(error.message);
      if (error.code === '22P02') return res.status(404).json({ error: 'Program tidak ditemukan.' });
      throw error;
    }
    res.status(201).json({ donation: data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
