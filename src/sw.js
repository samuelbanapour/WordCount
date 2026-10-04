// Service worker: caches the app so it works offline once installed.
const CACHE = "wordcount-v3";
const ASSETS = ["./", "index.html", "style.css", "app.js", "wordcount.js", "thesaurus.js", "manifest.webmanifest", "icon.svg"];
// Large data that rarely changes: served from the cache once downloaded (bump CACHE to refresh).
const CACHE_FIRST = ["thesaurus.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

function fetchAndCache(request) {
  return fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  });
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const { pathname } = new URL(event.request.url);
  if (CACHE_FIRST.some((file) => pathname.endsWith("/" + file))) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetchAndCache(event.request)));
    return;
  }
  // Network first, falling back to the cache when offline.
  event.respondWith(
    fetchAndCache(event.request).catch(() =>
      caches.match(event.request).then((r) => r || caches.match("index.html"))
    )
  );
});
