const express = require('express');
const { query, pool } = require('../db');
const { authRequired } = require('../middleware/auth');
const { scanInvoice } = require('../services/gemini');

const router = express.Router();
router.use(authRequired);

router.post('/sea-shipments/:id/invoices/scan', async (req, res) => {
  const { customer_id, image_url } = req.body || {};
  if (!customer_id || !image_url) return res.status(400).json({ error: 'customer_id_and_image_url_required' });

  let raw;
  try {
    raw = await scanInvoice(image_url);
  } catch (e) {
    console.error('[scan] gemini error:', e.message);
    const { rows: failed } = await query(
      `INSERT INTO invoices (sea_shipment_id, customer_id, image_url, raw_json, status, error_msg)
       VALUES ($1, $2, $3, $4, 'failed', $5) RETURNING *`,
      [req.params.id, customer_id, image_url, null, e.message.slice(0, 500)]
    );
    return res.status(502).json({ error: 'scan_failed', message: e.message, invoice: failed[0] });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: invRows } = await client.query(
      `INSERT INTO invoices (sea_shipment_id, customer_id, image_url, raw_json, status)
       VALUES ($1, $2, $3, $4, 'scanned') RETURNING *`,
      [req.params.id, customer_id, image_url, raw]
    );
    const invoice = invRows[0];

    const { rows: maxRow } = await client.query(
      `SELECT COALESCE(MAX(line_no), 0) AS max_line FROM raw_data_items
        WHERE sea_shipment_id = $1 AND customer_id = $2`,
      [req.params.id, customer_id]
    );
    let lineNo = Number(maxRow[0].max_line) || 0;

    const insertedItems = [];
    for (const it of raw.items || []) {
      lineNo++;
      const { rows } = await client.query(
        `INSERT INTO raw_data_items
          (sea_shipment_id, customer_id, source_invoice_id, line_no,
           name_vn, name_en, qty, unit, unit_value, total_value, country_of_origin)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          req.params.id, customer_id, invoice.id, lineNo,
          it.name_vn || '', it.name_en || '',
          it.qty || 0, it.unit || 'PCS',
          it.unit_value || 0, it.total_value || 0,
          it.country_of_origin || 'VIETNAM',
        ]
      );
      insertedItems.push(rows[0]);
    }
    await client.query('COMMIT');
    res.status(201).json({ invoice, items: insertedItems });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

router.get('/sea-shipments/:id/invoices', async (req, res) => {
  const params = [req.params.id];
  let sql = `SELECT * FROM invoices WHERE sea_shipment_id = $1`;
  if (req.query.customer_id) {
    params.push(req.query.customer_id);
    sql += ` AND customer_id = $${params.length}`;
  }
  sql += ` ORDER BY scanned_at DESC, id DESC`;
  const { rows } = await query(sql, params);
  res.json(rows);
});

router.get('/invoices/:id', async (req, res) => {
  const { rows } = await query(`SELECT * FROM invoices WHERE id = $1`, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

router.delete('/invoices/:id', async (req, res) => {
  await query(`DELETE FROM raw_data_items WHERE source_invoice_id = $1`, [req.params.id]);
  await query(`DELETE FROM invoices WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

router.post('/invoices/:id/restore', async (req, res) => {
  const { rows } = await query(`SELECT * FROM invoices WHERE id = $1`, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  const invoice = rows[0];
  if (!invoice.raw_json || !Array.isArray(invoice.raw_json.items)) {
    return res.status(400).json({ error: 'no_raw_data' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM raw_data_items WHERE source_invoice_id = $1`, [invoice.id]);
    const { rows: maxRow } = await client.query(
      `SELECT COALESCE(MAX(line_no), 0) AS max_line FROM raw_data_items
        WHERE sea_shipment_id = $1 AND customer_id = $2`,
      [invoice.sea_shipment_id, invoice.customer_id]
    );
    let lineNo = Number(maxRow[0].max_line) || 0;
    const inserted = [];
    for (const it of invoice.raw_json.items) {
      lineNo++;
      const { rows: ins } = await client.query(
        `INSERT INTO raw_data_items
          (sea_shipment_id, customer_id, source_invoice_id, line_no,
           name_vn, name_en, qty, unit, unit_value, total_value, country_of_origin)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          invoice.sea_shipment_id, invoice.customer_id, invoice.id, lineNo,
          it.name_vn || '', it.name_en || '',
          it.qty || 0, it.unit || 'PCS',
          it.unit_value || 0, it.total_value || 0,
          it.country_of_origin || 'VIETNAM',
        ]
      );
      inserted.push(ins[0]);
    }
    await client.query('COMMIT');
    res.json({ ok: true, items: inserted });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

module.exports = router;
