const express = require('express');
const { query } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT id, name, address, receiver_block, created_at FROM customers ORDER BY name ASC`
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name, address, receiver_block } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name_required' });
  const { rows } = await query(
    `INSERT INTO customers (name, address, receiver_block) VALUES ($1, $2, $3) RETURNING *`,
    [name, address || null, receiver_block || null]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { name, address, receiver_block } = req.body || {};
  const fields = [];
  const vals = [];
  let i = 1;
  if (name !== undefined) { fields.push(`name = $${i++}`); vals.push(name); }
  if (address !== undefined) { fields.push(`address = $${i++}`); vals.push(address); }
  if (receiver_block !== undefined) { fields.push(`receiver_block = $${i++}`); vals.push(receiver_block); }
  if (fields.length === 0) return res.status(400).json({ error: 'no_fields' });
  vals.push(req.params.id);
  const { rows } = await query(
    `UPDATE customers SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await query(`DELETE FROM customers WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
