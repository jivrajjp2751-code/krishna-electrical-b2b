import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useStore from './store/useStore';
import { startSessionWatcher, stopSessionWatcher } from './utils/security';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Suppliers from './pages/Suppliers';
import Customers from './pages/Customers';
import Purchases from './pages/Purchases';
import Sales from './pages/Sales';
import Invoices from './pages/Invoices';
import Quotations from './pages/Quotations';
import Enquiries from './pages/Enquiries';
import History from './pages/History';
import ProductHistory from './pages/ProductHistory';
import Documents from './pages/Documents';
import Reminders from './pages/Reminders';
import Settings from './pages/Settings';
import ToastContainer from './components/ToastContainer';

function ProtectedRoute({ children, adminOnly = false }) {
  const currentUser = useStore(s => s.currentUser);
  if (!currentUser) return <Navigate to="/login" replace />;
  if (adminOnly && currentUser.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function App() {
  const currentUser = useStore(s => s.currentUser);
  const syncFromServer = useStore(s => s.syncFromServer);
  const migratePasswords = useStore(s => s.migratePasswords);
  const logout = useStore(s => s.logout);
  const addToast = useStore(s => s.addToast);

  // Sync data from permanent database on startup
  useEffect(() => {
    syncFromServer().then(() => {
      // Migrate plaintext passwords to hashed after server data is loaded
      migratePasswords();
    });
  }, [syncFromServer, migratePasswords]);

  // Session timeout — auto-logout after 30 minutes of inactivity
  useEffect(() => {
    if (!currentUser) {
      stopSessionWatcher();
      return;
    }
    const cleanup = startSessionWatcher(() => {
      logout();
      addToast('Session expired due to inactivity. Please log in again.', 'info');
    });
    return cleanup;
  }, [currentUser, logout, addToast]);

  return (
    <>
      <ToastContainer />
      <Routes>
        <Route path="/login" element={currentUser ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="customers" element={<Customers />} />
          <Route path="documents" element={<Documents />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="sales" element={<Sales />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="quotations" element={<Quotations />} />
          <Route path="enquiries" element={<Enquiries />} />
          <Route path="history" element={<History />} />
          <Route path="product-history" element={<ProductHistory />} />
          <Route path="reminders" element={<Reminders />} />
          <Route path="settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
