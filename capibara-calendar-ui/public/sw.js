// The shell of the app, so that it opens without the network: the pages and the files of the build.
// What is asked of the calendar servers is never kept here: the events are in the database of the
// app (IndexedDB), and are asked for again when there is a network.
const shell = 'capibara-shell-v1'

self.addEventListener('install', () => {
  void self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== shell) await caches.delete(key)
      }
      await self.clients.claim()
    })(),
  )
})

const isOfTheServers = (url) =>
  url.pathname.startsWith('/api/') || url.pathname.startsWith('/radicale/')

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || isOfTheServers(url)) return

  if (request.mode === 'navigate') {
    // The page: from the network when there is one, and the one that was kept when there is not.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(shell).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(async () => (await caches.match('/')) ?? Response.error()),
    )
    return
  }

  // The files of the build have a name that changes with them, and the icons do not change.
  event.respondWith(
    caches.match(request).then(
      (kept) =>
        kept ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            void caches.open(shell).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
