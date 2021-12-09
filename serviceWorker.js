const APNEA_CACHE = 'apneaCache'

const ASSETS = [
  "./",
  "./index.html",
  "./static/main.css",
  "./static/main.js",
  "./static/icons/android-chrome-512x512.png",
  "./static/icons/android-chrome-192x192.png",
  "./static/icons/apple-touch-icon.png",
  "./static/icons/favicon-16x16.png",
  "./static/icons/favicon-32x32.png",
]

self.addEventListener("install", installEvent =>
  installEvent.waitUntil(
    caches.open(APNEA_CACHE)
      .then(cache => cache.addAll(ASSETS))
  )
)

self.addEventListener('activate', _ =>
  console.log("service worker activated")
)

self.addEventListener("fetch", fetchEvent => 
  fetchEvent.respondWith(
    caches.match(fetchEvent.request)
      .then(res => res || fetch(fetchEvent.request))
  )
)