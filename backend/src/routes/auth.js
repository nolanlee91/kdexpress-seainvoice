const express = require('express');
const { query } = require('../db');
const { signToken, verifyPassword, authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { code, password } = req.body || {};
  if (!code) return res.status(400).json({ error: 'code_required' });
  const { rows } = await query(`SELECT * FROM users WHERE code = $1`, [code]);
  if (rows.length === 0) return res.status(401).json({ error: 'invalid_credentials' });
  const user = rows[0];
  const ok = await verifyPassword(password || '', user.password);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, code: user.code, name: user.name, role: user.role },
  });
});

router.get('/me', authRequired, async (req, res) => {
  const { rows } = await query(`SELECT id, code, name, role FROM users WHERE id = $1`, [req.user.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'user_not_found' });
  res.json(rows[0]);
});

router.post('/change-password', authRequired, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!new_password) return res.status(400).json({ error: 'new_password_required' });
  const { rows } = await query(`SELECT * FROM users WHERE id = $1`, [req.user.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'user_not_found' });
  const ok = await verifyPassword(current_password || '', rows[0].password);
  if (!ok) return res.status(401).json({ error: 'invalid_current_password' });
  await query(`UPDATE users SET password = $1 WHERE id = $2`, [new_password, req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
