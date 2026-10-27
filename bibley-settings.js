/* bibley-settings.js - Bibley 5.9 (app 1.9) Settings screen.
   One searchable Settings home with grouped sections, app-wide Modes, appearance customization
   with a live preview, Home & navigation (bottom bar + Today cards), Widgets, and a hidden
   Tester / Labs menu (tap the version in About 7 times).
   Storage: existing settings keep their own keys as the source of truth (bibley_prefs_v1 through
   BibleyFX.prefs, bibley_ai_depth_v1, bible_esv_api_key_v1, bible_version_a_v1 via the version
   picker, Device settings through bibley-device.js). New data only under NEW keys:
   "bibley_settings_v2" (appearance extras, modes, layout) and "bibley_flags_v1" (Tester flags). */
(() => {
  "use strict";
  const FX = window.BibleyFX, C = window.BibleyCore;
  if (!FX || !C) return;
  const K_SET = "bibley_settings_v2", K_FLAGS = "bibley_flags_v1";
  const APP_VER = "1.9", WEB_VER = "5.9.1";
  const ui = FX.ui, esc = ui.esc, toast = ui.toast;
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { toast("Couldn't save: storage is full"); return false; } };
  const NAT = window.BibleyDeviceNative || null;
  const de = document.documentElement;

  /* ---------- debug log (memory only, for Tester > Export debug log) ---------- */
  const LOG = [];
  const logp = (lvl, msg) => { LOG.push(new Date().toISOString().slice(11, 19) + " " + lvl + " " + String(msg).slice(0, 300)); if (LOG.length > 200) LOG.shift(); };
  window.addEventListener("error", e => logp("error", (e.message || "") + " @" + (e.filename || "").split("/").pop() + ":" + (e.lineno || "")));
  window.addEventListener("unhandledrejection", e => logp("reject", e.reason && (e.reason.message || e.reason)));
  logp("info", "Settings module loaded (" + WEB_VER + ")");

  /* ---------- icons (line, 24px grid) ---------- */
  const sv = (d, extra) => '<svg class="ui-ic" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"' + (extra || "") + ">" + d + "</svg>";
  const IC = {
    palette: sv('<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-.9.7-1.5 1.7-1.5H17a3.5 3.5 0 0 0 3.5-3.5c0-4.3-3.8-7.7-8.5-7.7z"/><circle cx="7.8" cy="11" r="1"/><circle cx="10.5" cy="7.3" r="1"/><circle cx="15" cy="7.6" r="1"/>'),
    book: sv('<path d="M12 6.5C10.4 5 8 4.5 4 4.5v14c4 0 6.4.5 8 2 1.6-1.5 4-2 8-2v-14c-4 0-6.4.5-8 2z"/><path d="M12 6.5v14"/>'),
    modes: sv('<circle cx="8" cy="8" r="3.5"/><circle cx="16" cy="16" r="3.5"/><path d="M14 4.5h5.5V10M4.5 14V19.5H10"/>'),
    layout: sv('<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 16h17M9 16v4.5M15 16v4.5"/>'),
    grid: sv('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
    phone: sv('<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>'),
    moon: sv('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
    notes: sv('<path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z"/><path d="M6 3v18"/><path d="M10 8h6M10 12h6M10 16h4"/>'),
    audio: sv('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
    data: sv('<ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-6"/>'),
    lock: sv('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>'),
    info: sv('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.1"/>'),
    flask: sv('<path d="M9.5 3.5h5M10 3.5v6L4.8 18a1.8 1.8 0 0 0 1.6 2.5h11.2a1.8 1.8 0 0 0 1.6-2.5L14 9.5v-6"/><path d="M7.5 14.5h9"/>'),
    chev: '<svg class="bs-chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 6l6 6-6 6"/></svg>',
    back: sv('<path d="M14.5 6l-6 6 6 6"/>'),
    close: sv('<path d="M6 6l12 12M18 6L6 18"/>'),
    search: sv('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
    up: sv('<path d="M6.5 14.5L12 9l5.5 5.5"/>'), down: sv('<path d="M6.5 9.5L12 15l5.5-5.5"/>'),
    eye: sv('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
    focus: sv('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><circle cx="12" cy="12" r="2.5"/>'),
    sunset: sv('<path d="M3 18.5h18M6.5 18.5a5.5 5.5 0 0 1 11 0M12 4.5v3M4.9 9.9l1.8 1.8M19.1 9.9l-1.8 1.8"/>'),
    child: sv('<circle cx="12" cy="6" r="2.5"/><path d="M8 21v-6.5L6 11l3-1.5h6l3 1.5-2 3.5V21M12 14.5V21"/>'),
    study: sv('<path d="M3 8.5L12 4l9 4.5-9 4.5z"/><path d="M7 10.5v5c1.5 1.5 3 2 5 2s3.5-.5 5-2v-5M21 8.5v5.5"/>'),
    pray: sv('<path d="M12 3.5c-1 2-1.5 4-1.5 6.5L7 15.5 8.5 20h4l2.5-4.5V10c0-2.5-1-4.5-3-6.5z"/><path d="M12 3.5c1 2 1.5 4 1.5 6.5"/>'),
    cloud: sv('<path d="M7 18.5a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.5 1.5 4 4 0 0 1-.5 7.5z"/><path d="M4 4l16 16"/>'),
    access: sv('<circle cx="12" cy="4.8" r="1.8"/><path d="M5 8.5l7 1.5 7-1.5M12 10v4.5M12 14.5L9 21M12 14.5l3 6.5"/>'),
    sun: sv('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>'),
    flame: sv('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
    shield: sv('<path d="M12 3.5l7 3v5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5v-5z"/>'),
    star: sv('<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z"/>'),
    refresh: sv('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/>'),
    plus: sv('<path d="M12 5v14M5 12h14"/>')
  };

  /* ---------- state ---------- */
  const DEF = { themeMode: "", accent: "gold", face: "", width: "normal", margin: "m", vnum: "sup", layout: "paragraph",
    labels: true, dock: ["today", "mb", "plans", "notes", "aa"], dockHidden: [], density: "comfortable", radius: "soft", motion: "on",
    today: ["votd", "widgets", "wisdom", "continue", "focus", "plan", "links", "memory"], todayHidden: [], tts: 0.95,
    mode: "", modeBackup: null, modeOpts: {}, night: { on: false, type: "time", start: "21:30", end: "06:30" }, widgetCardHidden: false };
  const S = () => { const s = Object.assign({}, DEF, load(K_SET, {})); s.night = Object.assign({}, DEF.night, s.night || {}); s.modeOpts = s.modeOpts || {}; return s; };
  function setS(patch) { const s = Object.assign(load(K_SET, {}), patch); save(K_SET, s); applyAll(); }
  const flagsState = () => Object.assign({ unlocked: false, flags: {} }, load(K_FLAGS, {}));
  const prefs = () => FX.prefs.get();

  /* ---------- appearance ---------- */
  const FACES = [["source", "Source Serif", "'Source Serif 4', Georgia, serif", "serif"], ["georgia", "Classic serif", "Georgia, 'Noto Serif', 'Times New Roman', serif", "serif"],
    ["fraunces", "Fraunces", "'Fraunces', Georgia, serif", "serif"], ["sans", "System sans", "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif", "sans"],
    ["condensed", "Condensed sans", "'Roboto Condensed', 'sans-serif-condensed', 'Arial Narrow', sans-serif", "sans"]];
  const ACCENTS = [["gold", "Gold", "#c9a867", "#8a6420"], ["sage", "Sage", "#9cb79a", "#4f7350"], ["slate", "Slate blue", "#93abd0", "#3f5f8c"], ["rose", "Clay rose", "#cf9f94", "#95544a"], ["lavender", "Lavender", "#ad9fd2", "#64568f"]];
  const THEMES = [["dark", "Dark", "#141b2e", "#e8e1d0"], ["light", "Light", "#fbfaf7", "#1d2230"], ["sepia", "Sepia", "#f4ecd8", "#3b2f22"], ["black", "True black", "#000000", "#e8e1d0"], ["system", "System", "linear", ""]];
  const mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  let applying = false;
  function currentTheme() { const s = S(); if (s.themeMode === "black") return "black"; if (s.themeMode === "system") return "system"; return prefs().theme || "dark"; }
  function syncSystemTheme() {
    const s = S(); if (s.themeMode !== "system") return;
    const want = mq && !mq.matches ? "light" : "dark";
    if (prefs().theme !== want) FX.prefs.set("theme", want);
  }
  function afterPrefs() { if (!applying) applyAll(true); }
  function applyAll(fromPrefs) {
    applying = true;
    try {
      const s = S(), p = prefs(), fl = flagsState();
      const cls = new Set();
      if (s.themeMode === "black" && (p.theme || "dark") === "dark") cls.add("theme-black");
      if (s.mode) cls.add("mode-" + s.mode);
      const mo = s.mode ? modeOpts(s.mode) : {};
      if (s.density === "compact") cls.add("bs-compact");
      if (s.radius && s.radius !== "soft") cls.add("bs-r-" + s.radius);
      if (s.motion && s.motion !== "on") cls.add("bs-motion-" + s.motion);
      if (s.width !== "normal") cls.add("bs-w-" + s.width);
      if (s.margin !== "m") cls.add("bs-m-" + s.margin);
      if (s.vnum !== "sup") cls.add("bs-vn-" + s.vnum);
      if (s.layout === "verse") cls.add("bs-verse-lines");
      if (!s.labels) cls.add("bs-nolabels");
      // mode details (each part is individually editable on the mode's page)
      if (s.mode === "focus") { if (mo.dock) cls.add("bs-hide-dock"); if (mo.top) cls.add("bs-hide-top"); }
      if (s.mode === "night") { cls.add("bs-night-" + (mo.warmth || "med")); }
      if (s.mode === "kids") { if (mo.simple) cls.add("bs-simple-nav"); }
      if (s.mode === "study") { if (mo.lines) cls.add("bs-verse-lines"); if (mo.marks) cls.add("bs-study-marks"); }
      if (s.mode === "access") { if (mo.contrast) cls.add("bs-contrast"); if (mo.motion) cls.add("bs-motion-off"); }
      if (s.mode === "lowdata") { if (mo.fonts) cls.add("bs-sysfonts"); if (mo.motion) cls.add("bs-motion-off"); }
      Object.keys(fl.flags || {}).forEach(k => { if (fl.flags[k]) cls.add("flag-" + k); });
      [...de.classList].forEach(c => { if (/^(theme-black|mode-|bs-|flag-)/.test(c) && !cls.has(c)) de.classList.remove(c); });
      cls.forEach(c => de.classList.add(c));
      if (s.accent && s.accent !== "gold") de.setAttribute("data-accent", s.accent); else de.removeAttribute("data-accent");
      const face = FACES.find(f => f[0] === s.face);
      if (face) de.style.setProperty("--fx-verse-font", face[2]);
      if (s.mode === "night") { const dim = mo.dim == null ? 25 : mo.dim; de.style.setProperty("--bs-dim", String(dim / 100)); } else de.style.removeProperty("--bs-dim");
      ensureDim(s.mode === "night");
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta && cls.has("theme-black")) meta.setAttribute("content", "#000000");
      if (meta && s.mode === "night") meta.setAttribute("content", "#0f0b07");
      applyDock(s); applyTodayOrder();
    } catch (e) { logp("error", "applyAll " + e.message); }
    applying = false;
  }
  function ensureDim(on) {
    let d = document.querySelector(".bs-dim");
    if (on && !d) { d = document.createElement("div"); d.className = "bs-dim"; d.setAttribute("aria-hidden", "true"); document.body.appendChild(d); }
    if (!on && d) d.remove();
  }
  if (mq && mq.addEventListener) mq.addEventListener("change", () => { syncSystemTheme(); });

  /* ---------- bottom bar ---------- */
  const DOCK_NAMES = { today: "Today", mb: "My Bible", plans: "Plans", notes: "Notes", aa: "Settings" };
  function applyDock(s) {
    const dock = document.querySelector(".fx-dock"); if (!dock) return;
    const order = (s.dock || DEF.dock).filter(k => DOCK_NAMES[k]); Object.keys(DOCK_NAMES).forEach(k => { if (!order.includes(k)) order.push(k); });
    let hidden = s.dockHidden || [];
    if (s.mode === "kids" && modeOpts("kids").simple) hidden = hidden.concat(["plans"]);
    order.forEach(k => { const b = dock.querySelector('[data-a="' + k + '"]'); if (b) { dock.appendChild(b); b.hidden = k !== "aa" && hidden.includes(k); b.classList.toggle("bs-off", b.hidden); } });
  }

  /* ---------- Today cards ---------- */
  const TODAY_NAMES = { votd: "Verse of the day", widgets: "Add widgets card", wisdom: "Daily dose of wisdom", continue: "Continue reading", focus: "Time with God", plan: "Streak & reading plan", links: "Shortcuts (My Bible, Plans, Settings)", memory: "Memory verses" };
  function todayParts(body) {
    const m = {};
    const kids = [...body.children];
    kids.forEach((el, i) => {
      if (el.classList.contains("fx-votd")) m.votd = [el];
      else if (el.classList.contains("fx-wis-slot") || el.classList.contains("fx-wis")) m.wisdom = [el];
      else if (el.classList.contains("fx-continue")) { m.continue = [el]; const nx = kids[i + 1]; if (nx && !nx.className && nx.tagName === "DIV" && !nx.children.length) m.continue.push(nx); }
      else if (el.classList.contains("dv-today-slot")) m.focus = [el];
      else if (el.classList.contains("fx-today-plan")) m.plan = [el];
      else if (el.classList.contains("fx-today-links")) m.links = [el];
      else if (el.matches('[data-a="memlist"]')) m.memory = [el];
      else if (el.classList.contains("bs-wcard")) m.widgets = [el];
    });
    return m;
  }
  function applyTodayOrder() {
    const sheet = document.querySelector('.fx-sheet[data-view="today"]'); if (!sheet) return;
    const body = sheet.querySelector(".fx-sheet-body"); if (!body || !body.children.length) return;
    const s = S();
    if (!body.querySelector(".bs-wcard") && NAT && !s.widgetCardHidden && !(s.todayHidden || []).includes("widgets")) body.appendChild(widgetCard());
    const parts = todayParts(body);
    const order = (s.today || DEF.today).slice(); Object.keys(TODAY_NAMES).forEach(k => { if (!order.includes(k)) order.push(k); });
    const hidden = s.todayHidden || [];
    const focusFirst = s.mode === "prayer";
    const ord = focusFirst ? ["focus"].concat(order.filter(k => k !== "focus")) : order;
    ord.forEach(k => (parts[k] || []).forEach(el => { body.appendChild(el); el.classList.toggle("bs-off", hidden.includes(k)); }));
    // anything we do not know about stays at the end, untouched
  }
  const todayObs = new MutationObserver(() => { const sh = document.querySelector('.fx-sheet[data-view="today"]'); if (sh && !sh.dataset.bsDone) { /* fresh render */ } applyTodaySoon(); });
  let tq = 0; function applyTodaySoon() { clearTimeout(tq); tq = setTimeout(() => { todayObs.disconnect(); applyTodayOrder(); observeToday(); }, 30); }
  function observeToday() { const sh = document.querySelector(".fx-sheet"); if (sh) todayObs.observe(sh, { attributes: true, attributeFilter: ["data-view"], childList: true, subtree: false }), todayObs.observe(sh.querySelector(".fx-sheet-body"), { childList: true }); }
  const waitSheet = setInterval(() => { if (document.querySelector(".fx-sheet")) { clearInterval(waitSheet); observeToday(); applyTodayOrder(); } }, 400);
  let dockSeen = null; setInterval(() => { const d = document.querySelector(".fx-dock"); if (d && d !== dockSeen) { dockSeen = d; applyDock(S()); } }, 700);

  /* ---------- widgets ---------- */
  const WIDGETS = [["verse", "Verse of the Day", "Today's verse, opens the reader"], ["quick", "Bibley Quick", "Continue reading, streak, Today, Notes"], ["focus", "Time with God", "A 1x1 button that starts a session"], ["streak", "Streak & plan", "Your streak and plan progress"]];
  function widgetMock(k) {
    const pl = FX.plan && FX.plan(); let st = 0; try { st = FX._test.streak().n || 0; } catch {}
    if (k === "verse") return '<div class="bs-wm v"><div class="eb">' + IC.sun + 'Verse of the day</div><div class="tx">\u201cThe Lord is my shepherd; I shall lack nothing.\u201d</div><div class="rf">Psalm 23:1</div></div>';
    if (k === "quick") return '<div class="bs-wm q"><div class="hd"><b>Bibley</b><span>' + IC.flame + (st ? st + "-day" : "Today") + '</span></div><div class="ct">' + IC.book + '<span>Continue reading</span></div></div>';
    if (k === "focus") return '<div class="bs-wm f">' + IC.moon + "<span>Pray</span></div>";
    return '<div class="bs-wm s"><div class="n">' + st + '</div><div class="l">day streak</div><div class="bar"><i style="width:' + (pl ? pl.pct : 0) + '%"></i></div><div class="p">' + esc(pl ? "Day " + pl.day + " of " + pl.total : "No plan yet") + "</div></div>";
  }
  function pinWidget(k) {
    if (!NAT || !NAT.pinWidget) { toast("Widgets are available in the Android app"); return; }
    let r = ""; try { r = NAT.pinWidget(k); } catch (e) { r = "error"; }
    if (r === "requested") toast("Choose where to put it on your home screen");
    else toast("Long-press your home screen, tap Widgets, then find Bibley", 4200);
  }
  function widgetCard() {
    const el = document.createElement("div"); el.className = "fx-card bs-wcard";
    el.innerHTML = '<div class="bs-wc-h"><div class="fx-eyebrow">' + IC.grid + 'Home-screen widgets</div><button type="button" class="bs-x" aria-label="Hide this card">' + IC.close + '</button></div>' +
      '<p class="fx-muted bs-wc-p">Keep today\'s verse and your streak one glance away.</p><div class="bs-wc-row">' +
      WIDGETS.map(w => '<button type="button" class="bs-wc-it" data-pin="' + w[0] + '">' + widgetMock(w[0]) + "<span>" + esc(w[1]) + "</span><em>" + IC.plus + "Add</em></button>").join("") + "</div>";
    el.querySelector(".bs-x").onclick = () => { setS({ widgetCardHidden: true }); el.remove(); toast("Hidden. Find widgets in Settings any time"); };
    el.querySelectorAll("[data-pin]").forEach(b => b.onclick = () => pinWidget(b.dataset.pin));
    return el;
  }
  function pushPlanToWidgets() {
    if (!NAT || !NAT.setWidgetData) return;
    try { const pl = FX.plan(); let st = 0; try { st = FX._test.streak().n || 0; } catch {}
      const pos = load("bible_last_pos_v1", null);
      NAT.setWidgetData(JSON.stringify({ cont: pos && C.BOOKS[pos.bookIdx] ? ui.refOf(pos.bookIdx, pos.chapter) : "", streak: st, plan: pl ? pl.name : "", planDay: pl ? pl.day : 0, planTotal: pl ? pl.total : 0, planPct: pl ? pl.pct : 0 }));
    } catch (e) { logp("warn", "widget data " + e.message); }
  }

  /* ---------- modes ---------- */
  const MODES = [
    { id: "focus", name: "Focus", sub: "Just the words. Hides the bottom bar and extra buttons.", ic: IC.focus, opts: [["dock", "Hide the bottom bar", true], ["top", "Hide extra top-bar buttons", true]] },
    { id: "night", name: "Night", sub: "Warm, dim and easy on the eyes after dark.", ic: IC.moon, opts: [["warmth", "Warmth", "med", [["low", "Low"], ["med", "Medium"], ["high", "High"]]], ["dim", "Dim the screen", 25, "range"]] },
    { id: "kids", name: "Simple", sub: "Bigger text and fewer buttons. Good for kids.", ic: IC.child, opts: [["size", "Bigger text", true], ["simple", "Simpler navigation", true]] },
    { id: "study", name: "Study", sub: "Verse numbers, one verse per line, notes marked.", ic: IC.study, opts: [["lines", "One verse per line", true], ["marks", "Mark notes and highlights clearly", true]] },
    { id: "prayer", name: "Prayer", sub: "Calm colours, Time with God first on Today.", ic: IC.pray, opts: [["start", "Open Time with God when turned on", true]] },
    { id: "lowdata", name: "Low data", sub: "System fonts and no animations. Offline Bibles work as usual.", ic: IC.cloud, opts: [["fonts", "Use system fonts", true], ["motion", "Turn off animations", true]] },
    { id: "access", name: "Accessibility", sub: "Large text, high contrast and reduced motion.", ic: IC.access, opts: [["size", "Large text", true], ["contrast", "High contrast", true], ["motion", "Reduce motion", true]] }
  ];
  function modeOpts(id) {
    const m = MODES.find(x => x.id === id); const o = {}; if (!m) return o;
    m.opts.forEach(op => o[op[0]] = op[2]);
    return Object.assign(o, (S().modeOpts || {})[id] || {});
  }
  // prefs (old key) a mode touches; the old values are kept in modeBackup and put back when the mode ends
  function modePrefPatch(id, o) {
    const p = prefs();
    if (id === "kids" && o.size) return { size: Math.max(p.size, 22) };
    if (id === "access" && o.size) return { size: Math.max(p.size, 24) };
    if (id === "night" || id === "prayer") return { theme: "dark" };
    return {};
  }
  function setMode(id, opts) {
    const s = S();
    // leave the current mode first: restore what it changed
    if (s.mode) {
      const b = s.modeBackup || {};
      Object.keys(b.prefs || {}).forEach(k => FX.prefs.set(k, b.prefs[k]));
      if (b.themeMode !== undefined) { const cur = load(K_SET, {}); cur.themeMode = b.themeMode; save(K_SET, cur); }
    }
    if (!id) { setS({ mode: "", modeBackup: null, modeAuto: false }); return; }
    const o = modeOpts(id), patch = modePrefPatch(id, o), p = prefs(), back = { prefs: {} };
    Object.keys(patch).forEach(k => back.prefs[k] = p[k]);
    if (id === "night" || id === "prayer") back.themeMode = S().themeMode;
    const extra = { mode: id, modeBackup: back, modeAuto: !!(opts && opts.auto) };
    if (id === "night" || id === "prayer") extra.themeMode = "";
    const cur = Object.assign(load(K_SET, {}), extra); save(K_SET, cur);
    Object.keys(patch).forEach(k => FX.prefs.set(k, patch[k]));
    applyAll();
    if (id === "prayer" && o.start && !(opts && opts.quiet) && window.BibleyDevice) setTimeout(() => close(() => window.BibleyDevice.openFocus()), 200);
  }
  function setModeOpt(id, k, v) {
    const s = load(K_SET, {}); s.modeOpts = s.modeOpts || {}; s.modeOpts[id] = Object.assign({}, s.modeOpts[id] || {}, { [k]: v }); save(K_SET, s);
    if (S().mode === id && (k === "size")) { setMode(id, { quiet: true }); return; }
    applyAll();
  }
  /* Night schedule: at a set time, or at sunset (estimated from the time zone, no location needed) */
  const toMin = hm => { const [h, m] = String(hm || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
  function sunsetMin(d) {
    const lon = -d.getTimezoneOffset() / 60 * 15, lat = 38 * Math.PI / 180;
    const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
    const decl = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + doy) / 365);
    const ha = Math.acos(Math.max(-1, Math.min(1, (Math.sin(-0.833 * Math.PI / 180) - Math.sin(lat) * Math.sin(decl)) / (Math.cos(lat) * Math.cos(decl))))) * 180 / Math.PI;
    const tzLon = -d.getTimezoneOffset() / 60 * 15; // standard meridian = assumed longitude
    return Math.round(720 + ha * 4 + (tzLon - lon) * 4);
  }
  const fmtMin = m => { m = ((m % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mm = m % 60; return (h % 12 || 12) + ":" + String(mm).padStart(2, "0") + (h < 12 ? " AM" : " PM"); };
  function nightWindow(now) {
    const n = S().night; const start = n.type === "sunset" ? sunsetMin(now) : toMin(n.start), end = toMin(n.end);
    const t = now.getHours() * 60 + now.getMinutes();
    return start <= end ? (t >= start && t < end) : (t >= start || t < end);
  }
  function nightTick() {
    const s = S(); if (!s.night.on) return;
    const inside = nightWindow(new Date());
    if (inside && !s.mode && s.nightSkip !== new Date().toDateString()) { setMode("night", { auto: true }); toast("Night mode is on for the evening"); }
    else if (!inside && s.mode === "night" && s.modeAuto) setMode("");
  }
  setInterval(nightTick, 60000);

  /* ---------- Tester flags ---------- */
  const FLAGS = [["reader", "Test new reader layout", "A centered column with a quieter chapter heading"], ["floatnav", "Test floating bottom bar", "The bottom bar floats as a rounded bar"],
    ["bigtitles", "Test large-title headers", "Bigger titles on sheets and Settings pages"], ["compactcards", "Test compact verse cards", "Tighter rows in lists, My Bible and the notebook"],
    ["newtoday", "Test new Today layout", "Shortcuts as a 2-column grid, bigger verse card"]];
  function setFlag(k, v) { const f = flagsState(); f.flags[k] = !!v; save(K_FLAGS, f); applyAll(); logp("info", "flag " + k + "=" + !!v); }

  /* ---------- the Settings screen ---------- */
  let root = null, stack = [], depth = 0;
  function build() {
    if (root) return;
    root = document.createElement("section"); root.className = "bs-root"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Settings");
    root.innerHTML = '<div class="bs-head"><button type="button" class="bs-hb bs-back" aria-label="Back">' + IC.back + '</button><div class="bs-title">Settings</div><button type="button" class="bs-hb bs-close" aria-label="Close">' + IC.close + '</button></div><div class="bs-body"></div>';
    document.body.appendChild(root);
    root.querySelector(".bs-back").onclick = () => history.back();
    root.querySelector(".bs-close").onclick = () => close();
    window.addEventListener("popstate", e => {
      if (!root.classList.contains("open")) return;
      const st = e.state && e.state.bibleySettings;
      if (!st) { hide(); return; }
      if (st < stack.length) { stack = stack.slice(0, st); render(); }
    });
  }
  function open(page, anchor) {
    build();
    // a bottom sheet (Today, My Bible...) is open: let it close and its history entry pop first
    const sh = document.querySelector(".fx-sheet.open");
    if (sh && !root.classList.contains("open")) {
      let done = false; const go = () => { if (done) return; done = true; window.removeEventListener("popstate", go); setTimeout(() => open(page, anchor), 20); };
      window.addEventListener("popstate", go); setTimeout(go, 400); closeSheetSafe(); return;
    }
    if (!root.classList.contains("open")) { stack = []; root.classList.add("open"); }
    nav(page || "home", anchor);
  }
  function nav(page, anchor) {
    stack.push({ page, anchor }); try { history.pushState({ bibleySettings: stack.length }, ""); } catch {}
    render();
  }
  function hide() { if (!root) return; root.classList.remove("open"); stack = []; }
  function close(then) {
    if (!root || !root.classList.contains("open")) { if (typeof then === "function") then(); return; }
    const n = stack.length; hide();
    if (typeof then === "function") { let done = false; const run = () => { if (done) return; done = true; window.removeEventListener("popstate", onp); setTimeout(then, 30); }; const onp = () => run(); window.addEventListener("popstate", onp); setTimeout(run, 450); }
    if (n) try { history.go(-n); } catch {}
  }
  function closeSheetSafe() { try { ui.closeSheet(); } catch {} }
  function render() {
    const top = stack[stack.length - 1]; if (!top) return;
    const pg = PAGES[top.page] || PAGES.home;
    root.dataset.page = top.page;
    root.querySelector(".bs-title").textContent = typeof pg.title === "function" ? pg.title() : pg.title;
    root.querySelector(".bs-back").style.visibility = stack.length > 1 ? "visible" : "hidden";
    const body = root.querySelector(".bs-body"); body.innerHTML = ""; body.scrollTop = 0;
    const el = document.createElement("div"); el.className = "bs-page"; body.appendChild(el);
    pg.render(el);
    if (top.anchor) setTimeout(() => { const a = el.querySelector('[data-anchor="' + top.anchor + '"]'); if (a) { a.scrollIntoView({ block: "center" }); a.classList.add("bs-flash"); setTimeout(() => a.classList.remove("bs-flash"), 1600); } }, 60);
  }
  const rerender = () => { const top = stack[stack.length - 1]; if (top) top.anchor = null; const b = root.querySelector(".bs-body"), y = b.scrollTop; render(); b.scrollTop = y; };

  /* ---------- small builders ---------- */
  const row = (o) => '<button type="button" class="bs-row" data-go="' + (o.go || "") + '"' + (o.anchor ? ' data-anchor="' + o.anchor + '"' : "") + (o.act ? ' data-act="' + o.act + '"' : "") + '><span class="bs-ic">' + o.ic + '</span><span class="bs-t">' + esc(o.t) + (o.s ? "<small>" + esc(o.s) + "</small>" : "") + "</span>" + (o.right || IC.chev) + "</button>";
  const sw = (k, on, dis) => '<label class="dv-sw bs-sw"><input type="checkbox" data-sw="' + k + '"' + (on ? " checked" : "") + (dis ? " disabled" : "") + '><span></span></label>';
  const swRow = (k, t, sub, on, anchor, ic) => '<div class="bs-row bs-static"' + (anchor ? ' data-anchor="' + anchor + '"' : "") + ">" + (ic ? '<span class="bs-ic">' + ic + "</span>" : "") + '<span class="bs-t">' + esc(t) + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</span>" + sw(k, on) + "</div>";
  const seg = (k, val, opts) => '<div class="fx-seg bs-seg" data-seg="' + k + '">' + opts.map(([v, l]) => '<button type="button" data-v="' + v + '" class="' + (String(val) === String(v) ? "on" : "") + '">' + l + "</button>").join("") + "</div>";
  const group = (label, inner, anchor) => '<div class="bs-group"' + (anchor ? ' data-anchor="' + anchor + '"' : "") + ">" + (label ? '<div class="bs-gl">' + esc(label) + "</div>" : "") + '<div class="bs-card">' + inner + "</div></div>";
  const field = (label, inner, anchor, right) => '<div class="bs-field"' + (anchor ? ' data-anchor="' + anchor + '"' : "") + '><div class="bs-fl"><span>' + esc(label) + "</span>" + (right ? "<b>" + right + "</b>" : "") + "</div>" + inner + "</div>";
  function wire(el, handlers) {
    el.querySelectorAll("[data-go]").forEach(b => { if (b.dataset.go) b.onclick = () => nav(b.dataset.go); });
    el.querySelectorAll("[data-act]").forEach(b => b.onclick = () => handlers.act && handlers.act(b.dataset.act, b));
    el.querySelectorAll("[data-sw]").forEach(i => i.onchange = () => handlers.sw && handlers.sw(i.dataset.sw, i.checked, i));
    el.querySelectorAll("[data-seg]").forEach(sg => sg.querySelectorAll("button").forEach(b => b.onclick = () => { sg.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); handlers.seg && handlers.seg(sg.dataset.seg, b.dataset.v, b); }));
  }

  /* ---------- search index: every setting, where it lives ---------- */
  const INDEX = [
    ["Theme", "dark light sepia black system colour color", "appearance", "theme"], ["Accent colour", "accent color gold sage blue rose lavender", "appearance", "accent"],
    ["Font", "font family typeface serif sans", "appearance", "font"], ["Text size", "font size bigger smaller large", "appearance", "size"],
    ["Line spacing", "line height spacing", "appearance", "lh"], ["Text width", "width column measure", "appearance", "width"], ["Margins", "margin padding edges", "appearance", "margin"],
    ["Card density", "compact comfortable density", "appearance", "density"], ["Corner roundness", "corners round radius square", "appearance", "radius"],
    ["Animations", "motion animation reduce", "appearance", "motion"], ["Reset appearance", "reset default", "appearance", "reset"],
    ["Verse numbers", "verse number style superscript inline hidden", "reading", "vnum"], ["Paragraph or verse per line", "layout paragraph lines", "reading", "layout"],
    ["Bible version", "translation version kjv web esv", "reading", "version"], ["ESV key", "esv api key crossway", "reading", "esv"],
    ["Modes", "modes presets", "modes", ""], ["Focus mode", "focus distraction", "modes", "m-focus"], ["Night mode", "night dark warm dim", "modes", "m-night"],
    ["Simple mode", "kids simple child", "modes", "m-kids"], ["Study mode", "study cross references notes", "modes", "m-study"], ["Prayer mode", "prayer pray", "modes", "m-prayer"],
    ["Low data mode", "low data offline", "modes", "m-lowdata"], ["Accessibility mode", "accessibility large high contrast", "modes", "m-access"],
    ["Night mode schedule", "schedule sunset auto night time", "modes", "sched"],
    ["Bottom bar", "bottom bar tabs reorder dock", "home", "dock"], ["Bottom bar labels", "labels", "home", "labels"], ["Today cards", "today home cards reorder", "home", "today"],
    ["Widgets", "widget home screen add", "widgets", ""], ["Notifications", "notifications quiet hours pause dnd do not disturb", "device", ""], ["Quiet hours", "quiet hours", "device", ""],
    ["Time with God", "time with god prayer timer dnd do not disturb", "device", ""], ["Daily verse notification", "daily verse reminder notification", "device", ""],
    ["Study AI depth", "ai depth simple deep explain", "study", "depth"], ["Study Notebook", "notes notebook", "study", "nb"], ["Memory verses", "memorize memory", "study", "mem"],
    ["Reading plans", "plans streak", "study", "plans"], ["Read aloud speed", "audio speech voice read aloud speed tts", "audio", "tts"],
    ["Export backup", "backup export save", "data", "export"], ["Import backup", "backup import restore", "data", "import"], ["Storage used", "storage space", "data", "usage"],
    ["Privacy", "privacy data ai", "privacy", ""], ["What's new", "whats new changelog updates", "about", "wn"], ["Version", "version about build", "about", "ver"]
  ];
  const PG_NAMES = { appearance: "Appearance", reading: "Reading", modes: "Modes", home: "Home & navigation", widgets: "Widgets", device: "Notifications & device", study: "Study & notes", audio: "Audio", data: "Data & backup", privacy: "Privacy", about: "About", tester: "Tester" };

  /* ---------- pages ---------- */
  const modeName = () => { const s = S(); const m = MODES.find(x => x.id === s.mode); return m ? m.name + " mode is on" : "Focus, Night, Simple, Study and more"; };
  const PAGES = {};
  PAGES.home = { title: "Settings", render(el) {
    const s = S(), fl = flagsState(), p = prefs();
    const th = (THEMES.find(t => t[0] === currentTheme()) || THEMES[0])[1];
    el.innerHTML = '<div class="bs-search">' + IC.search + '<input type="search" placeholder="Search settings" aria-label="Search settings"></div><div class="bs-results" hidden></div><div class="bs-groups">' +
      (s.mode ? '<div class="bs-banner">' + (MODES.find(m => m.id === s.mode) || {}).ic + "<span>" + esc(modeName()) + '</span><button type="button" class="fx-btn small" data-act="modeoff">Turn off</button></div>' : "") +
      group("Look & feel", row({ ic: IC.palette, t: "Appearance", s: th + " \u00b7 " + p.size + "px \u00b7 " + ((FACES.find(f => f[0] === s.face) || (p.font === "sans" ? FACES[3] : FACES[0]))[1]), go: "appearance" }) +
        row({ ic: IC.book, t: "Reading", s: "Verse numbers, layout, Bible version", go: "reading" }) +
        row({ ic: IC.modes, t: "Modes", s: modeName(), go: "modes" }) +
        row({ ic: IC.layout, t: "Home & navigation", s: "Bottom bar, Today cards", go: "layout" })) +
      group("Device", (NAT ? row({ ic: IC.grid, t: "Widgets", s: "Add widgets to your home screen", go: "widgets" }) : "") +
        row({ ic: IC.phone, t: "Notifications & device", s: "Quiet hours, pause, Time with God", go: "device" })) +
      group("Study", row({ ic: IC.notes, t: "Study & notes", s: "Notebook, AI depth, plans, memory verses", go: "study" }) +
        row({ ic: IC.audio, t: "Audio", s: "Read aloud speed", go: "audio" })) +
      group("Your data", row({ ic: IC.data, t: "Data & backup", s: "Export or import everything", go: "data" }) +
        row({ ic: IC.shield, t: "Privacy", s: "What stays on this phone", go: "privacy" })) +
      group("", row({ ic: IC.info, t: "About Bibley", s: "Version " + APP_VER + " \u00b7 What's new", go: "about" }) +
        (fl.unlocked ? row({ ic: IC.flask, t: "Tester", s: "Experimental UI and tools", go: "tester", right: '<span class="bs-tag">Labs</span>' + IC.chev }) : "")) +
      "</div>";
    const inp = el.querySelector("input"), res = el.querySelector(".bs-results"), grp = el.querySelector(".bs-groups");
    inp.oninput = () => {
      const q = inp.value.trim().toLowerCase();
      if (!q) { res.hidden = true; grp.hidden = false; return; }
      const idx = INDEX.filter(r => NAT || r[2] !== "widgets").concat(fl.unlocked ? [["Tester", "tester labs experimental flags playground debug", "tester", ""]] : []);
      const hits = idx.filter(([t, k]) => (t + " " + k).toLowerCase().includes(q));
      res.innerHTML = hits.length ? '<div class="bs-card">' + hits.map((h, i) => '<button type="button" class="bs-row bs-hit" data-i="' + i + '"><span class="bs-t">' + esc(h[0]) + "<small>" + esc(PG_NAMES[h[2]]) + "</small></span>" + IC.chev + "</button>").join("") + "</div>" : '<div class="bs-empty">No settings match \u201c' + esc(inp.value) + "\u201d</div>";
      res.querySelectorAll(".bs-hit").forEach(b => b.onclick = () => { const h = hits[+b.dataset.i]; nav(h[2], h[3]); });
      res.hidden = false; grp.hidden = true;
    };
    wire(el, { act: a => { if (a === "modeoff") { setMode(""); rerender(); } } });
  } };

  PAGES.appearance = { title: "Appearance", render(el) {
    const s = S(), p = prefs(), th = currentTheme();
    const face = s.face || (p.font === "sans" ? "sans" : "source");
    el.innerHTML = '<div class="bs-preview" data-anchor="preview"><div class="bs-pv-card"><div class="bs-pv-h"><span class="fx-eyebrow">Preview</span><span class="bs-pv-ref">John 1</span></div><p class="bs-pv-t"><sup>1</sup> In the beginning was the Word, and the Word was with God, and the Word was God. <sup>2</sup> The same was in the beginning with God.</p><div class="bs-pv-row"><span class="bs-pv-btn">' + IC.book + 'Continue</span><span class="bs-pv-chip">Highlight</span></div></div></div>' +
      field("Theme", '<div class="bs-themes">' + THEMES.map(t => '<button type="button" class="bs-th' + (th === t[0] ? " on" : "") + '" data-theme="' + t[0] + '"><span class="sw" style="' + (t[0] === "system" ? "background:linear-gradient(90deg,#141b2e 50%,#fbfaf7 50%)" : "background:" + t[2]) + '"></span>' + t[1] + "</button>").join("") + "</div>", "theme") +
      field("Accent colour", '<div class="bs-accents">' + ACCENTS.map(a => '<button type="button" class="bs-ac' + (s.accent === a[0] ? " on" : "") + '" data-accent="' + a[0] + '" aria-label="' + a[1] + '" title="' + a[1] + '"><span style="background:' + (th === "light" || th === "sepia" ? a[3] : a[2]) + '"></span></button>').join("") + '<span class="bs-acname">' + esc((ACCENTS.find(a => a[0] === s.accent) || ACCENTS[0])[1]) + "</span></div>", "accent") +
      field("Font", '<div class="bs-fonts">' + FACES.map(f => '<button type="button" class="bs-font' + (face === f[0] ? " on" : "") + '" data-face="' + f[0] + '" style="font-family:' + f[2].replace(/"/g, "'") + '"><b>Aa</b><span>' + f[1] + "</span></button>").join("") + "</div>", "font") +
      field("Text size", '<input class="fx-range bs-range" data-range="size" type="range" min="14" max="30" step="1" value="' + p.size + '" aria-label="Text size">', "size", '<span class="v-size">' + p.size + "px</span>") +
      field("Line spacing", seg("lh", p.lh, [[1.5, "Tight"], [1.78, "Normal"], [2.1, "Roomy"], [2.4, "Airy"]]), "lh") +
      field("Text width", seg("width", s.width, [["narrow", "Narrow"], ["normal", "Normal"], ["wide", "Wide"]]), "width") +
      field("Margins", seg("margin", s.margin, [["s", "Small"], ["m", "Medium"], ["l", "Large"]]), "margin") +
      field("Card density", seg("density", s.density, [["comfortable", "Comfortable"], ["compact", "Compact"]]), "density") +
      field("Corners", seg("radius", s.radius, [["square", "Square"], ["soft", "Soft"], ["round", "Round"]]), "radius") +
      field("Animations", seg("motion", s.motion, [["on", "On"], ["reduced", "Reduced"], ["off", "Off"]]), "motion") +
      '<p class="bs-note">App icon style can\'t be changed yet: Android only allows that for apps built with several icons.</p>' +
      '<button type="button" class="fx-btn block bs-reset" data-act="reset" data-anchor="reset">' + IC.refresh + "Reset appearance</button>";
    el.querySelectorAll("[data-theme]").forEach(b => b.onclick = () => {
      const t = b.dataset.theme;
      if (t === "black") { setS({ themeMode: "black" }); FX.prefs.set("theme", "dark"); }
      else if (t === "system") { setS({ themeMode: "system" }); syncSystemTheme(); }
      else { setS({ themeMode: "" }); FX.prefs.set("theme", t); }
      applyAll(); rerender();
    });
    el.querySelectorAll("[data-accent]").forEach(b => b.onclick = () => { setS({ accent: b.dataset.accent }); rerender(); });
    el.querySelectorAll("[data-face]").forEach(b => b.onclick = () => { const f = FACES.find(x => x[0] === b.dataset.face); setS({ face: f[0] }); FX.prefs.set("font", f[3]); rerender(); });
    const r = el.querySelector('[data-range="size"]'); r.oninput = () => { FX.prefs.set("size", +r.value); el.querySelector(".v-size").textContent = r.value + "px"; };
    wire(el, {
      seg: (k, v) => { if (k === "lh") FX.prefs.set("lh", +v); else setS({ [k]: v }); },
      act: a => { if (a === "reset") { if (!confirm("Reset theme, colours, fonts, size and layout to the defaults? Your notes and highlights are not touched.")) return;
        if (S().mode) setMode("");
        const cur = load(K_SET, {}); ["themeMode", "accent", "face", "width", "margin", "vnum", "layout", "density", "radius", "motion", "labels"].forEach(k => delete cur[k]); save(K_SET, cur);
        de.style.removeProperty("--fx-verse-font");
        ["size", "font", "lh", "theme"].forEach(k => FX.prefs.set(k, FX.prefs.defaults[k]));
        applyAll(); rerender(); toast("Appearance reset"); } }
    });
  } };

  PAGES.reading = { title: "Reading", render(el) {
    const s = S(), vs = document.getElementById("versionSelect");
    const esv = (() => { try { return !!localStorage.getItem("bible_esv_api_key_v1"); } catch { return false; } })();
    el.innerHTML = '<div class="bs-preview"><div class="bs-pv-card"><p class="bs-pv-t"><sup>16</sup> For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life. <sup>17</sup> For God didn\'t send his Son into the world to judge the world.</p></div></div>' +
      field("Verse numbers", seg("vnum", s.vnum, [["sup", "Small"], ["inline", "Inline"], ["hidden", "Hidden"]]), "vnum") +
      field("Layout", seg("layout", s.layout, [["paragraph", "Paragraph"], ["verse", "Verse per line"]]), "layout") +
      field("Bible version", '<select class="fx-input bs-select" data-anchor="version">' + (vs ? vs.innerHTML : "") + "</select>", "version") +
      group("", row({ ic: IC.lock, t: "ESV API key", s: esv ? "Saved on this phone. Tap to change" : "Needed only to read the ESV", act: "esv", anchor: "esv" }) +
        row({ ic: IC.book, t: "Classic reading sheet", s: "The quick size, font and theme sheet", act: "classic" })) +
      '<p class="bs-note">Red letters are not offered: the Bible texts Bibley uses do not mark the words of Jesus.</p>';
    const sel = el.querySelector(".bs-select"); if (vs && sel) { sel.value = vs.value; sel.onchange = () => { vs.value = sel.value; vs.dispatchEvent(new Event("change", { bubbles: true })); toast("Bible version: " + sel.options[sel.selectedIndex].text); }; }
    wire(el, { seg: (k, v) => setS({ [k]: v }), act: a => {
      if (a === "esv") { const cur = (() => { try { return localStorage.getItem("bible_esv_api_key_v1") || ""; } catch { return ""; } })(); const k = prompt("Paste your free ESV API key from api.esv.org. It is stored only on this phone.", cur); if (k != null && k.trim()) { try { localStorage.setItem("bible_esv_api_key_v1", k.trim()); } catch {} toast("ESV key saved"); rerender(); } }
      if (a === "classic") { close(() => FX.readingSheet(), 120); }
    } });
  } };

  PAGES.modes = { title: "Modes", render(el) {
    const s = S(), n = s.night;
    el.innerHTML = '<p class="bs-lead">One tap changes the whole app. Turn a mode off and everything goes back the way it was.</p><div class="bs-modes">' +
      MODES.map(m => '<div class="bs-mode' + (s.mode === m.id ? " on" : "") + '" data-anchor="m-' + m.id + '"><button type="button" class="bs-mode-main" data-mode="' + m.id + '"><span class="bs-ic">' + m.ic + '</span><span class="bs-t">' + esc(m.name) + "<small>" + esc(m.sub) + "</small></span></button>" + sw("mode:" + m.id, s.mode === m.id) + '<button type="button" class="bs-mode-edit" data-edit="' + m.id + '" aria-label="Customize ' + esc(m.name) + '">Customize' + IC.chev + "</button></div>").join("") + "</div>" +
      group("Night mode schedule", swRow("sched", "Turn on Night mode automatically", n.on ? (n.type === "sunset" ? "At sunset, about " + fmtMin(sunsetMin(new Date())) + ", until " + fmtMin(toMin(n.end)) : "From " + fmtMin(toMin(n.start)) + " to " + fmtMin(toMin(n.end))) : "Off", n.on, "sched", IC.sunset) +
        '<div class="bs-sched' + (n.on ? "" : " off") + '">' + seg("stype", n.type, [["sunset", "At sunset"], ["time", "At a set time"]]) +
        '<div class="bs-times">' + (n.type === "time" ? '<label>From<input type="time" class="fx-input" data-t="start" value="' + esc(n.start) + '"></label>' : "") + '<label>Until<input type="time" class="fx-input" data-t="end" value="' + esc(n.end) + '"></label></div>' +
        '<p class="bs-note">Sunset is estimated from your time zone, so no location is needed.</p></div>', "sched");
    el.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { const id = b.dataset.mode; setMode(S().mode === id ? "" : id); rerender(); });
    el.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => nav("mode-" + b.dataset.edit));
    el.querySelectorAll('[data-t]').forEach(i => i.onchange = () => { const night = Object.assign({}, S().night, { [i.dataset.t]: i.value }); setS({ night }); nightTick(); });
    wire(el, {
      sw: (k, on) => { if (k.startsWith("mode:")) { setMode(on ? k.slice(5) : ""); rerender(); } if (k === "sched") { setS({ night: Object.assign({}, S().night, { on }) }); if (on) nightTick(); rerender(); } },
      seg: (k, v) => { if (k === "stype") { setS({ night: Object.assign({}, S().night, { type: v }) }); nightTick(); rerender(); } }
    });
  } };
  MODES.forEach(m => {
    PAGES["mode-" + m.id] = { title: m.name + " mode", render(el) {
      const s = S(), o = modeOpts(m.id), on = s.mode === m.id;
      el.innerHTML = '<div class="bs-mode-hero"><span class="bs-ic big">' + m.ic + '</span><div><b>' + esc(m.name) + " mode</b><small>" + esc(m.sub) + "</small></div></div>" +
        group("", swRow("on", on ? "On" : "Off", on ? "Turn off to go back to your own settings" : "Turn on to apply these changes", on)) +
        group("What it changes", m.opts.map(op => {
          if (op[3] === "range") return '<div class="bs-row bs-static bs-col"><span class="bs-t">' + esc(op[1]) + '<small class="v-' + op[0] + '">' + o[op[0]] + '%</small></span><input class="fx-range bs-range" type="range" min="0" max="60" step="5" value="' + o[op[0]] + '" data-mrange="' + op[0] + '"></div>';
          if (Array.isArray(op[3])) return '<div class="bs-row bs-static bs-col"><span class="bs-t">' + esc(op[1]) + "</span>" + seg("m:" + op[0], o[op[0]], op[3]) + "</div>";
          return swRow("o:" + op[0], op[1], "", !!o[op[0]]);
        }).join("")) +
        (m.id === "prayer" ? '<button type="button" class="fx-btn primary block" data-act="twg">' + IC.moon + "Start Time with God now</button>" : "") +
        (m.id === "night" ? '<button type="button" class="fx-btn block" data-go="modes" data-act="sched">' + IC.sunset + "Schedule Night mode</button>" : "");
      el.querySelectorAll("[data-mrange]").forEach(r => r.oninput = () => { el.querySelector(".v-" + r.dataset.mrange).textContent = r.value + "%"; setModeOpt(m.id, r.dataset.mrange, +r.value); });
      wire(el, {
        sw: (k, v) => { if (k === "on") { setMode(v ? m.id : ""); rerender(); } else if (k.startsWith("o:")) setModeOpt(m.id, k.slice(2), v); },
        seg: (k, v) => { if (k.startsWith("m:")) setModeOpt(m.id, k.slice(2), v); },
        act: a => { if (a === "twg" && window.BibleyDevice) { close(() => window.BibleyDevice.openFocus(), 150); } if (a === "sched") { history.back(); } }
      });
    } };
  });

  function orderList(kind, names, order, hidden, locked) {
    return order.map((k, i) => '<div class="bs-row bs-static bs-ord" data-k="' + k + '"><span class="bs-t">' + esc(names[k]) + '</span><span class="bs-ordb"><button type="button" class="bs-mini" data-mv="' + kind + ':' + k + ':-1"' + (i === 0 ? " disabled" : "") + ' aria-label="Move up">' + IC.up + '</button><button type="button" class="bs-mini" data-mv="' + kind + ':' + k + ':1"' + (i === order.length - 1 ? " disabled" : "") + ' aria-label="Move down">' + IC.down + "</button></span>" + (locked === k ? '<span class="bs-lock" title="Always shown">' + IC.lock + "</span>" : sw(kind + "-show:" + k, !hidden.includes(k))) + "</div>").join("");
  }
  PAGES.layout = { title: "Home & navigation", render(el) {
    const s = S();
    const dock = s.dock.filter(k => DOCK_NAMES[k]); Object.keys(DOCK_NAMES).forEach(k => { if (!dock.includes(k)) dock.push(k); });
    const today = s.today.filter(k => TODAY_NAMES[k]); Object.keys(TODAY_NAMES).forEach(k => { if (!today.includes(k)) today.push(k); });
    if (!NAT) today.splice(0, today.length, ...today.filter(k => k !== "widgets"));
    el.innerHTML = '<div class="bs-dockpv" data-anchor="dock">' + dock.filter(k => k === "aa" || !s.dockHidden.includes(k)).map(k => "<span>" + esc(DOCK_NAMES[k]) + "</span>").join("") + "</div>" +
      group("Bottom bar", orderList("dock", DOCK_NAMES, dock, s.dockHidden, "aa")) +
      group("", swRow("labels", "Show labels under icons", "", s.labels, "labels")) +
      group("Today cards", orderList("today", TODAY_NAMES, today, s.todayHidden), "today") +
      '<button type="button" class="fx-btn block" data-act="resetlayout">' + IC.refresh + "Reset layout</button>";
    el.querySelectorAll("[data-mv]").forEach(b => b.onclick = () => {
      const [kind, k, d] = b.dataset.mv.split(":"); const arr = (kind === "dock" ? dock : today).slice(); const i = arr.indexOf(k), j = i + (+d);
      if (j < 0 || j >= arr.length) return; arr.splice(i, 1); arr.splice(j, 0, k); setS({ [kind]: arr }); rerender();
    });
    wire(el, {
      sw: (k, on) => {
        if (k === "labels") { setS({ labels: on }); rerender(); return; }
        const [kind, key] = k.split("-show:"); const field = kind === "dock" ? "dockHidden" : "todayHidden";
        let h = (S()[field] || []).filter(x => x !== key); if (!on) h.push(key);
        if (kind === "dock" && Object.keys(DOCK_NAMES).filter(x => x !== "aa" && !h.includes(x)).length === 0) { toast("Keep at least one tab next to Settings"); rerender(); return; }
        const patch = { [field]: h }; if (kind === "today" && key === "widgets" && on) patch.widgetCardHidden = false;
        setS(patch); rerender();
      },
      act: a => { if (a === "resetlayout") { setS({ dock: DEF.dock, dockHidden: [], today: DEF.today, todayHidden: [], labels: true, widgetCardHidden: false }); rerender(); toast("Layout reset"); } }
    });
  } };
  // the Settings home row "Home & navigation" opens the layout page
  INDEX.forEach(r => { if (r[2] === "home") r[2] = "layout"; }); PG_NAMES.layout = PG_NAMES.home;

  PAGES.widgets = { title: "Widgets", render(el) {
    const s = S();
    el.innerHTML = '<p class="bs-lead">' + (NAT ? "Tap Add and your launcher asks where to put it. Widgets can be resized and follow your phone's light or dark look." : "Home-screen widgets are part of the Bibley Android app.") + "</p>" +
      '<div class="bs-wgrid">' + WIDGETS.map(w => '<div class="bs-wcell">' + widgetMock(w[0]) + "<b>" + esc(w[1]) + "</b><small>" + esc(w[2]) + '</small><button type="button" class="fx-btn small block" data-pin="' + w[0] + '"' + (NAT ? "" : " disabled") + ">" + IC.plus + "Add</button></div>").join("") + "</div>" +
      '<p class="bs-note">If nothing appears: long-press an empty spot on your home screen, tap Widgets, find Bibley and drag one out.</p>' +
      (NAT ? group("", swRow("card", "Show the widgets card on Today", "", !s.widgetCardHidden && !s.todayHidden.includes("widgets"))) : "");
    el.querySelectorAll("[data-pin]").forEach(b => b.onclick = () => pinWidget(b.dataset.pin));
    wire(el, { sw: (k, on) => { if (k === "card") setS({ widgetCardHidden: !on, todayHidden: S().todayHidden.filter(x => x !== "widgets").concat(on ? [] : ["widgets"]) }); } });
  } };

  PAGES.device = { title: "Notifications & device", render(el) {
    el.innerHTML = '<div class="dv-settings-slot bs-devslot"></div>' + (window.BibleyDevice ? "" : '<p class="bs-note">Device settings are still loading.</p>') +
      (NAT ? '<p class="bs-note">Quiet hours, pausing and Time with God work exactly as in Bibley 1.8.</p>' : "");
    if (window.BibleyDevice) window.BibleyDevice.mountSettings(el.querySelector(".dv-settings-slot"));
  } };

  PAGES.study = { title: "Study & notes", render(el) {
    let d = ""; try { d = localStorage.getItem("bibley_ai_depth_v1") || ""; } catch {}
    el.innerHTML = field("Study AI answers", seg("depth", d, [["simple", "Simple"], ["", "Normal"], ["deep", "Deep"]]), "depth") +
      group("", row({ ic: IC.notes, t: "Study Notebook", s: "Notebooks, templates, highlights", act: "nb", anchor: "nb" }) +
        row({ ic: IC.star, t: "My Bible", s: "Highlights, notes and bookmarks", act: "mb" }) +
        row({ ic: IC.flame, t: "Reading plans", s: (FX.plan() ? FX.plan().name + " \u00b7 day " + FX.plan().day : "Pick a plan"), act: "plans", anchor: "plans" }) +
        row({ ic: IC.study, t: "Memory verses", s: "Practise the verses you're memorizing", act: "mem", anchor: "mem" }));
    wire(el, { seg: (k, v) => { try { if (v) localStorage.setItem("bibley_ai_depth_v1", v); else localStorage.removeItem("bibley_ai_depth_v1"); } catch {} toast("Study AI: " + (v || "normal")); },
      act: a => { close(() => {
        if (a === "nb") { const b = document.querySelector('.fx-dock [data-a="notes"]'); if (b) b.click(); }
        if (a === "mb") FX.open.myBible(); if (a === "plans") FX.open.plans();
        if (a === "mem") { if (window.BibleyStudio) window.BibleyStudio.memoryList(); }
      }, 150); } });
  } };

  PAGES.audio = { title: "Audio", render(el) {
    const s = S();
    el.innerHTML = field("Read aloud speed", seg("tts", s.tts, [[0.75, "Slow"], [0.95, "Normal"], [1.15, "Fast"], [1.35, "Faster"]]), "tts") +
      '<p class="bs-note">Tap the speaker on a chapter to hear it read aloud. The voice comes from your phone\'s text-to-speech settings.</p>';
    wire(el, { seg: (k, v) => setS({ tts: +v }) });
  } };

  function storageRows() {
    const rows = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); const v = localStorage.getItem(k) || ""; rows.push([k, (k.length + v.length) * 2]); } } catch {}
    return rows.sort((a, b) => b[1] - a[1]);
  }
  const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : (n / 1024).toFixed(1) + " KB";
  PAGES.data = { title: "Data & backup", render(el) {
    const total = storageRows().reduce((a, r) => a + r[1], 0);
    el.innerHTML = '<p class="bs-lead">Everything you save in Bibley lives on this phone. Save a backup file now and then, or use one to move to a new phone.</p>' +
      group("", row({ ic: IC.data, t: "Export backup", s: "Highlights, notes, notebook, plans, settings", act: "export", anchor: "export" }) +
        row({ ic: IC.refresh, t: "Import backup", s: "Restore from a Bibley backup file", act: "import", anchor: "import" }) +
        '<div class="bs-row bs-static" data-anchor="usage"><span class="bs-ic">' + IC.info + '</span><span class="bs-t">Storage used<small>' + kb(total) + " on this phone</small></span></div>") +
      '<input type="file" accept="application/json,.json" hidden>';
    const file = el.querySelector("input[type=file]");
    file.onchange = () => { const f = file.files && file.files[0]; if (f) f.text().then(t => { FX.backup.importText(t); rerender(); }); };
    wire(el, { act: a => { if (a === "export") FX.backup.exportFile(); if (a === "import") file.click(); } });
  } };

  PAGES.privacy = { title: "Privacy", render(el) {
    el.innerHTML = '<div class="bs-card bs-prose"><p><b>On this phone.</b> Your highlights, notes, notebook, plans, streak and settings are stored only on this device. Bibley has no account and no tracking.</p>' +
      "<p><b>Study AI.</b> When you ask the Study AI something, your question and the verses around it are sent to the AI service to write the answer.</p>" +
      "<p><b>Bibles.</b> Some translations load from the internet the first time you open them, then work offline.</p>" +
      "<p><b>Your ESV key</b> (if you added one) is kept on this phone and only sent to api.esv.org.</p></div>" +
      group("", row({ ic: IC.data, t: "Data & backup", s: "Export everything as a file", go: "data" }));
    wire(el, {});
  } };

  let taps = 0, tapT = 0;
  PAGES.about = { title: "About", render(el) {
    const fl = flagsState();
    el.innerHTML = '<div class="bs-about"><div class="bs-logo">' + IC.book + "</div><b>Bibley</b><small>Read, study and pray</small></div>" +
      group("", '<button type="button" class="bs-row" data-act="ver" data-anchor="ver"><span class="bs-ic">' + IC.info + '</span><span class="bs-t">Version<small>App ' + APP_VER + " \u00b7 web " + WEB_VER + "</small></span>" + (fl.unlocked ? '<span class="bs-tag">Tester on</span>' : "") + "</button>" +
        row({ ic: IC.star, t: "What's new", s: "Daily verse notifications on iPhone", act: "wn", anchor: "wn" }) +
        row({ ic: IC.shield, t: "Privacy", s: "What stays on this phone", go: "privacy" })) +
      '<p class="bs-note bs-center">Made with care by Oliver Apps.</p>';
    wire(el, { act: a => {
      if (a === "wn") { close(() => { if (window.BibleyStudio) window.BibleyStudio.whatsNew(); }, 150); }
      if (a === "ver") {
        const now = Date.now(); if (now - tapT > 2500) taps = 0; tapT = now; taps++;
        if (flagsState().unlocked) { if (taps === 1) toast("Tester menu is already on"); return; }
        if (taps >= 7) { const f = flagsState(); f.unlocked = true; save(K_FLAGS, f); toast("Tester menu unlocked"); logp("info", "tester unlocked"); taps = 0; rerender(); }
        else if (taps >= 3) toast((7 - taps) + (7 - taps === 1 ? " more tap" : " more taps") + " to unlock the Tester menu", 1200);
      }
    } });
  } };

  PAGES.tester = { title: "Tester", render(el) {
    const fl = flagsState();
    el.innerHTML = '<div class="bs-exp">' + IC.flask + "<span><b>Experimental</b> These are test versions of new designs and tools. Each switch can be turned back off, and none of them touch your notes or highlights.</span></div>" +
      group("Test UI updates", FLAGS.map(f => swRow("flag:" + f[0], f[1], f[2], !!fl.flags[f[0]])).join("")) +
      group("Tools", row({ ic: IC.palette, t: "UI playground", s: "Every component in the current theme", go: "playground" }) +
        row({ ic: IC.star, t: "Show What's new again", act: "wn" }) +
        row({ ic: IC.data, t: "Storage keys", s: "Read-only list with sizes", go: "keys" }) +
        row({ ic: IC.notes, t: "Export debug log", s: "Build info, flags and recent errors", act: "log" }) +
        row({ ic: IC.refresh, t: "Clear cache and reload", s: "Cached app files only, not your data", act: "cache" })) +
      group("Build", buildInfo().map(([k, v]) => '<div class="bs-kv"><span>' + esc(k) + "</span><b>" + esc(v) + "</b></div>").join("")) +
      '<button type="button" class="fx-btn block" data-act="resetflags">' + IC.refresh + 'Reset all tester flags</button><button type="button" class="fx-btn block bs-quiet" data-act="hide">Hide the Tester menu</button>';
    wire(el, {
      sw: (k, on) => { if (k.startsWith("flag:")) setFlag(k.slice(5), on); },
      act: a => {
        if (a === "wn") { close(() => { if (window.BibleyStudio) window.BibleyStudio.whatsNew(); }, 150); }
        if (a === "log") exportLog();
        if (a === "cache") clearCache();
        if (a === "resetflags") { const f = flagsState(); f.flags = {}; save(K_FLAGS, f); applyAll(); rerender(); toast("All tester flags reset"); }
        if (a === "hide") { const f = flagsState(); f.flags = {}; f.unlocked = false; save(K_FLAGS, f); applyAll(); toast("Tester menu hidden. Tap the version 7 times to bring it back"); close(); }
      }
    });
  } };
  function buildInfo() {
    let vc = "10", vn = APP_VER, sdk = "", model = "";
    try { if (NAT && NAT.buildInfo) { const b = JSON.parse(NAT.buildInfo()); vc = String(b.versionCode); vn = b.versionName; sdk = "Android " + b.release + " (API " + b.sdk + ")"; model = b.model; } } catch {}
    let app = ""; try { app = window.AndroidApp && AndroidApp.appVersion ? AndroidApp.appVersion() : ""; } catch {}
    const wv = (navigator.userAgent.match(/Chrome\/([\d.]+)/) || [])[1] || "";
    return [["App version", (app || vn) + (window.AndroidApp ? "" : " (website)")], ["versionCode", window.AndroidApp ? vc : "n/a on the website"], ["Web version", WEB_VER], ["Device", model || (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "unknown"],
      ["Android", sdk || ((navigator.userAgent.match(/Android [\d.]+/) || [""])[0] || "not Android")], ["WebView / Chrome", wv || "unknown"], ["Screen", innerWidth + "\u00d7" + innerHeight + " @" + (devicePixelRatio || 1) + "x"], ["Device bridge", NAT ? "connected" : "none"]];
  }
  function exportLog() {
    const fl = flagsState(), s = S();
    const txt = ["Bibley debug log", new Date().toString(), ""].concat(buildInfo().map(r => r[0] + ": " + r[1]), ["", "Mode: " + (s.mode || "none"), "Flags: " + JSON.stringify(fl.flags), "Theme: " + currentTheme() + " / accent " + s.accent, "",
      "Storage keys (sizes only, no contents):"], storageRows().map(r => "  " + r[0] + "  " + kb(r[1])), ["", "Recent log:"], LOG.map(l => "  " + l)).join("\n");
    try { const blob = new Blob([txt], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "bibley-debug-" + new Date().toISOString().slice(0, 10) + ".txt"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); } catch {}
    ui.copyText(txt).then(ok => toast(ok ? "Debug log saved and copied" : "Debug log saved"));
    return txt;
  }
  async function clearCache() {
    if (!confirm("Clear Bibley's cached app files and reload? Your notes, highlights, plans, settings and saved offline chapters stay.")) return;
    let n = 0;
    try { if (window.caches) { const ks = await caches.keys(); for (const k of ks) { if (/^bibley-shell-/.test(k)) { await caches.delete(k); n++; } } } } catch {}
    toast("Cleared " + n + " cache" + (n === 1 ? "" : "s") + ". Reloading");
    setTimeout(() => location.reload(), 700);
  }
  PAGES.keys = { title: "Storage keys", render(el) {
    const rows = storageRows();
    el.innerHTML = '<p class="bs-lead">Read-only. ' + rows.length + " keys, " + kb(rows.reduce((a, r) => a + r[1], 0)) + " in total.</p>" + '<div class="bs-card">' + rows.map(r => '<div class="bs-kv mono"><span>' + esc(r[0]) + "</span><b>" + kb(r[1]) + "</b></div>").join("") + "</div>";
  } };
  PAGES.playground = { title: "UI playground", render(el) {
    el.innerHTML = '<div class="bs-exp">' + IC.flask + "<span><b>Experimental</b> Every building block in the current theme, accent and flags.</span></div>" +
      '<div class="bs-gl">Buttons</div><div class="fx-row bs-pg-row"><button type="button" class="fx-btn primary">Primary</button><button type="button" class="fx-btn">Default</button><button type="button" class="fx-btn small">' + IC.star + 'Small</button><button type="button" class="fx-btn" disabled>Disabled</button></div>' +
      '<div class="bs-gl">Card</div><div class="fx-card"><div class="fx-eyebrow">' + IC.sun + 'Eyebrow</div><p style="margin:8px 0 0">A flat card with a hairline border. <span class="fx-muted">Muted text.</span></p></div>' +
      '<div class="bs-gl">Segmented and switches</div>' + seg("pgseg", "b", [["a", "One"], ["b", "Two"], ["c", "Three"]]) + '<div style="height:10px"></div>' + group("", swRow("pg1", "Switch on", "With a subtitle", true) + swRow("pg2", "Switch off", "", false)) +
      '<div class="bs-gl">List rows</div>' + group("", row({ ic: IC.book, t: "Row with chevron", s: "Subtitle", act: "noop" }) + row({ ic: IC.notes, t: "Row with tag", right: '<span class="bs-tag">New</span>', act: "noop" })) +
      '<div class="bs-gl">Input and slider</div><input class="fx-input" placeholder="Text input"><div style="height:10px"></div><input class="fx-range bs-range" type="range" min="0" max="10" value="6">' +
      '<div class="bs-gl">Highlights</div><p class="bs-pv-t bs-hls"><span class="hl-yellow">yellow</span> <span class="hl-green">green</span> <span class="hl-blue">blue</span> <span class="hl-pink">pink</span> <span class="hl-purple">purple</span></p>' +
      '<div class="bs-gl">Overlays</div><div class="fx-row bs-pg-row"><button type="button" class="fx-btn small" data-act="toast">Show a toast</button><button type="button" class="fx-btn small" data-act="sheet">Open a sheet</button></div>';
    wire(el, { act: a => {
      if (a === "toast") toast("This is a toast");
      if (a === "sheet") { ui.openSheet("pg", "Sample sheet", b => { b.innerHTML = '<div class="fx-card"><div class="fx-eyebrow">Sheet</div><p>Swipe down, tap outside or press back to close.</p></div><button type="button" class="fx-btn primary block">Primary action</button>'; }); }
    } });
  } };

  /* ---------- reading data for the new widgets, and startup ---------- */
  applyAll(); syncSystemTheme(); nightTick();
  setTimeout(pushPlanToWidgets, 1500);
  document.addEventListener("visibilitychange", () => { if (document.hidden) pushPlanToWidgets(); else nightTick(); });

  window.BibleySettings = { open, close, afterPrefs, apply: applyAll, setMode, ttsRate: () => S().tts || 0.95, modes: MODES.map(m => m.id), _test: { S, flagsState, setFlag, exportLog, buildInfo, storageRows, sunsetMin, nightWindow, pages: () => Object.keys(PAGES).filter(k => PAGES[k]) } };
  logp("info", "ready");
})();
