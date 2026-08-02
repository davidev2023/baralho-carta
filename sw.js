const CACHE_NAME = 'cacheta-pwa-v2';
const assets = [
  './index.html',
  './jogo.html',
  './css/style.css',
  './js/app.js',
  './js/game.js',
  './js/firebase.js',
  './manifest.json',
  './logo.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assets);
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
