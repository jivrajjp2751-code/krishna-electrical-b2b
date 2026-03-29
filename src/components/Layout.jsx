import { useEffect, useCallback, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { BellRing, Check } from 'lucide-react';
import useStore from '../store/useStore';
import Sidebar from './Sidebar';
import Header from './Header';

// Helper to sync reminders to SW
function syncRemindersToSW(reminders) {
  try {
    const pending = (reminders || []).filter(r => r.status === 'pending');
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SCHEDULE_REMINDERS',
        payload: pending
      });
    }
  } catch { /* ignore */ }
}

export default function Layout() {
  const sidebarCollapsed = useStore(s => s.sidebarCollapsed);
  const sidebarMobileOpen = useStore(s => s.sidebarMobileOpen);
  const closeMobileSidebar = useStore(s => s.closeMobileSidebar);
  const customReminders = useStore(s => s.customReminders) || [];
  const completeCustomReminder = useStore(s => s.completeCustomReminder);
  const activeAlarms = useStore(s => s.activeAlarms) || [];
  const triggerAlarm = useStore(s => s.triggerAlarm);
  const dismissAlarm = useStore(s => s.dismissAlarm);
  const addToast = useStore(s => s.addToast);
  const firedIdsRef = useRef(new Set());

  // Request notification permission on first load
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          addToast('Notifications enabled! You\'ll receive reminders even when the app is in the background.', 'success');
        }
      });
    }
  }, []);

  // Sync reminders to service worker whenever they change
  useEffect(() => {
    syncRemindersToSW(customReminders);
  }, [customReminders]);

  // Listen for SW-fired reminders (background notifications)
  useEffect(() => {
    const handleSWMessage = (event) => {
      if (event.data?.type === 'REMINDER_FIRED') {
        const id = event.data.payload?.id;
        if (id && !firedIdsRef.current.has(id)) {
          firedIdsRef.current.add(id);
          // Find the reminder and show in-app popup
          const reminder = customReminders.find(r => r.id === id);
          if (reminder) {
            triggerAlarm(reminder);
          }
          completeCustomReminder(id);
        }
      }
    };

    const handleStorageEvent = () => {
      // Reload from localStorage when SW fires
      try {
        const data = localStorage.getItem('customReminders');
        const updated = data ? JSON.parse(data) : [];
        // Force store update handled by syncFromServer or page reload
      } catch { /* ignore */ }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }
    window.addEventListener('reminder-fired', handleStorageEvent);

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
      window.removeEventListener('reminder-fired', handleStorageEvent);
    };
  }, [customReminders, completeCustomReminder, triggerAlarm]);

  // Fallback: In-app checker for when SW isn't available or page is in foreground
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      customReminders.forEach(r => {
        if (r.status !== 'pending' || firedIdsRef.current.has(r.id)) return;
        if (!r.targetDate) return;

        const timeStr = r.targetTime || '00:00';
        const target = new Date(`${r.targetDate}T${timeStr}`);
        if (isNaN(target.getTime())) return;

        if (now >= target) {
          firedIdsRef.current.add(r.id);

          // Show system notification (in case SW didn't catch it)
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              // Use SW registration for persistent notification
              if (window.__swRegistration) {
                window.__swRegistration.showNotification('⏰ Reminder: ' + (r.type || 'Task'), {
                  body: r.text || 'You have a scheduled reminder.',
                  icon: '/icon-192.png',
                  badge: '/icon-192.png',
                  tag: 'reminder-' + r.id,
                  requireInteraction: true,
                  vibrate: [200, 100, 200, 100, 200],
                  data: { reminderId: r.id, url: '/reminders' }
                });
              } else {
                // Fallback to basic notification
                new Notification('⏰ Reminder: ' + (r.type || 'Task'), {
                  body: r.text || 'You have a scheduled reminder.',
                  icon: '/icon-192.png',
                  tag: 'reminder-' + r.id,
                  requireInteraction: true
                });
              }
            } catch { /* ignore */ }
          }

          // Show in-app alarm
          triggerAlarm(r);
          // Mark as completed
          completeCustomReminder(r.id);
        }
      });
    };

    // Check every 15 seconds (more reliable than 60 seconds)
    const intervalId = setInterval(checkReminders, 15000);
    // Also check immediately on mount
    checkReminders();

    return () => clearInterval(intervalId);
  }, [customReminders, completeCustomReminder, triggerAlarm]);


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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 400, padding: 16 }}>
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
