/* Copie Service Worker —— 网络优先：联网永远最新，断网用缓存兜底 */
const CACHE = 'copie-v20';
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
    // 应用外壳：网络优先，拿到就更新缓存；断网才回退缓存 → 打开即最新，无需刷新/升版本
    e.respondWith(
      fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then(h => h || caches.match('./index.html')))
    );
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
