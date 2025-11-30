const express = require('express');
const { query, getConnection } = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

function buildSessionSelectBase() {
  return (
    'SELECT s.id, s.student_id AS studentId, s.tutor_id AS tutorId, s.subject_id AS subjectId, s.title, s.status,' +
    ' s.start_time AS startTime, s.end_time AS endTime, s.duration_minutes AS durationMinutes,' +
    ' s.price, s.location, s.meeting_link AS meetingLink, s.notes, s.created_at AS createdAt, s.updated_at AS updatedAt,' +
    ' stu.name AS studentName, tut.name AS tutorName' +
    ' FROM sessions s' +
    ' JOIN users stu ON stu.id = s.student_id' +
    ' JOIN users tut ON tut.id = s.tutor_id'
  );
}

// List sessions for current user (student or tutor)
router.get('/', authRequired, async (req, res, next) => {
  try {
    const { role, userId, status, from, to } = req.query;
    const effectiveRole = role === 'student' || role === 'tutor' ? role : req.user.role;
    const effectiveUserId = userId ? Number(userId) : req.user.id;

    let sql = buildSessionSelectBase() + ' WHERE 1=1';
    const params = [];

    if (effectiveRole === 'student') {
      sql += ' AND s.student_id = ?';
    } else if (effectiveRole === 'tutor') {
      sql += ' AND s.tutor_id = ?';
    }
    params.push(effectiveUserId);

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (from) {
      sql += ' AND s.start_time >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND s.start_time <= ?';
      params.push(to);
    }

    sql += ' ORDER BY s.start_time DESC';

    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Get single session by id (must be participant)
router.get('/:id', authRequired, async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const rows = await query(buildSessionSelectBase() + ' WHERE s.id = ?', [sessionId]);
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    const session = rows[0];
    if (req.user.role !== 'admin' && req.user.id !== session.studentId && req.user.id !== session.tutorId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(session);
  } catch (err) {
    next(err);
  }
});

// Create a session from an availability slot (booking)
router.post('/', authRequired, async (req, res, next) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can book sessions' });
    }
    const { slotId, title, subjectId, notes } = req.body || {};
    if (!slotId) return res.status(400).json({ error: 'slotId is required' });

    const conn = await getConnection();
    try {
      await conn.beginTransaction();
      const [slotRows] = await conn.execute(
        'SELECT id, tutor_id, start_time, end_time, price, is_booked FROM availability_slots WHERE id = ? FOR UPDATE',
        [slotId]
      );
      if (!slotRows.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'Slot not found' });
      }
      const slot = slotRows[0];
      if (slot.is_booked) {
        await conn.rollback();
        return res.status(400).json({ error: 'Slot is already booked' });
      }

      const startTime = slot.start_time;
      const endTime = slot.end_time;
      const durationMinutes = Math.max(
        1,
        Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000)
      );

      const sessionTitle = title || 'Tutoring session';

      const [result] = await conn.execute(
        'INSERT INTO sessions (student_id, tutor_id, subject_id, title, status, start_time, end_time, duration_minutes, price, location, meeting_link, notes, created_at, updated_at)' +
          " VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?, ?, 'online', NULL, ?, NOW(), NOW())",
        [req.user.id, slot.tutor_id, subjectId || null, sessionTitle, startTime, endTime, durationMinutes, slot.price, notes || null]
      );

      await conn.execute('UPDATE availability_slots SET is_booked = 1, updated_at = NOW() WHERE id = ?', [slotId]);

      await conn.commit();

      const [createdRows] = await conn.execute(
        buildSessionSelectBase() + ' WHERE s.id = ?',
        [result.insertId]
      );
      res.status(201).json(createdRows[0]);
    } catch (err) {
      try { await conn.rollback(); } catch (_) {}
      next(err);
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
});

