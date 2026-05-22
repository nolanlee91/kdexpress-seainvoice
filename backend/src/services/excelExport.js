const ExcelJS = require('exceljs');
const { query } = require('../db');

const FORBIDDEN_SHEET_CHARS = /[\\\/\?\*\[\]:]/g;
function safeSheetName(name, takenNames) {
  let n = (name || 'Sheet').replace(FORBIDDEN_SHEET_CHARS, '-').trim().slice(0, 31) || 'Sheet';
  let i = 2;
  const base = n;
  while (takenNames.has(n)) {
    const suffix = ` (${i})`;
    n = base.slice(0, 31 - suffix.length) + suffix;
    i++;
  }
  takenNames.add(n);
  return n;
}

async function buildWorkbook(seaShipmentId) {
  const { rows: shipRows } = await query(
    `SELECT id, code, invoice_date, sender_block, status FROM sea_shipments WHERE id = $1`,
    [seaShipmentId]
  );
  if (shipRows.length === 0) throw new Error('sea_shipment_not_found');
  const ship = shipRows[0];

  const { rows: customerRows } = await query(
    `SELECT c.id, c.name, c.address, c.receiver_block, ssc.display_order
       FROM customers c
       JOIN sea_shipment_customers ssc ON ssc.customer_id = c.id
      WHERE ssc.sea_shipment_id = $1
   ORDER BY ssc.display_order ASC, c.name ASC`,
    [seaShipmentId]
  );

  const { rows: itemRows } = await query(
    `SELECT * FROM commercial_invoice_items WHERE sea_shipment_id = $1
      ORDER BY customer_id ASC, line_no ASC, id ASC`,
    [seaShipmentId]
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = 'App Hàng Biển';
  wb.created = new Date();

  const takenNames = new Set();
  if (customerRows.length === 0) {
    const ws = wb.addWorksheet(safeSheetName(ship.code || 'EMPTY', takenNames));
    ws.addRow(['Chuyến này chưa có khách hoặc chưa có Commercial Invoice nào.']);
  }

  for (const customer of customerRows) {
    const items = itemRows.filter((it) => it.customer_id === customer.id);
    const sheetName = safeSheetName(customer.name, takenNames);
    buildCommercialInvoiceSheet(wb.addWorksheet(sheetName), ship, customer, items);
  }

  return wb;
}

function buildCommercialInvoiceSheet(ws, ship, customer, items) {
  ws.columns = [
    { width: 36 }, // A: name_vn
    { width: 36 }, // B: name_en
    { width: 8 },  // C: qty
    { width: 12 }, // D: unit
    { width: 14 }, // E: unit value
    { width: 14 }, // F: total value
    { width: 12 }, // G: country
    { width: 22 }, // H: material
    { width: 16 }, // I: HS Canada
    { width: 14 }, // J: HS Vietnam
  ];

  const r1 = ws.addRow(['COMMERCIAL INVOICE']);
  r1.font = { bold: true, size: 16 };
  r1.alignment = { horizontal: 'center' };
  ws.mergeCells('A1:J1');
  r1.height = 28;

  const senderText = ship.sender_block || 'GEMADEPT LOGISTICS ONE MEMBER CO., LTD';
  const invoiceDateText = ship.invoice_date
    ? `Invoice Date: ${formatDate(ship.invoice_date)}`
    : 'Invoice Date:';
  const invoiceMeta = [
    `Sender:\n${senderText}`,
    '', '', '', '',
    `${invoiceDateText}\nReason for Export: Sale\nType of Export: Permanent\nTerms of Trade: ExWork`,
  ];
  const r2 = ws.addRow(invoiceMeta);
  ws.mergeCells('A2:E2');
  ws.mergeCells('F2:J2');
  r2.alignment = { wrapText: true, vertical: 'top' };
  r2.height = 80;
  r2.getCell(1).border = thinBorderAll();
  r2.getCell(6).border = thinBorderAll();

  const receiverText = customer.receiver_block || `${customer.name}${customer.address ? '\n' + customer.address : ''}`;
  const r3 = ws.addRow([
    `Receiver:\n${receiverText}`,
    '', '', '', '',
    'Duty/taxes acct: Receiver Will Pay\nRequiere Pedimento: No\nDuty/tax billing service: Receiver will pay\nCarrier:',
  ]);
  ws.mergeCells('A3:E3');
  ws.mergeCells('F3:J3');
  r3.alignment = { wrapText: true, vertical: 'top' };
  r3.height = 80;
  r3.getCell(1).border = thinBorderAll();
  r3.getCell(6).border = thinBorderAll();

  const r4 = ws.addRow([
    'Full Description of Goods',
    '',
    "Q'ty",
    'Unit of Measure',
    'Unit Value (USD)',
    'Total Value (USD)',
    'Country of Origin',
    'Material',
    'HS Code (Canada)',
    'HS Code (Vietnam)',
  ]);
  ws.mergeCells('A4:B4');
  r4.font = { bold: true };
  r4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEEBF7' } };
  r4.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  r4.height = 32;
  r4.eachCell((c) => (c.border = thinBorderAll()));

  const dataStart = 5;
  let totalQty = 0;
  items.forEach((it, idx) => {
    const rowNum = dataStart + idx;
    const r = ws.addRow([
      it.name_vn || '',
      it.name_en || '',
      Number(it.qty || 0),
      it.unit || 'PCS',
      Number(it.unit_value_usd || 0),
      { formula: `C${rowNum}*E${rowNum}` },
      it.country_of_origin || 'VIETNAM',
      it.material || '',
      it.hs_code_ca || '',
      it.hs_code_vn || '',
    ]);
    r.alignment = { wrapText: true, vertical: 'top' };
    r.getCell(3).numFmt = 'General';
    r.getCell(5).numFmt = '#,##0.0000';
    r.getCell(6).numFmt = '#,##0.00';
    r.eachCell((c) => (c.border = thinBorderAll()));
    totalQty += Number(it.qty || 0);
  });

  const dataEnd = dataStart + items.length - 1;
  if (items.length > 0) {
    const totalRow = ws.addRow([
      'TOTAL', '',
      { formula: `SUM(C${dataStart}:C${dataEnd})` },
      '', '',
      { formula: `SUM(F${dataStart}:F${dataEnd})` },
      '', '', '', '',
    ]);
    ws.mergeCells(`A${totalRow.number}:B${totalRow.number}`);
    totalRow.font = { bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
    totalRow.getCell(3).numFmt = 'General';
    totalRow.getCell(6).numFmt = '#,##0.00';
    totalRow.eachCell((c) => (c.border = thinBorderAll()));
  }

  const certifyDate = ship.invoice_date ? formatDate(ship.invoice_date).toUpperCase() : '';
  const certifyRow = ws.addRow([
    `I/We hereby certify that the information contained in the invoice is true and correct and that the contents of this shipment are as stated above.\nName: Signature: Position: Shipping Agent\nDate of signature: ${certifyDate}`,
  ]);
  ws.mergeCells(`A${certifyRow.number}:J${certifyRow.number}`);
  certifyRow.alignment = { wrapText: true, vertical: 'top' };
  certifyRow.height = 60;
  certifyRow.getCell(1).border = thinBorderAll();
}

function thinBorderAll() {
  return {
    top: { style: 'thin' }, left: { style: 'thin' },
    bottom: { style: 'thin' }, right: { style: 'thin' },
  };
}

function formatDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const day = String(dt.getDate()).padStart(2, '0');
  const months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  return `${day} - ${months[dt.getMonth()]} - ${dt.getFullYear()}`;
}

module.exports = { buildWorkbook };
