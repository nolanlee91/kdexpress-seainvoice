import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import SeaShipments from './pages/SeaShipments.jsx';
import SeaShipmentDetail from './pages/SeaShipmentDetail.jsx';
import Customers from './pages/Customers.jsx';
import Accounts from './pages/Accounts.jsx';
import MyAccount from './pages/MyAccount.jsx';

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Đang tải…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && !role.includes(user.role)) return <Navigate to="/shipments" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/shipments" element={<SeaShipments />} />
        <Route path="/shipments/:id" element={<SeaShipmentDetail />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/my-account" element={<MyAccount />} />
        <Route path="/accounts" element={
          <ProtectedRoute role={['admin']}><Accounts /></ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/shipments" replace />} />
      </Route>
    </Routes>
  );
}
