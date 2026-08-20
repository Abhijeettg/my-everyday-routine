/*
 * Offline shell for My Everyday Routine.
 *
 * Deliberately has no build-time precache manifest: Vite emits hashed filenames,
 * and a manifest that drifts out of sync with them is worse than none. Instead
 * the shell is cached on install and everything else is cached the first time it
 * is fetched, so the second visit works with the network off.
 *
 * Your data is NOT cached here. It lives in localStorage (written by the app on
 * every change) and, when a server is reachable, in tracker.json. Caching API
 * responses would mean serving yesterday's numbers as though they were current.
 */
const VERSION = 'v21';
const SHELL = `routine-shell-${VERSION}`;
const ASSETS = `routine-assets-${VERSION}`;

// Filled in at build time by scripts/precache.mjs with the real hashed
// filenames. The fallback list keeps a dev build working.
const PRECACHE = [
  './',
  './index.html',
  './assets/Checkout-DUnIKDaE.js',
  './assets/Countdown-6-_L38PE.js',
  './assets/Dashboard-BaPrdGz0.js',
  './assets/DeadlinesPage-Cb29YL3u.js',
  './assets/GlowCard-BQ66Tnzo.js',
  './assets/Journal-MNCU_aA0.js',
  './assets/Money-DMJ-oyaX.js',
  './assets/Review-DMSAwpH2.js',
  './assets/arrow-right-Bo4Yoq4D.js',
  './assets/chevron-right-Cy5fNQ3v.js',
  './assets/coins-CIUV7aFu.js',
  './assets/flag-DYXj4-pd.js',
  './assets/index-BkrA9QOJ.js',
  './assets/index-DEoH5RpP.css',
  './assets/maximize-2-B2-RrLp2.js',
  './assets/sparkles-IwIIu7YD.js',
  './assets/trending-up-Ce7XOUUK.js',
  './favicon.svg',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  './manifest.webmanifest',
];
const SHELL_URLS = PRECACHE;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // one bad URL must not fail the whole install
    await Promise.allSettled(SHELL_URLS.map(u => cache.add(u)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k.startsWith('routine-') && !k.endsWith(VERSION))
          .map(k => caches.delete(k)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Live data: always go to the network. If it is down the app falls back to
  // localStorage on its own, which is newer than anything a cache would hold.
  if (url.pathname.startsWith('/api/')) return;

  // Navigation: serve the app shell so a deep link works with no network.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      const cached = await cache.match(SHELL_URLS[1]) ?? await cache.match(SHELL_URLS[0]);

      const network = fetch(request).then(res => {
        if (res && res.ok) cache.put(SHELL_URLS[1], res.clone());
        return res;
      }).catch(() => null);

      // Nothing to fall back on, so there is no choice but to wait.
      if (!cached) return (await network) ?? Response.error();

      // Otherwise give the network a short moment to win — a fresh build should
      // still arrive first on a decent connection — and hand over the cached
      // shell the instant it does not. Refreshing used to wait on the network
      // every single time, which on a phone is what made it feel broken.
      const patience = new Promise(resolve => setTimeout(() => resolve(null), 600));
      const quick = await Promise.race([network, patience]);
      event.waitUntil(network);     // keep updating even when the cache was served
      return quick ?? cached;
    })());
    return;
  }

  // Everything else: serve from cache, and refresh it in the background so a
  // new build is picked up without ever blocking on the network.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    const network = fetch(request).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        caches.open(ASSETS).then(c => c.put(request, res.clone()));
      }
      return res;
    }).catch(() => null);
    return cached ?? (await network) ?? Response.error();
  })());
});
