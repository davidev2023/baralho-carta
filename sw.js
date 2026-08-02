const CACHE_NAME = 'cacheta-pwa-v1';
const assets = [
  './index.html',
  './jogo.html',
  './css/style.css',
  './js/app.js',
  './js/game.js',
  './js/firebase.js',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      cache.addAll(assets);
    })
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request);
    })
  );
});
