import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import ImageUpload from '../components/ImageUpload.jsx';
import ImageDrawer from '../components/ImageDrawer.jsx';

export default function SeaShipmentDetail() {
  const { id } = useParams();
  const [ship, setShip] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [activeCustomerId, setActiveCustomerId] = useState(null);
  const [tab, setTab] = useState('scan');
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [pickCustomer, setPickCustomer] = useState('');

  async function loadShip() {
    const s = await api.getShipment(id);
    setShip(s);
    setCustomers(s.customers || []);
    if (!activeCustomerId && s.customers?.length > 0) setActiveCustomerId(s.customers[0].id);
  }
  async function loadAllCustomers() {
    setAllCustomers(await api.listCustomers());
  }
  useEffect(() => { loadShip(); loadAllCustomers(); }, [id]);

  async function addCustomerToShipment() {
    if (!pickCustomer) return;
    await api.addShipmentCustomer(id, Number(pickCustomer));
    setPickCustomer(''); setAddingCustomer(false);
    await loadShip();
  }
  async function removeCustomer(cid) {
    if (!confirm('Xoá khách này khỏi chuyến? Toàn bộ hóa đơn + data sửa + CI của khách sẽ mất.')) return;
    await api.removeShipmentCustomer(id, cid);
    if (activeCustomerId === cid) setActiveCustomerId(null);
    await loadShip();
  }

  function downloadExcel() {
    const token = localStorage.getItem('haibien_token');
    fetch(api.exportUrl(id), { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (!r.ok) throw new Error('Export failed: ' + r.status);
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (ship?.code || `sea-${id}`) + '.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((e) => alert(e.message));
  }

  if (!ship) return <div className="muted">Đang tải…</div>;

  const activeCustomer = customers.find((c) => c.id === activeCustomerId);
  const availableCustomers = allCustomers.filter(
    (c) => !customers.some((x) => x.id === c.id)
  );

  return (
    <div className="col" style={{ gap: 20 }}>
      <header>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p className="page-eyebrow">
              <Link to="/shipments" style={{ color: 'var(--text-muted)' }}>← Chuyến hàng biển</Link>
            </p>
            <h1 className="page-title mono">{ship.code}</h1>
            <p className="page-subtitle">
              {ship.invoice_date ? `Ngày invoice: ${new Date(ship.invoice_date).toLocaleDateString('vi-VN')}` : 'Chưa đặt ngày invoice'}
              {' · '}
              <span className={'badge ' + (ship.status === 'finalized' ? 'badge-success' : 'badge-slate')}>
                {(ship.status || 'draft').toUpperCase()}
              </span>
            </p>
          </div>
          <button className="primary" onClick={downloadExcel}>📥 Xuất Excel</button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
        {/* Sidebar: Customers in shipment */}
        <div className="card col" style={{ padding: 16, gap: 8 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
            <strong style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
              Khách trong chuyến
            </strong>
            <button className="ghost" style={{ padding: '0 8px', height: 24, fontSize: 12 }} onClick={() => setAddingCustomer(true)}>+ Thêm</button>
          </div>
          {customers.length === 0 && <div className="muted">Chưa có khách nào.</div>}
          {customers.map((c) => (
            <div key={c.id} style={{
              padding: '10px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
              background: activeCustomerId === c.id ? 'var(--accent-bg)' : 'transparent',
              border: '1px solid ' + (activeCustomerId === c.id ? 'var(--accent-strong)' : 'transparent'),
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              transition: 'background var(--transition-fast)',
            }} onClick={() => setActiveCustomerId(c.id)}>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: activeCustomerId === c.id ? 600 : 500, color: 'var(--text-primary)' }}>{c.name}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                  {c.invoice_count} ảnh · {c.raw_item_count} sửa · {c.ci_item_count} CI
                </div>
                <div className="row" style={{ gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                  {c.raw_data_saved_at && <span className="badge badge-success">✓ DATA</span>}
                  {c.ci_generated_at && <span className="badge badge-info">✓ CI</span>}
                </div>
              </div>
              <button className="ghost danger" style={{ padding: '0 6px', height: 22, fontSize: 14, boxShadow: 'none' }}
                onClick={(e) => { e.stopPropagation(); removeCustomer(c.id); }}>×</button>
            </div>
          ))}
          {addingCustomer && (
            <div className="col" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 6 }}>
              <select value={pickCustomer} onChange={(e) => setPickCustomer(e.target.value)}>
                <option value="">— Chọn khách —</option>
                {availableCustomers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                <button onClick={() => setAddingCustomer(false)}>Huỷ</button>
                <button className="primary" disabled={!pickCustomer} onClick={addCustomerToShipment}>Thêm</button>
              </div>
              {availableCustomers.length === 0 && (
                <div className="muted">Đã thêm hết khách. <Link to="/customers">Tạo khách mới</Link></div>
              )}
            </div>
          )}
        </div>

        {/* Main panel */}
        <div className="col">
          {!activeCustomer ? (
            <div className="card muted">Chọn khách bên trái để xem chi tiết.</div>
          ) : (
            <>
              <div className="tabs">
                <button className={`tab ${tab==='scan'?'active':''}`} onClick={() => setTab('scan')}>
                  Bước 1 · Hóa đơn AI
                </button>
                <button className={`tab ${tab==='raw'?'active':''}`} onClick={() => setTab('raw')}>
                  Bước 2 · Data gốc
                </button>
                <button className={`tab ${tab==='edit'?'active':''}`} onClick={() => setTab('edit')}>
                  Bước 3 · Data sửa
                </button>
                <button className={`tab ${tab==='ci'?'active':''}`} onClick={() => setTab('ci')}>
                  Bước 4 · Commercial Invoice
                </button>
              </div>
              {tab === 'scan' && <ScanTab shipmentId={id} customer={activeCustomer} onReload={loadShip} />}
              {tab === 'raw' && <RawSnapshotTab shipmentId={id} customer={activeCustomer} onReload={loadShip} />}
              {tab === 'edit' && <EditedDataTab shipmentId={id} customer={activeCustomer} onReload={loadShip} />}
              {tab === 'ci' && <CommercialInvoiceTab shipmentId={id} customer={activeCustomer} onReload={loadShip} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Bước 1 · Hóa đơn AI ───────────────────────── */

function ScanTab({ shipmentId, customer, onReload }) {
  const [invoices, setInvoices] = useState([]);
  const [scanProgress, setScanProgress] = useState(null); // {current, total, fileName}
  const [scanErrors, setScanErrors] = useState([]); // [{fileName, message}]
  const [drawerUrl, setDrawerUrl] = useState(null);

  async function load() {
    setInvoices(await api.listInvoices(shipmentId, customer.id));
  }
  useEffect(() => { load(); }, [shipmentId, customer.id]);

  async function onUploaded(url, meta = {}) {
    const { index = 0, total = 1, fileName = '' } = meta;
    setScanProgress({ current: index + 1, total, fileName });
    try {
      await api.scanInvoice(shipmentId, customer.id, url);
    } catch (e) {
      setScanErrors((errs) => [...errs, { fileName, message: e.data?.message || e.message }]);
    }
    if (index === total - 1) {
      await load(); onReload();
      setTimeout(() => setScanProgress(null), 1500); // briefly hold final state
    }
  }
  function resetErrors() { setScanErrors([]); }

  async function remove(invId) {
    if (!confirm('Xoá ảnh hóa đơn này? Items đã clone sang Data sửa cũng sẽ mất.')) return;
    await api.deleteInvoice(invId);
    load(); onReload();
  }

  return (
    <div className="col">
      <div className="card col">
        <strong>Bước 1 — Upload ảnh hóa đơn để AI scan</strong>
        <div className="muted">
          AI đọc hóa đơn, lưu output bất biến vào <strong>Data gốc</strong> (bước 2) + auto-clone sang <strong>Data sửa</strong> (bước 3) cho manager review.
          Có VN thì điền tên VN, có EN thì điền tên EN — AI KHÔNG tự dịch. Chọn nhiều ảnh cùng lúc bằng Ctrl/Shift.
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <ImageUpload onUploaded={onUploaded} multiple label="Upload ảnh hóa đơn" />
          {scanProgress && (
            <div className="muted">
              Đang scan AI <strong>{scanProgress.current}/{scanProgress.total}</strong>
              {scanProgress.fileName && ` · ${scanProgress.fileName}`} …
            </div>
          )}
        </div>
        {scanErrors.length > 0 && (
          <div className="error" style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>Lỗi scan ({scanErrors.length}):</strong>
              <button className="ghost" onClick={resetErrors}>Đóng</button>
            </div>
            {scanErrors.map((e, i) => <div key={i}>• {e.fileName}: {e.message}</div>)}
          </div>
        )}
      </div>

      <h4 style={{ margin: 0 }}>Lịch sử ảnh ({invoices.length})</h4>
      {invoices.length === 0 && <div className="muted">Chưa có ảnh nào.</div>}
      <div className="col">
        {invoices.map((inv) => (
          <div key={inv.id} className="card row" style={{ justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 12 }}>
              <img src={inv.image_url} alt="" onClick={() => setDrawerUrl(inv.image_url)}
                style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }} />
              <div>
                <button className="ghost" onClick={() => setDrawerUrl(inv.image_url)} style={{ padding: 0, height: 'auto', boxShadow: 'none' }}>
                  📷 Xem ảnh
                </button>
                <div className="muted" style={{ fontSize: 12 }}>
                  {new Date(inv.scanned_at).toLocaleString('vi-VN')} · {inv.status}
                  {inv.raw_json?.currency_detected && ` · ${inv.raw_json.currency_detected}`}
                  {inv.raw_json?.items && ` · ${inv.raw_json.items.length} items`}
                </div>
                {inv.status === 'failed' && <div className="error" style={{ fontSize: 12 }}>{inv.error_msg}</div>}
              </div>
            </div>
            <button className="danger" onClick={() => remove(inv.id)}>Xoá</button>
          </div>
        ))}
      </div>
      <ImageDrawer url={drawerUrl} title={`Ảnh hóa đơn — ${customer.name}`} onClose={() => setDrawerUrl(null)} />
    </div>
  );
}

/* ───────────────────────── Bước 2 · Data gốc (read-only) ───────────────────────── */

function RawSnapshotTab({ shipmentId, customer, onReload }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resyncing, setResyncing] = useState(null); // invoice id đang re-sync
  const [drawerUrl, setDrawerUrl] = useState(null);

  async function load() {
    setInvoices(await api.listInvoices(shipmentId, customer.id));
  }
  useEffect(() => { load(); }, [shipmentId, customer.id]);

  async function resync(invId) {
    if (!confirm('Đồng bộ Data sửa = Data gốc của ảnh này? Items đã sửa của ảnh này trong bước 3 sẽ bị ghi đè.')) return;
    setResyncing(invId);
    try {
      await api.restoreInvoice(invId);
      await load(); onReload();
      alert('Đã đồng bộ Data sửa từ Data gốc. Mở tab "Bước 3 · Data sửa" để xem.');
    } catch (e) {
      alert('Lỗi: ' + (e.data?.message || e.message));
    } finally {
      setResyncing(null);
    }
  }

  const totalItems = invoices.reduce((s, inv) => s + (inv.raw_json?.items?.length || 0), 0);

  return (
    <div className="col">
      <div className="card col">
        <strong>Bước 2 — Data gốc (read-only, từ AI scan)</strong>
        <div className="muted">
          Đây là snapshot <strong>bất biến</strong> output của AI khi scan ảnh. KHÔNG sửa được ở đây.
          Muốn sửa thì mở tab <strong>Bước 3 · Data sửa</strong>. Có thể đồng bộ ngược (Data sửa ← Data gốc) qua nút "↻ Reset Data sửa" của từng ảnh.
        </div>
        <div className="muted">
          Tổng cộng <strong>{invoices.length} ảnh · {totalItems} dòng items</strong> trong Data gốc.
        </div>
      </div>

      {invoices.length === 0 && (
        <div className="card muted">Chưa có ảnh nào. Quay lại <strong>Bước 1</strong> upload hóa đơn.</div>
      )}

      {invoices.filter((i) => i.status === 'scanned' && i.raw_json?.items).map((inv) => (
        <div key={inv.id} className="card col">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 12 }}>
              <img src={inv.image_url} alt="" onClick={() => setDrawerUrl(inv.image_url)}
                style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }} />
              <div>
                <div style={{ fontWeight: 500 }}>
                  Ảnh #{inv.id}
                  {inv.raw_json?.currency_detected && (
                    <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                      Tiền tệ: {inv.raw_json.currency_detected}
                    </span>
                  )}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {new Date(inv.scanned_at).toLocaleString('vi-VN')} · {inv.raw_json.items.length} dòng
                </div>
              </div>
            </div>
            <button onClick={() => resync(inv.id)} disabled={resyncing === inv.id}
              title="Ghi đè items trong Data sửa của ảnh này bằng Data gốc">
              {resyncing === inv.id ? 'Đang đồng bộ…' : '↻ Reset Data sửa từ ảnh này'}
            </button>
          </div>
          <div style={{ overflow: 'auto', maxHeight: 400, border: '1px solid #1a2138', borderRadius: 6 }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Tên VN</th>
                  <th>Tên EN</th>
                  <th style={{ width: 60 }}>SL</th>
                  <th style={{ width: 60 }}>ĐV</th>
                  <th style={{ width: 110 }}>Đơn giá</th>
                  <th style={{ width: 110 }}>Tổng</th>
                  <th style={{ width: 80 }}>Country</th>
                </tr>
              </thead>
              <tbody>
                {inv.raw_json.items.map((it, i) => (
                  <tr key={i}>
                    <td className="muted">{i + 1}</td>
                    <td>{it.name_vn || <span className="muted">—</span>}</td>
                    <td>{it.name_en || <span className="muted">—</span>}</td>
                    <td>{it.qty}</td>
                    <td>{it.unit}</td>
                    <td>{Number(it.unit_value).toLocaleString('en-US')}</td>
                    <td>{Number(it.total_value).toLocaleString('en-US')}</td>
                    <td>{it.country_of_origin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {inv.raw_json.notes && (
            <div className="muted" style={{ fontSize: 12 }}>Ghi chú AI: {inv.raw_json.notes}</div>
          )}
        </div>
      ))}
      <ImageDrawer url={drawerUrl} title={`Ảnh hóa đơn — ${customer.name}`} onClose={() => setDrawerUrl(null)} />
    </div>
  );
}

/* ───────────────────────── Bước 3 · Data sửa (editable) ───────────────────────── */

function EditedDataTab({ shipmentId, customer, onReload }) {
  const [rows, setRows] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [dirty, setDirty] = useState({});
  const [newRows, setNewRows] = useState([]); // each has _groupInvoiceId so we know which section they belong to
  const [deleteIds, setDeleteIds] = useState([]);
  const [currency, setCurrency] = useState(customer.currency || 'VND');
  const [rate, setRate] = useState(customer.exchange_rate_vnd_per_usd || '');
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [translateMsg, setTranslateMsg] = useState('');
  const [drawerUrl, setDrawerUrl] = useState(null);

  async function load() {
    const [items, invs] = await Promise.all([
      api.listRawItems(shipmentId, customer.id),
      api.listInvoices(shipmentId, customer.id),
    ]);
    setRows(items);
    setInvoices(invs);
    setDirty({}); setNewRows([]); setDeleteIds([]);
    setCurrency(customer.currency || 'VND');
    setRate(customer.exchange_rate_vnd_per_usd || '');
  }
  useEffect(() => { load(); }, [shipmentId, customer.id]);

  function patchRow(id, patch) {
    setRows((rs) => rs.map((r) => {
      if (r.id !== id) return r;
      const updated = { ...r, ...patch };
      if ('qty' in patch || 'unit_value' in patch) {
        updated.total_value = Math.round(Number(updated.qty || 0) * Number(updated.unit_value || 0) * 100) / 100;
      }
      return updated;
    }));
    setDirty((d) => ({ ...d, [id]: true }));
  }
  function addNewRow(groupInvoiceId = null) {
    setNewRows((n) => [...n, {
      _tmp: Math.random(),
      _groupInvoiceId: groupInvoiceId,
      source_invoice_id: groupInvoiceId,
      line_no: rows.length + n.length + 1,
      name_vn: '', name_en: '', qty: 1, unit: 'PCS',
      unit_value: 0, total_value: 0, country_of_origin: 'VIETNAM',
    }]);
  }
  function patchNewRow(tmp, patch) {
    setNewRows((n) => n.map((r) => {
      if (r._tmp !== tmp) return r;
      const updated = { ...r, ...patch };
      if ('qty' in patch || 'unit_value' in patch) {
        updated.total_value = Math.round(Number(updated.qty || 0) * Number(updated.unit_value || 0) * 100) / 100;
      }
      return updated;
    }));
  }
  function deleteRow(id) {
    setRows((rs) => rs.filter((r) => r.id !== id));
    setDeleteIds((ds) => [...ds, id]);
  }
  function removeNewRow(tmp) {
    setNewRows((n) => n.filter((r) => r._tmp !== tmp));
  }

  async function translateMissing() {
    const needTranslate = [
      ...rows.filter((r) => r.name_vn && !r.name_en).map((r) => ({ id: r.id, name_vn: r.name_vn })),
      ...newRows.filter((r) => r.name_vn && !r.name_en).map((r) => ({ id: r._tmp, name_vn: r.name_vn })),
    ];
    if (needTranslate.length === 0) {
      setTranslateMsg('Không có dòng nào cần dịch (tất cả name_en đã có hoặc name_vn trống).');
      setTimeout(() => setTranslateMsg(''), 3000);
      return;
    }
    setTranslating(true); setTranslateMsg('');
    try {
      const { translations } = await api.translateRawItems(needTranslate);
      const transMap = new Map(translations.map((t) => [t.id, t.name_en]));
      setRows((rs) => rs.map((r) => {
        const en = transMap.get(r.id);
        if (en) {
          setDirty((d) => ({ ...d, [r.id]: true }));
          return { ...r, name_en: en };
        }
        return r;
      }));
      setNewRows((ns) => ns.map((r) => {
        const en = transMap.get(r._tmp);
        return en ? { ...r, name_en: en } : r;
      }));
      setTranslateMsg(`✓ Đã dịch ${translations.length} dòng — review xong bấm 💾 Lưu để áp dụng.`);
      setTimeout(() => setTranslateMsg(''), 5000);
    } catch (e) {
      setTranslateMsg('Lỗi: ' + (e.data?.message || e.message));
    } finally {
      setTranslating(false);
    }
  }

  async function saveAll() {
    setLoading(true); setSavedMsg('');
    try {
      await api.updateCustomerSettings(shipmentId, customer.id, {
        currency,
        exchange_rate_vnd_per_usd: rate === '' ? null : Number(rate),
      });

      const upserts = [];
      for (const r of rows) {
        if (dirty[r.id]) {
          upserts.push({
            id: r.id, line_no: r.line_no, name_vn: r.name_vn, name_en: r.name_en,
            qty: r.qty, unit: r.unit,
            unit_value: r.unit_value, total_value: r.total_value,
            country_of_origin: r.country_of_origin,
          });
        }
      }
      for (const r of newRows) {
        upserts.push({
          source_invoice_id: r._groupInvoiceId || r.source_invoice_id || null,
          line_no: r.line_no, name_vn: r.name_vn, name_en: r.name_en,
          qty: r.qty, unit: r.unit,
          unit_value: r.unit_value, total_value: r.total_value,
          country_of_origin: r.country_of_origin,
        });
      }
      await api.bulkRawItems({
        sea_shipment_id: Number(shipmentId),
        customer_id: customer.id,
        upserts,
        delete_ids: deleteIds,
      });
      await load(); onReload();
      setSavedMsg('✓ Đã lưu Data sửa');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (e) {
      alert('Lỗi lưu: ' + (e.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  }

  const hasDirty = Object.keys(dirty).length > 0 || newRows.length > 0 || deleteIds.length > 0;
  const settingsChanged =
    currency !== (customer.currency || 'VND') ||
    String(rate) !== String(customer.exchange_rate_vnd_per_usd || '');
  const totalQty = rows.reduce((s, r) => s + Number(r.qty || 0), 0)
                 + newRows.reduce((s, r) => s + Number(r.qty || 0), 0);
  const totalValue = rows.reduce((s, r) => s + Number(r.total_value || 0), 0)
                   + newRows.reduce((s, r) => s + Number(r.total_value || 0), 0);

  // Group rows by source_invoice_id, in order of invoices list. Items without
  // source go into the "Manual" group at the end.
  const sortedInvoices = [...invoices].filter((i) => i.status === 'scanned').sort((a, b) => a.id - b.id);
  const groups = sortedInvoices.map((inv) => ({
    invoice: inv,
    rows: rows.filter((r) => r.source_invoice_id === inv.id),
    newRows: newRows.filter((r) => r._groupInvoiceId === inv.id),
  }));
  const manualGroup = {
    invoice: null,
    rows: rows.filter((r) => !sortedInvoices.some((i) => i.id === r.source_invoice_id)),
    newRows: newRows.filter((r) => !r._groupInvoiceId),
  };
  if (manualGroup.rows.length > 0 || manualGroup.newRows.length > 0) {
    groups.push(manualGroup);
  }

  return (
    <div className="col">
      <div className="card col">
        <strong>Bước 3 — Data sửa cho {customer.name}</strong>
        <div className="muted">
          Bản copy <strong>có thể sửa</strong> từ Data gốc. Items được nhóm theo ảnh hóa đơn — click ảnh để xem ở drawer bên phải.
          Sửa OCR, dịch tiếng Anh, chốt giá rồi <strong>💾 Lưu</strong>. Không ảnh hưởng Data gốc (B2).
        </div>
        <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 120 }}>
            <label>Đơn vị tiền</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="VND">VND (đồng Việt Nam)</option>
              <option value="USD">USD (đô la Mỹ)</option>
            </select>
          </div>
          {currency === 'VND' && (
            <div style={{ minWidth: 200 }}>
              <label>Tỷ giá VND/USD <span className="muted">(1 USD = ? VND)</span></label>
              <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)}
                placeholder="vd: 25000" />
            </div>
          )}
          <div style={{ flex: 1 }} />
          <div style={{ alignSelf: 'flex-end' }}>
            <button onClick={translateMissing} disabled={translating} title="Dùng AI dịch các dòng có name_vn nhưng name_en trống">
              {translating ? 'Đang dịch…' : '🌐 Dịch tiếng Anh (AI)'}
            </button>
            <button className="primary" disabled={(!hasDirty && !settingsChanged) || loading} onClick={saveAll} style={{ marginLeft: 8 }}>
              {loading ? 'Đang lưu…' : '💾 Lưu Data sửa'}
            </button>
          </div>
        </div>
        {savedMsg && <div className="success">{savedMsg}</div>}
        {translateMsg && <div className={translateMsg.startsWith('Lỗi') ? 'error' : 'success'}>{translateMsg}</div>}
        <div className="row" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 12, fontSize: 13 }}>
          <span className="muted">Tổng cộng <strong>{rows.length + newRows.length}</strong> dòng</span>
          <span><strong>{totalQty.toLocaleString('en-US')}</strong> qty · <strong>{totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> {currency}</span>
        </div>
      </div>

      {groups.length === 0 && (
        <div className="card muted" style={{ textAlign: 'center', padding: 32 }}>
          Chưa có items trong Data sửa. Quay lại <strong>Bước 1</strong> upload ảnh, hoặc bấm "+ Thêm dòng thủ công" dưới đây.
          <div style={{ marginTop: 12 }}>
            <button onClick={() => addNewRow(null)}>+ Thêm dòng thủ công</button>
          </div>
        </div>
      )}

      {groups.map((g) => {
        const inv = g.invoice;
        const groupTotalQty = g.rows.reduce((s, r) => s + Number(r.qty || 0), 0) + g.newRows.reduce((s, r) => s + Number(r.qty || 0), 0);
        const groupTotalValue = g.rows.reduce((s, r) => s + Number(r.total_value || 0), 0) + g.newRows.reduce((s, r) => s + Number(r.total_value || 0), 0);
        const key = inv ? `inv-${inv.id}` : 'manual';
        return (
          <div key={key} className="card col" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="row" style={{ padding: 16, gap: 14, borderBottom: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}>
              {inv ? (
                <img src={inv.image_url} alt="" onClick={() => setDrawerUrl(inv.image_url)}
                  style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--radius-md)', cursor: 'pointer', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-muted)', fontSize: 11 }}>
                  Thủ công
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {inv ? `Ảnh #${inv.id}` : 'Items thêm tay (không từ ảnh)'}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {inv && new Date(inv.scanned_at).toLocaleString('vi-VN')}
                  {inv?.raw_json?.currency_detected && ` · ${inv.raw_json.currency_detected}`}
                  {' · '}{g.rows.length + g.newRows.length} dòng
                  {' · '}{groupTotalQty} qty · {groupTotalValue.toLocaleString('en-US', { maximumFractionDigits: 2 })} {currency}
                </div>
              </div>
              <button onClick={() => addNewRow(inv ? inv.id : null)}>+ Thêm dòng</button>
            </div>
            <div style={{ overflow: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>#</th>
                    <th>Tên VN</th>
                    <th>Tên EN</th>
                    <th style={{ width: 80 }}>SL</th>
                    <th style={{ width: 80 }}>ĐV</th>
                    <th style={{ width: 130 }}>Đơn giá ({currency})</th>
                    <th style={{ width: 130 }}>Tổng ({currency})</th>
                    <th style={{ width: 90 }}>Country</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr key={r.id}>
                      <td><input type="number" value={r.line_no || ''} onChange={(e) => patchRow(r.id, { line_no: Number(e.target.value) })} style={{ width: 50 }} /></td>
                      <td><input value={r.name_vn || ''} onChange={(e) => patchRow(r.id, { name_vn: e.target.value })} /></td>
                      <td><input value={r.name_en || ''} onChange={(e) => patchRow(r.id, { name_en: e.target.value })} /></td>
                      <td><input type="number" step="0.001" value={r.qty || ''} onChange={(e) => patchRow(r.id, { qty: e.target.value })} /></td>
                      <td><input value={r.unit || ''} onChange={(e) => patchRow(r.id, { unit: e.target.value })} /></td>
                      <td><input type="number" step="0.01" value={r.unit_value || ''} onChange={(e) => patchRow(r.id, { unit_value: e.target.value })} /></td>
                      <td><input type="number" step="0.01" value={r.total_value || ''} onChange={(e) => patchRow(r.id, { total_value: e.target.value })} /></td>
                      <td><input value={r.country_of_origin || ''} onChange={(e) => patchRow(r.id, { country_of_origin: e.target.value })} /></td>
                      <td><button className="danger" onClick={() => deleteRow(r.id)}>×</button></td>
                    </tr>
                  ))}
                  {g.newRows.map((r) => (
                    <tr key={r._tmp} style={{ background: 'rgba(22,163,74,0.06)' }}>
                      <td><input type="number" value={r.line_no} onChange={(e) => patchNewRow(r._tmp, { line_no: Number(e.target.value) })} style={{ width: 50 }} /></td>
                      <td><input value={r.name_vn} onChange={(e) => patchNewRow(r._tmp, { name_vn: e.target.value })} /></td>
                      <td><input value={r.name_en} onChange={(e) => patchNewRow(r._tmp, { name_en: e.target.value })} /></td>
                      <td><input type="number" step="0.001" value={r.qty} onChange={(e) => patchNewRow(r._tmp, { qty: e.target.value })} /></td>
                      <td><input value={r.unit} onChange={(e) => patchNewRow(r._tmp, { unit: e.target.value })} /></td>
                      <td><input type="number" step="0.01" value={r.unit_value} onChange={(e) => patchNewRow(r._tmp, { unit_value: e.target.value })} /></td>
                      <td><input type="number" step="0.01" value={r.total_value} onChange={(e) => patchNewRow(r._tmp, { total_value: e.target.value })} /></td>
                      <td><input value={r.country_of_origin} onChange={(e) => patchNewRow(r._tmp, { country_of_origin: e.target.value })} /></td>
                      <td><button onClick={() => removeNewRow(r._tmp)}>×</button></td>
                    </tr>
                  ))}
                  {g.rows.length === 0 && g.newRows.length === 0 && (
                    <tr><td colSpan={9} className="muted" style={{ padding: 16, textAlign: 'center' }}>
                      Không có items từ ảnh này.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <ImageDrawer url={drawerUrl} title={`Ảnh hóa đơn — ${customer.name}`} onClose={() => setDrawerUrl(null)} />
    </div>
  );
}

/* ───────────────────────── Bước 4 · Commercial Invoice ───────────────────────── */

function CommercialInvoiceTab({ shipmentId, customer, onReload }) {
  const [rows, setRows] = useState([]);
  const [dirty, setDirty] = useState({});
  const [newRows, setNewRows] = useState([]);
  const [deleteIds, setDeleteIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [promoting, setPromoting] = useState(false);

  async function load() {
    const items = await api.listItems(shipmentId, customer.id);
    setRows(items);
    setDirty({}); setNewRows([]); setDeleteIds([]);
  }
  useEffect(() => { load(); }, [shipmentId, customer.id]);

  async function promote(mode) {
    if (mode === 'replace' && rows.length > 0) {
      if (!confirm('Tạo lại từ Data sửa sẽ XOÁ HẾT items hiện tại của CI. Tiếp tục?')) return;
    }
    setPromoting(true);
    try {
      const result = await api.promoteToCI(shipmentId, customer.id, mode);
      await load(); onReload();
      alert(`Đã tạo ${result.items.length} items từ Data sửa (tỷ giá ${result.rate || '—'} ${result.currency}/USD).`);
    } catch (e) {
      alert('Lỗi: ' + (e.data?.message || e.message));
    } finally {
      setPromoting(false);
    }
  }

  async function normalizeUnits() {
    try {
      const r = await api.normalizeCIUnits(shipmentId, customer.id);
      await load();
      alert(`Đã convert ${r.changed}/${r.scanned} đơn vị sang English.`);
    } catch (e) {
      alert('Lỗi: ' + (e.data?.message || e.message));
    }
  }

  function patchRow(id, patch) {
    setRows((rs) => rs.map((r) => {
      if (r.id !== id) return r;
      const updated = { ...r, ...patch };
      if ('qty' in patch || 'unit_value_usd' in patch) {
        const q = Number(updated.qty || 0);
        const u = Number(updated.unit_value_usd || 0);
        updated.total_value_usd = Math.round(q * u * 100) / 100;
      }
      return updated;
    }));
    setDirty((d) => ({ ...d, [id]: true }));
  }
  function addNewRow() {
    setNewRows((n) => [...n, {
      _tmp: Math.random(),
      line_no: rows.length + n.length + 1,
      name_vn: '', name_en: '', qty: 1, unit: 'PCS',
      unit_value_usd: 0, total_value_usd: 0, country_of_origin: 'VIETNAM',
    }]);
  }
  function patchNewRow(tmp, patch) {
    setNewRows((n) => n.map((r) => {
      if (r._tmp !== tmp) return r;
      const updated = { ...r, ...patch };
      if ('qty' in patch || 'unit_value_usd' in patch) {
        updated.total_value_usd = Math.round(Number(updated.qty || 0) * Number(updated.unit_value_usd || 0) * 100) / 100;
      }
      return updated;
    }));
  }
  function deleteRow(id) {
    setRows((rs) => rs.filter((r) => r.id !== id));
    setDeleteIds((ds) => [...ds, id]);
  }
  function removeNewRow(tmp) {
    setNewRows((n) => n.filter((r) => r._tmp !== tmp));
  }

  async function saveAll() {
    setLoading(true);
    try {
      const upserts = [];
      for (const r of rows) {
        if (dirty[r.id]) {
          upserts.push({
            id: r.id, line_no: r.line_no, name_vn: r.name_vn, name_en: r.name_en,
            qty: r.qty, unit: r.unit,
            unit_value_usd: r.unit_value_usd, total_value_usd: r.total_value_usd,
            country_of_origin: r.country_of_origin,
          });
        }
      }
      for (const r of newRows) {
        upserts.push({
          line_no: r.line_no, name_vn: r.name_vn, name_en: r.name_en,
          qty: r.qty, unit: r.unit,
          unit_value_usd: r.unit_value_usd, total_value_usd: r.total_value_usd,
          country_of_origin: r.country_of_origin,
        });
      }
      await api.bulkItems({
        sea_shipment_id: Number(shipmentId),
        customer_id: customer.id,
        upserts,
        delete_ids: deleteIds,
      });
      await load(); onReload();
    } catch (e) {
      alert('Lỗi lưu: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  const hasDirty = Object.keys(dirty).length > 0 || newRows.length > 0 || deleteIds.length > 0;
  const totalQty = rows.reduce((s, r) => s + Number(r.qty || 0), 0)
                 + newRows.reduce((s, r) => s + Number(r.qty || 0), 0);
  const totalUsd = rows.reduce((s, r) => s + Number(r.total_value_usd || 0), 0)
                 + newRows.reduce((s, r) => s + Number(r.total_value_usd || 0), 0);

  return (
    <div className="col">
      <div className="card col">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <strong>Bước 4 — Commercial Invoice cho {customer.name} (USD)</strong>
            <div className="muted">
              Items clone từ Data sửa + tự quy đổi VND→USD theo tỷ giá đã đặt ở B3. Sửa ở đây không ảnh hưởng Data sửa.
            </div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {rows.length === 0 ? (
              <button className="primary" disabled={promoting} onClick={() => promote('replace')}>
                {promoting ? 'Đang tạo…' : '🪄 Tạo CI từ Data sửa'}
              </button>
            ) : (
              <>
                <button onClick={() => promote('append')} disabled={promoting} title="Thêm items từ Data sửa vào sau danh sách hiện tại">+ Append từ Data sửa</button>
                <button className="danger" onClick={() => promote('replace')} disabled={promoting} title="Xoá hết items CI, tạo lại từ Data sửa">↻ Tạo lại từ Data sửa</button>
                <button onClick={normalizeUnits} title="Convert hết đơn vị VN sang EN (Cái→PCS, Bộ→SET, ...)">🔤 Chuẩn hoá đơn vị</button>
                <button onClick={addNewRow}>+ Thêm dòng</button>
                <button className="primary" disabled={!hasDirty || loading} onClick={saveAll}>
                  {loading ? 'Đang lưu…' : 'Lưu thay đổi'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="table-shell" style={{ overflow: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th>Tên VN</th>
              <th>Tên EN</th>
              <th style={{ width: 80 }}>SL</th>
              <th style={{ width: 80 }}>ĐV</th>
              <th style={{ width: 110 }}>Đơn giá USD</th>
              <th style={{ width: 110 }}>Tổng USD</th>
              <th style={{ width: 90 }}>Country</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><input type="number" value={r.line_no || ''} onChange={(e) => patchRow(r.id, { line_no: Number(e.target.value) })} style={{ width: 50 }} /></td>
                <td><input value={r.name_vn || ''} onChange={(e) => patchRow(r.id, { name_vn: e.target.value })} /></td>
                <td><input value={r.name_en || ''} onChange={(e) => patchRow(r.id, { name_en: e.target.value })} /></td>
                <td><input type="number" step="0.001" value={r.qty || ''} onChange={(e) => patchRow(r.id, { qty: e.target.value })} /></td>
                <td><input value={r.unit || ''} onChange={(e) => patchRow(r.id, { unit: e.target.value })} /></td>
                <td><input type="number" step="0.0001" value={r.unit_value_usd || ''} onChange={(e) => patchRow(r.id, { unit_value_usd: e.target.value })} /></td>
                <td><input type="number" step="0.01" value={r.total_value_usd || ''} onChange={(e) => patchRow(r.id, { total_value_usd: e.target.value })} /></td>
                <td><input value={r.country_of_origin || ''} onChange={(e) => patchRow(r.id, { country_of_origin: e.target.value })} /></td>
                <td><button className="danger" onClick={() => deleteRow(r.id)}>×</button></td>
              </tr>
            ))}
            {newRows.map((r) => (
              <tr key={r._tmp} style={{ background: 'rgba(22,163,74,0.06)' }}>
                <td><input type="number" value={r.line_no} onChange={(e) => patchNewRow(r._tmp, { line_no: Number(e.target.value) })} style={{ width: 50 }} /></td>
                <td><input value={r.name_vn} onChange={(e) => patchNewRow(r._tmp, { name_vn: e.target.value })} /></td>
                <td><input value={r.name_en} onChange={(e) => patchNewRow(r._tmp, { name_en: e.target.value })} /></td>
                <td><input type="number" step="0.001" value={r.qty} onChange={(e) => patchNewRow(r._tmp, { qty: e.target.value })} /></td>
                <td><input value={r.unit} onChange={(e) => patchNewRow(r._tmp, { unit: e.target.value })} /></td>
                <td><input type="number" step="0.0001" value={r.unit_value_usd} onChange={(e) => patchNewRow(r._tmp, { unit_value_usd: e.target.value })} /></td>
                <td><input type="number" step="0.01" value={r.total_value_usd} onChange={(e) => patchNewRow(r._tmp, { total_value_usd: e.target.value })} /></td>
                <td><input value={r.country_of_origin} onChange={(e) => patchNewRow(r._tmp, { country_of_origin: e.target.value })} /></td>
                <td><button onClick={() => removeNewRow(r._tmp)}>×</button></td>
              </tr>
            ))}
            {rows.length === 0 && newRows.length === 0 && (
              <tr><td colSpan={9} className="muted" style={{ padding: 24, textAlign: 'center' }}>
                Chưa có CI. Bấm "🪄 Tạo CI từ Data sửa" để bắt đầu.
              </td></tr>
            )}
          </tbody>
          {(rows.length > 0 || newRows.length > 0) && (
            <tfoot>
              <tr style={{ background: 'var(--bg-tertiary)', fontWeight: 600 }}>
                <td colSpan={3}>TOTAL</td>
                <td>{totalQty.toLocaleString('en-US')}</td>
                <td colSpan={2}></td>
                <td>{totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
