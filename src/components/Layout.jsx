import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { BellRing, Check } from 'lucide-react';
import useStore from '../store/useStore';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  const sidebarCollapsed = useStore(s => s.sidebarCollapsed);
  const sidebarMobileOpen = useStore(s => s.sidebarMobileOpen);
  const closeMobileSidebar = useStore(s => s.closeMobileSidebar);
  const customReminders = useStore(s => s.customReminders) || [];
  const completeCustomReminder = useStore(s => s.completeCustomReminder);
  const activeAlarms = useStore(s => s.activeAlarms) || [];
  const triggerAlarm = useStore(s => s.triggerAlarm);
  const dismissAlarm = useStore(s => s.dismissAlarm);

  useEffect(() => {
    // Request notification permission if not granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const checkReminders = () => {
      const now = new Date();
      customReminders.forEach(r => {
        if (r.status === 'pending' && r.targetDate && r.targetTime) {
          const target = new Date(`${r.targetDate}T${r.targetTime}`);
          if (now >= target) {
            // It's time to notify!
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Reminder: ' + r.type, {
                body: r.text || 'You have a scheduled reminder.',
                icon: '/vite.svg'
              });
            }
            // Trigger in-app popup wrapper
            triggerAlarm(r);
            // Mark as completed so it doesn't trigger again
            completeCustomReminder(r.id);
          }
        }
      });
    };

    // Check every minute
    const intervalId = setInterval(checkReminders, 60000);
    // Also check on mount
    checkReminders();

    return () => clearInterval(intervalId);
  }, [customReminders, completeCustomReminder]);


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

      {/* active alarms on-screen popups */}
      {activeAlarms.length > 0 && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 400 }}>
            {activeAlarms.map(alarm => (
              <div key={alarm.id} className="modal" style={{ margin: 0, animation: 'slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
                <div className="modal-body" style={{ textAlign: 'center', padding: 30 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--danger-50)', color: 'var(--danger-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', animation: 'floatBg 2s infinite alternate' }}>
                    <BellRing size={32} />
                  </div>
                  <h2 style={{ fontSize: 20, color: 'var(--gray-900)', marginBottom: 8 }}>{alarm.type}</h2>
                  <p style={{ fontSize: 16, color: 'var(--gray-600)', marginBottom: 24 }}>{alarm.text}</p>
                  <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={() => dismissAlarm(alarm.id)}>
                    <Check size={18} /> Acknowledge
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
