const express = require('express');
const { authRequired } = require('../middleware/auth');
const { buildWorkbook } = require('../services/excelExport');
const { query } = require('../db');

const router = express.Router();
router.use(authRequired);

router.get('/sea-shipments/:id/export.xlsx', async (req, res) => {
  const wb = await buildWorkbook(req.params.id);
  const { rows } = await query(`SELECT code FROM sea_shipments WHERE id = $1`, [req.params.id]);
  const code = rows[0]?.code || `sea-${req.params.id}`;
  const safeFile = code.replace(/[\\\/\?\*\[\]:]/g, '-');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFile)}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

module.exports = router;
