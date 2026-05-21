require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./db');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const customersRoutes = require('./routes/customers');
const seaShipmentsRoutes = require('./routes/seaShipments');
const invoicesRoutes = require('./routes/invoices');
const rawDataItemsRoutes = require('./routes/rawDataItems');
const commercialInvoiceItemsRoutes = require('./routes/commercialInvoiceItems');
const uploadRoutes = require('./routes/upload');
const exportRoutes = require('./routes/export');

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/sea-shipments', seaShipmentsRoutes);
app.use('/api', invoicesRoutes);
app.use('/api', rawDataItemsRoutes);
app.use('/api', commercialInvoiceItemsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', exportRoutes);

app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'server_error', message: err.message });
});

const PORT = process.env.PORT || 4000;

initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`[haibien-backend] listening on :${PORT}`));
  })
  .catch((e) => {
    console.error('[fatal] initDB failed:', e);
    process.exit(1);
  });
