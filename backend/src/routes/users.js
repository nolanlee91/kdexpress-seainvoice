const express = require('express');
const { query } = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authRequired);

router.get('/', requireRole('admin'), async (req, res) => {
  const { rows } = await query(
    `SELECT id, code, name, role, password, created_at FROM users ORDER BY id ASC`
  );
  res.json(rows);
});

router.post('/', requireRole('admin'), async (req, res) => {
  const { code, name, password, role } = req.body || {};
  if (!code || !name) return res.status(400).json({ error: 'code_and_name_required' });
  if (!['admin', 'manager', 'staff'].includes(role || 'staff')) {
    return res.status(400).json({ error: 'invalid_role' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO users (code, name, password, role) VALUES ($1, $2, $3, $4)
       RETURNING id, code, name, role, password, created_at`,
      [code, name, password || null, role || 'staff']
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'code_taken' });
    throw e;
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const { name, password, role } = req.body || {};
  const fields = [];
  const vals = [];
  let i = 1;
  if (name !== undefined) { fields.push(`name = $${i++}`); vals.push(name); }
  if (password !== undefined) { fields.push(`password = $${i++}`); vals.push(password); }
  if (role !== undefined) {
    if (!['admin', 'manager', 'staff'].includes(role)) return res.status(400).json({ error: 'invalid_role' });
    fields.push(`role = $${i++}`); vals.push(role);
  }
  if (fields.length === 0) return res.status(400).json({ error: 'no_fields' });
  vals.push(req.params.id);
  const { rows } = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${i}
     RETURNING id, code, name, role, password, created_at`,
    vals
  );
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  if (Number(req.params.id) === Number(req.user.id)) {
    return res.status(400).json({ error: 'cannot_delete_self' });
  }
  await query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
