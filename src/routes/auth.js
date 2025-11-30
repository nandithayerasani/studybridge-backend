const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../config/db');
const { generateToken, authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' });
    const userRole = role === 'tutor' ? 'tutor' : 'student';
    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ error: 'Email already in use' });
    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (name, email, password_hash, role, joined_at) VALUES (?, ?, ?, ?, NOW())',
      [name, email, hash, userRole]
    );
    const user = { id: result.insertId, name, email, role: userRole };
    const token = generateToken(user);
    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
    const rows = await query('SELECT id, name, email, password_hash, role FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const userRow = rows[0];
    const ok = await bcrypt.compare(password, userRow.password_hash || '');
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const user = { id: userRow.id, name: userRow.name, email: userRow.email, role: userRow.role };
    const token = generateToken(user);
    res.json({ user, token });
  } catch (err) {
    next(err);
  }
});

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

router.post('/logout', authRequired, (req, res) => {
  res.json({ ok: true });
});

// Request a password reset link
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const users = await query('SELECT id, email FROM users WHERE email = ?', [email]);

    // Always return a generic response to avoid leaking whether the email exists
    const genericResponse = {
      ok: true,
      message: 'If an account exists for that email, password reset instructions have been sent.',
    };

    if (!users.length) {
      return res.json(genericResponse);
    }

    const user = users[0];

    // Generate secure token and store hash
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, used_at, created_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), NULL, NOW())',
      [user.id, tokenHash]
    );

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${token}`;

    // For now, log the reset URL so it can be tested in development
    console.log('Password reset link for', user.email, ':', resetUrl);

    return res.json(genericResponse);
  } catch (err) {
    next(err);
  }
});

// Reset password using a token
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({ error: 'token and password are required' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const rows = await query(
      'SELECT prt.id, prt.user_id AS userId FROM password_reset_tokens prt WHERE prt.token_hash = ? AND prt.expires_at > NOW() AND prt.used_at IS NULL LIMIT 1',
      [tokenHash]
    );

    if (!rows.length) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const reset = rows[0];

    const hash = await bcrypt.hash(password, 10);

    await query('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, reset.userId]);
    await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?', [reset.id]);

    res.json({ ok: true, message: 'Password has been reset successfully.' });
  } catch (err) {
    next(err);
  }
});

// Change password for logged-in user
router.post('/change-password', authRequired, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const rows = await query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userRow = rows[0];
    const ok = await bcrypt.compare(currentPassword, userRow.password_hash || '');
    if (!ok) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, req.user.id]);

    res.json({ ok: true, message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
