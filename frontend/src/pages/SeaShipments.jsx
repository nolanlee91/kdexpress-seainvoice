import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function SeaShipments() {
  const [shipments, setShipments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ code: '', invoice_date: '', sender_block: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function reload() {
    setLoading(true);
    try { setShipments(await api.listShipments()); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  async function create(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createShipment(form);
      setShowModal(false);
      setForm({ code: '', invoice_date: '', sender_block: '' });
      reload();
    } catch (e) {
      setError(e.data?.error || e.message);
    }
  }

  async function remove(id) {
    if (!confirm('Xoá chuyến này? Toàn bộ data sẽ mất.')) return;
    await api.deleteShipment(id);
    reload();
  }

  return (
    <div className="col" style={{ gap: 20 }}>
      <header>
        <p className="page-eyebrow">OPERATIONS</p>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h1 className="page-title">Chuyến <span className="page-title-accent">hàng biển</span></h1>
          <button className="primary" onClick={() => setShowModal(true)}>+ Tạo chuyến mới</button>
        </div>
        <p className="page-subtitle">Quản lý chuyến container đường biển + xuất Commercial Invoice.</p>
      </header>

      {loading ? <div className="muted">Đang tải…</div> : (
        <div className="table-shell">
          <table className="table">
            <thead>
              <tr>
                <th>Mã chuyến</th>
                <th>Ngày invoice</th>
                <th>Khách</th>
                <th>Hóa đơn AI</th>
                <th>Items CI</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shipments.length === 0 && (
                <tr><td colSpan={7} className="muted" style={{ padding: 32, textAlign: 'center' }}>
                  Chưa có chuyến nào. Bấm "Tạo chuyến mới" để bắt đầu.
                </td></tr>
              )}
              {shipments.map((s) => (
                <tr key={s.id}>
                  <td><Link to={`/shipments/${s.id}`} className="mono">{s.code}</Link></td>
                  <td>{s.invoice_date ? new Date(s.invoice_date).toLocaleDateString('vi-VN') : <span className="muted">—</span>}</td>
                  <td>{s.customer_count}</td>
                  <td>{s.invoice_count}</td>
                  <td>{s.ci_item_count}</td>
                  <td>
                    <span className={'badge ' + (s.status === 'finalized' ? 'badge-success' : 'badge-slate')}>
                      {s.status === 'finalized' ? 'FINALIZED' : 'DRAFT'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="danger" onClick={() => remove(s.id)}>Xoá</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form className="modal col" onClick={(e) => e.stopPropagation()} onSubmit={create}>
            <h3>Tạo chuyến hàng biển</h3>
            <div>
              <label>Mã chuyến</label>
              <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="SEA 052026" autoFocus />
            </div>
            <div>
              <label>Ngày invoice</label>
              <input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} />
            </div>
            <div>
              <label>Sender block (tùy chọn)</label>
              <textarea rows={4} value={form.sender_block}
                placeholder="GEMADEPT LOGISTICS ONE MEMBER CO., LTD..."
                onChange={(e) => setForm({ ...form, sender_block: e.target.value })} />
            </div>
            {error && <div className="error">{error}</div>}
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button type="button" onClick={() => setShowModal(false)}>Huỷ</button>
              <button className="primary" type="submit">Tạo</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
