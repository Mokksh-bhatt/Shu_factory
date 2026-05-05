// Shu Factory Alarm Service Worker
// Registered at /alarm-sw.js — handles loud background notifications
// Works independently from OneSignal so we get audio in background tabs

const VIBRATE_PATTERN = [600, 200, 600, 200, 600, 200, 1000, 400, 600, 200, 600];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Message from the app: show a notification + tell any open windows to play audio
self.addEventListener('message', (event) => {
  const { type, title, body, mode, tag } = event.data || {};

  if (type === 'SHOW_ALARM') {
    const notifTag = tag || `shu-alarm-${Date.now()}`;

    const notifPromise = self.registration.showNotification(title || 'Shu Factory', {
      body: body || '',
      icon: '/logo.jpg',
      badge: '/logo.jpg',
      tag: notifTag,
      requireInteraction: true,  // stays on screen until dismissed — critical for loud effect
      renotify: true,            // re-alert even if same tag exists
      silent: false,
      vibrate: VIBRATE_PATTERN,
      data: { mode: mode || 'worker' },
    });

    // Also tell any open windows to fire the audio alarm
    const msgPromise = self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        clients.forEach((c) => c.postMessage({ type: 'PLAY_ALARM', mode: mode || 'worker' }));
      });

    event.waitUntil(Promise.all([notifPromise, msgPromise]));
  }
});

// Push event (fires when the browser receives a push via our own subscription)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'Shu Factory';
  const body = data.body || '';
  const mode = data.mode || 'worker';

  const notifPromise = self.registration.showNotification(title, {
    body,
    icon: '/logo.jpg',
    badge: '/logo.jpg',
    tag: `shu-alarm-${Date.now()}`,
    requireInteraction: true,
    renotify: true,
    silent: false,
    vibrate: VIBRATE_PATTERN,
    data: { mode },
  });

  const msgPromise = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clients) => {
      clients.forEach((c) => c.postMessage({ type: 'PLAY_ALARM', mode }));
    });

  event.waitUntil(Promise.all([notifPromise, msgPromise]));
});

// Notification tapped: focus existing window or open a new one
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('/');
    })
  );
});
