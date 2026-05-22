const express = require('express');
const { query, pool } = require('../db');
const { authRequired } = require('../middleware/auth');
const { translateNames } = require('../services/gemini');
const { translateUnit } = require('../utils/units');

const router = express.Router();
router.use(authRequired);

router.get('/sea-shipments/:id/raw-data-items', async (req, res) => {
  const params = [req.params.id];
  let sql = `SELECT * FROM raw_data_items WHERE sea_shipment_id = $1`;
  if (req.query.customer_id) {
    params.push(req.query.customer_id);
    sql += ` AND customer_id = $${params.length}`;
  }
  sql += ` ORDER BY customer_id, line_no ASC, id ASC`;
  const { rows } = await query(sql, params);
  res.json(rows);
});

// Bulk save: dùng cho Save button của tab "Data gốc"
router.post('/raw-data-items/bulk', async (req, res) => {
  const { sea_shipment_id, customer_id, upserts = [], delete_ids = [] } = req.body || {};
  if (!sea_shipment_id || !customer_id) {
    return res.status(400).json({ error: 'sea_shipment_id_and_customer_id_required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (delete_ids.length > 0) {
      await client.query(
        `DELETE FROM raw_data_items
          WHERE id = ANY($1::int[]) AND sea_shipment_id = $2 AND customer_id = $3`,
        [delete_ids, sea_shipment_id, customer_id]
      );
    }
    const results = [];
    for (const it of upserts) {
      if (it.id) {
        const { rows } = await client.query(
          `UPDATE raw_data_items SET
              line_no = $1, name_vn = $2, name_en = $3, qty = $4, unit = $5,
              unit_value = $6, total_value = $7, country_of_origin = $8,
              updated_at = NOW()
            WHERE id = $9 AND sea_shipment_id = $10 AND customer_id = $11
          RETURNING *`,
          [
            it.line_no || 0, it.name_vn || '', it.name_en || '',
            it.qty || 0, it.unit || 'PCS',
            it.unit_value || 0,
            it.total_value != null ? it.total_value : Number(it.qty || 0) * Number(it.unit_value || 0),
            it.country_of_origin || 'VIETNAM',
            it.id, sea_shipment_id, customer_id,
          ]
        );
        if (rows[0]) results.push(rows[0]);
      } else {
        const { rows } = await client.query(
          `INSERT INTO raw_data_items
            (sea_shipment_id, customer_id, source_invoice_id, line_no,
             name_vn, name_en, qty, unit, unit_value, total_value, country_of_origin)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [
            sea_shipment_id, customer_id, it.source_invoice_id || null, it.line_no || 0,
            it.name_vn || '', it.name_en || '',
            it.qty || 0, it.unit || 'PCS',
            it.unit_value || 0,
            it.total_value != null ? it.total_value : Number(it.qty || 0) * Number(it.unit_value || 0),
            it.country_of_origin || 'VIETNAM',
          ]
        );
        results.push(rows[0]);
      }
    }
    // Mark raw_data_saved_at on link table
    await client.query(
      `UPDATE sea_shipment_customers SET raw_data_saved_at = NOW()
        WHERE sea_shipment_id = $1 AND customer_id = $2`,
      [sea_shipment_id, customer_id]
    );
    await client.query('COMMIT');
    res.json({ ok: true, items: results });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

router.delete('/raw-data-items/:id', async (req, res) => {
  await query(`DELETE FROM raw_data_items WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

// Translate VN → EN for items missing name_en.
// Body: { items: [{id, name_vn}, ...] } - FE gửi danh sách cần dịch
// Trả: { translations: [{id, name_en}, ...] }  (FE update state, manager review rồi mới Save)
router.post('/raw-data-items/translate', async (req, res) => {
  const items = (req.body && req.body.items) || [];
  if (items.length === 0) return res.json({ translations: [] });
  try {
    const translations = await translateNames(items);
    res.json({ translations });
  } catch (e) {
    console.error('[translate] gemini error:', e.message);
    res.status(502).json({ error: 'translate_failed', message: e.message });
  }
});

// Update exchange rate / currency on sea_shipment_customers
router.put('/sea-shipments/:id/customers/:customerId/settings', async (req, res) => {
  const { currency, exchange_rate_vnd_per_usd } = req.body || {};
  const fields = [];
  const vals = [];
  let i = 1;
  if (currency !== undefined) { fields.push(`currency = $${i++}`); vals.push(currency); }
  if (exchange_rate_vnd_per_usd !== undefined) {
    fields.push(`exchange_rate_vnd_per_usd = $${i++}`);
    vals.push(exchange_rate_vnd_per_usd === '' || exchange_rate_vnd_per_usd === null ? null : Number(exchange_rate_vnd_per_usd));
  }
  if (fields.length === 0) return res.status(400).json({ error: 'no_fields' });
  vals.push(req.params.id, req.params.customerId);
  const { rows } = await query(
    `UPDATE sea_shipment_customers SET ${fields.join(', ')}
      WHERE sea_shipment_id = $${i++} AND customer_id = $${i}
      RETURNING *`,
    vals
  );
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

// Promote: clone raw_data_items → commercial_invoice_items with currency conversion
router.post('/sea-shipments/:id/customers/:customerId/promote-to-ci', async (req, res) => {
  const { mode = 'replace' } = req.body || {}; // 'replace' | 'append'

  const { rows: linkRows } = await query(
    `SELECT * FROM sea_shipment_customers
      WHERE sea_shipment_id = $1 AND customer_id = $2`,
    [req.params.id, req.params.customerId]
  );
  if (linkRows.length === 0) return res.status(404).json({ error: 'customer_not_in_shipment' });
  const link = linkRows[0];
  const currency = link.currency || 'VND';
  const rate = Number(link.exchange_rate_vnd_per_usd || 0);

  if (currency === 'VND' && (!rate || rate <= 0)) {
    return res.status(400).json({ error: 'exchange_rate_required', message: 'Cần điền tỷ giá VND/USD ở tab Data gốc trước khi tạo Commercial Invoice.' });
  }

  const { rows: rawItems } = await query(
    `SELECT * FROM raw_data_items
      WHERE sea_shipment_id = $1 AND customer_id = $2
   ORDER BY line_no ASC, id ASC`,
    [req.params.id, req.params.customerId]
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (mode === 'replace') {
      await client.query(
        `DELETE FROM commercial_invoice_items
          WHERE sea_shipment_id = $1 AND customer_id = $2`,
        [req.params.id, req.params.customerId]
      );
    }
    const { rows: maxRow } = await client.query(
      `SELECT COALESCE(MAX(line_no), 0) AS max_line FROM commercial_invoice_items
        WHERE sea_shipment_id = $1 AND customer_id = $2`,
      [req.params.id, req.params.customerId]
    );
    let lineNo = Number(maxRow[0].max_line) || 0;

    const inserted = [];
    for (const raw of rawItems) {
      lineNo++;
      const unitUsd = currency === 'USD'
        ? Number(raw.unit_value || 0)
        : Math.round((Number(raw.unit_value || 0) / rate) * 10000) / 10000;
      const totalUsd = currency === 'USD'
        ? Number(raw.total_value || 0)
        : Math.round((Number(raw.total_value || 0) / rate) * 100) / 100;

      const { rows } = await client.query(
        `INSERT INTO commercial_invoice_items
          (sea_shipment_id, customer_id, source_invoice_id, line_no,
           name_vn, name_en, qty, unit, unit_value_usd, total_value_usd, country_of_origin)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          req.params.id, req.params.customerId, raw.source_invoice_id || null, lineNo,
          raw.name_vn || '', raw.name_en || '',
          raw.qty || 0, translateUnit(raw.unit || 'PCS'),
          unitUsd, totalUsd,
          raw.country_of_origin || 'VIETNAM',
        ]
      );
      inserted.push(rows[0]);
    }
    await client.query(
      `UPDATE sea_shipment_customers SET ci_generated_at = NOW()
        WHERE sea_shipment_id = $1 AND customer_id = $2`,
      [req.params.id, req.params.customerId]
    );
    await client.query('COMMIT');
    res.json({ ok: true, items: inserted, rate, currency });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

module.exports = router;
