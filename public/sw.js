// 快取策略:
// - 頁面(HTML 導覽):network-first,離線時才用快取。
//   舊版是 cache-first 且快取名稱固定,部署新版後使用者會一直拿到舊 HTML,
//   舊 HTML 引用的 JS chunk 在新部署中已不存在,導致頁面壞掉。
// - /_next/static/ 與圖示等靜態檔:檔名含 hash、內容不變,cache-first。
// - API 與其他請求:不經過 Service Worker。
// 修改快取策略時請遞增 CACHE_NAME,activate 會清掉舊快取。
const CACHE_NAME = 'assetdash-v2';
const OFFLINE_FALLBACK = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_FALLBACK)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/')
    || /\.(?:svg|png|ico|webp|jpg|jpeg|woff2?)$/.test(url.pathname)
    || url.pathname === '/manifest.json';
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_FALLBACK)))
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
  }
});
