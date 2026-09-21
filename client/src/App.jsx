import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Customers from './pages/Customers.jsx';
import CustomerProfile from './pages/CustomerProfile.jsx';
import NewBottle from './pages/NewBottle.jsx';
import Refill from './pages/Refill.jsx';
import Payments from './pages/Payments.jsx';
import Inventory from './pages/Inventory.jsx';
import Reconciliation from './pages/Reconciliation.jsx';
import Reports from './pages/Reports.jsx';
import AuditLogs from './pages/AuditLogs.jsx';
import Settings from './pages/Settings.jsx';
import Users from './pages/Users.jsx';

function Protected({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerProfile />} />
        <Route path="new-bottle" element={<NewBottle />} />
        <Route path="refill" element={<Refill />} />
        <Route path="payments" element={<Payments />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="reconciliation" element={<Reconciliation />} />
        <Route path="reports" element={<Reports />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="settings" element={<Settings />} />
        <Route path="users" element={<Users />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}