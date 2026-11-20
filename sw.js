/* Copie Service Worker —— 外壳缓存优先秒开，后台拉新版，拉到了通知页面自己刷新 */
const CACHE = 'copie-v24';
const ASSETS = ['./', './index.html', './guide.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== location.origin) return; // 站外请求（如 GitHub API）不缓存，避免同步拿到过期 sha
  if (u.search) return; // 带参数的请求（如分享入口）不缓存
  if (u.pathname.endsWith('.apk')) return; // APK 永远走网络，避免装到旧包
  const isHome = u.pathname === new URL('./', self.registration.scope).pathname
    || u.pathname === new URL('./index.html', self.registration.scope).pathname;
  if (req.mode === 'navigate' || isHome) {
    // 页面只读取自己的缓存，教程等路径不能用首页兜底。
    const storage = caches.open(CACHE);
    const cached = storage.then(cache => cache.match(req));
    const refreshed = Promise.all([storage, cached]).then(async ([cache, hit]) => {
      const response = await fetch(req);
      if (!response.ok) return response;
      const changed = isHome && hit && (await hit.clone().text()) !== (await response.clone().text());
      await cache.put(req, response.clone());
      if (changed) {
        const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        pages.forEach(page => page.postMessage({ type: 'copie-updated' }));
      }
      return response;
    });
    e.waitUntil(refreshed.catch(() => {}));
    e.respondWith(cached.then(hit => hit || refreshed));
    return;
  }
  // 其它静态资源（图标等）：缓存优先，省流量
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }))
  );
});
