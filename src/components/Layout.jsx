import { Outlet } from 'react-router-dom';
import useStore from '../store/useStore';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  const sidebarCollapsed = useStore(s => s.sidebarCollapsed);
  const sidebarMobileOpen = useStore(s => s.sidebarMobileOpen);
  const closeMobileSidebar = useStore(s => s.closeMobileSidebar);

  return (
    <div className="app-layout">
      <Sidebar />
      {sidebarMobileOpen && <div className="mobile-overlay" onClick={closeMobileSidebar} />}
      <div className={`main-content ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <Header />
        <div className="page-wrapper fade-in">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
