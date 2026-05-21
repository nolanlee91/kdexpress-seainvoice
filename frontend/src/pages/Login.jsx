import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { user, loginUser } = useAuth();
  const nav = useNavigate();
  const [code, setCode] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/shipments" replace />;

  async function submit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await loginUser(code, password);
      nav('/shipments');
    } catch (e) {
      setError(e.data?.error || e.message || 'Lỗi đăng nhập');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: 20, background: 'var(--bg-primary)',
    }}>
      <form className="card col" onSubmit={submit} style={{ width: 380, padding: 28 }}>
        <div className="row" style={{ gap: 10, marginBottom: 4 }}>
          <div className="sidebar-logo-icon" style={{ width: 36, height: 36 }}>📦</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Hàng Biển</div>
            <div className="muted" style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              KDExpress · Internal
            </div>
          </div>
        </div>
        <div>
          <label>Mã đăng nhập</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
        </div>
        <div>
          <label>Mật khẩu</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div className="error">{error}</div>}
        <button className="primary" type="submit" disabled={loading}>
          {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}
