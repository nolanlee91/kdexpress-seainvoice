const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') || process.env.DATABASE_URL?.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function initDB() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      code VARCHAR(64) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      password TEXT,
      role VARCHAR(32) NOT NULL DEFAULT 'staff',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      address TEXT,
      receiver_block TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sea_shipments (
      id SERIAL PRIMARY KEY,
      code VARCHAR(64) UNIQUE NOT NULL,
      invoice_date DATE,
      sender_block TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'draft',
      created_by INT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sea_shipment_customers (
      id SERIAL PRIMARY KEY,
      sea_shipment_id INT NOT NULL REFERENCES sea_shipments(id) ON DELETE CASCADE,
      customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      display_order INT NOT NULL DEFAULT 0,
      currency VARCHAR(8) NOT NULL DEFAULT 'VND',
      exchange_rate_vnd_per_usd NUMERIC(14,4),
      raw_data_saved_at TIMESTAMPTZ,
      ci_generated_at TIMESTAMPTZ,
      UNIQUE (sea_shipment_id, customer_id)
    );
  `);
  // Migration: add new cols if table existed pre-refactor
  await query(`ALTER TABLE sea_shipment_customers ADD COLUMN IF NOT EXISTS currency VARCHAR(8) NOT NULL DEFAULT 'VND';`);
  await query(`ALTER TABLE sea_shipment_customers ADD COLUMN IF NOT EXISTS exchange_rate_vnd_per_usd NUMERIC(14,4);`);
  await query(`ALTER TABLE sea_shipment_customers ADD COLUMN IF NOT EXISTS raw_data_saved_at TIMESTAMPTZ;`);
  await query(`ALTER TABLE sea_shipment_customers ADD COLUMN IF NOT EXISTS ci_generated_at TIMESTAMPTZ;`);

  // Cargos removed in refactor 2026-05-21 (user dropped per-package tracking)
  await query(`DROP TABLE IF EXISTS cargos;`);

  await query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      sea_shipment_id INT NOT NULL REFERENCES sea_shipments(id) ON DELETE CASCADE,
      customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      raw_json JSONB,
      status VARCHAR(32) NOT NULL DEFAULT 'scanned',
      error_msg TEXT,
      scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Data gốc (editable canonical raw data — manager saves after reviewing AI scan)
  await query(`
    CREATE TABLE IF NOT EXISTS raw_data_items (
      id SERIAL PRIMARY KEY,
      sea_shipment_id INT NOT NULL REFERENCES sea_shipments(id) ON DELETE CASCADE,
      customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      source_invoice_id INT REFERENCES invoices(id) ON DELETE SET NULL,
      line_no INT NOT NULL DEFAULT 0,
      name_vn TEXT,
      name_en TEXT,
      qty NUMERIC(14,3),
      unit VARCHAR(32),
      unit_value NUMERIC(18,4),
      total_value NUMERIC(18,2),
      country_of_origin VARCHAR(64) DEFAULT 'VIETNAM',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Commercial Invoice items (USD, manager promotes from raw_data_items)
  await query(`
    CREATE TABLE IF NOT EXISTS commercial_invoice_items (
      id SERIAL PRIMARY KEY,
      sea_shipment_id INT NOT NULL REFERENCES sea_shipments(id) ON DELETE CASCADE,
      customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      source_invoice_id INT REFERENCES invoices(id) ON DELETE SET NULL,
      line_no INT NOT NULL DEFAULT 0,
      name_vn TEXT,
      name_en TEXT,
      qty NUMERIC(14,3),
      unit VARCHAR(32),
      unit_value_usd NUMERIC(14,4),
      total_value_usd NUMERIC(14,2),
      country_of_origin VARCHAR(64) DEFAULT 'VIETNAM',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_raw_items_ship_customer ON raw_data_items(sea_shipment_id, customer_id, line_no);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_invoices_ship_customer ON invoices(sea_shipment_id, customer_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ci_items_ship_customer ON commercial_invoice_items(sea_shipment_id, customer_id, line_no);`);

  const { rows } = await query(`SELECT id FROM users WHERE code = $1`, ['admin']);
  if (rows.length === 0) {
    await query(
      `INSERT INTO users (code, name, password, role) VALUES ($1, $2, $3, $4)`,
      ['admin', 'Administrator', 'admin', 'admin']
    );
    console.log('[initDB] Default admin user created: admin / admin');
  }
}

module.exports = { pool, query, initDB };
