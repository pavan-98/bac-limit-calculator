// Service worker: makes the app load instantly and work with no signal
// (bars and basements often have bad network).
//
// Strategy: network first so updates ship straight away, but if the network
// hasn't answered within NETWORK_TIMEOUT_MS we serve the cached copy instead.
// Bump CACHE when the list of files changes.
const CACHE = 'can-i-drive-v1';
const NETWORK_TIMEOUT_MS = 3000;
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'script.js',
  'favicon.svg',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fromNetwork(request) {
  return fetch(request).then((response) => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  });
}

function fromCache(request) {
  return caches.match(request, { ignoreSearch: true }).then((hit) => {
    if (hit) return hit;
    // Any page in the app falls back to the cached home page.
    if (request.mode === 'navigate') return caches.match('./');
    return undefined;
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  const network = fromNetwork(request);
  // Keep the worker alive so a slow response still refreshes the cache.
  event.waitUntil(network.catch(() => {}));

  event.respondWith(
    new Promise((resolve, reject) => {
      let settled = false;
      const finish = (response) => {
        if (!settled && response) {
          settled = true;
          resolve(response);
        }
      };

      // Slow network: answer from cache if we have it.
      const timer = setTimeout(() => fromCache(request).then(finish), NETWORK_TIMEOUT_MS);

      network
        .then((response) => {
          clearTimeout(timer);
          finish(response);
        })
        .catch(() => {
          clearTimeout(timer);
          // Offline: cache or a plain error.
          fromCache(request).then((cached) => {
            if (cached) finish(cached);
            else if (!settled) reject(new Error('offline and not cached'));
          });
        });
    })
  );
});
