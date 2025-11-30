const express = require('express');
const { query } = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { subject, minRating } = req.query;
    const params = [];
    let sql =
      'SELECT u.id, u.name, u.bio, u.avatar_url AS avatarUrl, u.verified, u.joined_at AS joinedAt,' +
      ' COALESCE(AVG(r.rating),0) AS rating, COUNT(r.id) AS totalRatings' +
      ' FROM users u' +
      ' LEFT JOIN session_reviews r ON r.tutor_id = u.id';
    if (subject) {
      sql +=
        ' JOIN tutor_subjects ts ON ts.tutor_id = u.id' +
        ' JOIN subjects s ON s.id = ts.subject_id AND s.name = ?';
      params.push(subject);
    }
    sql += ' WHERE u.role = "tutor" GROUP BY u.id';
    if (minRating) {
      sql += ' HAVING rating >= ?';
      params.push(Number(minRating));
    }
    const tutors = await query(sql, params);
    for (const t of tutors) {
      const subs = await query(
        'SELECT s.name FROM tutor_subjects ts JOIN subjects s ON s.id = ts.subject_id WHERE ts.tutor_id = ? ORDER BY s.name',
        [t.id]
      );
      t.subjects = subs.map((s) => s.name);
    }
    res.json(tutors);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/availability', async (req, res, next) => {
  try {
    const tutorId = req.params.id;
    const rows = await query(
      'SELECT id, tutor_id AS tutorId, start_time AS startTime, end_time AS endTime, price, is_booked AS isBooked FROM availability_slots WHERE tutor_id = ? ORDER BY start_time ASC',
      [tutorId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/availability', authRequired, async (req, res, next) => {
  try {
    const tutorId = Number(req.params.id);
    if (req.user.role !== 'tutor' || req.user.id !== tutorId) {
      return res.status(403).json({ error: 'You can only manage your own availability' });
    }
    const { startTime, endTime, price } = req.body || {};
    if (!startTime || !endTime || price == null) {
      return res.status(400).json({ error: 'startTime, endTime and price are required' });
    }
    const result = await query(
      'INSERT INTO availability_slots (tutor_id, start_time, end_time, price, is_booked, created_at, updated_at) VALUES (?, ?, ?, ?, 0, NOW(), NOW())',
      [tutorId, startTime, endTime, price]
    );
    const rows = await query(
      'SELECT id, tutor_id AS tutorId, start_time AS startTime, end_time AS endTime, price, is_booked AS isBooked FROM availability_slots WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/availability/:slotId', authRequired, async (req, res, next) => {
  try {
    const tutorId = Number(req.params.id);
    const slotId = Number(req.params.slotId);

    if (!Number.isFinite(tutorId) || !Number.isFinite(slotId)) {
      return res.status(400).json({ error: 'Invalid tutor or slot id' });
    }

    if (req.user.role !== 'tutor' || req.user.id !== tutorId) {
      return res.status(403).json({ error: 'You can only manage your own availability' });
    }

    const rows = await query('SELECT tutor_id FROM availability_slots WHERE id = ?', [slotId]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    if (rows[0].tutor_id !== tutorId) {
      return res.status(403).json({ error: 'You can only delete your own slots' });
    }

    await query('DELETE FROM availability_slots WHERE id = ?', [slotId]);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/reviews', async (req, res, next) => {
  try {
    const tutorId = req.params.id;
    const rows = await query(
      'SELECT id, session_id AS sessionId, student_id AS studentId, tutor_id AS tutorId, rating, review, helpful_count AS helpfulCount, created_at AS createdAt FROM session_reviews WHERE tutor_id = ? ORDER BY created_at DESC',
      [tutorId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/rating-summary', async (req, res, next) => {
  try {
    const tutorId = req.params.id;
    const rows = await query(
      'SELECT COALESCE(AVG(rating),0) AS averageRating, COUNT(*) AS totalReviews FROM session_reviews WHERE tutor_id = ?',
      [tutorId]
    );
    res.json(rows[0] || { averageRating: 0, totalReviews: 0 });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const rows = await query(
      'SELECT u.id, u.name, u.bio, u.avatar_url AS avatarUrl, u.verified, u.joined_at AS joinedAt,' +
        ' COALESCE(AVG(r.rating),0) AS rating, COUNT(r.id) AS totalRatings' +
        ' FROM users u LEFT JOIN session_reviews r ON r.tutor_id = u.id' +
        ' WHERE u.id = ? AND u.role = "tutor" GROUP BY u.id',
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Tutor not found' });
    const tutor = rows[0];
    const subs = await query(
      'SELECT s.id, s.name FROM tutor_subjects ts JOIN subjects s ON s.id = ts.subject_id WHERE ts.tutor_id = ? ORDER BY s.name',
      [id]
    );
    tutor.subjects = subs;
    res.json(tutor);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
