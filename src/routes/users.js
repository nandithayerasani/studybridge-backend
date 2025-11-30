const express = require('express');
const { query } = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/me', authRequired, async (req, res, next) => {
  try {
    const rows = await query(
      'SELECT id, name, email, role, avatar_url AS avatarUrl, bio, verified, joined_at AS joinedAt FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/me', authRequired, async (req, res, next) => {
  try {
    const { name, bio, avatarUrl } = req.body || {};
    const fields = [];
    const params = [];
    if (name != null) { fields.push('name = ?'); params.push(name); }
    if (bio != null) { fields.push('bio = ?'); params.push(bio); }
    if (avatarUrl != null) { fields.push('avatar_url = ?'); params.push(avatarUrl); }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.user.id);
    await query(`UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
    const rows = await query(
      'SELECT id, name, email, role, avatar_url AS avatarUrl, bio, verified, joined_at AS joinedAt FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
