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

const VERSION = "v2";
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

/**
 * Does this file's name carry its own fingerprint?
 *
 * This is the question the whole asset cache turns on, and the previous
 * version got it wrong by assuming the answer was always yes for anything
 * under /_next/static/. Most built files do carry a content hash — change the
 * file and the name changes with it, so a cached copy can never be the wrong
 * copy. But App Router route chunks are served at plain paths like
 * /_next/static/chunks/app/admin/rentals/page.js, and those names stay the
 * same while their contents change.
 *
 * Caching one of those forever is how somebody ends up staring at
 * "Application error" with yesterday's JavaScript and no way to clear it —
 * which is exactly the trap this worker was written to avoid, left open at
 * the one door nobody checked.
 *
 * So: a long run of hex in the name means immutable. Everything else is
 * fetched fresh, with the cached copy kept only for when there is no signal.
 */
function isImmutable(pathname) {
  return /(^|[/.-])[0-9a-f]{8,}([/.]|$)/i.test(pathname);
}

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

  const cacheable =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(png|jpg|jpeg|svg|webp|woff2?)$/.test(url.pathname);

  if (!cacheable) return;

  const immutable = isImmutable(url.pathname);

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);

      // A file whose name carries its own fingerprint can be served from the
      // cache forever, because a changed file gets a different name.
      if (immutable && cached) return cached;

      try {
        const response = await fetch(request);
        if (response.ok) {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put(request, copy));
        }
        return response;
      } catch {
        // Offline. A possibly-stale copy beats nothing.
        if (cached) return cached;
        throw new Error("Offline and not cached");
      }
    })(),
  );
});
