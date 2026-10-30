/* Bibley service worker.
   Bump VERSION whenever index.html / pwa.js / bibley-features.* / icons change so phones pick up the update.
   - App shell: precached, served network-first (so a new version always wins when online).
   - Bible chapters from the text APIs: cache-first + refresh in the background
     (stale-while-revalidate), kept across versions in their own cache, so every
     chapter you've opened works offline.
   - AI requests (POST) are never touched.
   - Daily verse push: shows the verse sent by bibley-push.sites.tab.bot; tapping opens Bibley at that verse. */
const VERSION = 'bibley-v20';
const SHELL_CACHE = 'bibley-shell-' + VERSION;
const TEXT_CACHE = 'bibley-chapters-v1';   // NOT versioned: keeps his read chapters across app updates
const FONT_CACHE = 'bibley-fonts-v1';
const TEXT_LIMIT = 1500;                    // chapters kept (oldest trimmed)

const SHELL = [
  './', './index.html', './pwa.js', './bibley-features.js', './bibley-features.css', './bibley-notes.js', './bibley-notes.css', './bibley-studynb.js', './bibley-studynb.css', './bibley-device.js', './bibley-device.css', './bibley-settings.js', './bibley-settings.css', './bibley-nav.js', './bibley-nav.css', './bibley-ui16.css', './bibley-ai.js', './bibley-call.js', './bibley-call.css', './bibley-studio.js', './bibley-studio.css', './lostbooks.js', './lostbooks.css', './bibley-study.js', './bibley-wisdom.js', './bibley-wisdom.css', './bibley-scroll.js', './bibley-scroll.css', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-192.png', './icons/maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png'
];
// Bible text sources whose GET responses are safe to keep on the device.
// (api.esv.org is left out: Crossway's terms limit storing ESV text.)
const TEXT_HOSTS = ['bible-api.com', 'bolls.life', 'bible.helloao.org', 'labs.bible.org'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL_CACHE);
    await c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keep = [SHELL_CACHE, TEXT_CACHE, FONT_CACHE];
    for (const k of await caches.keys()) if (k.startsWith('bibley-') && !keep.includes(k)) await caches.delete(k);
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.enable(); } catch {} }
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
  if (e.data && e.data.type === 'version' && e.ports[0]) e.ports[0].postMessage(VERSION);
});

const json = (body, extra) => new Response(JSON.stringify(body), {
  status: 200, headers: { 'Content-Type': 'application/json', ...extra }
});

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length > TEXT_LIMIT) for (const k of keys.slice(0, keys.length - TEXT_LIMIT)) await cache.delete(k);
}

// Bible text: answer from the device if we have it, refresh it quietly in the background.
async function bibleText(e) {
  const req = e.request;
  const cache = await caches.open(TEXT_CACHE);
  const hit = await cache.match(req.url, { ignoreVary: true });
  const net = fetch(req.url, { mode: 'cors', credentials: 'omit' }).then(async res => {
    if (res.ok) { await cache.put(req.url, res.clone()); trim(cache); return res; }
    // A chapter this translation doesn't have (OEB, Cherokee NT-only, Hebrew OT-only...).
    // Hand the page a quiet marker instead of a red 404 in the console; the page turns
    // it back into its normal "isn't included in this version" message.
    if (res.status === 404) return json({}, { 'X-Bibley-Missing': '1' });
    return res;
  });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  try { return await net; }
  catch { return json({ offline: true }, { 'X-Bibley-Offline': '1' }); }
}

async function fonts(req) {
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
  } catch { return new Response('', { status: 200, headers: { 'Content-Type': 'text/css' } }); }
}

async function shell(e) {
  const req = e.request;
  const cache = await caches.open(SHELL_CACHE);
  try {
    const pre = e.preloadResponse ? await e.preloadResponse : null;
    const res = pre || await fetch(req);
    if (res.ok && res.type === 'basic') cache.put(req.mode === 'navigate' ? './index.html' : req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || (await cache.match('./'));
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // AI calls etc. go straight to the network
  const url = new URL(req.url);
  if (TEXT_HOSTS.includes(url.hostname)) { e.respondWith(bibleText(e)); return; }
  if (FONT_HOSTS.includes(url.hostname)) { e.respondWith(fonts(req)); return; }
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(new URL('./', self.location).pathname)) return;
  if (url.pathname.indexOf('/bibles/') >= 0) return;    // offline JSON Bibles: the page keeps them in IndexedDB itself
  e.respondWith(shell(e));
});

const PUSH_API = 'https://bibley-push.sites.tab.bot';
self.addEventListener('push', e => {
  let d = null;
  try { d = e.data ? e.data.json() : null; } catch (err) { d = null; }
  const show = m => self.registration.showNotification(m.title || 'Verse of the day', {
    body: m.body || 'Open Bibley for today\'s verse.', icon: './icons/icon-192.png', tag: m.tag || 'bibley-votd',
    data: { url: m.url || './', ref: m.ref || '' }
  });
  e.waitUntil(d && d.body ? show(d) : fetch(PUSH_API + '/today').then(r => r.json()).then(show).catch(() => show({})));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {};
  const url = new URL(data.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const c = list.find(w => w.url.startsWith(self.registration.scope));
    if (c) { if (data.ref) c.postMessage({ type: 'bibley-open-verse', ref: data.ref }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
