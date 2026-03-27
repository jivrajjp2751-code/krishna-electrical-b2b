import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, LogOut, Menu } from 'lucide-react';
import useStore from '../store/useStore';

const pageTitles = {
  '/': { title: 'Dashboard', breadcrumb: 'Home / Dashboard' },
  '/products': { title: 'Products', breadcrumb: 'Home / Products' },
  '/suppliers': { title: 'Suppliers (Party A)', breadcrumb: 'Home / Suppliers' },
  '/customers': { title: 'Customers (Party B)', breadcrumb: 'Home / Customers' },
  '/documents': { title: 'Customer Documents', breadcrumb: 'Home / Documents' },
  '/enquiries': { title: 'Enquiries', breadcrumb: 'Home / Enquiries' },
  '/purchases': { title: 'Purchases', breadcrumb: 'Home / Purchases' },
  '/sales': { title: 'Sales', breadcrumb: 'Home / Sales' },
  '/invoices': { title: 'Tax Invoices', breadcrumb: 'Home / Invoices' },
  '/quotations': { title: 'Quotations', breadcrumb: 'Home / Quotations' },
  '/history': { title: 'Customer History', breadcrumb: 'Home / Reports / History' },
  '/product-history': { title: 'Product History', breadcrumb: 'Home / Reports / Product History' },
  '/reminders': { title: 'Reminders & Alerts', breadcrumb: 'Home / Reports / Reminders' },
  '/settings': { title: 'Settings', breadcrumb: 'Home / Settings' },
};

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = useStore(s => s.sidebarCollapsed);
  const toggleMobileSidebar = useStore(s => s.toggleMobileSidebar);
  const logout = useStore(s => s.logout);
  const getLowStockProducts = useStore(s => s.getLowStockProducts);
  const getInactiveCustomers = useStore(s => s.getInactiveCustomers);
  const getPendingEnquiries = useStore(s => s.getPendingEnquiries);

  const alertCount = getLowStockProducts().length + getInactiveCustomers().length + getPendingEnquiries().length;
  const pageInfo = pageTitles[location.pathname] || { title: 'Page', breadcrumb: 'Home' };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className={`header ${collapsed ? 'collapsed' : ''}`}>
      <div className="header-left">
        <button className="mobile-menu-btn" onClick={toggleMobileSidebar}>
          <Menu size={20} />
        </button>
        <div className="page-title-section">
          <h1>{pageInfo.title}</h1>
          <span className="breadcrumb">{pageInfo.breadcrumb}</span>
        </div>
      </div>

      <div className="header-right">
        <button
          className="header-btn"
          onClick={() => navigate('/reminders')}
          title="Notifications"
        >
          <Bell size={20} />
          {alertCount > 0 && <span className="notification-dot" />}
        </button>
        <button
          className="header-btn"
          onClick={handleLogout}
          title="Logout"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
