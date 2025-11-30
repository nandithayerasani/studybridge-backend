const express = require('express');
const { query } = require('../config/db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const rows = await query(
      'SELECT id, name, category, description, icon FROM subjects ORDER BY name ASC',
      []
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const rows = await query(
      'SELECT id, name, category, description, icon FROM subjects WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Subject not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
