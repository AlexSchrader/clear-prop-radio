/* Clear Prop Radio service worker.
   Caches the app shell and the lazily loaded worldwide airport file so searches work offline.
   Bump CACHE whenever airports-world.json is rebuilt. Only registered over https (GitHub Pages). */
const CACHE = "cpr-v2";
const DATA = "airports-world.json";

self.addEventListener("install", e => { self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  const isData = req.url.endsWith(DATA);
  e.respondWith(isData ? cacheFirst(req) : networkFirst(req));
});
async function cacheFirst(req) {
  const c = await caches.open(CACHE), hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) c.put(req, res.clone());
  return res;
}
async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) c.put(req, res.clone());
    return res;
  } catch (err) {
    return (await c.match(req)) || (await c.match("./")) || Response.error();
  }
}
