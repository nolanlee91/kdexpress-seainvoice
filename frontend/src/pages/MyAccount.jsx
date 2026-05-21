import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

export default function MyAccount() {
  const { user } = useAuth();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setMsg(''); setError('');
    if (form.new_password !== form.confirm) return setError('Mật khẩu mới không khớp');
    try {
      await api.changePassword(form.current_password, form.new_password);
      setMsg('Đã đổi mật khẩu thành công');
      setForm({ current_password: '', new_password: '', confirm: '' });
    } catch (e) {
      setError(e.data?.error || e.message);
    }
  }

  return (
    <div className="col" style={{ maxWidth: 500, gap: 20 }}>
      <header>
        <p className="page-eyebrow">ACCOUNT</p>
        <h1 className="page-title">Tài khoản <span className="page-title-accent">của tôi</span></h1>
      </header>
      <div className="card">
        <div className="muted">Đăng nhập: <strong className="mono">{user?.code}</strong></div>
        <div className="muted">Tên: {user?.name}</div>
        <div className="muted">Role: {user?.role}</div>
      </div>
      <form className="card col" onSubmit={submit}>
        <h3 style={{ margin: 0 }}>Đổi mật khẩu</h3>
        <div>
          <label>Mật khẩu hiện tại</label>
          <input type="password" required value={form.current_password}
            onChange={(e) => setForm({ ...form, current_password: e.target.value })} />
        </div>
        <div>
          <label>Mật khẩu mới</label>
          <input type="password" required value={form.new_password}
            onChange={(e) => setForm({ ...form, new_password: e.target.value })} />
        </div>
        <div>
          <label>Nhập lại mật khẩu mới</label>
          <input type="password" required value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </div>
        {error && <div className="error">{error}</div>}
        {msg && <div className="success">{msg}</div>}
        <button className="primary" type="submit">Đổi mật khẩu</button>
      </form>
    </div>
  );
}
