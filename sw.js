/* ============================================================
   sw.js — Service Worker（オフライン対応・高速起動）
   方針:
   - HTML/JS/CSS は network-first（オンライン時は常に最新。古いキャッシュに
     固定されない）。失敗時のみキャッシュへフォールバック＝圏外でも起動できる。
   - カード画像(asset/)は cache-first（不変アセット。2回目以降は即表示・通信ゼロ）。
   - クロスオリジン（Google Fonts / WebSocket）は触らない。
   バージョンを上げると activate で旧キャッシュを全部捨てる。
   ============================================================ */
const VERSION = 'v4';
const CACHE = 'dominion-' + VERSION;

// オフラインに最低限必要なファイル（盤面サムネ含む・約1MB）
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './css/style.css',
  './js/cards.js',
  './js/engine.js',
  './js/cpu.js',
  './js/store.js',
  './js/net.js',
  './js/audio.js',
  './js/ui.js',
];
const CARD_IDS = ['copper', 'silver', 'gold', 'estate', 'duchy', 'province', 'curse',
  'cellar', 'village', 'woodcutter', 'workshop', 'moat', 'militia', 'smithy', 'remodel', 'market', 'mine',
  // 拡張: 陰謀
  'courtyard', 'pawn', 'shanty_town', 'steward', 'wishing_well', 'baron', 'bridge',
  'conspirator', 'ironworks', 'mining_village', 'torturer', 'duke', 'nobles', 'harem'];
const THUMBS = CARD_IDS.map((id) => './asset/thumb/' + id + '.jpg');

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE.concat(THUMBS)))
      .catch(() => { /* 一部失敗しても起動は妨げない */ })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // フォント等のクロスオリジンは素通し

  // カード画像: cache-first（不変。ヒットすれば通信ゼロ）
  if (url.pathname.includes('/asset/')) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // それ以外（HTML/JS/CSS）: network-first（最新優先・圏外はキャッシュで起動）
  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
