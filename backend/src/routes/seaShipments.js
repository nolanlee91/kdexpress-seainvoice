const express = require('express');
const { query } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT s.id, s.code, s.invoice_date, s.sender_block, s.status, s.created_at,
            COALESCE(cu.cnt, 0) AS customer_count,
            COALESCE(inv.cnt, 0) AS invoice_count,
            COALESCE(ci.cnt, 0) AS ci_item_count
       FROM sea_shipments s
       LEFT JOIN (SELECT sea_shipment_id, COUNT(*) cnt FROM sea_shipment_customers GROUP BY sea_shipment_id) cu
              ON cu.sea_shipment_id = s.id
       LEFT JOIN (SELECT sea_shipment_id, COUNT(*) cnt FROM invoices GROUP BY sea_shipment_id) inv
              ON inv.sea_shipment_id = s.id
       LEFT JOIN (SELECT sea_shipment_id, COUNT(*) cnt FROM commercial_invoice_items GROUP BY sea_shipment_id) ci
              ON ci.sea_shipment_id = s.id
   ORDER BY s.created_at DESC, s.id DESC`
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { code, invoice_date, sender_block } = req.body || {};
  if (!code) return res.status(400).json({ error: 'code_required' });
  try {
    const { rows } = await query(
      `INSERT INTO sea_shipments (code, invoice_date, sender_block, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [code, invoice_date || null, sender_block || null, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'code_taken' });
    throw e;
  }
});

router.get('/:id', async (req, res) => {
  const { rows } = await query(`SELECT * FROM sea_shipments WHERE id = $1`, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  const ship = rows[0];
  const { rows: customers } = await query(
    `SELECT c.id, c.name, c.address, c.receiver_block,
            ssc.display_order, ssc.currency, ssc.exchange_rate_vnd_per_usd,
            ssc.raw_data_saved_at, ssc.ci_generated_at,
            COALESCE(inv.cnt, 0) AS invoice_count,
            COALESCE(raw.cnt, 0) AS raw_item_count,
            COALESCE(ci.cnt, 0) AS ci_item_count
       FROM sea_shipment_customers ssc
       JOIN customers c ON c.id = ssc.customer_id
       LEFT JOIN (SELECT customer_id, sea_shipment_id, COUNT(*) cnt FROM invoices
                   WHERE sea_shipment_id = $1 GROUP BY customer_id, sea_shipment_id) inv
              ON inv.customer_id = c.id
       LEFT JOIN (SELECT customer_id, sea_shipment_id, COUNT(*) cnt FROM raw_data_items
                   WHERE sea_shipment_id = $1 GROUP BY customer_id, sea_shipment_id) raw
              ON raw.customer_id = c.id
       LEFT JOIN (SELECT customer_id, sea_shipment_id, COUNT(*) cnt FROM commercial_invoice_items
                   WHERE sea_shipment_id = $1 GROUP BY customer_id, sea_shipment_id) ci
              ON ci.customer_id = c.id
      WHERE ssc.sea_shipment_id = $1
   ORDER BY ssc.display_order ASC, c.name ASC`,
    [req.params.id]
  );
  res.json({ ...ship, customers });
});

router.put('/:id', async (req, res) => {
  const { code, invoice_date, sender_block, status } = req.body || {};
  const fields = [];
  const vals = [];
  let i = 1;
  if (code !== undefined) { fields.push(`code = $${i++}`); vals.push(code); }
  if (invoice_date !== undefined) { fields.push(`invoice_date = $${i++}`); vals.push(invoice_date || null); }
  if (sender_block !== undefined) { fields.push(`sender_block = $${i++}`); vals.push(sender_block); }
  if (status !== undefined) { fields.push(`status = $${i++}`); vals.push(status); }
  if (fields.length === 0) return res.status(400).json({ error: 'no_fields' });
  vals.push(req.params.id);
  try {
    const { rows } = await query(
      `UPDATE sea_shipments SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'code_taken' });
    throw e;
  }
});

router.delete('/:id', async (req, res) => {
  await query(`DELETE FROM sea_shipments WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

router.post('/:id/customers', async (req, res) => {
  const { customer_id } = req.body || {};
  if (!customer_id) return res.status(400).json({ error: 'customer_id_required' });
  try {
    const { rows } = await query(
      `INSERT INTO sea_shipment_customers (sea_shipment_id, customer_id, display_order)
       VALUES ($1, $2, COALESCE((SELECT MAX(display_order)+1 FROM sea_shipment_customers WHERE sea_shipment_id=$1), 0))
       RETURNING *`,
      [req.params.id, customer_id]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'already_added' });
    throw e;
  }
});

router.delete('/:id/customers/:customerId', async (req, res) => {
  await query(`DELETE FROM raw_data_items WHERE sea_shipment_id = $1 AND customer_id = $2`, [req.params.id, req.params.customerId]);
  await query(`DELETE FROM commercial_invoice_items WHERE sea_shipment_id = $1 AND customer_id = $2`, [req.params.id, req.params.customerId]);
  await query(`DELETE FROM invoices WHERE sea_shipment_id = $1 AND customer_id = $2`, [req.params.id, req.params.customerId]);
  await query(
    `DELETE FROM sea_shipment_customers WHERE sea_shipment_id = $1 AND customer_id = $2`,
    [req.params.id, req.params.customerId]
  );
  res.json({ ok: true });
});

module.exports = router;
