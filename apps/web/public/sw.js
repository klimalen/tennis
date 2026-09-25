// Navigations only. Other requests stay with the browser so the worker
// does not add a hop to images, data, or scripts. The offline page is the
// only thing kept in cache.
const OFFLINE_CACHE = 'tennis-offline-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then(async (cache) => {
      const response = await fetch(OFFLINE_URL, { cache: 'reload' })
      if (!response.ok) throw new Error('offline page unavailable')
      await cache.put(OFFLINE_URL, response)
      await self.skipWaiting()
    }),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(keys.filter((key) => key !== OFFLINE_CACHE).map((key) => caches.delete(key)))
      await self.clients.claim()
    }),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(OFFLINE_URL)
      return cached || Response.error()
    }),
  )
})
