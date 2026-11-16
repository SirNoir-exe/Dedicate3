const express = require('express');
const db = require('../db');
const { requireAuth, requireStaff } = require('../middleware/auth');
const { serializeDedication } = require('../serialize');

const router = express.Router();
// Every route here is locked to staff accounts (you + the social prefect).
router.use(requireAuth, requireStaff);

const STATUSES = ['pending', 'played', 'belated', 'cancelled'];
const SELECT = `
  SELECT d.*,
         u.full_name   AS submitted_by_name,
         u.school_email AS submitted_by_email,
         u.class_name  AS submitted_by_class,
         h.full_name   AS handled_by_name
  FROM dedications d
  JOIN users u ON u.id = d.user_id
  LEFT JOIN users h ON h.id = d.handled_by
`;

// GET /api/admin/dedications?status=pending&date=2026-11-05&q=song-or-name&from=...&to=...
router.get('/dedications', (req, res) => {
  const { status, date, from, to, q } = req.query;
  const where = [];
  const params = [];

  if (status) {
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
    }
    where.push('d.status = ?');
    params.push(status);
  }
  if (date) {
    where.push('d.play_date = ?');
    params.push(String(date));
  }
  if (from) {
    where.push('d.play_date >= ?');
    params.push(String(from));
  }
  if (to) {
    where.push('d.play_date <= ?');
    params.push(String(to));
  }
  if (q) {
    where.push(`(d.to_name LIKE ? OR d.from_name LIKE ? OR d.song LIKE ? OR d.artist LIKE ?)`);
    const like = `%${String(q).trim()}%`;
    params.push(like, like, like, like);
  }

  const sql =
    SELECT + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY d.play_date ASC, d.created_at ASC, d.id ASC';
  const rows = db.prepare(sql).all(...params);
  res.json({ dedications: rows.map(serializeDedication) });
});

// GET /api/admin/stats  - counts per status (handy for panel badges)
router.get('/stats', (_req, res) => {
  const rows = db.prepare('SELECT status, COUNT(*) AS n FROM dedications GROUP BY status').all();
  const stats = { pending: 0, played: 0, belated: 0, cancelled: 0 };
  for (const r of rows) stats[r.status] = r.n;
  res.json({ stats });
});

// PATCH /api/admin/dedications/:id/status   body: { status: "played"|"belated"|"cancelled"|"pending", note?: string }
router.patch('/dedications/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const { status, note } = req.body || {};

  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
  }
  const cleanNote = String(note ?? '').trim();
  if (cleanNote.length > 300) {
    return res.status(400).json({ error: 'Note must be 300 characters or fewer.' });
  }

  const existing = db.prepare('SELECT id FROM dedications WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Dedication not found.' });

  // Setting back to "pending" clears the handler so it returns to the queue cleanly.
  if (status === 'pending') {
    db.prepare(
      `UPDATE dedications SET status='pending', status_note=NULL, handled_by=NULL, handled_at=NULL WHERE id = ?`
    ).run(id);
  } else {
    db.prepare(
      `UPDATE dedications
       SET status = ?, status_note = ?, handled_by = ?, handled_at = datetime('now')
       WHERE id = ?`
    ).run(status, cleanNote || null, req.user.id, id);
  }

  const row = db.prepare(SELECT + ' WHERE d.id = ?').get(id);
  res.json({ dedication: serializeDedication(row) });
});

module.exports = router;
