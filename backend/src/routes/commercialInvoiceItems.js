const express = require('express');
const { query, pool } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/sea-shipments/:id/commercial-invoice-items', async (req, res) => {
  const params = [req.params.id];
  let sql = `SELECT * FROM commercial_invoice_items WHERE sea_shipment_id = $1`;
  if (req.query.customer_id) {
    params.push(req.query.customer_id);
    sql += ` AND customer_id = $${params.length}`;
  }
  sql += ` ORDER BY customer_id, line_no ASC, id ASC`;
  const { rows } = await query(sql, params);
  res.json(rows);
});

router.post('/sea-shipments/:id/commercial-invoice-items', async (req, res) => {
  const b = req.body || {};
  if (!b.customer_id) return res.status(400).json({ error: 'customer_id_required' });
  const { rows: maxRow } = await query(
    `SELECT COALESCE(MAX(line_no), 0) AS max_line FROM commercial_invoice_items
      WHERE sea_shipment_id = $1 AND customer_id = $2`,
    [req.params.id, b.customer_id]
  );
  const lineNo = b.line_no || (Number(maxRow[0].max_line) + 1);
  const { rows } = await query(
    `INSERT INTO commercial_invoice_items
      (sea_shipment_id, customer_id, source_invoice_id, line_no,
       name_vn, name_en, qty, unit, unit_value_usd, total_value_usd, country_of_origin)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      req.params.id, b.customer_id, b.source_invoice_id || null, lineNo,
      b.name_vn || '', b.name_en || '',
      b.qty || 0, b.unit || 'PCS',
      b.unit_value_usd || 0,
      b.total_value_usd != null ? b.total_value_usd : Number(b.qty || 0) * Number(b.unit_value_usd || 0),
      b.country_of_origin || 'VIETNAM',
    ]
  );
  res.status(201).json(rows[0]);
});

router.put('/commercial-invoice-items/:id', async (req, res) => {
  const allowed = [
    'name_vn', 'name_en', 'qty', 'unit',
    'unit_value_usd', 'total_value_usd', 'country_of_origin', 'line_no',
  ];
  const fields = [];
  const vals = [];
  let i = 1;
  for (const k of allowed) {
    if (req.body && req.body[k] !== undefined) {
      fields.push(`${k} = $${i++}`);
      vals.push(req.body[k] === '' ? null : req.body[k]);
    }
  }
  if (fields.length === 0) return res.status(400).json({ error: 'no_fields' });
  fields.push(`updated_at = NOW()`);
  vals.push(req.params.id);
  const { rows } = await query(
    `UPDATE commercial_invoice_items SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

router.delete('/commercial-invoice-items/:id', async (req, res) => {
  await query(`DELETE FROM commercial_invoice_items WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

// Bulk upsert: dùng cho inline-edit toàn bảng — gửi cả danh sách + id của row bị xoá
// Body: { sea_shipment_id, customer_id, upserts: [{id?, ...}], delete_ids: [int] }
router.post('/commercial-invoice-items/bulk', async (req, res) => {
  const { sea_shipment_id, customer_id, upserts = [], delete_ids = [] } = req.body || {};
  if (!sea_shipment_id || !customer_id) {
    return res.status(400).json({ error: 'sea_shipment_id_and_customer_id_required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (delete_ids.length > 0) {
      await client.query(
        `DELETE FROM commercial_invoice_items
          WHERE id = ANY($1::int[]) AND sea_shipment_id = $2 AND customer_id = $3`,
        [delete_ids, sea_shipment_id, customer_id]
      );
    }
    const results = [];
    for (const it of upserts) {
      if (it.id) {
        const { rows } = await client.query(
          `UPDATE commercial_invoice_items SET
              line_no = $1, name_vn = $2, name_en = $3, qty = $4, unit = $5,
              unit_value_usd = $6, total_value_usd = $7, country_of_origin = $8,
              updated_at = NOW()
            WHERE id = $9 AND sea_shipment_id = $10 AND customer_id = $11
          RETURNING *`,
          [
            it.line_no || 0, it.name_vn || '', it.name_en || '',
            it.qty || 0, it.unit || 'PCS',
            it.unit_value_usd || 0,
            it.total_value_usd != null ? it.total_value_usd : Number(it.qty || 0) * Number(it.unit_value_usd || 0),
            it.country_of_origin || 'VIETNAM',
            it.id, sea_shipment_id, customer_id,
          ]
        );
        if (rows[0]) results.push(rows[0]);
      } else {
        const { rows } = await client.query(
          `INSERT INTO commercial_invoice_items
            (sea_shipment_id, customer_id, source_invoice_id, line_no,
             name_vn, name_en, qty, unit, unit_value_usd, total_value_usd, country_of_origin)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [
            sea_shipment_id, customer_id, it.source_invoice_id || null, it.line_no || 0,
            it.name_vn || '', it.name_en || '',
            it.qty || 0, it.unit || 'PCS',
            it.unit_value_usd || 0,
            it.total_value_usd != null ? it.total_value_usd : Number(it.qty || 0) * Number(it.unit_value_usd || 0),
            it.country_of_origin || 'VIETNAM',
          ]
        );
        results.push(rows[0]);
      }
    }
    await client.query('COMMIT');
    res.json({ ok: true, items: results });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

module.exports = router;
