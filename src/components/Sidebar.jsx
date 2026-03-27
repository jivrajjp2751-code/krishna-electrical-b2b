import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Truck, Users, ShoppingCart, Receipt,
  FileText, Bell, Settings, ChevronLeft, ChevronRight, LogOut,
  Clock, FolderOpen, FileCheck, MessageSquare, BarChart3
} from 'lucide-react';
import useStore from '../store/useStore';

const navItems = [
  { section: 'Overview' },
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { section: 'Management' },
  { path: '/products', label: 'Products', icon: Package },
  { path: '/suppliers', label: 'Suppliers (Party A)', icon: Truck },
  { path: '/customers', label: 'Customers (Party B)', icon: Users },
  { path: '/documents', label: 'Documents', icon: FolderOpen },
  { section: 'Transactions' },
  { path: '/enquiries', label: 'Enquiries', icon: MessageSquare },
  { path: '/purchases', label: 'Purchases', icon: ShoppingCart },
  { path: '/sales', label: 'Sales', icon: Receipt },
  { path: '/invoices', label: 'Invoices', icon: FileText },
  { path: '/quotations', label: 'Quotations', icon: FileCheck },
  { section: 'Reports' },
  { path: '/history', label: 'Customer History', icon: Clock },
  { path: '/product-history', label: 'Product History', icon: BarChart3 },
  { path: '/reminders', label: 'Reminders', icon: Bell },
  { section: 'System' },
  { path: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = useStore(s => s.sidebarCollapsed);
  const mobileOpen = useStore(s => s.sidebarMobileOpen);
  const toggleSidebar = useStore(s => s.toggleSidebar);
  const closeMobileSidebar = useStore(s => s.closeMobileSidebar);
  const currentUser = useStore(s => s.currentUser);
  const logout = useStore(s => s.logout);
  const getLowStockProducts = useStore(s => s.getLowStockProducts);
  const getInactiveCustomers = useStore(s => s.getInactiveCustomers);
  const getPendingEnquiries = useStore(s => s.getPendingEnquiries);

  const lowStockCount = getLowStockProducts().length;
  const inactiveCount = getInactiveCustomers().length;
  const pendingEnquiryCount = getPendingEnquiries().length;
  const alertCount = lowStockCount + inactiveCount + pendingEnquiryCount;

  const handleNav = (path) => {
    navigate(path);
    closeMobileSidebar();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-icon">KE</div>
        <div className="brand-text">
          <h2>Krishna Electrical</h2>
          <span>Electrical Works</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item, i) => {
          if (item.section) {
            return <div key={i} className="nav-section-title">{item.section}</div>;
          }
          if (item.adminOnly && currentUser?.role !== 'admin') return null;

          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);

          const badge = item.path === '/reminders' && alertCount > 0 ? alertCount : null;

          return (
            <div
              key={item.path}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => handleNav(item.path)}
            >
              <item.icon className="nav-icon" size={20} />
              <span className="nav-label">{item.label}</span>
              {badge && <span className="nav-badge">{badge}</span>}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-user">
        <div className="user-avatar">
          {currentUser?.name?.charAt(0) || 'U'}
        </div>
        <div className="user-info">
          <div className="user-name">{currentUser?.name || 'User'}</div>
          <div className="user-role">{currentUser?.role === 'admin' ? 'Administrator' : 'Staff'}</div>
        </div>
      </div>

      <div className="sidebar-toggle" onClick={toggleSidebar} title={collapsed ? 'Expand' : 'Collapse'}>
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </div>
    </aside>
  );
}
