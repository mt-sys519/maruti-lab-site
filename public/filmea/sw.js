// FILMEA's service worker: lets the page be installed as an app and open without a connection.
//
// The page itself (HTML, scripts, styles, the list of looks) is fetched from the network first, so a
// deploy shows up on the next visit; the saved copy is only used offline. The colour tables, sample
// photos, the rendered mounts and icons do not change under the same name, so they are served from the cache once fetched.
// Photos the visitor opens never pass through here: they are read from the device, not fetched.
const VERSION = 'filmea-v2';
const SHELL = [
  './', 'index.html', 'app.js', 'engine.js', 'loaders.js', 'print.js', 'style.css', 'presets.json',
  'icon.svg', 'icon-192.png', 'manifest.webmanifest', 'photos/person.jpg', 'i18n.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

const FIXED = /\/filmea\/(luts|photos|frames)\/|\/filmea\/icon[^/]*\.(png|svg)$/;

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith('/filmea/')) return;
  // the guide, FAQ and licence pages are ordinary pages; leave them to the browser
  if (/\/filmea\/(guide|faq)\/|licenses\.html$/.test(url.pathname)) return;
  e.respondWith(FIXED.test(url.pathname) ? cacheFirst(req) : networkFirst(req));
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') return (await caches.match('index.html')) || Response.error();
    throw err;
  }
}
