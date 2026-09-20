/* Copie Service Worker —— 外壳缓存优先秒开，后台拉新版，拉到了通知页面自己刷新 */
const CACHE = 'copie-v23';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

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
  const isDoc = req.mode === 'navigate' || u.pathname === '/' || u.pathname.endsWith('/') || u.pathname.endsWith('index.html');
  if (isDoc) {
    // 应用外壳：有缓存立刻用缓存开页（不白屏）；同时后台拉一次网络，内容和缓存不一样就更新缓存并通知页面自己刷新
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = (await cache.match(req)) || (await cache.match('./index.html'));
      const refresh = (async () => {
        try {
          const res = await fetch(req);
          if (!res || !res.ok) return;
          const fresh = await res.clone().text();
          const old = hit ? await hit.clone().text() : null;
          await cache.put(req, res);
          if (old !== null && old !== fresh) {
            const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
            cs.forEach(c => c.postMessage({ type: 'copie-updated' }));
          }
        } catch (_) {}
      })();
      if (hit) { e.waitUntil(refresh); return hit; }
      await refresh; // 第一次装、还没缓存：只能等网络
      return (await cache.match(req)) || fetch(req);
    })());
    return;
  }
  // 其它静态资源（图标等）：缓存优先，省流量
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
