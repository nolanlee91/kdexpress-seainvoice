import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [sidebarExtra, setSidebarExtra] = useState(null);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/logo.png" alt="KDExpress" className="sidebar-logo-img" />
          <div className="sidebar-logo-sub">seainvoice.hub</div>
        </div>

        <div className="sidebar-section-label">Operations</div>
        <nav className="sidebar-nav">
          <NavLink to="/shipments" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
            Chuyến hàng biển
          </NavLink>
          <NavLink to="/customers" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
            Khách hàng
          </NavLink>
        </nav>

        {sidebarExtra ? (
          <div className="sidebar-extra">{sidebarExtra}</div>
        ) : (
          <div style={{ flex: 1 }} />
        )}

        <div className="sidebar-section-label">Account</div>
        <nav className="sidebar-nav">
          {user?.role === 'admin' && (
            <NavLink to="/accounts" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
              Tài khoản
            </NavLink>
          )}
          <NavLink to="/my-account" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
            Đổi mật khẩu
          </NavLink>
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-row">
            <div className="sidebar-avatar">{getInitials(user?.name)}</div>
            <div style={{ overflow: 'hidden' }}>
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-role">{user?.code} · {user?.role}</div>
            </div>
          </div>
          <button className="sidebar-logout" onClick={() => { logout(); nav('/login'); }}>
            Đăng xuất
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, overflow: 'auto', padding: 32 }}>
        <div className="page-transition" key={location.pathname}>
          <Outlet context={{ setSidebarExtra }} />
        </div>
      </main>
    </div>
  );
}
