/* Bibley PWA: service worker, Install button, offline banner, update notice.
   Kept separate from the reader script so the reader works with or without it. */
(() => {
  const $ = id => document.getElementById(id);
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: minimal-ui)').matches || navigator.standalone === true;
  const DISMISS_KEY = 'bibley_install_dismissed_v1';
  let deferredPrompt = null;

  function toast(msg, ms) {
    const t = $('pwaToast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms || 3200);
  }
  window.bibleyToast = toast;

  /* ---------- service worker ---------- */
  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { scope: './' }).then(reg => {
        // Check for a new version whenever the app comes back to the foreground.
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
      }).catch(err => console.warn('Service worker not registered', err));
    });
    let refreshed = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || refreshed) return;   // first install: nothing to announce
      refreshed = true;
      toast('Bibley updated ✓');
    });
  }

  /* ---------- install button ---------- */
  const pill = $('installPill'), pillBtn = $('installPillBtn'), pillClose = $('installPillClose'), drawerBtn = $('installDrawerBtn');
  function dismissedRecently() { try { return Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < 3 * 864e5; } catch { return false; } }
  function showInstall(show) {
    const on = show && !isStandalone();
    if (drawerBtn) drawerBtn.hidden = !on;
    if (pill) pill.hidden = !(on && !dismissedRecently());
  }
  async function doInstall() {
    if (!deferredPrompt) { toast('Tap ⋮ in Chrome → "Add to Home screen" or "Install app"', 5000); return; }
    deferredPrompt.prompt();
    let outcome = 'dismissed';
    try { ({ outcome } = await deferredPrompt.userChoice); } catch {}
    deferredPrompt = null;
    if (outcome === 'accepted') showInstall(false);
  }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; showInstall(true); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; showInstall(false); toast('Installed! Bibley is on your home screen 📖', 4000); });
  if (pillBtn) pillBtn.addEventListener('click', doInstall);
  if (drawerBtn) drawerBtn.addEventListener('click', doInstall);
  if (pillClose) pillClose.addEventListener('click', () => { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {} if (pill) pill.hidden = true; });
  const mq = matchMedia('(display-mode: standalone)');
  if (mq.addEventListener) mq.addEventListener('change', () => { if (isStandalone()) showInstall(false); });
  showInstall(false);

  /* ---------- offline banner ---------- */
  const bar = $('offlineBar');
  function updOnline() {
    if (!bar) return;
    bar.hidden = navigator.onLine;
    document.body.classList.toggle('is-offline', !navigator.onLine);
  }
  window.addEventListener('online', () => { updOnline(); toast('Back online'); });
  window.addEventListener('offline', updOnline);
  updOnline();
})();

/* Download-the-Android-app pill: only in Android browsers, never inside the app itself. Dismiss is remembered. */
;(function () {
  var KEY = 'bibley_apk_pill_dismissed', HREF = 'https://oliver-apps.sites.tab.bot/apks/Bibley.apk';
  try {
    var ua = navigator.userAgent || '';
    if (!/Android/i.test(ua) || /OliverApp\//.test(ua) || window.AndroidApp || window.__isAndroidApp) return;
    if (location.hostname === 'appassets.androidplatform.net') return;
    if (localStorage.getItem(KEY) === '1') return;
  } catch (e) { return; }
  function show() {
    if (!document.body || document.getElementById('apk-pill')) return;
    var w = document.createElement('div');
    w.id = 'apk-pill';
    w.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:2147483000;' +
      'display:flex;align-items:center;max-width:calc(100vw - 24px);box-sizing:border-box;background:#111a2f;color:#e8e1d0;border:1px solid #2a3658;' +
      'border-radius:999px;box-shadow:0 6px 22px rgba(0,0,0,.35);font:600 12px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:0 2px 0 0;';
    var a = document.createElement('a');
    a.href = HREF;
    a.rel = 'noopener';
    a.style.cssText = 'display:flex;align-items:center;gap:7px;padding:8px 4px 8px 12px;color:inherit;text-decoration:none;white-space:nowrap;overflow:hidden;min-width:0;';
    a.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style="flex:none"><path fill="#c9a867" d="M17.6 9.48l1.84-3.18a.63.63 0 0 0-1.09-.63l-1.88 3.24a11.43 11.43 0 0 0-8.94 0L5.65 5.67a.63.63 0 0 0-1.09.63L6.4 9.48A10.78 10.78 0 0 0 1 18h22a10.78 10.78 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z"/></svg>' +
      '<span style="overflow:hidden;text-overflow:ellipsis">Download the full release app for Android</span>';
    var x = document.createElement('button');
    x.type = 'button';
    x.setAttribute('aria-label', 'Dismiss');
    x.style.cssText = 'flex:none;width:30px;height:30px;margin:0;padding:0;border:0;border-radius:50%;background:transparent;color:inherit;opacity:.65;cursor:pointer;display:flex;align-items:center;justify-content:center;';
    x.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.3 5.71L12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.71 2.88 18.3 9.17 12 2.88 5.71 4.29 4.3l6.3 6.29 6.29-6.3z"/></svg>';
    x.onclick = function (e) { e.preventDefault(); try { localStorage.setItem(KEY, '1'); } catch (er) {} if (w.parentNode) w.parentNode.removeChild(w); };
    w.appendChild(a);
    w.appendChild(x);
    document.body.appendChild(w);
    place();
    setTimeout(place, 1500);
    window.addEventListener('resize', place);
  }
  /* Sit above anything already pinned to the bottom of the screen (tab bars, players, round + buttons). */
  function place() {
    var w = document.getElementById('apk-pill');
    if (!w) return;
    var h = window.innerHeight, top = h, els = document.body.getElementsByTagName('*');
    for (var i = 0; i < els.length && i < 6000; i++) {
      var el = els[i];
      if (el === w || w.contains(el)) continue;
      var cs = window.getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 24 || r.height > h * 0.4) continue;
      if (r.bottom >= h - 40 && r.bottom <= h + 2 && r.top > h * 0.5 && r.top < top) top = r.top;
    }
    w.style.bottom = top < h ? 'calc(' + Math.round(h - top + 10) + 'px + env(safe-area-inset-bottom,0px))' : 'calc(16px + env(safe-area-inset-bottom,0px))';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
})();
