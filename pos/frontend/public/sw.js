self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

const CACHE = 'pos-v1'
const ASSETS = ['/', '/index.html', '/manifest.webmanifest']

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(req)
      if (cached) return cached
      try {
        const res = await fetch(req)
        if (res && res.status === 200 && res.type === 'basic') {
          cache.put(req, res.clone())
        }
        return res
      } catch (err) {
        return cached || Response.error()
      }
    })()
  )
})