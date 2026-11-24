/* Service worker de DrawingTogether (généré à la construction à partir de src/sw-template.js). */
const CACHE = 'drawingtogether-__VERSION__';
const ASSETS = __ASSETS__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('drawingtogether-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Seulement nos propres fichiers ; le temps réel et le stockage passent directement au réseau
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Page : réseau d'abord (pour avoir la dernière version), sinon la copie
    event.respondWith(fetch(req).catch(() => caches.match('index.html', { ignoreVary: true })));
    return;
  }
  event.respondWith(
    // ignoreVary : certains serveurs répondent « Vary: Origin », ce qui empêcherait de retrouver le fichier
    caches.match(req, { ignoreVary: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    })),
  );
});
