const express = require('express');
const { query } = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

function canAccessStudent(req, studentId) {
  return req.user.role === 'admin' || req.user.id === Number(studentId);
}

// Get all study plans for a student
router.get('/students/:studentId', authRequired, async (req, res, next) => {
  try {
    const { studentId } = req.params;
    if (!canAccessStudent(req, studentId)) return res.status(403).json({ error: 'Forbidden' });
    const rows = await query(
      'SELECT id, student_id AS studentId, title, description, subject_id AS subjectId, start_date AS startDate, end_date AS endDate, status, progress_percent AS progressPercent, created_at AS createdAt, updated_at AS updatedAt FROM study_plans WHERE student_id = ? ORDER BY created_at DESC',
      [studentId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Create a study plan for a student
router.post('/students/:studentId', authRequired, async (req, res, next) => {
  try {
    const { studentId } = req.params;
    if (!canAccessStudent(req, studentId)) return res.status(403).json({ error: 'Forbidden' });
    const { title, description, subjectId, startDate, endDate } = req.body || {};
    if (!title || !startDate || !endDate) {
      return res.status(400).json({ error: 'title, startDate and endDate are required' });
    }
    const result = await query(
      'INSERT INTO study_plans (student_id, title, description, subject_id, start_date, end_date, status, progress_percent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, "active", 0, NOW(), NOW())',
      [studentId, title, description || null, subjectId || null, startDate, endDate]
    );
    const rows = await query(
      'SELECT id, student_id AS studentId, title, description, subject_id AS subjectId, start_date AS startDate, end_date AS endDate, status, progress_percent AS progressPercent, created_at AS createdAt, updated_at AS updatedAt FROM study_plans WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Get single study plan
router.get('/:id', authRequired, async (req, res, next) => {
  try {
    const planId = req.params.id;
    const rows = await query(
      'SELECT id, student_id AS studentId, title, description, subject_id AS subjectId, start_date AS startDate, end_date AS endDate, status, progress_percent AS progressPercent, created_at AS createdAt, updated_at AS updatedAt FROM study_plans WHERE id = ?',
      [planId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Study plan not found' });
    const plan = rows[0];
    if (!canAccessStudent(req, plan.studentId)) return res.status(403).json({ error: 'Forbidden' });
    res.json(plan);
  } catch (err) {
    next(err);
  }
});

// Update a study plan
router.patch('/:id', authRequired, async (req, res, next) => {
  try {
    const planId = req.params.id;
    const existingRows = await query('SELECT student_id FROM study_plans WHERE id = ?', [planId]);
    if (!existingRows.length) return res.status(404).json({ error: 'Study plan not found' });
    const studentId = existingRows[0].student_id;
    if (!canAccessStudent(req, studentId)) return res.status(403).json({ error: 'Forbidden' });

    const { title, description, subjectId, startDate, endDate, status, progressPercent } = req.body || {};
    const fields = [];
    const params = [];
    if (title != null) { fields.push('title = ?'); params.push(title); }
    if (description != null) { fields.push('description = ?'); params.push(description); }
    if (subjectId != null) { fields.push('subject_id = ?'); params.push(subjectId); }
    if (startDate != null) { fields.push('start_date = ?'); params.push(startDate); }
    if (endDate != null) { fields.push('end_date = ?'); params.push(endDate); }
    if (status != null) { fields.push('status = ?'); params.push(status); }
    if (progressPercent != null) { fields.push('progress_percent = ?'); params.push(progressPercent); }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(planId);
    await query(`UPDATE study_plans SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
    const rows = await query(
      'SELECT id, student_id AS studentId, title, description, subject_id AS subjectId, start_date AS startDate, end_date AS endDate, status, progress_percent AS progressPercent, created_at AS createdAt, updated_at AS updatedAt FROM study_plans WHERE id = ?',
      [planId]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Get tasks for a plan
router.get('/:id/tasks', authRequired, async (req, res, next) => {
  try {
    const planId = req.params.id;
    const ownerRows = await query('SELECT student_id FROM study_plans WHERE id = ?', [planId]);
    if (!ownerRows.length) return res.status(404).json({ error: 'Study plan not found' });
    const studentId = ownerRows[0].student_id;
    if (!canAccessStudent(req, studentId)) return res.status(403).json({ error: 'Forbidden' });
    const rows = await query(
      'SELECT id, plan_id AS planId, student_id AS studentId, title, description, due_date AS dueDate, status, priority, subject_id AS subjectId, session_id AS sessionId, estimated_hours AS estimatedHours, created_at AS createdAt, updated_at AS updatedAt FROM tasks WHERE plan_id = ? ORDER BY due_date ASC',
      [planId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Add a task to a plan
router.post('/:id/tasks', authRequired, async (req, res, next) => {
  try {
    const planId = req.params.id;
    const ownerRows = await query('SELECT student_id FROM study_plans WHERE id = ?', [planId]);
    if (!ownerRows.length) return res.status(404).json({ error: 'Study plan not found' });
    const studentId = ownerRows[0].student_id;
    if (!canAccessStudent(req, studentId)) return res.status(403).json({ error: 'Forbidden' });

    const { title, description, dueDate, priority, subjectId, sessionId, estimatedHours } = req.body || {};
    if (!title || !dueDate) {
      return res.status(400).json({ error: 'title and dueDate are required' });
    }
    const prio = ['low', 'medium', 'high'].includes(priority) ? priority : 'medium';

    const result = await query(
      'INSERT INTO tasks (plan_id, student_id, title, description, due_date, status, priority, subject_id, session_id, estimated_hours, created_at, updated_at)' +
        ' VALUES (?, ?, ?, ?, ?, "todo", ?, ?, ?, ?, NOW(), NOW())',
      [planId, studentId, title, description || null, dueDate, prio, subjectId || null, sessionId || null, estimatedHours || null]
    );
    const rows = await query(
      'SELECT id, plan_id AS planId, student_id AS studentId, title, description, due_date AS dueDate, status, priority, subject_id AS subjectId, session_id AS sessionId, estimated_hours AS estimatedHours, created_at AS createdAt, updated_at AS updatedAt FROM tasks WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update a task
router.patch('/tasks/:taskId', authRequired, async (req, res, next) => {
  try {
    const taskId = req.params.taskId;
    const rows = await query('SELECT student_id FROM tasks WHERE id = ?', [taskId]);
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    const studentId = rows[0].student_id;
    if (!canAccessStudent(req, studentId)) return res.status(403).json({ error: 'Forbidden' });

    const { title, description, dueDate, status, priority, subjectId, sessionId, estimatedHours } = req.body || {};
    const fields = [];
    const params = [];
    if (title != null) { fields.push('title = ?'); params.push(title); }
    if (description != null) { fields.push('description = ?'); params.push(description); }
    if (dueDate != null) { fields.push('due_date = ?'); params.push(dueDate); }
    if (status != null) { fields.push('status = ?'); params.push(status); }
    if (priority != null) { fields.push('priority = ?'); params.push(priority); }
    if (subjectId != null) { fields.push('subject_id = ?'); params.push(subjectId); }
    if (sessionId != null) { fields.push('session_id = ?'); params.push(sessionId); }
    if (estimatedHours != null) { fields.push('estimated_hours = ?'); params.push(estimatedHours); }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

    params.push(taskId);
    await query(`UPDATE tasks SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
    const updated = await query(
      'SELECT id, plan_id AS planId, student_id AS studentId, title, description, due_date AS dueDate, status, priority, subject_id AS subjectId, session_id AS sessionId, estimated_hours AS estimatedHours, created_at AS createdAt, updated_at AS updatedAt FROM tasks WHERE id = ?',
      [taskId]
    );
    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
});

// Delete a task
router.delete('/tasks/:taskId', authRequired, async (req, res, next) => {
  try {
    const taskId = req.params.taskId;
    const rows = await query('SELECT student_id FROM tasks WHERE id = ?', [taskId]);
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    const studentId = rows[0].student_id;
    if (!canAccessStudent(req, studentId)) return res.status(403).json({ error: 'Forbidden' });
    await query('DELETE FROM tasks WHERE id = ?', [taskId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
