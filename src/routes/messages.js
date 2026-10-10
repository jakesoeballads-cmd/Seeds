const express = require('express');
const { requireAuth, requireDatabase } = require('../middleware/auth');
const messages = require('../services/messages');

const router = express.Router();
router.use(requireDatabase, requireAuth);

// GET /api/messages  Kotak masuk: pesan langsung + percakapan kegiatan.
router.get('/', async (req, res, next) => {
  try {
    res.json({ conversations: await messages.listConversations(req.user.id) });
  } catch (err) {
    next(err);
  }
});

// GET /api/messages/unread  Jumlah pesan belum dibaca (untuk lencana menu).
router.get('/unread', async (req, res, next) => {
  try {
    res.json({ unread: await messages.unreadCount(req.user.id) });
  } catch (err) {
    next(err);
  }
});

// GET /api/messages/:userId  Pesan langsung dengan member lain (ditandai dibaca).
router.get('/:userId', async (req, res, next) => {
  try {
    const thread = await messages.getDirectThread(req.user.id, req.params.userId);
    await messages.markDirectRead(req.user.id, req.params.userId);
    res.json({ messages: thread });
  } catch (err) {
    next(err);
  }
});

// POST /api/messages/:userId  { "body": "…" }
router.post('/:userId', async (req, res, next) => {
  try {
    res.status(201).json({ message: await messages.sendDirect(req.user.id, req.params.userId, req.body.body) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
