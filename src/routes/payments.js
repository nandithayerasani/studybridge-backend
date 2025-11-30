const express = require('express');
const { query } = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// Create a payment record for a session (stub for real PSP integration)
router.post('/checkout', authRequired, async (req, res, next) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const rows = await query(
      'SELECT id, student_id, tutor_id, price FROM sessions WHERE id = ?',
      [sessionId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    const s = rows[0];

    if (req.user.role !== 'admin' && req.user.id !== s.student_id) {
      return res.status(403).json({ error: 'Only the student can pay for a session' });
    }

    const amount = s.price;
    const result = await query(
      'INSERT INTO payments (session_id, student_id, tutor_id, amount, currency, status, provider, provider_charge_id, created_at)' +
        " VALUES (?, ?, ?, ?, 'USD', 'completed', 'stub', NULL, NOW())",
      [sessionId, s.student_id, s.tutor_id, amount]
    );

    const created = await query(
      'SELECT id, session_id AS sessionId, student_id AS studentId, tutor_id AS tutorId, amount, currency, status, provider, provider_charge_id AS providerChargeId, created_at AS createdAt FROM payments WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json(created[0]);
  } catch (err) {
    next(err);
  }
});

// List payment transactions for current user
router.get('/transactions', authRequired, async (req, res, next) => {
  try {
    const role = req.user.role;
    const { from, to } = req.query;
    let sql =
      'SELECT id, session_id AS sessionId, student_id AS studentId, tutor_id AS tutorId, amount, currency, status, provider, provider_charge_id AS providerChargeId, created_at AS createdAt FROM payments WHERE ';
    const params = [];
    if (role === 'tutor') {
      sql += 'tutor_id = ?';
    } else {
      sql += 'student_id = ?';
    }
    params.push(req.user.id);

    if (from) {
      sql += ' AND created_at >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND created_at <= ?';
      params.push(to);
    }

    sql += ' ORDER BY created_at DESC';

    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Summary of earnings or spend for current user
router.get('/summary', authRequired, async (req, res, next) => {
  try {
    const role = req.user.role;
    const { from, to } = req.query;

    let sql = 'SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count FROM payments WHERE ';
    const params = [];

    if (role === 'tutor') {
      sql += 'tutor_id = ?';
    } else {
      sql += 'student_id = ?';
    }
    params.push(req.user.id);

    if (from) {
      sql += ' AND created_at >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND created_at <= ?';
      params.push(to);
    }

    const rows = await query(sql, params);
    const total = rows[0]?.total || 0;
    const count = rows[0]?.count || 0;

    res.json({
      role,
      totalAmount: total,
      transactionCount: count,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
