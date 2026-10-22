// sw.js - service worker for the installable CashBook app.
// It does ONE thing: if the phone has no internet when a page is opened, show a
// friendly "You are offline" page instead of the browser's error screen.
// Everything else (your data, scripts, styles) always goes straight to the network,
// so you never see an old copy of the site after an update.
const CACHE = "cashbook-offline-v1";
const OFFLINE_PAGE = "offline.html";

self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(CACHE).then(function (cache) {
            return cache.addAll([OFFLINE_PAGE]);
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys()
            .then(function (names) {
                return Promise.all(names.filter(function (name) { return name !== CACHE; })
                    .map(function (name) { return caches.delete(name); }));
            })
            .then(function () { return self.clients.claim(); })
    );
});

self.addEventListener("fetch", function (event) {
    // Only page navigations are handled; all other requests are left alone.
    if (event.request.mode !== "navigate") return;

    event.respondWith(
        fetch(event.request).catch(function () {
            return caches.match(OFFLINE_PAGE);
        })
    );
});
