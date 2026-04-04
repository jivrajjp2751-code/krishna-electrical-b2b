const CACHE_NAME = 'krishna-electrical-v4';
const OFFLINE_URLS = ['/'];

// ── Scheduled reminders stored inside the service worker ──
let scheduledReminders = [];

// Install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
  // Start the reminder checker loop
  startReminderChecker();
});

// Fetch — network-first strategy
self.addEventListener('fetch', (event) => {
  if (
    event.request.url.includes('supabase.co') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Listen for messages from the main app ──
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  if (type === 'SCHEDULE_REMINDERS') {
    // Replace the entire list of pending reminders
    scheduledReminders = (payload || []).filter(r => r.status === 'pending');
    // Immediately check so instant triggers are handled
    checkAndFireReminders();
  }

  if (type === 'ADD_REMINDER') {
    const existing = scheduledReminders.find(r => r.id === payload.id);
    if (!existing && payload.status === 'pending') {
      scheduledReminders.push(payload);
    }
  }

  if (type === 'REMOVE_REMINDER') {
    scheduledReminders = scheduledReminders.filter(r => r.id !== payload.id);
  }

  if (type === 'COMPLETE_REMINDER') {
    scheduledReminders = scheduledReminders.filter(r => r.id !== payload.id);
  }
});

// ── Periodic check loop (runs every 30 seconds) ──
let checkerInterval = null;

function startReminderChecker() {
  if (checkerInterval) clearInterval(checkerInterval);
  checkerInterval = setInterval(checkAndFireReminders, 30000); // 30 seconds
}

function checkAndFireReminders() {
  const now = new Date();
  const toFire = [];

  scheduledReminders = scheduledReminders.filter(r => {
    if (r.status !== 'pending') return false;

    const dateStr = r.targetDate;
    const timeStr = r.targetTime || '00:00';
    if (!dateStr) return true; // keep but don't fire (no date)

    const target = new Date(`${dateStr}T${timeStr}`);
    if (isNaN(target.getTime())) return true; // invalid date, keep

    if (now >= target) {
      toFire.push(r);
      return false; // remove from list after firing
    }
    return true; // keep, not yet time
  });

  toFire.forEach(r => {
    // Show system-level notification (works in background!)
    self.registration.showNotification('⏰ Reminder: ' + (r.type || 'Task'), {
      body: r.text || 'You have a scheduled reminder.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'reminder-' + r.id,
      requireInteraction: true, // Keep showing until user interacts
      vibrate: [200, 100, 200, 100, 200], // Vibrate pattern for mobile
      data: { reminderId: r.id, url: '/reminders' },
      actions: [
        { action: 'open', title: '📋 Open App' },
        { action: 'dismiss', title: '✓ Dismiss' }
      ]
    }).catch(() => {});

    // Notify the main app so it can mark as completed
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'REMINDER_FIRED', payload: { id: r.id } });
      });
    });
  });
}

// Start checker (also handles case where SW wakes up)
startReminderChecker();

// ── Handle notification clicks ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/reminders';

  if (event.action === 'dismiss') {
    return; // Just close
  }

  // Open the app or focus existing window
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Try to focus an existing window
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Open a new window
      return self.clients.openWindow(url);
    })
  );
});
