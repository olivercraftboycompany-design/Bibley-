/* bibley-focus.js - Bibley 6.6: Focus mode switch for the Bibley app 2.3 bridge (window.BibleyFocus).
   Focus mode only turns on the phone's Do Not Disturb and full screen (the app hides the status bar).
   It changes nothing inside Bibley. Without the bridge (website, PWA, app 2.2 or older) there is no
   Focus control at all: window.BibleyFocusUI stays undefined and Settings / the More menu show nothing.
   No storage keys: the app keeps the on/off state itself (it survives restarts). */
(() => {
  "use strict";
  const F = window.BibleyFocus;
  let native = false;
  try { native = !!(F && typeof F.isSupported === "function" && F.isSupported()); } catch (e) { native = false; }
  if (!native) return;

  const ICON = '<svg class="ui-ic" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".9" fill="currentColor"/></svg>';
  const ASK = "Allow Do Not Disturb access for Bibley";
  const parse = s => { if (s && typeof s === "object") return s; try { return JSON.parse(s) || {}; } catch (e) { return {}; } };
  const call = (fn, dflt) => { try { return typeof F[fn] === "function" ? F[fn]() : dflt; } catch (e) { return dflt; } };

  let on = false, access = true;
  const subs = new Set();
  function emit() {
    document.documentElement.classList.toggle("bf-on", on);
    subs.forEach(fn => { try { fn(get()); } catch (e) {} });
    bar(!!(on && !access && bar.wanted));
  }
  function get() { return { on, access, needsAccess: on && !access }; }
  function read(d) {
    if (d && typeof d === "object") {
      if (typeof d.on === "boolean") on = d.on;
      if (typeof d.access === "boolean") access = d.access;
    }
  }
  function sync() { on = !!call("isOn", false); access = !!call("hasAccess", true); emit(); }

  function enable(opts) {
    access = !!call("hasAccess", true);
    read(parse(call("enable", "{}")));
    on = true;
    if (!access) bar.wanted = !(opts && opts.quiet);
    emit();
  }
  function disable() { read(parse(call("disable", "{}"))); on = false; bar.wanted = false; emit(); }
  function set(v, opts) { if (v) enable(opts); else disable(); }
  function requestAccess() { call("requestAccess", false); }

  // One quiet line with an Allow button, shown when Focus is on but DND access isn't granted.
  let barEl = null;
  function bar(show) {
    if (!show) { if (barEl) { barEl.remove(); barEl = null; } return; }
    if (barEl) return;
    barEl = document.createElement("div"); barEl.className = "bf-ask"; barEl.setAttribute("role", "status");
    barEl.innerHTML = ICON + "<span>" + ASK + '</span><button type="button" class="fx-btn small primary" data-bf="allow">Allow</button><button type="button" class="bf-x" data-bf="x" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    barEl.querySelector('[data-bf="allow"]').onclick = requestAccess;
    barEl.querySelector('[data-bf="x"]').onclick = () => { bar.wanted = false; bar(false); };
    document.body.appendChild(barEl);
  }
  bar.wanted = false;

  window.addEventListener("bibley-focus-change", e => { read(parse(e && e.detail)); emit(); });
  window.addEventListener("bibley-focus-access", e => {
    const d = parse(e && e.detail);
    access = typeof d.access === "boolean" ? d.access : !!call("hasAccess", access);
    if (typeof d.on === "boolean") on = d.on;
    // Granted while Focus is on: make sure DND is applied (the app usually does it itself at this moment).
    if (access && on && !(d.dnd === "applied" || d.dnd === "already_on" || d.dndByBibley || d.dndActive)) read(parse(call("enable", "{}")));
    if (access) bar.wanted = false;
    emit();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) sync(); });

  window.BibleyFocusUI = { supported: true, icon: ICON, ask: ASK, get, set, enable, disable, requestAccess, sync,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); } };
  sync();
})();
