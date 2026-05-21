import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

export default function Accounts() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', password: '', role: 'staff' });
  const [error, setError] = useState('');
  const [showPwd, setShowPwd] = useState({}); // {id: bool}

  async function load() { setUsers(await api.listUsers()); }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ code: '', name: '', password: '', role: 'staff' });
    setShowModal(true); setError('');
  }
  function openEdit(u) {
    setEditing(u);
    setForm({ code: u.code, name: u.name, password: u.password || '', role: u.role });
    setShowModal(true); setError('');
  }
  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await api.updateUser(editing.id, {
          name: form.name, password: form.password || null, role: form.role,
        });
      } else {
        await api.createUser(form);
      }
      setShowModal(false); load();
    } catch (e) { setError(e.data?.error || e.message); }
  }
  async function remove(u) {
    if (u.id === me.id) return alert('Không thể xoá tài khoản của chính mình.');
    if (!confirm(`Xoá tài khoản "${u.code}"?`)) return;
    await api.deleteUser(u.id); load();
  }

  return (
    <div className="col" style={{ gap: 20 }}>
      <header>
        <p className="page-eyebrow">ADMIN</p>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h1 className="page-title">Tài <span className="page-title-accent">khoản</span></h1>
          <button className="primary" onClick={openCreate}>+ Tạo tài khoản</button>
        </div>
        <p className="page-subtitle">Manager và nhân viên có quyền truy cập app.</p>
      </header>
      <div className="table-shell">
        <table className="table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên</th>
              <th>Role</th>
              <th>Mật khẩu</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="mono">{u.code}</td>
                <td>{u.name}</td>
                <td>{u.role}</td>
                <td className="mono" style={{ fontSize: 12 }}>
                  {showPwd[u.id]
                    ? (u.password || '—')
                    : (u.password ? '••••••' : '—')}
                  {u.password && (
                    <button className="ghost" style={{ marginLeft: 6, padding: '2px 6px', fontSize: 11 }}
                      onClick={() => setShowPwd({ ...showPwd, [u.id]: !showPwd[u.id] })}>
                      {showPwd[u.id] ? 'Ẩn' : 'Hiện'}
                    </button>
                  )}
                </td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <button onClick={() => openEdit(u)}>Sửa</button>
                    <button className="danger" onClick={() => remove(u)} disabled={u.id === me.id}>Xoá</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form className="modal col" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <h3>{editing ? `Sửa: ${editing.code}` : 'Tạo tài khoản'}</h3>
            {!editing && (
              <div>
                <label>Mã đăng nhập</label>
                <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} autoFocus />
              </div>
            )}
            <div>
              <label>Tên</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label>Mật khẩu</label>
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="staff">staff</option>
                <option value="manager">manager</option>
                <option value="admin">admin</option>
              </select>
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
