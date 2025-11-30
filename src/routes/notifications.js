const express = require('express');
const { query } = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// List notifications for current user
router.get('/', authRequired, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const rows = await query(
      'SELECT id, user_id AS userId, type, title, message, action_url AS actionUrl, action_text AS actionText, is_read AS isRead, created_at AS createdAt FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Mark a single notification as read/unread
router.patch('/:id', authRequired, async (req, res, next) => {
  try {
    const notifId = req.params.id;
    const userId = req.user.id;
    const rows = await query('SELECT user_id FROM notifications WHERE id = ?', [notifId]);
    if (!rows.length) return res.status(404).json({ error: 'Notification not found' });
    if (rows[0].user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

    const { isRead } = req.body || {};
    const value = isRead === false ? 0 : 1;
    await query('UPDATE notifications SET is_read = ?, created_at = created_at WHERE id = ?', [value, notifId]);

    const updated = await query(
      'SELECT id, user_id AS userId, type, title, message, action_url AS actionUrl, action_text AS actionText, is_read AS isRead, created_at AS createdAt FROM notifications WHERE id = ?',
      [notifId]
    );
    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
});

// Mark all notifications as read for current user
router.post('/mark-all-read', authRequired, async (req, res, next) => {
  try {
    const userId = req.user.id;
    await query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Optional summary endpoint (unread, today, total)
router.get('/summary', authRequired, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const all = await query('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?', [userId]);
    const unread = await query('SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0', [userId]);
    const today = await query(
      'SELECT COUNT(*) AS today FROM notifications WHERE user_id = ? AND DATE(created_at) = CURDATE()',
      [userId]
    );
    res.json({
      total: all[0]?.total || 0,
      unread: unread[0]?.unread || 0,
      today: today[0]?.today || 0,
    });
  } catch (err) {
    next(err);
  }
});

// Get notification settings for current user
router.get('/settings', authRequired, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const rows = await query(
      'SELECT booking, reminder, payment, rating, system_updates AS system FROM notification_settings WHERE user_id = ?',
      [userId]
    );

    if (!rows.length) {
      // Defaults: all enabled
      return res.json({
        booking: true,
        reminder: true,
        payment: true,
        rating: true,
        system: true,
      });
    }

    const row = rows[0];
    res.json({
      booking: !!row.booking,
      reminder: !!row.reminder,
      payment: !!row.payment,
      rating: !!row.rating,
      system: !!row.system,
    });
  } catch (err) {
    // If the notification_settings table does not exist yet, fall back to defaults
    if (err && err.code === 'ER_NO_SUCH_TABLE') {
      return res.json({
        booking: true,
        reminder: true,
        payment: true,
        rating: true,
        system: true,
      });
    }
    next(err);
  }
});

// Update notification settings for current user
router.put('/settings', authRequired, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { booking, reminder, payment, rating, system } = req.body || {};

    const toBit = (value) => (value === false ? 0 : 1);

    await query(
      'INSERT INTO notification_settings (user_id, booking, reminder, payment, rating, system_updates, created_at, updated_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW()) ' +
        'ON DUPLICATE KEY UPDATE booking = VALUES(booking), reminder = VALUES(reminder), payment = VALUES(payment), rating = VALUES(rating), system_updates = VALUES(system_updates), updated_at = NOW()',
      [
        userId,
        toBit(booking),
        toBit(reminder),
        toBit(payment),
        toBit(rating),
        toBit(system),
      ]
    );

    const rows = await query(
      'SELECT booking, reminder, payment, rating, system_updates AS system FROM notification_settings WHERE user_id = ?',
      [userId]
    );
    const row = rows[0];

    res.json({
      booking: !!row.booking,
      reminder: !!row.reminder,
      payment: !!row.payment,
      rating: !!row.rating,
      system: !!row.system,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
