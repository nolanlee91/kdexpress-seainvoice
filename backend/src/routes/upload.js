const express = require('express');
const { authRequired } = require('../middleware/auth');
const { createUploadUrl } = require('../services/r2');

const router = express.Router();
router.use(authRequired);

router.post('/sign-r2', async (req, res) => {
  try {
    const folder = (req.body && req.body.folder) || 'haibien/invoices';
    const contentType = (req.body && req.body.contentType) || 'image/jpeg';
    const result = await createUploadUrl({ folder, contentType });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
