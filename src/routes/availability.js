const express = require('express');
const { query } = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// Get an availability slot by id
router.get('/:id', async (req, res, next) => {
  try {
    const slotId = req.params.id;
    const rows = await query(
      'SELECT id, tutor_id AS tutorId, start_time AS startTime, end_time AS endTime, price, is_booked AS isBooked FROM availability_slots WHERE id = ?',
      [slotId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Slot not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update an availability slot (tutor only)
router.patch('/:id', authRequired, async (req, res, next) => {
  try {
    const slotId = req.params.id;
    const rows = await query('SELECT tutor_id FROM availability_slots WHERE id = ?', [slotId]);
    if (!rows.length) return res.status(404).json({ error: 'Slot not found' });
    const tutorId = rows[0].tutor_id;
    if (req.user.role !== 'tutor' || req.user.id !== tutorId) {
      return res.status(403).json({ error: 'You can only modify your own availability' });
    }

    const { startTime, endTime, price, isBooked } = req.body || {};
    const fields = [];
    const params = [];
    if (startTime != null) { fields.push('start_time = ?'); params.push(startTime); }
    if (endTime != null) { fields.push('end_time = ?'); params.push(endTime); }
    if (price != null) { fields.push('price = ?'); params.push(price); }
    if (isBooked != null) { fields.push('is_booked = ?'); params.push(isBooked ? 1 : 0); }

    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

    params.push(slotId);
    await query(`UPDATE availability_slots SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
    const updated = await query(
      'SELECT id, tutor_id AS tutorId, start_time AS startTime, end_time AS endTime, price, is_booked AS isBooked FROM availability_slots WHERE id = ?',
      [slotId]
    );
    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
});

// Delete an availability slot (tutor only)
router.delete('/:id', authRequired, async (req, res, next) => {
  try {
    const slotId = req.params.id;
    const rows = await query('SELECT tutor_id FROM availability_slots WHERE id = ?', [slotId]);
    if (!rows.length) return res.status(404).json({ error: 'Slot not found' });
    const tutorId = rows[0].tutor_id;
    if (req.user.role !== 'tutor' || req.user.id !== tutorId) {
      return res.status(403).json({ error: 'You can only delete your own availability' });
    }
    await query('DELETE FROM availability_slots WHERE id = ?', [slotId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
