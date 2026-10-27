/* bibley-device.js - Bibley 5.8 "Device" settings.
   Settings > Device: home-screen widgets, notification quiet hours / pause, and "Time with God"
   (a focus mode: calm full-screen view, prayer timer, app notifications muted and, in the Android app,
   the phone's own Do Not Disturb for the session).
   Native parts live in the Android app (window.BibleyDeviceNative). On the website those controls are shown
   disabled with "Available in the Android app"; the Time with God timer itself works everywhere.
   New storage only: localStorage "bibley_device_v1" (choices), "bibley_focus_v1" (the running session) and
   "bibley_push_v1" (daily verse push on the website).
   Nothing older is read-modified-written. ASCII only in this file (symbols are written as escapes). */
(() => {
  "use strict";
  if (window.BibleyDevice) return;
  const FX = window.BibleyFX, C = window.BibleyCore;
  if (!FX || !C) { console.warn("Bibley device: features missing"); return; }
  const NAT = (window.BibleyDeviceNative && typeof window.BibleyDeviceNative.state === "function") ? window.BibleyDeviceNative : null;
  const { h, esc, toast, openSheet, closeSheet } = FX.ui;
  const K_DEV = "bibley_device_v1", K_FOCUS = "bibley_focus_v1", K_POS = "bible_last_pos_v1";
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const dev = () => Object.assign({ minutes: 20, chime: true, dnd: true, dndExplained: false }, load(K_DEV, {}));
  const setDev = (k, v) => { const d = dev(); d[k] = v; save(K_DEV, d); };
  const nstate = () => { if (!NAT) return {}; try { return JSON.parse(NAT.state()) || {}; } catch { return {}; } };
  const pad = n => String(n).padStart(2, "0");
  const toHM = m => pad(Math.floor(m / 60)) + ":" + pad(m % 60);
  const fromHM = s => { const m = /^(\d{1,2}):(\d{2})/.exec(s || ""); return m ? (+m[1]) * 60 + (+m[2]) : 0; };
  const nice = m => { const d = new Date(); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };
  const S = (p, w) => '<svg class="ui-ic" viewBox="0 0 24 24" width="' + (w || 20) + '" height="' + (w || 20) + '" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + p + "</svg>";
  const IC = {
    moon: S('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
    grid: S('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
    bell: S('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
    bellOff: S('<path d="M8.6 5.6A6 6 0 0 1 18 11v4M6 11v5.5L4.5 18H16"/><path d="M10 20.5a2 2 0 0 0 4 0"/><path d="M3.5 3.5l17 17"/>'),
    phone: S('<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.5h2"/>'),
    chev: S('<path d="M9.5 6l6 6-6 6"/>', 18),
    sun: S('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>', 16),
    book: S('<path d="M12 6.5C10.4 5 8 4.5 4 4.5v14c4 0 6.4.5 8 2 1.6-1.5 4-2 8-2v-14c-4 0-6.4.5-8 2z"/><path d="M12 6.5v14"/>'),
    notes: S('<path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z"/><path d="M6 3v18"/><path d="M10 8h6M10 12h6M10 16h4"/>'),
    flame: S('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>', 14),
    x: S('<path d="M6 6l12 12M18 6L6 18"/>'),
    check: S('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 16),
    info: S('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.4"/>', 16)
  };
  const BE_STILL = { t: "Be still, and know that I am God.", r: "Psalm 46:10" };
  const APP_ONLY = '<span class="dv-apponly">' + IC.phone + "Available in the Android app</span>";

  /* ---------------- daily verse push on the website (Home Screen app on iPhone, Chrome on Android) ---------------- */
  const PUSH_API = "https://bibley-push.sites.tab.bot";
  const PUSH_KEY = "BCHMTIZQJiXZFoXckXjYJzJFCqCnbM1EXEYbpon1pcf0VM-MjCX8zkrf7-o6mR29-AasFKBRO6w4izZckO4NaPc";
  const K_PUSH = "bibley_push_v1";
  const WRAPPED = !!(NAT || window.AndroidApp);
  const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = () => { try { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch { return false; } };
  function pushState() {
    if (WRAPPED) return "app";
    if (IOS && !standalone()) return "install";
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
    if (Notification.permission === "denied") return "denied";
    return "ok";
  }
  const PUSH_NOTE = { install: "Add Bibley to your Home Screen first", unsupported: "Not available in this browser", denied: "Notifications are blocked for Bibley in your browser settings", ok: "Today's verse once a day" };
  const pushPrefs = () => Object.assign({ on: false, time: "07:00", synced: "" }, load(K_PUSH, {}));
  const savePush = p => { try { localStorage.setItem(K_PUSH, JSON.stringify(p)); } catch {} };
  const keyBytes = s => { const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); };
  const today = () => { const x = new Date(); return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate()); };
  async function pushSend(sub, time) {
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
    const r = await fetch(PUSH_API + "/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON(), time, tz }) });
    if (!r.ok) throw new Error("server");
  }
  async function pushOn(time) {
    const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (perm !== "granted") throw new Error(perm === "denied" ? "denied" : "dismissed");
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUSH_KEY) });
    await pushSend(sub, time);
  }
  async function pushOff() {
    try {
      const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      try { await fetch(PUSH_API + "/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }); } catch {}
      await sub.unsubscribe();
    } catch {}
  }
  async function pushSync() {
    const p = pushPrefs();
    if (!p.on || pushState() !== "ok" || Notification.permission !== "granted" || p.synced === today()) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUSH_KEY) });
      await pushSend(sub, p.time); savePush(Object.assign(p, { synced: today() }));
    } catch {}
  }
  function pushSection() {
    const st = pushState(), p = pushPrefs(), on = p.on && st === "ok";
    return row(IC.bell, "Daily verse", PUSH_NOTE[st], sw("webpush", on, st !== "ok")) +
      '<div class="dv-times one' + (on ? "" : " off") + '" data-g="wp"><label>At<input type="time" class="fx-input" data-t="wpt" value="' + esc(p.time) + '"></label></div>';
  }
  async function pushToggle(inp, el) {
    const t = el.querySelector('[data-t="wpt"]'), g = el.querySelector('[data-g="wp"]'), time = (t && t.value) || "07:00";
    if (inp.checked) {
      inp.disabled = true;
      try { await pushOn(time); savePush({ on: true, time, synced: today() }); g.classList.remove("off"); toast("Daily verse at " + nice(fromHM(time))); }
      catch (e) {
        inp.checked = false; savePush(Object.assign(pushPrefs(), { on: false }));
        toast(e.message === "denied" ? "Notifications are blocked for Bibley in your browser settings" : e.message === "dismissed" ? "Notifications were not allowed" : "Couldn't turn on the daily verse. Try again.");
      }
      inp.disabled = false;
    } else { savePush({ on: false, time, synced: "" }); g.classList.add("off"); pushOff(); toast("Daily verse off"); }
  }
  async function pushTime(inp) {
    const p = pushPrefs(), time = inp.value || "07:00";
    savePush(Object.assign(p, { time }));
    if (!p.on || Notification.permission !== "granted") return;
    try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) { await pushSend(sub, time); savePush(Object.assign(pushPrefs(), { synced: today() })); toast("Daily verse at " + nice(fromHM(time))); } } catch { toast("Couldn't save the time. Try again."); }
  }

  /* ---------------- verse of the day (reads the app's own daily cache, else fetches it) ---------------- */
  function votdRef() { try { return FX._test.votdRef(); } catch { return "John 3:16"; } }
  async function votd() {
    const ref = votdRef();
    try {
      const st = load("bibley_votd_v1", {}); const day = new Date(); const ds = day.getFullYear() + "-" + pad(day.getMonth() + 1) + "-" + pad(day.getDate());
      const k = Object.keys(st).find(x => x.startsWith(ds)); if (k && st[k] && st[k].text) return st[k];
    } catch {}
    for (const ver of [C.panes && C.panes.a ? C.panes.a.version : "web", "web", "kjv"]) {
      try { const t = String(await C.fetchVerseText(ref, ver) || "").replace(/\s+/g, " ").trim(); if (t) return { ref, text: t, version: ver }; } catch {}
    }
    return { ref, text: "", version: "" };
  }
  function parseRef(ref) {
    const m = /^(.+?)\s+(\d+)(?::(\d+))?/.exec(ref || ""); if (!m) return null;
    const b = C.BOOKS.findIndex(x => x[0] === m[1] || x[1] === m[1] || (m[1] === "Psalm" && x[0] === "Psalms"));
    return b < 0 ? null : { b, c: +m[2], v: m[3] ? +m[3] : 0 };
  }
  function openRef(ref) {
    const p = parseRef(ref); if (!p) return;
    try { closeSheet(); } catch {}
    if (p.v) FX.jumpToVerse(p.b, p.c, p.v); else C.goTo(p.b, p.c);
  }

  /* ---------------- small UI parts ---------------- */
  const sw = (id, on, dis) => '<label class="dv-sw' + (dis ? " dis" : "") + '"><input type="checkbox" data-k="' + id + '"' + (on ? " checked" : "") + (dis ? " disabled" : "") + '><span></span></label>';
  function row(icon, title, sub, right) {
    return '<div class="dv-line"><span class="dv-ic">' + icon + '</span><span class="dv-t">' + esc(title) + (sub ? "<small>" + sub + "</small>" : "") + "</span>" + (right || "") + "</div>";
  }

  /* ---------------- Settings > Device (inline section) ---------------- */
  function summary() {
    if (!NAT) { const p = pushPrefs(); return { w: "Verse of the Day, Quick actions", n: !WRAPPED && p.on ? "Daily verse at " + nice(fromHM(p.time)) : "Daily verse, quiet hours and pause", f: "Do not disturb my relationship with God" }; }
    const s = nstate(); const f = s.focus || {};
    const n = s.paused ? "All paused" : s.quietOn ? "Quiet " + nice(s.quietStart) + " \u2013 " + nice(s.quietEnd) : "Quiet hours off";
    const wc = s.widgets ? (s.widgets.verse || 0) + (s.widgets.quick || 0) : 0;
    return { w: wc ? wc + " on your home screen" : "Verse of the Day, Quick actions", n, f: f.active ? "In session now" : "Do not disturb my relationship with God" };
  }
  function mountSettings(slot) {
    if (!slot) return;
    const s = summary();
    slot.innerHTML = '<div class="dv-sec"><div class="dv-sec-h">Device</div><div class="dv-list">' +
      (NAT ? '<button type="button" class="dv-row" data-a="widgets"><span class="dv-ic">' + IC.grid + '</span><span class="dv-t">Home-screen widgets<small>' + esc(s.w) + "</small></span>" + IC.chev + "</button>" : "") +
      '<button type="button" class="dv-row" data-a="notif"><span class="dv-ic">' + IC.bellOff + '</span><span class="dv-t">Notifications<small>' + esc(s.n) + "</small></span>" + IC.chev + "</button>" +
      '<button type="button" class="dv-row" data-a="focus"><span class="dv-ic">' + IC.moon + '</span><span class="dv-t">Time with God<small>' + esc(s.f) + "</small></span>" + IC.chev + "</button>" +
      "</div></div>";
    slot.querySelectorAll(".dv-row").forEach(b => b.onclick = () => deviceSheet(b.dataset.a));
  }

  /* ---------------- the Device sheet ---------------- */
  function widgetMock(kind) {
    if (kind === "verse") return '<div class="dv-wmock v"><div class="dv-wm-eb">' + IC.sun + 'Verse of the day</div><div class="dv-wm-tx" data-votd>&nbsp;</div><div class="dv-wm-ref" data-votdref>' + esc(votdRef()) + " \u00b7 WEB</div></div>";
    const pos = lastPosLabel(), st = streakN();
    return '<div class="dv-wmock q"><div class="dv-wm-h"><b>Bibley</b><span>' + IC.flame + (st ? st + "-day streak" : "Today") + '</span></div><div class="dv-wm-cont">' + IC.book + '<span>Continue reading<small>' + esc(pos || "Open the reader") + '</small></span></div><div class="dv-wm-btns"><span>' + IC.sun + "Today</span><span>" + IC.notes + "Notes</span><span>" + IC.moon + "Time with God</span></div></div>";
  }
  function deviceSheet(focusOn) {
    openSheet("device", "Device", body => {
      const s = nstate(), d = dev();
      const notifOff = NAT && s.notifAllowed === false;
      const el = h('<div class="dv-sheet">' +
        // Widgets
        '<section class="fx-card dv-card" id="dv-widgets"><div class="fx-eyebrow dv-eb">' + IC.grid + 'Home-screen widgets</div>' +
        '<div class="dv-wgrid"><div class="dv-wcol">' + widgetMock("verse") + '<div class="dv-wname">Verse of the Day</div><button type="button" class="fx-btn small block" data-pin="verse"' + (NAT ? "" : " disabled") + ">Add to home screen</button></div>" +
        '<div class="dv-wcol">' + widgetMock("quick") + '<div class="dv-wname">Bibley Quick</div><button type="button" class="fx-btn small block" data-pin="quick"' + (NAT ? "" : " disabled") + ">Add to home screen</button></div></div>" +
        (NAT ? '<p class="dv-hint">' + IC.info + "<span>" + (s.pinSupported ? "Your launcher will ask where to put it. " : "") + "You can also long-press an empty spot on your home screen, tap <b>Widgets</b>, find <b>Bibley</b> and drag one out. Both can be resized and follow your phone's light or dark mode.</span></p>" : '<p class="dv-hint">' + APP_ONLY + "</p>") +
        "</section>" +
        // Notifications
        '<section class="fx-card dv-card" id="dv-notif"><div class="fx-eyebrow dv-eb">' + IC.bellOff + "Notifications</div>" +
        (notifOff ? '<div class="dv-warn"><span>Notifications are turned off for Bibley in your phone settings.</span><button type="button" class="fx-btn small" data-a="nset">Open settings</button></div>' : "") +
        (WRAPPED ? "" : pushSection()) +
        row(IC.bellOff, "Pause all Bibley notifications", "Nothing from Bibley until you turn this off", sw("paused", s.paused, !NAT)) +
        row(IC.moon, "Quiet hours", "Bibley notifications arrive silently, no sound or pop-up", sw("quietOn", s.quietOn, !NAT)) +
        '<div class="dv-times' + (s.quietOn ? "" : " off") + '" data-g="quiet"><label>From<input type="time" class="fx-input" data-t="qs" value="' + toHM(s.quietStart != null ? s.quietStart : 1320) + '"' + (NAT ? "" : " disabled") + '></label><label>To<input type="time" class="fx-input" data-t="qe" value="' + toHM(s.quietEnd != null ? s.quietEnd : 420) + '"' + (NAT ? "" : " disabled") + "></label></div>" +
        (WRAPPED ? (row(IC.bell, "Daily verse notification", "Today's verse once a day, silent in quiet hours", sw("reminderOn", s.reminderOn, !NAT)) +
        '<div class="dv-times one' + (s.reminderOn ? "" : " off") + '" data-g="rem"><label>At<input type="time" class="fx-input" data-t="rt" value="' + toHM(s.reminderTime != null ? s.reminderTime : 420) + '"' + (NAT ? "" : " disabled") + "></label></div>") : "") +
        (NAT ? "" : '<p class="dv-hint">' + APP_ONLY + "</p>") +
        "</section>" +
        // Time with God
        '<section class="fx-card dv-card" id="dv-focus"><div class="fx-eyebrow dv-eb">' + IC.moon + "Time with God</div>" +
        '<div class="dv-ftitle">Do not disturb my relationship with God</div>' +
        '<p class="fx-muted dv-p">A calm screen with today\'s verse and a prayer timer. Bibley stays quiet while it runs' + (NAT ? ", and your phone's Do Not Disturb can turn on for the session and switch back off when it ends." : ".") + "</p>" +
        row(IC.phone, "Phone Do Not Disturb", NAT ? (s.dndAccess ? '<span class="dv-ok">' + IC.check + "Allowed</span>" : "Needs a one-time permission") : "Silences calls and other apps too", NAT ? (s.dndAccess ? sw("dnd", d.dnd, false) : '<button type="button" class="fx-btn small" data-a="grant">Allow</button>') : sw("dnd", false, true)) +
        (NAT ? "" : '<p class="dv-hint">' + APP_ONLY + "</p>") +
        '<button type="button" class="fx-btn primary block dv-start" data-a="focus">' + IC.moon + (session() ? "Return to Time with God" : "Start Time with God") + "</button>" +
        "</section></div>");
      if (!NAT) { const w = el.querySelector("#dv-widgets"); if (w) w.remove(); }
      body.append(el);
      // verse text in the widget preview
      votd().then(v => { const t = el.querySelector("[data-votd]"); if (t && v.text) t.textContent = "\u201c" + v.text + "\u201d"; });
      el.querySelectorAll("[data-pin]").forEach(b => b.onclick = () => pin(b.dataset.pin));
      const nb = el.querySelector('[data-a="nset"]'); if (nb) nb.onclick = () => { try { NAT.openNotificationSettings(); } catch {} };
      const gb = el.querySelector('[data-a="grant"]'); if (gb) gb.onclick = () => explainDnd(() => deviceSheet("focus"));
      el.querySelector('[data-a="focus"]').onclick = () => { closeSheet(); openFocus(); };
      const q = () => { const qs = el.querySelector('[data-t="qs"]'), qe = el.querySelector('[data-t="qe"]'); return [fromHM(qs.value), fromHM(qe.value)]; };
      el.querySelectorAll(".dv-sw input").forEach(inp => inp.onchange = () => {
        const k = inp.dataset.k, on = inp.checked;
        if (k === "dnd") { setDev("dnd", on); return; }
        if (k === "webpush") { pushToggle(inp, el); return; }
        if (!NAT) return;
        try {
          if (k === "paused") { NAT.setPaused(on); toast(on ? "Bibley notifications paused" : "Bibley notifications back on"); }
          if (k === "quietOn") { const [a, b] = q(); NAT.setQuiet(on, a, b); el.querySelector('[data-g="quiet"]').classList.toggle("off", !on); }
          if (k === "reminderOn") {
            NAT.setReminder(on, fromHM(el.querySelector('[data-t="rt"]').value)); el.querySelector('[data-g="rem"]').classList.toggle("off", !on);
            if (on) { try { if (window.AndroidApp && AndroidApp.notifPermission && AndroidApp.notifPermission() !== "granted") AndroidApp.requestNotifPermission(); } catch {} toast("Daily verse at " + nice(fromHM(el.querySelector('[data-t="rt"]').value))); }
          }
        } catch {}
      });
      el.querySelectorAll('input[type="time"]').forEach(inp => inp.onchange = () => {
        if (inp.dataset.t === "wpt") { pushTime(inp); return; }
        if (!NAT) return;
        try {
          if (inp.dataset.t === "rt") NAT.setReminder(el.querySelector('[data-k="reminderOn"]').checked, fromHM(inp.value));
          else { const [a, b] = q(); NAT.setQuiet(el.querySelector('[data-k="quietOn"]').checked, a, b); }
        } catch {}
      });
      if (focusOn) { const t = el.querySelector("#dv-" + focusOn); if (t && focusOn !== "widgets") setTimeout(() => t.scrollIntoView({ block: "start", behavior: "instant" }), 30); }
    });
  }
  function pin(kind) {
    if (!NAT) { toast("Widgets are available in the Android app"); return; }
    let r = "error"; try { r = NAT.pinWidget(kind); } catch {}
    if (r === "requested") toast("Check your home screen to place it");
    else toast("Long-press your home screen, tap Widgets, then find Bibley", 4200);
  }
  function explainDnd(after) {
    const d = dev();
    const wrap = h('<div class="dv-modal-wrap" role="dialog" aria-modal="true"><div class="dv-modal">' +
      '<div class="fx-eyebrow dv-eb">' + IC.phone + "Phone Do Not Disturb</div>" +
      "<h3>Let Bibley turn on Do Not Disturb</h3>" +
      "<p>So nothing interrupts your Time with God, Bibley can switch on your phone's Do Not Disturb when you start a session and switch it back off when it ends.</p>" +
      "<p>Android asks you to allow this once. On the next screen, find <b>Bibley</b>, turn it on, then come back.</p>" +
      '<div class="fx-row dv-mrow"><button type="button" class="fx-btn" data-a="no">Not now</button><button type="button" class="fx-btn primary" data-a="go">Open settings</button></div></div></div>');
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.onclick = e => { if (e.target === wrap) close(); };
    wrap.querySelector('[data-a="no"]').onclick = close;
    wrap.querySelector('[data-a="go"]').onclick = () => {
      setDev("dndExplained", true); close();
      try { NAT.openDndAccess(); } catch {}
      // when they come back, refresh what was open
      const back = () => { if (document.visibilityState === "visible") { document.removeEventListener("visibilitychange", back); if (after) setTimeout(after, 250); } };
      document.addEventListener("visibilitychange", back);
    };
    void d;
  }

  /* ---------------- Time with God ---------------- */
  function webSession() { const s = load(K_FOCUS, null); return s && s.endAt > Date.now() ? s : null; }
  function session() {
    if (NAT) { const f = nstate().focus || {}; return f.active ? { endAt: f.endAt, startAt: f.startAt, minutes: f.minutes, chime: f.chime, dnd: !!f.dndApplied, native: true } : null; }
    return webSession();
  }
  let fv = null, tick = null, endedShown = false;
  function chime() {
    try {
      const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
      const ac = new A(); const t0 = ac.currentTime;
      [[528, 0], [660, 0.9], [792, 1.8]].forEach(([f, at]) => {
        const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(0.09, t0 + at + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 2.6);
        o.connect(g).connect(ac.destination); o.start(t0 + at); o.stop(t0 + at + 2.7);
      });
      setTimeout(() => { try { ac.close(); } catch {} }, 5000);
    } catch {}
  }
  let popGuard = 0;
  function openFocus() {
    // Close an open sheet first; its history.back() must land before this view adds its own history entry.
    if (document.querySelector(".fx-sheet.open")) { popGuard = Date.now() + 700; try { closeSheet(); } catch {} setTimeout(showFocus, 350); return; }
    showFocus();
  }
  function showFocus() {
    if (!fv) {
      fv = h('<div class="dv-focus" role="dialog" aria-modal="true" aria-label="Time with God"><div class="dv-fx-in"></div></div>');
      document.body.appendChild(fv);
    }
    fv.classList.add("open"); document.documentElement.classList.add("dv-focus-open");
    try { history.pushState({ bibleyFocus: 1 }, ""); } catch {}
    render();
  }
  function hideFocus(fromPop) {
    if (!fv) return; clearInterval(tick); tick = null;
    fv.classList.remove("open"); document.documentElement.classList.remove("dv-focus-open");
    if (!fromPop) { try { if (history.state && history.state.bibleyFocus) history.back(); } catch {} }
    refreshSlots();
  }
  window.addEventListener("popstate", () => { if (Date.now() < popGuard) return; if (fv && fv.classList.contains("open")) hideFocus(true); });
  function render() {
    const box = fv.querySelector(".dv-fx-in"); clearInterval(tick); tick = null;
    const s = session();
    if (s) return renderRunning(box, s);
    if (endedShown) return;
    const d = dev(), ns = nstate();
    const presets = [10, 20, 30, 60]; const custom = !presets.includes(d.minutes);
    box.innerHTML = '<button type="button" class="dv-fx-x" aria-label="Close">' + IC.x + "</button>" +
      '<div class="dv-fx-head"><div class="fx-eyebrow dv-eb">' + IC.moon + 'Time with God</div><h2>Do not disturb my relationship with God</h2></div>' +
      '<div class="dv-fx-verse"><div class="dv-fx-vt" data-v>&nbsp;</div><div class="dv-fx-vr"><span data-vr>' + esc(votdRef()) + '</span><button type="button" class="dv-link" data-a="read">' + IC.book + "Read in context</button></div></div>" +
      '<div class="dv-fx-lab">Prayer timer</div>' +
      '<div class="fx-seg dv-presets">' + presets.map(m => '<button type="button" data-m="' + m + '" class="' + (d.minutes === m ? "on" : "") + '">' + m + " min</button>").join("") + '<button type="button" data-m="c" class="' + (custom ? "on" : "") + '">Custom</button></div>' +
      '<div class="dv-custom' + (custom ? "" : " off") + '"><input type="number" inputmode="numeric" min="1" max="240" class="fx-input" value="' + (custom ? d.minutes : 45) + '" aria-label="Minutes"><span>minutes</span></div>' +
      '<div class="dv-fx-opts">' +
      row(IC.bell, "Gentle chime at the end", "", sw("chime", d.chime, false)) +
      row(IC.phone, "Phone Do Not Disturb", NAT ? (ns.dndAccess ? "On for the session, then back to normal" : "Needs a one-time permission") : "Available in the Android app",
        NAT ? (ns.dndAccess ? sw("dnd", d.dnd, false) : '<button type="button" class="fx-btn small" data-a="grant">Allow</button>') : sw("dnd", false, true)) +
      "</div>" +
      '<p class="dv-fx-note">' + IC.bellOff + "<span>Bibley's own notifications are muted while you pray.</span></p>" +
      '<button type="button" class="fx-btn primary block dv-fx-go" data-a="start">Begin</button>';
    votd().then(v => { const t = box.querySelector("[data-v]"); if (t) t.textContent = v.text ? "\u201c" + v.text + "\u201d" : "\u201c" + BE_STILL.t + "\u201d"; if (!v.text) box.querySelector("[data-vr]").textContent = BE_STILL.r; });
    box.querySelector(".dv-fx-x").onclick = () => hideFocus();
    box.querySelector('[data-a="read"]').onclick = () => { const r = box.querySelector("[data-vr]").textContent; hideFocus(); setTimeout(() => openRef(r), 60); };
    box.querySelectorAll(".dv-presets button").forEach(b => b.onclick = () => {
      box.querySelectorAll(".dv-presets button").forEach(x => x.classList.toggle("on", x === b));
      const c = b.dataset.m === "c"; box.querySelector(".dv-custom").classList.toggle("off", !c);
      if (!c) setDev("minutes", +b.dataset.m); else { const i = box.querySelector(".dv-custom input"); i.focus(); setDev("minutes", Math.max(1, Math.min(240, +i.value || 45))); }
    });
    box.querySelector(".dv-custom input").oninput = e => { const v = Math.max(1, Math.min(240, Math.round(+e.target.value || 0))); if (v) setDev("minutes", v); };
    box.querySelectorAll(".dv-sw input").forEach(i => i.onchange = () => setDev(i.dataset.k, i.checked));
    const g = box.querySelector('[data-a="grant"]'); if (g) g.onclick = () => explainDnd(() => { if (fv && fv.classList.contains("open")) render(); });
    box.querySelector('[data-a="start"]').onclick = start;
  }
  function start() {
    const d = dev(); const mins = Math.max(1, Math.min(240, Math.round(d.minutes || 20)));
    let s = null;
    if (NAT) {
      try { const r = JSON.parse(NAT.startFocus(mins, !!d.dnd, !!d.chime)); if (r && r.endAt) s = { endAt: r.endAt, startAt: r.startAt, minutes: r.minutes, chime: r.chime, dnd: !!r.dndApplied, native: true }; } catch {}
      if (s && d.dnd && !s.dnd && nstate().dndAccess) toast("Your phone was already in Do Not Disturb", 3000);
    }
    if (!s) s = { endAt: Date.now() + mins * 60000, startAt: Date.now(), minutes: mins, chime: !!d.chime, dnd: false };
    save(K_FOCUS, { endAt: s.endAt, startAt: s.startAt, minutes: s.minutes, chime: s.chime });
    endedShown = false;
    renderRunning(fv.querySelector(".dv-fx-in"), s);
    refreshSlots();
  }
  function stop(completed) {
    if (NAT) { try { NAT.stopFocus(!!completed); } catch {} }
    const s = load(K_FOCUS, null); save(K_FOCUS, null);
    return s;
  }
  function renderRunning(box, s) {
    const R = 104, CIRC = 2 * Math.PI * R;
    box.innerHTML = '<button type="button" class="dv-fx-x" aria-label="Hide (the session keeps going)">' + IC.x + "</button>" +
      '<div class="dv-fx-head center"><div class="fx-eyebrow dv-eb">' + IC.moon + "Time with God</div></div>" +
      '<div class="dv-ring"><svg viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="' + R + '" class="tr"/><circle cx="120" cy="120" r="' + R + '" class="pr" stroke-dasharray="' + CIRC.toFixed(1) + '" stroke-dashoffset="0" transform="rotate(-90 120 120)"/></svg>' +
      '<div class="dv-ring-c"><div class="dv-time" data-t>--:--</div><div class="dv-time-l">remaining</div></div></div>' +
      '<div class="dv-status">' + (s.dnd ? IC.phone + "<span>Phone Do Not Disturb is on</span>" : IC.bellOff + "<span>Bibley notifications are muted</span>") + "</div>" +
      '<div class="dv-fx-verse soft"><div class="dv-fx-vt" data-v>\u201c' + esc(BE_STILL.t) + '\u201d</div><div class="dv-fx-vr"><span data-vr>' + esc(BE_STILL.r) + "</span></div></div>" +
      '<button type="button" class="fx-btn block dv-fx-end" data-a="end">End session</button>';
    votd().then(v => { if (!v.text) return; const t = box.querySelector("[data-v]"), r = box.querySelector("[data-vr]"); if (t) t.textContent = "\u201c" + v.text + "\u201d"; if (r) r.textContent = v.ref; });
    box.querySelector(".dv-fx-x").onclick = () => hideFocus();
    box.querySelector('[data-a="end"]').onclick = () => { const old = stop(false); renderDone(box, old, false); };
    const tEl = box.querySelector("[data-t]"), pr = box.querySelector(".pr");
    const total = Math.max(60000, (s.endAt - (s.startAt || (s.endAt - s.minutes * 60000))));
    const step = () => {
      const left = s.endAt - Date.now();
      if (left <= 0) { clearInterval(tick); tick = null; const old = stop(true); if (s.chime) chime(); renderDone(box, old || s, true); return; }
      const sec = Math.ceil(left / 1000), m = Math.floor(sec / 60);
      tEl.textContent = (m >= 60 ? Math.floor(m / 60) + ":" + pad(m % 60) : m) + ":" + pad(sec % 60);
      pr.setAttribute("stroke-dashoffset", (CIRC * (1 - left / total)).toFixed(1));
    };
    step(); tick = setInterval(step, 1000);
  }
  function renderDone(box, s, completed) {
    endedShown = true;
    const mins = s ? Math.round((Math.min(Date.now(), s.endAt) - (s.startAt || Date.now())) / 60000) : 0;
    box.innerHTML = '<div class="dv-done"><div class="dv-done-ic">' + IC.check + "</div><h2>" + (completed ? "Amen." : "Session ended") + "</h2>" +
      "<p>" + (mins ? "You spent " + mins + " minute" + (mins === 1 ? "" : "s") + " with God." : "") + (NAT ? " Your phone is back to normal." : "") + "</p>" +
      '<p class="dv-fx-vt small">\u201cThe Lord bless you, and keep you.\u201d <span>Numbers 6:24</span></p>' +
      '<button type="button" class="fx-btn primary block" data-a="ok">Done</button></div>';
    box.querySelector('[data-a="ok"]').onclick = () => { endedShown = false; hideFocus(); };
    refreshSlots();
  }

  /* ---------------- Today quick toggle ---------------- */
  function renderToday(slot) {
    if (!slot) return;
    const s = session();
    const left = s ? Math.max(1, Math.ceil((s.endAt - Date.now()) / 60000)) : 0;
    slot.innerHTML = '<button type="button" class="dv-today' + (s ? " on" : "") + '"><span class="dv-ic">' + IC.moon + '</span><span class="dv-t">Time with God<small>' + (s ? left + " min left \u00b7 tap to return" : "Do not disturb my relationship with God") + '</small></span><span class="dv-today-b">' + (s ? "Open" : "Start") + "</span></button>";
    slot.querySelector("button").onclick = () => openFocus();
  }
  function refreshSlots() {
    document.querySelectorAll(".dv-today-slot").forEach(renderToday);
    document.querySelectorAll(".dv-settings-slot").forEach(mountSettings);
  }

  /* ---------------- widgets: data + launch actions ---------------- */
  function lastPosLabel() { const p = load(K_POS, null); try { return p && C.BOOKS[p.bookIdx] ? FX.ui.refOf(p.bookIdx, p.chapter) : ""; } catch { return ""; } }
  function streakN() { try { return FX._test.streak().n || 0; } catch { return 0; } }
  function pushWidgetData() { if (!NAT) return; try { NAT.setWidgetData(JSON.stringify({ cont: lastPosLabel(), streak: streakN() })); } catch {} }
  function pullAction() {
    if (!NAT) return;
    let a = ""; try { a = NAT.takeAction(); } catch {}
    if (!a) return;
    if (a === "focus") openFocus();
    else if (a === "votd") { hideFocus(); openRef(votdRef()); }
    else if (a === "today") { hideFocus(); FX.open.today(); }
    else if (a === "notes") { hideFocus(); try { closeSheet(); } catch {} if (window.BibleyStudyNB) window.BibleyStudyNB.open(); else if (window.BibleyNotes) window.BibleyNotes.open(); }
    else if (a === "continue") { hideFocus(); try { closeSheet(); } catch {} const p = load(K_POS, null); if (p && C.BOOKS[p.bookIdx]) C.goTo(p.bookIdx, p.chapter); }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") pushWidgetData();
    else { setTimeout(pullAction, 120); if (fv && fv.classList.contains("open")) render(); refreshSlots(); }
  });

  function openFromLink() {
    let ref = ""; try { ref = new URLSearchParams(location.search).get("verse") || ""; } catch {}
    if (!ref) return;
    try { const u = new URL(location.href); u.searchParams.delete("verse"); u.searchParams.delete("from"); history.replaceState(null, "", u.pathname + u.search + u.hash); } catch {}
    setTimeout(() => openRef(ref), 500);
  }
  if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", e => { if (e.data && e.data.type === "bibley-open-verse" && e.data.ref) openRef(e.data.ref); });
  openFromLink();
  setTimeout(pushSync, 3000);

  window.BibleyDevice = { mountSettings, renderToday, openFocus, deviceSheet, pullAction, refresh: refreshSlots, hasNative: !!NAT, _test: { session, stop, votd } };
  if (!NAT) document.documentElement.classList.add("dv-web");
  refreshSlots();
  setTimeout(() => { pushWidgetData(); pullAction(); }, 900);
  // a web session that was running when the page closed comes back
  if (webSession() && !NAT) refreshSlots();
})();
