import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

// ── Register Service Worker for notifications + PWA ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('[SW] Registered:', reg.scope);
        window.__swRegistration = reg;
        // After registration, sync current reminders to the SW
        syncRemindersToSW();
      })
      .catch(err => console.warn('[SW] Registration failed:', err));
  });
}

// Helper: Send all pending reminders to the service worker
export function syncRemindersToSW() {
  try {
    const data = localStorage.getItem('customReminders');
    const reminders = data ? JSON.parse(data) : [];
    const pending = reminders.filter(r => r.status === 'pending');
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SCHEDULE_REMINDERS',
        payload: pending
      });
    }
  } catch { /* ignore */ }
}

// Listen for fired reminder messages from SW
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'REMINDER_FIRED') {
      // dynamically import to avoid circular dependencies
      const id = event.data.payload?.id;
      if (id) {
        try {
          const data = localStorage.getItem('customReminders');
          const reminders = data ? JSON.parse(data) : [];
          const updated = reminders.map(r => r.id === id ? { ...r, status: 'completed' } : r);
          localStorage.setItem('customReminders', JSON.stringify(updated));
          // Trigger a storage event so the store can pick it up
          window.dispatchEvent(new Event('reminder-fired'));
        } catch { /* ignore */ }
      }
    }
  });
}
