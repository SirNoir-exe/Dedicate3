const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { serializeDedication } = require('../serialize');

const router = express.Router();
router.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function clean(value, max) {
  const s = String(value ?? '').trim();
  return s.length > max ? null : s;
}

function isRealDate(str) {
  if (!DATE_RE.test(str)) return false;
  const d = new Date(str + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

// POST /api/dedications  - any logged-in user creates a dedication
router.post('/', (req, res) => {
  const body = req.body || {};

  const fromName = clean(body.fromName, 100);
  const toName = clean(body.toName, 100);
  const song = clean(body.song, 150);
  const artist = clean(body.artist, 100);
  const meal = clean(body.meal, 100);
  const comment = clean(body.comment, 500);
  const playDate = String(body.playDate || '').trim();

  if (!fromName) return res.status(400).json({ error: 'Please tell us who the dedication is from (max 100 characters).' });
  if (!toName) return res.status(400).json({ error: 'Please tell us who the dedication is for (max 100 characters).' });
  if (!song) return res.status(400).json({ error: 'Please enter the song (max 150 characters).' });
  if (artist === null) return res.status(400).json({ error: 'Artist name is too long.' });
  if (meal === null) return res.status(400).json({ error: 'Meal is too long.' });
  if (comment === null) return res.status(400).json({ error: 'Comment must be 500 characters or fewer.' });
  if (!isRealDate(playDate)) {
    return res.status(400).json({ error: 'Please pick a valid date (YYYY-MM-DD).' });
  }

  const info = db
    .prepare(
      `INSERT INTO dedications (user_id, from_name, to_name, song, artist, meal, comment, play_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, fromName, toName, song, artist || null, meal || null, comment || null, playDate);

  const row = db.prepare('SELECT * FROM dedications WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ dedication: serializeDedication(row) });
});

// GET /api/dedications/mine  - a user sees only their own submissions (and their status)
router.get('/mine', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM dedications WHERE user_id = ? ORDER BY created_at DESC, id DESC')
    .all(req.user.id);
  res.json({ dedications: rows.map(serializeDedication) });
});

// DELETE /api/dedications/:id  - a user can withdraw their own dedication while it is still pending
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM dedications WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Dedication not found.' });
  if (row.status !== 'pending') {
    return res.status(409).json({ error: 'Only pending dedications can be withdrawn.' });
  }
  db.prepare('DELETE FROM dedications WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
