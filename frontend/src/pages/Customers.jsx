import { useEffect, useState } from 'react';
import { api } from '../api';

const DEFAULT_RECEIVER = '<Tên công ty>\n<Địa chỉ>\n<City, State, Zip, Country>';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', receiver_block: '' });
  const [error, setError] = useState('');

  async function load() { setCustomers(await api.listCustomers()); }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', address: '', receiver_block: DEFAULT_RECEIVER });
    setShowModal(true); setError('');
  }
  function openEdit(c) {
    setEditing(c);
    setForm({ name: c.name, address: c.address || '', receiver_block: c.receiver_block || '' });
    setShowModal(true); setError('');
  }
  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editing) await api.updateCustomer(editing.id, form);
      else await api.createCustomer(form);
      setShowModal(false);
      load();
    } catch (e) { setError(e.data?.error || e.message); }
  }
  async function remove(c) {
    if (!confirm(`Xoá khách "${c.name}"? Toàn bộ liên kết với chuyến + cargos + items sẽ bị xoá cascade.`)) return;
    await api.deleteCustomer(c.id);
    load();
  }

  return (
    <div className="col" style={{ gap: 20 }}>
      <header>
        <p className="page-eyebrow">DIRECTORY</p>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h1 className="page-title">Khách <span className="page-title-accent">hàng</span></h1>
          <button className="primary" onClick={openCreate}>+ Tạo khách</button>
        </div>
        <p className="page-subtitle">Receiver list cho Commercial Invoice.</p>
      </header>
      <div className="table-shell">
        <table className="table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Địa chỉ</th>
              <th>Receiver block</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr><td colSpan={4} className="muted" style={{ padding: 24, textAlign: 'center' }}>
                Chưa có khách hàng nào.
              </td></tr>
            )}
            {customers.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td className="muted">{c.address || '—'}</td>
                <td className="muted" style={{ whiteSpace: 'pre-wrap', fontSize: 12, maxWidth: 400 }}>
                  {(c.receiver_block || '').slice(0, 150)}{(c.receiver_block || '').length > 150 ? '…' : ''}
                </td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <button onClick={() => openEdit(c)}>Sửa</button>
                    <button className="danger" onClick={() => remove(c)}>Xoá</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form className="modal col" onClick={(e) => e.stopPropagation()} onSubmit={submit} style={{ width: 560 }}>
            <h3>{editing ? 'Sửa khách hàng' : 'Tạo khách hàng'}</h3>
            <div>
              <label>Tên hiển thị</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div>
              <label>Địa chỉ ngắn (tùy chọn)</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label>Receiver block — text dán vào ô "Receiver" của Commercial Invoice</label>
              <textarea rows={6} value={form.receiver_block}
                onChange={(e) => setForm({ ...form, receiver_block: e.target.value })}
                placeholder="1552704 B.C.LTD. (OngBa Vietnamese Eatery)&#10;11761 250 STREET&#10;Maple Ridge, BC V4R 2W8" />
            </div>
            {error && <div className="error">{error}</div>}
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setShowModal(false)}>Huỷ</button>
              <button className="primary" type="submit">{editing ? 'Lưu' : 'Tạo'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
