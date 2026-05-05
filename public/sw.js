// KILL SWITCH FOR OLD SERVICE WORKER
// This new version immediately unregisters itself.
// We removed client.navigate() because it caused an infinite reload loop if an older
// version of main.jsx was still registering the service worker.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration.unregister().then(() => {
      console.log('Stale SW unregistered successfully.');
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Always fetch from network to ensure the user gets the latest index.html and main.jsx
  // Add a cache-busting query parameter for HTML files to bypass browser HTTP cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request.url + '?v=' + Date.now()).catch(() => fetch(event.request))
    );
  } else {
    event.respondWith(fetch(event.request));
  }
});
