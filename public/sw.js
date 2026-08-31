/**
 * Service worker for Room Within.
 *
 * A service worker sits between the site and the network and can serve pages
 * from its own cache. That is what makes the site usable with no signal — and
 * also what makes a careless one dangerous, because a stale page cached
 * forever is very hard for an ordinary person to clear.
 *
 * So the rules here are deliberately cautious:
 *
 *   - Pages are fetched from the network first, always. The cache is only a
 *     fallback for when the network fails. Nobody ever sees yesterday's page
 *     because the network was fine and the cache was quicker.
 *   - Only GET requests are touched. Anything that changes data — signing up
 *     for a class, saving a booking — goes straight to the network, every time.
 *   - Admin pages and API routes are never cached at all. They are private,
 *     and a cached copy of somebody's invoice is exactly the thing not to
 *     leave on a shared phone.
 *   - Bumping VERSION throws away every old cache on the next visit, so a bad
 *     cache can always be cleared by shipping a new version.
 */

const VERSION = "v1";
const SHELL = `roomwithin-shell-${VERSION}`;
const PAGES = `roomwithin-pages-${VERSION}`;

/** Enough to render something recognisable with no connection. */
const PRECACHE = [
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/logo-lockup.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      // A precache miss must not stop the worker installing — the site works
      // without it, just less gracefully offline.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL && key !== PAGES)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Things that must never be served from a cache. */
function isPrivate(url) {
  return (
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/portal") ||
    url.pathname.startsWith("/my-bookings") ||
    url.pathname.startsWith("/counselling")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Someone else's server is not ours to cache.
  if (url.origin !== self.location.origin) return;

  if (isPrivate(url)) return;

  // Pages: network first, cache only as a fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(PAGES).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached ?? caches.match("/offline");
        }),
    );
    return;
  }

  // Built assets carry a hash in the filename, so a cached copy is always the
  // right copy. Images and fonts are safe to serve from cache too.
  const cacheable =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(png|jpg|jpeg|svg|webp|woff2?)$/.test(url.pathname);

  if (!cacheable) return;

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
