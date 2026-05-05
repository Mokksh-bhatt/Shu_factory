// KILL SWITCH FOR OLD SERVICE WORKER
// If a browser is still running this old sw.js, it will download this update.
// This new version immediately unregisters itself and reloads the page,
// breaking the user out of the cache loop so they get the new OneSignal logic.

self.addEventListener('install', () => {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration.unregister().then(() => {
      return self.clients.matchAll();
    }).then((clients) => {
      // Force all clients to reload to get the fresh index.html
      clients.forEach(client => {
        if (client.url && "navigate" in client) {
          client.navigate(client.url);
        }
      });
    })
  );
});

// Pass through all network requests so we don't break anything while unregistering
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
