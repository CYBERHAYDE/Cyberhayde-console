/* CyberHayde console service worker.
   - The console page is ALWAYS fetched fresh from your host (it ignores every browser cache), so a new version shows up
     the next time the page opens. If the network is slow or off, the last copy it saw is used instead, so the console still opens.
   - It only touches files from the same site as the console. Calls to Google (sync, your clients) pass straight through.
   - To release a change to THIS file, change the number on the next line. */
const SW_VERSION = '2';
const CACHE = 'chconsole-sw-' + SW_VERSION;

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    const keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});

function keyOf(url) { const u = new URL(url); u.search = ''; u.hash = ''; return u.toString(); }

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // Google and everything else: not ours
  e.respondWith((async function () {
    const cache = await caches.open(CACHE), key = keyOf(req.url);
    const network = fetch(req.url, { cache: 'no-store' }).then(function (r) {
      if (r && r.ok) cache.put(key, r.clone());
      return r;
    });
    const cached = await cache.match(key);
    if (!cached) { try { return await network; } catch (err) { return Response.error(); } }
    // Newest copy if the network answers within 4 seconds, otherwise the saved one (the fetch still refreshes the saved copy).
    const slow = new Promise(function (res) { setTimeout(function () { res(cached); }, 4000); });
    try { return await Promise.race([network, slow]); } catch (err) { return cached; }
  })());
});