// Update a session (status, times, notes)
router.patch('/:id', authRequired, async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const rows = await query('SELECT student_id, tutor_id FROM sessions WHERE id = ?', [sessionId]);
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    const s = rows[0];
    if (req.user.role !== 'admin' && req.user.id !== s.student_id && req.user.id !== s.tutor_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { status, startTime, endTime, notes } = req.body || {};
    const fields = [];
    const params = [];
    if (status != null) { fields.push('status = ?'); params.push(status); }
    if (startTime != null) { fields.push('start_time = ?'); params.push(startTime); }
    if (endTime != null) { fields.push('end_time = ?'); params.push(endTime); }
    if (notes != null) { fields.push('notes = ?'); params.push(notes); }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(sessionId);
    await query(`UPDATE sessions SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
    const updated = await query(buildSessionSelectBase() + ' WHERE s.id = ?', [sessionId]);
    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
});

// Get messages for a session
router.get('/:id/messages', authRequired, async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const rows = await query('SELECT student_id, tutor_id FROM sessions WHERE id = ?', [sessionId]);
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    const s = rows[0];
    if (req.user.role !== 'admin' && req.user.id !== s.student_id && req.user.id !== s.tutor_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const messages = await query(
      'SELECT id, session_id AS sessionId, sender_id AS senderId, sender_name AS senderName, content, type, created_at AS createdAt FROM messages WHERE session_id = ? ORDER BY created_at ASC',
      [sessionId]
    );
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

// Post a new message to a session
router.post('/:id/messages', authRequired, async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const { content, type } = req.body || {};
    if (!content || !content.trim()) return res.status(400).json({ error: 'content is required' });
    const rows = await query('SELECT student_id, tutor_id FROM sessions WHERE id = ?', [sessionId]);
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    const s = rows[0];
    if (req.user.role !== 'admin' && req.user.id !== s.student_id && req.user.id !== s.tutor_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const messageType = type === 'system' ? 'system' : 'text';
    const result = await query(
      'INSERT INTO messages (session_id, sender_id, sender_name, content, type, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [sessionId, req.user.id, req.user.name || null, content, messageType]
    );
    const created = await query(
      'SELECT id, session_id AS sessionId, sender_id AS senderId, sender_name AS senderName, content, type, created_at AS createdAt FROM messages WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json(created[0]);
  } catch (err) {
    next(err);
  }
});

// Get AI summary for a session (if it exists)
router.get('/:id/ai-summary', authRequired, async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const rows = await query('SELECT student_id, tutor_id FROM sessions WHERE id = ?', [sessionId]);
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    const s = rows[0];
    if (req.user.role !== 'admin' && req.user.id !== s.student_id && req.user.id !== s.tutor_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const summaries = await query(
      'SELECT session_id AS sessionId, tldr, key_points AS keyPoints, next_steps AS nextSteps, created_at AS createdAt, updated_at AS updatedAt FROM session_ai_summaries WHERE session_id = ?',
      [sessionId]
    );
    if (!summaries.length) {
      return res.status(404).json({ error: 'AI summary not found' });
    }
    const summary = summaries[0];
    try {
      if (summary.keyPoints) summary.keyPoints = JSON.parse(summary.keyPoints);
    } catch (_) {}
    try {
      if (summary.nextSteps) summary.nextSteps = JSON.parse(summary.nextSteps);
    } catch (_) {}
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// Create or update AI summary for a session
router.post('/:id/ai-summary', authRequired, async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const { tldr, keyPoints, nextSteps } = req.body || {};
    const rows = await query('SELECT student_id, tutor_id FROM sessions WHERE id = ?', [sessionId]);
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    const s = rows[0];
    if (req.user.role !== 'admin' && req.user.id !== s.student_id && req.user.id !== s.tutor_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const keyPointsStr = Array.isArray(keyPoints) ? JSON.stringify(keyPoints) : null;
    const nextStepsStr = Array.isArray(nextSteps) ? JSON.stringify(nextSteps) : null;

    await query(
      'INSERT INTO session_ai_summaries (session_id, tldr, key_points, next_steps, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW()) ' +
        'ON DUPLICATE KEY UPDATE tldr = VALUES(tldr), key_points = VALUES(key_points), next_steps = VALUES(next_steps), updated_at = NOW()',
      [sessionId, tldr || null, keyPointsStr, nextStepsStr]
    );

    const saved = await query(
      'SELECT session_id AS sessionId, tldr, key_points AS keyPoints, next_steps AS nextSteps, created_at AS createdAt, updated_at AS updatedAt FROM session_ai_summaries WHERE session_id = ?',
      [sessionId]
    );
    const summary = saved[0];
    try {
      if (summary.keyPoints) summary.keyPoints = JSON.parse(summary.keyPoints);
    } catch (_) {}
    try {
      if (summary.nextSteps) summary.nextSteps = JSON.parse(summary.nextSteps);
    } catch (_) {}
    res.status(201).json(summary);
  } catch (err) {
    next(err);
  }
});

// Get TutorBot (AI) messages for a session
router.get('/:id/ai-messages', authRequired, async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const rows = await query('SELECT student_id, tutor_id FROM sessions WHERE id = ?', [sessionId]);
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    const s = rows[0];
    if (req.user.role !== 'admin' && req.user.id !== s.student_id && req.user.id !== s.tutor_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const messages = await query(
      'SELECT id, session_id AS sessionId, role, content, created_at AS createdAt FROM session_ai_messages WHERE session_id = ? ORDER BY created_at ASC',
      [sessionId]
    );
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

// Append a TutorBot (AI) message for a session
router.post('/:id/ai-messages', authRequired, async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const { role, content } = req.body || {};
    if (!content || !content.trim()) return res.status(400).json({ error: 'content is required' });
    const normalizedRole = role === 'bot' ? 'bot' : 'user';

    const rows = await query('SELECT student_id, tutor_id FROM sessions WHERE id = ?', [sessionId]);
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    const s = rows[0];
    if (req.user.role !== 'admin' && req.user.id !== s.student_id && req.user.id !== s.tutor_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await query(
      'INSERT INTO session_ai_messages (session_id, role, content, created_at) VALUES (?, ?, ?, NOW())',
      [sessionId, normalizedRole, content]
    );
    const created = await query(
      'SELECT id, session_id AS sessionId, role, content, created_at AS createdAt FROM session_ai_messages WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json(created[0]);
  } catch (err) {
    next(err);
  }
});

// Submit or update a review for a session
router.post('/:id/review', authRequired, async (req, res, next) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can submit reviews' });
    }
    const sessionId = req.params.id;
    const { rating, review } = req.body || {};
    const numericRating = Number(rating);
    if (!(numericRating >= 1 && numericRating <= 5)) {
      return res.status(400).json({ error: 'rating must be between 1 and 5' });
    }
    const rows = await query('SELECT student_id, tutor_id FROM sessions WHERE id = ?', [sessionId]);
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    const s = rows[0];
    if (s.student_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only review your own sessions' });
    }

    await query(
      'INSERT INTO session_reviews (session_id, student_id, tutor_id, rating, review, created_at) VALUES (?, ?, ?, ?, ?, NOW())' +
        ' ON DUPLICATE KEY UPDATE rating = VALUES(rating), review = VALUES(review), created_at = VALUES(created_at)',
      [sessionId, s.student_id, s.tutor_id, numericRating, review || null]
    );

    const reviewRows = await query(
      'SELECT id, session_id AS sessionId, student_id AS studentId, tutor_id AS tutorId, rating, review, helpful_count AS helpfulCount, created_at AS createdAt FROM session_reviews WHERE session_id = ?',
      [sessionId]
    );
    res.status(201).json(reviewRows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
