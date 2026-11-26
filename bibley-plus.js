/* bibley-plus.js - Bibley 7.2 "Plus" (2026-11-26).
   On top of the reader (window.BibleyCore), all stored on the device, syncing through the
   existing BibleySync account when signed in (keys start "bibley_"; the encrypted journal
   syncs only as ciphertext - the PIN and derived key are never stored anywhere):
   - Daily & monthly recaps (reading, notes, highlights, saved verses, prayers, memory, plans, journal count, streak).
     Only dated records are counted; nothing is invented for days with no records.
   - Prayer list (private, active/answered) + guided prayers.
   - Journal with a real PIN lock: entries are AES-GCM encrypted with a key derived from the PIN
     (PBKDF2). Forgetting the PIN means the entries cannot be recovered - the UI says so.
   - Memory practice: flashcards, fill-in-the-blank, first letters, reference quiz, spaced repetition.
   - Reading plans+: custom plan builder, catch-up & skip day, seasonal plans (Advent, Lent, Holy Week/Easter).
   - Compare word-diff: word-level differences + % between the two panes.
   - Back/forward chapter history, print-friendly view, random verse, voice search,
     saved searches + filters (Search+), read-aloud sleep timer & speed bar, notes trash, exports (Markdown/CSV). */
(() => {
  "use strict";
  const C = window.BibleyCore;
  if (!C) { console.warn("Bibley Plus: reader bridge missing"); return; }
  const { BOOKS } = C;

  const K = {
    PRAY: "bibley_plus_prayers_v1",
    JRNL: "bibley_plus_journal_v1",
    SRS: "bibley_plus_srs_v1",
    LOG: "bibley_plus_log_v1",
    CPLAN: "bibley_plus_cplan_v1",
    TRASH: "bibley_plus_trash_v1",
    SHIST: "bibley_plus_searchhist_v1",
    PREFS: "bibley_plus_prefs_v1",
    MEM: "bibley_memorize_v1",          // existing memorize list (bibley-studio.js)
    READ: "bibley_read_v1", ACT: "bibley_activity_v1", PLAN: "bibley_plan_v1", // existing (bibley-features.js)
    NOTES: "bibley_notes_v1", VBM: "bibley_vbm_v1", HL: "bible_highlights_v2",
    NB: "bibley_notebook_v1", SNB: "bibley_nb_v1_notes", SET: "bibley_settings_v2"
  };
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { toast("Couldn't save: storage is full"); return false; } };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const h = html => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const pad = n => String(n).padStart(2, "0");
  const dayStr = (d = new Date()) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const addDays = (s, n) => { const [y, m, d] = s.split("-").map(Number); const t = new Date(y, m - 1, d + n); return dayStr(t); };
  const monthStr = (d = new Date()) => d.getFullYear() + "-" + pad(d.getMonth() + 1);
  const tsDay = ts => { const d = new Date(ts); return isNaN(d) ? null : dayStr(d); };
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const refOf = (b, c, v) => BOOKS[b][1] + " " + c + (v ? ":" + v : "");
  function toast(msg, ms) {
    if (typeof window.bibleyToast === "function") { window.bibleyToast(msg, ms); return; }
    let t = document.querySelector(".fx-toast");
    if (!t) { t = document.createElement("div"); t.className = "fx-toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), ms || 2600);
  }
  function markActive(day = dayStr()) { const a = load(K.ACT, []); if (!a.includes(day)) { a.push(day); a.sort(); save(K.ACT, a.slice(-800)); } }
  function streak() {
    const set = new Set(load(K.ACT, [])); const today = dayStr();
    let d = set.has(today) ? today : addDays(today, -1), n = 0;
    while (set.has(d)) { n++; d = addDays(d, -1); }
    return { n, today: set.has(today) };
  }
  function logEvent(t, n) { const l = load(K.LOG, []); l.push({ d: dayStr(), t, n: n || 1 }); save(K.LOG, l.slice(-3000)); }
  const prefs = () => Object.assign({ diffOn: false, ttsTimer: 0 }, load(K.PREFS, {}));
  const setPref = (k, v) => { const p = load(K.PREFS, {}); p[k] = v; save(K.PREFS, p); };
  const OT_END = 38; // last OT book index (Malachi)

  const IC = {
    sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    cal: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18"/></svg>',
    pray: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-4 0-7-2.5-7-6 0-2.5 1.5-4 3-5.5S12 5 12 3c0 2 2.5 4.5 4 6.5s3 3 3 5.5c0 3.5-3 6-7 6z"/></svg>',
    lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    cards: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3" y="6" width="13" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v13"/></svg>',
    route: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8 17.5 16 6.5M6 13v-2a4 4 0 0 1 4-4h2"/></svg>',
    search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    tool: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L14 13l-3-3 3.7-3.7z"/></svg>',
    plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
  };

  /* ================= sheet shell ================= */
  let overlay = null, sheet = null, sheetBody = null, sheetTitle = null, backBtn = null;
  const viewStack = [];
  function ensureSheet() {
    if (sheet) return;
    overlay = h('<div class="bp-overlay"></div>');
    sheet = h('<div class="bp-sheet" role="dialog" aria-label="Bibley Plus"></div>');
    sheet.innerHTML = '<div class="bp-sheet-head"><button class="bp-back" aria-label="Back" style="visibility:hidden">&#8249;</button><div class="bp-sheet-title">Plus</div><button class="bp-close" aria-label="Close">&#215;</button></div><div class="bp-sheet-body"></div>';
    document.body.append(overlay, sheet);
    overlay.onclick = closePlus;
    sheet.querySelector(".bp-close").onclick = closePlus;
    backBtn = sheet.querySelector(".bp-back");
    backBtn.onclick = () => { const v = viewStack.pop(); if (v) renderView(v, true); };
    sheetTitle = sheet.querySelector(".bp-sheet-title");
    sheetBody = sheet.querySelector(".bp-sheet-body");
    document.addEventListener("keydown", e => { if (e.key === "Escape" && sheet.classList.contains("open")) closePlus(); });
  }
  function renderView(view, isBack) {
    ensureSheet();
    if (!isBack && viewStack[viewStack.length - 1] !== view) { if (view !== "menu") viewStack.push(view); else viewStack.length = 0; }
    if (isBack && view === "menu") viewStack.length = 0;
    backBtn.style.visibility = view === "menu" ? "hidden" : "visible";
    sheetBody.innerHTML = "";
    sheetBody.scrollTop = 0;
    const V = VIEWS[view] || VIEWS.menu;
    sheetTitle.textContent = V.title;
    try { V.render(sheetBody); } catch (err) { console.error("Bibley Plus view failed", view, err); sheetBody.innerHTML = '<p class="bp-muted">Something went wrong opening this screen.</p>'; }
  }
  function openPlus(view) {
    ensureSheet();
    // one sheet at a time: close the app's Today/Plans/etc sheet if it is open
    try { const fx = window.BibleyFX; if (fx && fx.voice && fx.voice.sheetOpen && fx.voice.sheetOpen()) fx.voice.closeSheet(); } catch {}
    overlay.classList.add("open"); sheet.classList.add("open"); renderView(view || "menu");
  }
  function closePlus() { if (!sheet) return; overlay.classList.remove("open"); sheet.classList.remove("open"); lockJournal(); }

  /* ================= dock / entry ================= */
  function addDockButton() {
    const dock = document.querySelector(".fx-dock");
    const mk = host => {
      const b = h('<button type="button" class="bp-dock-b" aria-label="Bibley Plus" title="Recaps, prayer, journal, memory, plans &amp; tools">' + IC.plus + '<span>Plus</span></button>');
      b.onclick = () => openPlus("menu");
      host.appendChild(b);
    };
    if (dock) { mk(dock); return; }
    if (!document.querySelector(".bp-fab")) {
      const b = h('<button type="button" class="bp-fab">Plus</button>');
      b.onclick = () => openPlus("menu");
      document.body.appendChild(b);
    }
  }

  VIEWS_MENU();
  function VIEWS_MENU() { /* placeholder hoisted, real VIEWS below */ }

  /* ================= shared data readers (existing Bibley records) ================= */
  const readMap = () => load(K.READ, {});
  function chaptersOn(day) {
    const rm = readMap(), out = [];
    Object.keys(rm).forEach(k => { if (rm[k] === day) { const m = k.match(/^(.+)-(\d+)$/); if (m) { const bi = BOOKS.findIndex(b => b[0] === m[1]); if (bi >= 0) out.push([bi, +m[2]]); } } });
    return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
  function summarizeChapters(chs) {
    const parts = []; let i = 0;
    while (i < chs.length) { const b = chs[i][0]; let j = i; while (j + 1 < chs.length && chs[j + 1][0] === b && chs[j + 1][1] === chs[j][1] + 1) j++;
      parts.push(BOOKS[b][1] + " " + chs[i][1] + (j > i ? "\u2013" + chs[j][1] : "")); i = j + 1; }
    return parts.join(" \u00b7 ");
  }
  const inRange = (ts, from, to) => { const d = tsDay(ts); return d && d >= from && d <= to; };
  function countAdded(map, from, to) { let n = 0; Object.values(map || {}).forEach(e => { const t = e && (e.added || e.created); if (t && inRange(t, from, to)) n++; }); return n; }
  function countNb(from, to) { const d = load(K.NB, null); let n = 0; (d && d.notes || []).forEach(x => { const t = x.created || x.updated; if (t && inRange(t, from, to)) n++; }); return n; }
  function countSnb(from, to) { let n = 0; (load(K.SNB, []) || []).forEach(x => { const t = x.created || x.updated; if (t && inRange(t, from, to)) n++; }); return n; }
  function planDaysOn(day) {
    let n = 0;
    const p = load(K.PLAN, null); if (p && p.done) Object.values(p.done).forEach(d => { if (d === day) n++; });
    const cp = load(K.CPLAN, null); if (cp && cp.plans) cp.plans.forEach(pl => { Object.values(pl.done || {}).forEach(d => { if (d === day) n++; }); });
    return n;
  }
  function logOn(day, type) { return load(K.LOG, []).filter(e => e.d === day && (!type || e.t === type)).reduce((s, e) => s + (e.n || 1), 0); }
  function journalDays() {
    if (jEntries) return Array.from(new Set(jEntries.map(e => e.d))); // unlocked: derive from memory
    const m = load(K.JRNL, null); return (m && m.days) || []; // legacy records only (days no longer stored in plaintext)
  }

  /* ================= recaps ================= */
  function dayRecap(day) {
    const pr = load(K.PRAY, { items: [] });
    return {
      day,
      chapters: chaptersOn(day),
      notes: countAdded(load(K.NOTES, {}), day, day) + countNb(day, day) + countSnb(day, day),
      highlights: countAdded(load(K.HL, {}), day, day),
      savedVerses: countAdded(load(K.VBM, {}), day, day),
      prayersAdded: pr.items.filter(p => tsDay(p.added) === day).length,
      prayersAnswered: pr.items.filter(p => p.answered && tsDay(p.answered) === day),
      memReviews: logOn(day, "mem"),
      planDays: planDaysOn(day),
      journal: journalDays().includes(day),
      active: load(K.ACT, []).includes(day)
    };
  }
  function monthRecap(month) { // month = "YYYY-MM"
    const from = month + "-01", to = month + "-31";
    const rm = readMap(); const chs = [];
    Object.keys(rm).forEach(k => { const d = rm[k]; if (d >= from && d <= to) { const m = k.match(/^(.+)-(\d+)$/); if (m) { const bi = BOOKS.findIndex(b => b[0] === m[1]); if (bi >= 0) chs.push([bi, +m[2]]); } } });
    const bookCount = {}; chs.forEach(([b]) => { bookCount[b] = (bookCount[b] || 0) + 1; });
    const top = Object.entries(bookCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([b, n]) => BOOKS[b][1] + " (" + n + ")");
    const actDays = load(K.ACT, []).filter(d => d.startsWith(month)).length;
    // longest streak inside the month
    const set = new Set(load(K.ACT, []).filter(d => d.startsWith(month)));
    let best = 0; for (let i = 1; i <= 31; i++) { const d = month + "-" + pad(i); if (set.has(d)) { let n = 0, dd = d; while (set.has(dd)) { n++; dd = addDays(dd, -1); } best = Math.max(best, n); } }
    const pr = load(K.PRAY, { items: [] });
    const lg = load(K.LOG, []).filter(e => e.d.startsWith(month));
    let pd = 0; const p = load(K.PLAN, null); if (p && p.done) Object.values(p.done).forEach(d => { if (d.startsWith(month)) pd++; });
    const cp = load(K.CPLAN, null); if (cp && cp.plans) cp.plans.forEach(pl => Object.values(pl.done || {}).forEach(d => { if (d.startsWith(month)) pd++; }));
    return {
      month, chapters: chs.length, topBooks: top, activeDays: actDays, bestStreak: best,
      notes: countAdded(load(K.NOTES, {}), from, to) + countNb(from, to) + countSnb(from, to),
      highlights: countAdded(load(K.HL, {}), from, to), savedVerses: countAdded(load(K.VBM, {}), from, to),
      prayersAdded: pr.items.filter(x => { const d = tsDay(x.added); return d && d.startsWith(month); }).length,
      prayersAnswered: pr.items.filter(x => x.answered && tsDay(x.answered) && tsDay(x.answered).startsWith(month)).length,
      memReviews: lg.filter(e => e.t === "mem").reduce((s, e) => s + (e.n || 1), 0),
      planDays: pd, journalEntries: journalDays().filter(d => d.startsWith(month)).length
    };
  }
  function recapText(d) {
    const L = ["Bibley recap - " + d.day];
    if (d.chapters.length) L.push("Read: " + summarizeChapters(d.chapters));
    if (d.planDays) L.push("Reading plan days completed: " + d.planDays);
    if (d.notes) L.push("Notes written: " + d.notes);
    if (d.highlights) L.push("Highlights: " + d.highlights);
    if (d.savedVerses) L.push("Verses saved: " + d.savedVerses);
    if (d.prayersAdded) L.push("Prayers added: " + d.prayersAdded);
    if (d.prayersAnswered.length) L.push("Prayers answered: " + d.prayersAnswered.map(p => p.title).join(", "));
    if (d.memReviews) L.push("Memory verses reviewed: " + d.memReviews);
    if (d.journal) L.push("Journaled: yes");
    const s = streak(); if (s.n) L.push("Streak: " + s.n + " day" + (s.n === 1 ? "" : "s"));
    if (L.length === 1) L.push("Nothing recorded for this day.");
    return L.join("\n");
  }

  const VIEWS = {};
  VIEWS.menu = {
    title: "Bibley Plus",
    render(body) {
      const due = dueCount();
      const items = [
        ["recap-day", IC.sun, "Daily recap", "What you read, wrote and prayed today"],
        ["recap-month", IC.cal, "Monthly recap", "Your month in reading and study"],
        ["prayers", IC.pray, "Prayer list", (load(K.PRAY, { items: [] }).items.filter(p => !p.answered).length) + " active \u00b7 private to you"],
        ["journal", IC.lock, "Journal", "PIN-locked, encrypted on this device"],
        ["memory", IC.cards, "Memory practice", due ? due + " verse" + (due === 1 ? "" : "s") + " due for review" : "Flashcards & quizzes with spaced repetition"],
        ["plans", IC.route, "Reading plans +", "Custom plans, catch-up, seasonal plans"],
        ["search", IC.search, "Search+", "Filters, saved searches, voice search"],
        ["tools", IC.tool, "Tools", "Print, random verse, trash, export"]
      ];
      items.forEach(([v, ic, t, sub]) => {
        const b = h('<button class="bp-menu-item"><span class="mi-ic">' + ic + '</span><span>' + esc(t) + '<span class="mi-sub">' + esc(sub) + '</span></span><span class="mi-arrow">&#8250;</span></button>');
        b.onclick = () => renderView(v);
        body.appendChild(b);
      });
      body.appendChild(h('<p class="bp-muted" style="margin-top:14px">Everything here stays on this device. When you sign in under Settings &gt; Account &amp; Cloud Sync, it syncs with your other devices through your Bibley account. Nothing is shared publicly.</p>'));
    }
  };
  VIEWS["recap-day"] = {
    title: "Daily recap",
    render(body) {
      let day = dayStr();
      const head = h('<div class="bp-row spread"><button class="bp-btn small">&#8249; Prev</button><b style="font-family:Fraunces;color:var(--gold-soft)"></b><button class="bp-btn small">Next &#8250;</button></div>');
      const [prev, label, next] = head.querySelectorAll("button,b");
      const content = h('<div></div>');
      const draw = () => {
        label.textContent = day === dayStr() ? "Today" : day;
        const d = dayRecap(day);
        content.innerHTML = "";
        const rows = [];
        if (d.chapters.length) rows.push(["\u{1F4D6}", "Read", summarizeChapters(d.chapters)]);
        if (d.planDays) rows.push(["\u{1F4C5}", "Reading plan", d.planDays + " day" + (d.planDays === 1 ? "" : "s") + " completed"]);
        if (d.notes) rows.push(["\u270D\uFE0F", "Notes", d.notes + " written"]);
        if (d.highlights) rows.push(["\u{1F3A8}", "Highlights", String(d.highlights)]);
        if (d.savedVerses) rows.push(["\u{1F516}", "Verses saved", String(d.savedVerses)]);
        if (d.prayersAdded) rows.push(["\u{1F64F}", "Prayers added", String(d.prayersAdded)]);
        d.prayersAnswered.forEach(p => rows.push(["\u2728", "Prayer answered", p.title]));
        if (d.memReviews) rows.push(["\u{1F9E0}", "Memory review", d.memReviews + " verse" + (d.memReviews === 1 ? "" : "s") + " reviewed"]);
        if (d.journal) rows.push(["\u{1F4D3}", "Journal", "Entry written"]);
        const card = h('<div class="bp-card gold"></div>');
        if (rows.length) rows.forEach(([ic, t, sub]) => card.appendChild(h('<div class="bp-list-row"><span class="lr-ic">' + ic + '</span><span class="lr-txt">' + esc(t) + '<span class="lr-sub">' + esc(sub) + '</span></span></div>')));
        else card.innerHTML = '<p class="bp-muted" style="margin:0">Nothing recorded for this day' + (day === dayStr() ? " yet" : "") + '. Reading, notes, highlights, saved verses, prayers, memory practice and journal entries show up here as you do them.</p>';
        content.appendChild(card);
        const s = streak();
        content.appendChild(h('<div class="bp-stat-grid"><div class="bp-stat"><b>' + d.chapters.length + '</b><span>chapters</span></div><div class="bp-stat"><b>' + s.n + '</b><span>day streak</span></div><div class="bp-stat"><b>' + (d.notes + d.highlights + d.savedVerses) + '</b><span>study marks</span></div></div>'));
        const cp = h('<button class="bp-btn block">Copy recap as text</button>');
        cp.onclick = async () => { const ok = await copyText(recapText(d)); toast(ok ? "Recap copied" : "Couldn't copy"); };
        content.appendChild(cp);
      };
      prev.onclick = () => { day = addDays(day, -1); draw(); };
      next.onclick = () => { day = addDays(day, 1); draw(); };
      draw();
      body.append(head, content);
      body.appendChild(h('<p class="bp-muted">Only activity recorded on this device is counted - days before these records existed simply have nothing to show.</p>'));
    }
  };
  VIEWS["recap-month"] = {
    title: "Monthly recap",
    render(body) {
      let month = monthStr();
      const head = h('<div class="bp-row spread"><button class="bp-btn small">&#8249; Prev</button><b style="font-family:Fraunces;color:var(--gold-soft)"></b><button class="bp-btn small">Next &#8250;</button></div>');
      const [prev, label, next] = head.querySelectorAll("button,b");
      const content = h('<div></div>');
      const draw = () => {
        const [y, m] = month.split("-").map(Number);
        label.textContent = MONTHS[m - 1] + " " + y + (month === monthStr() ? " (so far)" : "");
        const r = monthRecap(month);
        content.innerHTML = "";
        content.appendChild(h('<div class="bp-stat-grid"><div class="bp-stat"><b>' + r.chapters + '</b><span>chapters read</span></div><div class="bp-stat"><b>' + r.activeDays + '</b><span>days active</span></div><div class="bp-stat"><b>' + r.bestStreak + '</b><span>best streak</span></div><div class="bp-stat"><b>' + r.notes + '</b><span>notes</span></div><div class="bp-stat"><b>' + r.highlights + '</b><span>highlights</span></div><div class="bp-stat"><b>' + r.savedVerses + '</b><span>verses saved</span></div><div class="bp-stat"><b>' + r.prayersAdded + '</b><span>prayers added</span></div><div class="bp-stat"><b>' + r.prayersAnswered + '</b><span>prayers answered</span></div><div class="bp-stat"><b>' + r.memReviews + '</b><span>memory reviews</span></div></div>'));
        if (r.topBooks.length) content.appendChild(h('<div class="bp-card"><div class="bp-eyebrow">Most read</div><p style="margin:4px 0 0;font-size:14px">' + esc(r.topBooks.join(" \u00b7 ")) + '</p></div>'));
        const more = [];
        if (r.planDays) more.push(r.planDays + " reading-plan day" + (r.planDays === 1 ? "" : "s") + " completed");
        if (r.journalEntries) more.push(r.journalEntries + " journal entr" + (r.journalEntries === 1 ? "y" : "ies"));
        if (more.length) content.appendChild(h('<p class="bp-muted">' + esc(more.join(" \u00b7 ")) + '</p>'));
        if (!r.chapters && !r.activeDays) content.appendChild(h('<p class="bp-muted">Nothing recorded for this month. Counts start from activity recorded on this device.</p>'));
      };
      prev.onclick = () => { const [y, m] = month.split("-").map(Number); const d = new Date(y, m - 2, 1); month = monthStr(d); draw(); };
      next.onclick = () => { const [y, m] = month.split("-").map(Number); const d = new Date(y, m, 1); month = monthStr(d); draw(); };
      draw();
      body.append(head, content);
    }
  };

  /* ================= prayer list ================= */
  const prayAll = () => { const d = load(K.PRAY, null); return d && Array.isArray(d.items) ? d : { items: [] }; };
  const praySave = d => save(K.PRAY, d);
  const GUIDED = [
    { name: "Morning", ref: "Psalm 143:8", text: "Lord, thank you for this new day.\nLet me hear of your unfailing love this morning, because I trust you.\nShow me the way I should go today - in my words, my work and my choices.\nKeep me from anything that would pull me away from you.\nI give you this day. Amen." },
    { name: "Thankfulness", ref: "Psalm 100", text: "Father, today I want to say thank you.\nThank you for life, for breath, for your Word.\nThank you for the people you have put around me.\nThank you for the answers I have seen, and for the ones still on the way.\nYou are good, and your love endures forever. Amen." },
    { name: "For someone in need", ref: "James 5:16", text: "Lord, I bring you this person on my heart: (say their name).\nYou know exactly what they are facing.\nPlease meet them where they are - comfort them, provide for them, heal what is broken.\nShow me if there is something I can do to help.\nI trust them to you. Amen." },
    { name: "When I'm anxious", ref: "Philippians 4:6-7", text: "Lord, you said not to be anxious about anything, but to bring everything to you in prayer.\nSo here it is - all of it: (name what is worrying you).\nThank you that you listen and that you care.\nGuard my heart and my mind with your peace today.\nAmen." },
    { name: "The Lord's Prayer pattern", ref: "Matthew 6:9-13", text: "Our Father in heaven, hallowed be your name.\nYour kingdom come, your will be done, on earth as it is in heaven.\nGive us today our daily bread.\nForgive us our debts, as we also have forgiven our debtors.\nAnd lead us not into temptation, but deliver us from the evil one.\nAmen." }
  ];
  VIEWS.prayers = {
    title: "Prayer list",
    render(body) {
      const d = prayAll();
      const active = d.items.filter(p => !p.answered);
      const answered = d.items.filter(p => p.answered);
      const addCard = h('<div class="bp-card"><div class="bp-eyebrow">New prayer</div><input class="bp-input" placeholder="What are you praying for?" maxlength="120"/><textarea class="bp-textarea" placeholder="Details (optional)" style="margin-top:8px"></textarea><button class="bp-btn primary block">Add prayer</button></div>');
      const [inp, ta, btn] = [addCard.querySelector("input"), addCard.querySelector("textarea"), addCard.querySelector("button")];
      btn.onclick = () => {
        const title = inp.value.trim(); if (!title) { toast("Give the prayer a short title"); return; }
        const dd = prayAll(); dd.items.unshift({ id: "p" + Date.now().toString(36), title, detail: ta.value.trim(), added: Date.now(), answered: 0 });
        praySave(dd); logEvent("prayer", 1); toast("Prayer added"); renderView("prayers", true);
      };
      body.appendChild(addCard);
      body.appendChild(h('<p class="bp-muted">Private: your prayers live on this device and in your Bibley account when signed in. They are never public.</p>'));
      if (active.length) {
        body.appendChild(h('<div class="bp-eyebrow">Active (' + active.length + ')</div>'));
        active.forEach(p => body.appendChild(prayerCard(p)));
      }
      if (answered.length) {
        body.appendChild(h('<div class="bp-eyebrow">Answered (' + answered.length + ')</div>'));
        answered.forEach(p => body.appendChild(prayerCard(p)));
      }
      body.appendChild(h('<div class="bp-eyebrow">Guided prayers</div>'));
      GUIDED.forEach(g => {
        const b = h('<button class="bp-menu-item"><span class="mi-ic">' + IC.pray + '</span><span>' + esc(g.name) + '<span class="mi-sub">' + esc(g.ref) + '</span></span><span class="mi-arrow">&#8250;</span></button>');
        b.onclick = () => {
          sheetTitle.textContent = g.name;
          backBtn.style.visibility = "visible"; viewStack.push("prayers");
          sheetBody.innerHTML = "";
          const card = h('<div class="bp-card gold"><p class="bp-muted" style="margin:0 0 8px">' + esc(g.ref) + '</p><div class="bp-guided">' + esc(g.text) + '</div></div>');
          const use = h('<button class="bp-btn block">Save as a prayer request</button>');
          use.onclick = () => { const dd = prayAll(); dd.items.unshift({ id: "p" + Date.now().toString(36), title: g.name + " prayer", detail: g.ref, added: Date.now(), answered: 0 }); praySave(dd); logEvent("prayer", 1); toast("Added to your prayer list"); renderView("prayers", true); };
          sheetBody.append(card, use);
        };
        body.appendChild(b);
      });
    }
  };
  function prayerCard(p) {
    const card = h('<div class="bp-prayer' + (p.answered ? " answered" : "") + '"><b>' + esc(p.title) + '</b>' + (p.detail ? '<p>' + esc(p.detail) + '</p>' : "") + '<div class="pr-meta">Added ' + esc(tsDay(p.added) || "") + (p.answered ? " \u00b7 answered " + esc(tsDay(p.answered) || "") : "") + '</div><div class="bp-row" style="margin-top:8px"></div></div>');
    const row = card.querySelector(".bp-row");
    if (!p.answered) {
      const ans = h('<button class="bp-btn small primary">Mark answered</button>');
      ans.onclick = () => { const d = prayAll(); const it = d.items.find(x => x.id === p.id); if (it) { it.answered = Date.now(); praySave(d); logEvent("prayer_answered", 1); toast("Marked as answered \u2728"); renderView("prayers", true); } };
      row.appendChild(ans);
    } else {
      const re = h('<button class="bp-btn small">Make active again</button>');
      re.onclick = () => { const d = prayAll(); const it = d.items.find(x => x.id === p.id); if (it) { it.answered = 0; praySave(d); renderView("prayers", true); } };
      row.appendChild(re);
    }
    const del = h('<button class="bp-btn small danger">Delete</button>');
    del.onclick = () => { if (!confirm("Delete this prayer? (goes to Trash for 30 days)")) return; const d = prayAll(); const i = d.items.findIndex(x => x.id === p.id); if (i >= 0) { pushTrash("prayer", p.title, { key: K.PRAY, id: p.id, data: d.items[i] }); d.items.splice(i, 1); praySave(d); renderView("prayers", true); } };
    row.appendChild(del);
    return card;
  }

  /* ================= encrypted journal ================= */
   /* Entries are AES-GCM encrypted with a key derived from the PIN/passphrase (PBKDF2-SHA256, 250k rounds).
     Stored/synced record: {salt, iv, ct, updated} - ciphertext plus a last-modified timestamp for sync
     merge only. Entry dates live INSIDE the encrypted payload (older records may still carry a plaintext
     days[] list until the next save). The PIN is never stored; there is no recovery - the screens say so.
     Honest limits: a short numeric PIN can be brute-forced offline by someone who obtains the stored
     record, and encryption cannot protect against hostile code running in this page. The setup screen
     says both in user terms. */
  let jKey = null, jEntries = null, jLockTimer = 0;
  const b64 = buf => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const journalMeta = () => load(K.JRNL, null);
  async function deriveKey(pin, salt) {
    const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function journalUnlock(pin) {
    const m = journalMeta(); if (!m) return false;
    try {
      const key = await deriveKey(pin, unb64(m.salt));
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(m.iv) }, key, unb64(m.ct));
      const data = JSON.parse(new TextDecoder().decode(pt));
      if (!data || (data.v !== 1 && data.v !== 2) || !Array.isArray(data.entries)) return false;
      jKey = key; jEntries = data.entries; armJournalLock(); return true;
    } catch { return false; }
  }
  async function journalSetup(pin) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    jKey = await deriveKey(pin, salt); jEntries = [];
    await journalPersist(salt); armJournalLock(); return true;
  }
  async function journalPersist(salt) {
    const m = journalMeta() || {};
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const payload = { v: 2, entries: jEntries, days: Array.from(new Set(jEntries.map(e => e.d))) };
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, jKey, new TextEncoder().encode(JSON.stringify(payload)));
    save(K.JRNL, { salt: salt ? b64(salt) : m.salt, iv: b64(iv), ct: b64(ct), updated: Date.now() });
  }
  function lockJournal() { jKey = null; jEntries = null; clearTimeout(jLockTimer); }
  function armJournalLock() { clearTimeout(jLockTimer); jLockTimer = setTimeout(() => { lockJournal(); if (sheet && sheet.classList.contains("open") && sheetTitle.textContent === "Journal") renderView("journal", true); }, 10 * 60 * 1000); }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") lockJournal(); });

  VIEWS.journal = {
    title: "Journal",
    render(body) {
      const m = journalMeta();
      if (!jKey) {
        const wrap = h('<div class="bp-lock-wrap"><div class="bp-lock-ic">' + IC.lock + '</div></div>');
        if (!m) {
          wrap.appendChild(h('<p style="font-family:Fraunces;font-size:17px;color:var(--gold-soft);margin:0 0 6px">Lock your journal</p>'));
          wrap.appendChild(h('<p class="bp-muted">Entries are encrypted on this device with a key made from your PIN or passphrase; if you sync, only the encrypted copy ever leaves the device. <b>Strength matters:</b> a short numeric PIN can be guessed by someone who gets hold of your data - a longer passphrase is much stronger. Encryption protects the stored entries; it cannot protect against malicious software on the device itself. If you forget your PIN or passphrase, these entries <b>cannot be recovered</b>. There is no reset.</p>'));
          const p1 = h('<input class="bp-input" type="password" placeholder="Choose a PIN or passphrase (longer is stronger)" maxlength="64"/>');
          const p2 = h('<input class="bp-input" type="password" placeholder="Repeat it" maxlength="64" style="margin-top:8px"/>');
          const btn = h('<button class="bp-btn primary block" style="margin-top:10px">Create locked journal</button>');
          btn.onclick = async () => {
            const a = p1.value.trim();
            if (a.length < 4) { toast("Needs at least 4 characters - longer is stronger"); return; }
            if (a !== p2.value.trim()) { toast("They don't match"); return; }
            btn.disabled = true;
            try { await journalSetup(a); toast("Journal created and locked"); renderView("journal", true); }
            catch (e) { console.error(e); toast("Encryption isn't available in this browser"); btn.disabled = false; }
          };
          wrap.append(p1, p2, btn);
        } else {
          wrap.appendChild(h('<p style="font-family:Fraunces;font-size:17px;color:var(--gold-soft);margin:0 0 6px">Journal is locked</p>'));
          wrap.appendChild(h('<p class="bp-muted">Entries are encrypted on this device. A wrong PIN or passphrase cannot open them, and a forgotten one cannot be recovered.</p>'));
          const p1 = h('<input class="bp-input" type="password" placeholder="PIN or passphrase" maxlength="64"/>');
          const btn = h('<button class="bp-btn primary block" style="margin-top:10px">Unlock</button>');
          const go = async () => { btn.disabled = true; const ok = await journalUnlock(p1.value); btn.disabled = false; if (ok) renderView("journal", true); else { toast("Wrong PIN"); p1.value = ""; p1.focus(); } };
          btn.onclick = go; p1.onkeydown = e => { if (e.key === "Enter") go(); };
          wrap.append(p1, btn);
        }
        body.appendChild(wrap);
        return;
      }
      armJournalLock();
      const bar = h('<div class="bp-row spread"><span class="bp-muted">' + jEntries.length + ' entr' + (jEntries.length === 1 ? "y" : "ies") + '</span><button class="bp-btn small">Lock now</button></div>');
      bar.querySelector("button").onclick = () => { lockJournal(); renderView("journal", true); };
      body.appendChild(bar);
      const PROMPTS = ["What are you grateful to God for today?", "What is God teaching you right now?", "A verse that stayed with you today", "Who is on your heart to pray for?", "What do you want to remember from today?"];
      const prompt = PROMPTS[new Date().getDate() % PROMPTS.length];
      const card = h('<div class="bp-card"><div class="bp-eyebrow">Today \u00b7 ' + esc(prompt) + '</div><textarea class="bp-textarea" placeholder="Write freely - this is between you and God."></textarea><button class="bp-btn primary block">Save entry</button></div>');
      const ta = card.querySelector("textarea"), sv = card.querySelector("button");
      sv.onclick = async () => {
        const t = ta.value.trim(); if (!t) { toast("Write something first"); return; }
        jEntries.unshift({ id: "j" + Date.now().toString(36), d: dayStr(), prompt, text: t, ts: Date.now() });
        await journalPersist(); logEvent("journal", 1); toast("Entry saved"); renderView("journal", true);
      };
      body.appendChild(card);
      jEntries.forEach(e => {
        const el = h('<div class="bp-j-entry"><div class="je-date">' + esc(e.d) + '</div><div class="je-prompt">' + esc(e.prompt || "") + '</div><div class="je-text">' + esc(e.text) + '</div><div class="bp-row" style="margin-top:6px"><button class="bp-btn small danger">Delete</button></div></div>');
        el.querySelector("button").onclick = async () => { if (!confirm("Delete this journal entry? This cannot be undone.")) return; jEntries = jEntries.filter(x => x.id !== e.id); await journalPersist(); renderView("journal", true); };
        body.appendChild(el);
      });
    }
  };

  /* ================= memory practice (flashcards + spaced repetition) ================= */
  const memAll = () => { const d = load(K.MEM, {}); return d && typeof d === "object" && d.verses && typeof d.verses === "object" ? d : { v: 1, verses: {} }; };
  const srsAll = () => { const d = load(K.SRS, {}); return d && d.cards ? d : { cards: {} }; };
  const srsSave = d => save(K.SRS, d);
  function dueCount() {
    const s = srsAll(), today = dayStr(); let n = 0;
    Object.keys(memAll().verses).forEach(k => { const c = s.cards[k]; if (!c || c.due <= today) n++; });
    return n;
  }
  function grade(key, g) { // g: 0 again, 1 hard, 2 good, 3 easy (SM-2 lite)
    const s = srsAll(); const c = s.cards[key] || { ease: 2.5, ivl: 0, reps: 0 };
    c.reps++;
    if (g === 0) { c.ivl = 0; c.ease = Math.max(1.3, c.ease - 0.2); }
    else {
      if (g === 1) c.ease = Math.max(1.3, c.ease - 0.15);
      if (g === 3) c.ease += 0.15;
      c.ivl = c.ivl === 0 ? (g === 3 ? 3 : 1) : Math.max(1, Math.round(c.ivl * c.ease * (g === 1 ? 0.8 : 1)));
    }
    c.due = addDays(dayStr(), c.ivl); c.last = dayStr(); s.cards[key] = c; srsSave(s); logEvent("mem", 1);
  }
  const memList = () => Object.entries(memAll().verses).map(([k, v]) => ({ key: k, ref: v.ref || k, text: v.text || "" }));
  const STARTER = [["John 3:16"], ["Psalm 23:1"], ["Proverbs 3:5"], ["Proverbs 3:6"], ["Philippians 4:13"], ["Romans 8:28"], ["Psalm 119:105"], ["Joshua 1:9"]];
  async function addStarterVerses() {
    let added = 0;
    for (const [r] of STARTER) {
      try {
        const parsed = C.parseRef ? C.parseRef(r) : null; if (!parsed) continue;
        const text = await C.fetchVerseText(r, "web"); if (!text) continue;
        const key = BOOKS[parsed.bookIdx][0] + "-" + parsed.chapter + "-" + parsed.verse;
        const all = memAll();
        if (!all.verses[key]) { all.verses[key] = { text, ref: r, added: Date.now() }; all.v = 1; save(K.MEM, all); added++; }
      } catch {}
    }
    return added;
  }
  const MODES = [["flip", "Flashcard"], ["blank", "Fill in the blank"], ["first", "First letters"], ["quiz", "Reference quiz"]];
  VIEWS.memory = {
    title: "Memory practice",
    render(body) {
      const list = memList();
      const today = dayStr(); const s = srsAll();
      const due = list.filter(v => { const c = s.cards[v.key]; return !c || c.due <= today; });
      const learned = list.filter(v => { const c = s.cards[v.key]; return c && c.due > today; });
      body.appendChild(h('<div class="bp-stat-grid"><div class="bp-stat"><b>' + due.length + '</b><span>due today</span></div><div class="bp-stat"><b>' + learned.length + '</b><span>scheduled</span></div><div class="bp-stat"><b>' + list.length + '</b><span>total verses</span></div></div>'));
      if (!list.length) {
        body.appendChild(h('<p class="bp-muted">No memory verses yet. Verses you save in Memorize mode (tap a verse in the reader) appear here, or start with a small starter set.</p>'));
        const st = h('<button class="bp-btn primary block">Add 8 well-known starter verses</button>');
        st.onclick = async () => { st.disabled = true; const n = await addStarterVerses(); toast(n ? n + " verses added" : "Couldn't add verses (offline?)"); renderView("memory", true); };
        body.appendChild(st);
        const cur = C.selectedVerse && C.selectedVerse();
        if (cur) {
          const add = h('<button class="bp-btn block">Add current verse (' + esc(refOf(cur.bookIdx, cur.chapter, cur.verseNum)) + ')</button>');
          add.onclick = () => { const all = memAll(); all.verses[cur.key] = { text: cur.text, ref: refOf(cur.bookIdx, cur.chapter, cur.verseNum), added: Date.now() }; all.v = 1; save(K.MEM, all); toast("Added"); renderView("memory", true); };
          body.appendChild(add);
        }
        return;
      }
      const pool = due.length ? due : list;
      body.appendChild(h('<div class="bp-eyebrow">' + (due.length ? "Review " + due.length + " due verse" + (due.length === 1 ? "" : "s") : "Nothing due - practice anyway") + '</div>'));
      MODES.forEach(([m, name]) => {
        const b = h('<button class="bp-menu-item"><span class="mi-ic">' + IC.cards + '</span><span>' + name + '</span><span class="mi-arrow">&#8250;</span></button>');
        b.onclick = () => startSession(m, pool);
        body.appendChild(b);
      });
      body.appendChild(h('<p class="bp-muted">Spaced repetition: verses you know well come back less often; ones you miss come back tomorrow. Reviews count toward your recaps.</p>'));
    }
  };
  let session = null;
  function startSession(mode, pool) {
    session = { mode, queue: pool.slice().sort(() => Math.random() - .5).slice(0, 10), done: 0 };
    sheetTitle.textContent = MODES.find(m => m[0] === mode)[1];
    viewStack.push("memory"); backBtn.style.visibility = "visible";
    nextCard();
  }
  function nextCard() {
    sheetBody.innerHTML = "";
    if (!session.queue.length) {
      sheetBody.appendChild(h('<div class="bp-card gold" style="text-align:center"><p style="font-family:Fraunces;font-size:17px;margin:6px 0">Session complete</p><p class="bp-muted">' + session.done + ' verse' + (session.done === 1 ? "" : "s") + ' reviewed. Nice work.</p></div>'));
      const back = h('<button class="bp-btn block">Back to Memory practice</button>');
      back.onclick = () => renderView("memory", true);
      sheetBody.appendChild(back);
      return;
    }
    const v = session.queue[0];
    sheetBody.appendChild(h('<div class="bp-progress"><i style="width:' + Math.round(session.done / (session.done + session.queue.length) * 100) + '%"></i></div>'));
    const box = h('<div class="bp-flash"><div class="bp-flash-inner"></div></div>');
    const inner = box.querySelector(".bp-flash-inner");
    const grades = h('<div class="bp-grade-row"><button>Again<small>tomorrow</small></button><button>Hard<small>shorter gap</small></button><button>Good<small>normal gap</small></button><button>Easy<small>longer gap</small></button></div>');
    grades.style.display = "none";
    grades.querySelectorAll("button").forEach((btn, g) => btn.onclick = () => { grade(v.key, g); session.queue.shift(); session.done++; nextCard(); });
    const reveal = () => { grades.style.display = "grid"; };
    if (session.mode === "flip") {
      inner.innerHTML = '<div class="bp-flash-ref">' + esc(v.ref) + '</div><div class="bp-flash-text" hidden>' + esc(v.text) + '</div>';
      inner.onclick = () => { inner.querySelector(".bp-flash-text").hidden = false; reveal(); };
    } else if (session.mode === "blank") {
      const words = v.text.split(/\s+/);
      const hideIdx = new Set(); const step = Math.max(3, Math.round(words.length / 4));
      for (let i = 1; i < words.length; i += step) hideIdx.add(i);
      const html = words.map((w, i) => hideIdx.has(i) ? '<span class="blank" data-w="' + esc(w) + '">' + esc(w) + '</span>' : esc(w)).join(" ");
      inner.innerHTML = '<div class="bp-flash-ref">' + esc(v.ref) + '</div><div class="bp-flash-text">' + html + '</div><p class="bp-muted" style="margin:0">Tap to reveal the missing words</p>';
      inner.onclick = () => { inner.querySelectorAll(".blank").forEach(b => b.classList.add("shown")); reveal(); };
    } else if (session.mode === "first") {
      const fl = v.text.split(/\s+/).map(w => { const m = w.match(/[\w\u2019'-]+|./gu); return m ? m[0][0] : ""; }).join(" ");
      inner.innerHTML = '<div class="bp-flash-ref">' + esc(v.ref) + '</div><div class="bp-firstletters">' + esc(fl) + '</div><div class="bp-flash-text" hidden>' + esc(v.text) + '</div><p class="bp-muted" style="margin:0">Say it from the first letters, then tap</p>';
      inner.onclick = () => { inner.querySelector(".bp-flash-text").hidden = false; reveal(); };
    } else { // quiz: pick the reference
      const others = memList().filter(x => x.key !== v.key).sort(() => Math.random() - .5).slice(0, 3);
      const opts = others.concat([v]).sort(() => Math.random() - .5);
      inner.innerHTML = '<div class="bp-flash-text">' + esc(v.text) + '</div><p class="bp-muted" style="margin:0">Which verse is this?</p>';
      const orow = h('<div style="display:grid;gap:7px;margin-top:10px"></div>');
      opts.forEach(o => {
        const b = h('<button class="bp-btn">' + esc(o.ref) + '</button>');
        b.onclick = () => {
          if (o.key === v.key) { grade(v.key, 2); session.queue.shift(); session.done++; toast("Correct"); nextCard(); }
          else { b.disabled = true; b.style.opacity = .4; grade(v.key, 0); toast("Not that one - it will come back tomorrow"); }
        };
        orow.appendChild(b);
      });
      inner.appendChild(orow);
    }
    sheetBody.append(box, grades);
  }

  /* ================= reading plans + ================= */
  const cplanAll = () => { const d = load(K.CPLAN, null); return d && Array.isArray(d.plans) ? d : { plans: [], active: null }; };
  const cplanSave = d => save(K.CPLAN, d);
  const chRange = (b0, b1) => { const out = []; for (let b = b0; b <= b1; b++) for (let c = 1; c <= BOOKS[b][2]; c++) out.push([b, c]); return out; };
  const splitDays = (list, days) => Array.from({ length: days }, (_, d) => list.slice(Math.floor(d * list.length / days), Math.floor((d + 1) * list.length / days)));
  function easterDate(year) { // Gregorian computus
    const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), hh = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - hh - k) % 7, m = Math.floor((a + 11 * hh + 22 * l) / 451), mo = Math.floor((hh + l - 7 * m + 114) / 31), da = ((hh + l - 7 * m + 114) % 31) + 1;
    return new Date(year, mo - 1, da);
  }
  function seasonalPlans(year) {
    const easter = easterDate(year);
    const lentStart = dayStr(new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 46)); // Ash Wednesday
    const palm = dayStr(new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 7));
    const B = n => BOOKS.findIndex(b => b[0] === n);
    const ch = (n, c) => [[B(n), c]];
    const adventDays = [["Isaiah", 7], ["Isaiah", 9], ["Isaiah", 11], ["Micah", 5], ["Zechariah", 9], ["Isaiah", 40], ["Malachi", 3], ["Malachi", 4], ["Psalms", 24], ["Psalms", 96], ["Isaiah", 52], ["Isaiah", 53], ["Luke", 1], ["Matthew", 1], ["Luke", 2], ["Matthew", 2], ["John", 1], ["Isaiah", 60], ["Isaiah", 61], ["Galatians", 4], ["Philippians", 2], ["Psalms", 98], ["Revelation", 21], ["Revelation", 22]].map(([n, c]) => ch(n, c));
    const lentDays = []; for (let i = 1; i <= 24; i++) lentDays.push(ch("Luke", i)); for (let i = 1; i <= 16; i++) lentDays.push(ch("Mark", i));
    const holyDays = [["Matthew", 21], ["Matthew", 22], ["Matthew", 24], ["Matthew", 25], ["Matthew", 26], ["Matthew", 27], ["Psalms", 22], ["Matthew", 28]].map(([n, c]) => ch(n, c));
    return [
      { id: "advent", name: "Advent", blurb: "24 days of promise and arrival, Dec 1\u201324", start: year + "-12-01", days: adventDays },
      { id: "lent", name: "Lent", blurb: "40 days with Jesus through Luke & Mark", start: lentStart, days: lentDays },
      { id: "holyweek", name: "Holy Week & Easter", blurb: "Palm Sunday to Easter morning, 8 days", start: palm, days: holyDays }
    ];
  }
  function activeSeasonal() {
    const today = dayStr(), y = new Date().getFullYear();
    return seasonalPlans(y).concat(seasonalPlans(y + 1)).map(s => Object.assign({}, s, { end: addDays(s.start, s.days.length - 1) }))
      .sort((a, b) => a.start < b.start ? -1 : 1);
  }
  function cplanState(pl) {
    const done = pl.done || {}, skipped = pl.skipped || {};
    let idx = pl.days.findIndex((_, i) => !done[i] && !skipped[i]);
    const finished = idx < 0; if (finished) idx = pl.days.length - 1;
    const doneCount = Object.keys(done).length;
    const expected = Math.min(pl.days.length - 1, Math.floor((Date.parse(dayStr()) - Date.parse(pl.started)) / 86400000));
    return { idx, finished, doneCount, total: pl.days.length, pct: Math.round(doneCount / pl.days.length * 100), behind: Math.max(0, expected - doneCount - Object.keys(skipped).length) };
  }
  VIEWS.plans = {
    title: "Reading plans +",
    render(body) {
      const d = cplanAll();
      const mine = d.plans.find(p => p.id === d.active) || null;
      if (mine) {
        const st = cplanState(mine);
        const card = h('<div class="bp-card gold"><div class="bp-row spread"><b style="font-family:Fraunces;color:var(--gold-soft)">' + esc(mine.name) + '</b><span class="bp-muted">' + st.doneCount + '/' + st.total + ' days \u00b7 ' + st.pct + '%</span></div><div class="bp-progress"><i style="width:' + st.pct + '%"></i></div></div>');
        if (st.behind > 0 && !st.finished) {
          const cu = h('<button class="bp-btn small">Catch up (' + st.behind + ' day' + (st.behind === 1 ? "" : "s") + ' behind)</button>');
          cu.onclick = () => { const dd = cplanAll(); const pl = dd.plans.find(p => p.id === dd.active); pl.started = addDays(dayStr(), -(st.doneCount + Object.keys(pl.skipped || {}).length)); cplanSave(dd); toast("Schedule moved up - today is your next reading"); renderView("plans", true); };
          card.appendChild(cu);
        }
        body.appendChild(card);
        if (!st.finished) {
          const todays = mine.days[st.idx];
          const tc = h('<div class="bp-card"><div class="bp-eyebrow">Today \u00b7 Day ' + (st.idx + 1) + '</div><p style="font-size:15px;margin:4px 0 10px">' + esc(summarizeChapters(todays)) + '</p><div class="bp-row"></div></div>');
          const row = tc.querySelector(".bp-row");
          const open = h('<button class="bp-btn small">Open reading</button>');
          open.onclick = () => { C.goTo(todays[0][0], todays[0][1]); closePlus(); };
          const done = h('<button class="bp-btn small primary">Mark day done</button>');
          done.onclick = () => {
            const dd = cplanAll(); const pl = dd.plans.find(p => p.id === dd.active);
            pl.done = pl.done || {}; pl.done[st.idx] = dayStr(); cplanSave(dd);
            const rm = readMap(); todays.forEach(([b, c]) => { if (!rm[BOOKS[b][0] + "-" + c]) rm[BOOKS[b][0] + "-" + c] = dayStr(); }); save(K.READ, rm);
            markActive(); logEvent("plan", 1);
            const after = cplanState(pl);
            toast(after.finished ? "Plan complete - well done!" : "Day " + (st.idx + 1) + " done \u2713", 3000);
            renderView("plans", true);
          };
          const skip = h('<button class="bp-btn small">Skip this day</button>');
          skip.onclick = () => { if (!confirm("Skip Day " + (st.idx + 1) + "? Its reading is dropped, not moved.")) return; const dd = cplanAll(); const pl = dd.plans.find(p => p.id === dd.active); pl.skipped = pl.skipped || {}; pl.skipped[st.idx] = dayStr(); cplanSave(dd); renderView("plans", true); };
          const quit = h('<button class="bp-btn small danger">End plan</button>');
          quit.onclick = () => { if (!confirm("End this plan? Your progress is kept in history.")) return; const dd = cplanAll(); dd.active = null; cplanSave(dd); renderView("plans", true); };
          row.append(open, done, skip, quit);
          body.appendChild(tc);
        } else {
          body.appendChild(h('<p class="bp-muted">Plan complete. Start another below.</p>'));
        }
      }
      body.appendChild(h('<div class="bp-eyebrow">' + (mine ? "Start a different plan" : "Start a plan") + '</div>'));
      const custom = h('<button class="bp-menu-item"><span class="mi-ic">' + IC.route + '</span><span>Build a custom plan<span class="mi-sub">Choose the books and the pace</span></span><span class="mi-arrow">&#8250;</span></button>');
      custom.onclick = () => renderView("plan-builder");
      body.appendChild(custom);
      const seasons = activeSeasonal();
      body.appendChild(h('<div class="bp-eyebrow">Seasonal</div>'));
      seasons.slice(0, 3).forEach(s => {
        const b = h('<button class="bp-menu-item"><span class="mi-ic">' + IC.cal + '</span><span>' + esc(s.name) + '<span class="mi-sub">' + esc(s.blurb) + ' \u00b7 ' + esc(s.start) + ' \u2192 ' + esc(s.end) + '</span></span><span class="mi-arrow">&#8250;</span></button>');
        b.onclick = () => {
          const dd = cplanAll();
          const id = s.id + "-" + s.start;
          if (!dd.plans.some(p => p.id === id)) dd.plans.push({ id, name: s.name + " " + s.start.slice(0, 4), days: s.days, started: dayStr(), done: {}, skipped: {}, seasonal: s.id });
          dd.active = id; cplanSave(dd); toast(s.name + " plan started"); renderView("plans", true);
        };
        body.appendChild(b);
      });
      body.appendChild(h('<p class="bp-muted">These plans sit alongside the built-in plans (Plans button in the dock) - pick whichever you like; both count toward your streak. If you switch, progress on the other plan is kept.</p>'));
    }
  };
  VIEWS["plan-builder"] = {
    title: "Custom plan",
    render(body) {
      const scopes = [["Whole Bible", 0, 65], ["Old Testament", 0, OT_END], ["New Testament", 39, 65], ["Gospels", 39, 42], ["Gospels & Acts", 39, 43], ["Letters", 44, 64], ["Psalms", 18, 18], ["Proverbs", 19, 19]];
      const card = h('<div class="bp-card"><div class="bp-eyebrow">Build your plan</div>' +
        '<input class="bp-input" placeholder="Plan name (optional)" maxlength="60"/>' +
        '<div class="bp-eyebrow" style="margin-top:10px">What to read</div><select class="bp-select"></select>' +
        '<div class="bp-eyebrow" style="margin-top:10px">Pace</div><div class="bp-row"><input class="bp-input" type="number" min="1" max="365" value="30" style="width:90px"/><span class="bp-muted">days to finish</span></div>' +
        '<div class="bp-day-list" style="margin-top:10px"></div>' +
        '<button class="bp-btn primary block" style="margin-top:10px">Start this plan</button></div>');
      const [nameIn, sel, daysIn, preview, start] = [card.querySelector("input"), card.querySelector("select"), card.querySelector("input[type=number]"), card.querySelector(".bp-day-list"), card.querySelector("button")];
      scopes.concat(BOOKS.map((b, i) => [b[1], i, i])).forEach(([n, b0, b1]) => sel.appendChild(h('<option value="' + b0 + '-' + b1 + '">' + esc(n) + '</option>')));
      const draw = () => {
        const [b0, b1] = sel.value.split("-").map(Number);
        const list = chRange(b0, b1);
        const days = Math.max(1, Math.min(365, +daysIn.value || 30));
        const dd = splitDays(list, days);
        preview.textContent = list.length + " chapters over " + days + " days \u00b7 Day 1: " + summarizeChapters(dd[0]) + (dd[1] ? " \u00b7 Day 2: " + summarizeChapters(dd[1]) : "") + " \u00b7 ...";
      };
      sel.onchange = draw; daysIn.oninput = draw; draw();
      start.onclick = () => {
        const [b0, b1] = sel.value.split("-").map(Number);
        const days = Math.max(1, Math.min(365, +daysIn.value || 30));
        const list = chRange(b0, b1);
        const name = nameIn.value.trim() || (sel.options[sel.selectedIndex].text + " in " + days + " days");
        const dd = cplanAll();
        const id = "c" + Date.now().toString(36);
        dd.plans.push({ id, name, days: splitDays(list, days), started: dayStr(), done: {}, skipped: {} });
        dd.active = id; cplanSave(dd);
        toast("Plan started"); renderView("plans", true);
      };
      body.appendChild(card);
    }
  };

  /* ================= Search+ (filters, saved searches, voice) ================= */
  const jsonBibleCache = {};
  async function loadWholeBible(id) {
    if (jsonBibleCache[id]) return jsonBibleCache[id];
    const base = (location.hostname === "appassets.androidplatform.net") ? "https://olivercraftboycompany-design.github.io/Bibley-/bibles/" : "bibles/";
    const res = await fetch(base + id + ".json.gz");
    if (!res.ok) throw new Error("load failed");
    const u8 = new Uint8Array(await res.arrayBuffer());
    let text;
    if (u8[0] === 0x1f && u8[1] === 0x8b && typeof DecompressionStream !== "undefined") {
      text = await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    } else text = new TextDecoder().decode(u8);
    const d = JSON.parse(text);
    if (!d || !Array.isArray(d.b) || d.b.length !== 66) throw new Error("bad bible data");
    jsonBibleCache[id] = d;
    return d;
  }
  function bibleSearch(d, q, b0, b1, cap) {
    const out = []; const needle = q.toLowerCase();
    outer: for (let b = b0; b <= b1; b++) {
      const book = d.b[b]; if (!book) continue;
      for (let c = 0; c < book.length; c++) {
        const ch = book[c]; if (!ch) continue;
        for (let v = 0; v < ch.length; v++) {
          const t = ch[v];
          if (t && t.toLowerCase().includes(needle)) { out.push({ b, c: c + 1, v: v + 1, text: t }); if (out.length >= cap) break outer; }
        }
      }
    }
    return out;
  }
  const shistAll = () => load(K.SHIST, []);
  VIEWS.search = {
    title: "Search+",
    render(body) {
      const versions = Object.keys(C.jsonBibles || { web: 1, kjv: 1 });
      const card = h('<div class="bp-card"><div class="bp-row"><input class="bp-input" placeholder="Search the whole Bible..." style="flex:1"/><button class="bp-btn small" title="Voice search">&#x1F3A4;</button></div>' +
        '<div class="bp-row" style="margin-top:8px"><select class="bp-select" style="flex:1"></select><select class="bp-select" style="flex:1"></select><select class="bp-select" style="flex:1"></select></div>' +
        '<button class="bp-btn primary block" style="margin-top:8px">Search</button></div>');
      const [inp, mic] = card.querySelectorAll("input,button");
      const [scopeSel, bookSel, verSel] = card.querySelectorAll("select");
      [["all", "Old & New Testament"], ["ot", "Old Testament"], ["nt", "New Testament"]].forEach(([v, n]) => scopeSel.appendChild(h('<option value="' + v + '">' + n + '</option>')));
      const updBooks = () => {
        bookSel.innerHTML = '<option value="-1">All books</option>';
        const a = scopeSel.value === "nt" ? 39 : 0, b = scopeSel.value === "ot" ? OT_END : 65;
        for (let i = a; i <= b; i++) bookSel.appendChild(h('<option value="' + i + '">' + esc(BOOKS[i][1]) + '</option>'));
      };
      scopeSel.onchange = updBooks; updBooks();
      versions.forEach(v => verSel.appendChild(h('<option value="' + v + '"' + (v === (C.panes.a.version || "web") ? " selected" : "") + '>' + v.toUpperCase() + '</option>')));
      const results = h('<div></div>');
      const histWrap = h('<div></div>');
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) mic.disabled = true, mic.title = "Voice search needs Chrome or Edge";
      mic.onclick = () => {
        if (!SR) { toast("Voice search needs Chrome or Edge"); return; }
        const r = new SR(); r.lang = "en-US"; r.interimResults = false;
        mic.style.color = "#e6bf69";
        r.onresult = e => { inp.value = e.results[0][0].transcript; run(); };
        r.onend = () => { mic.style.color = ""; };
        r.onerror = () => { mic.style.color = ""; toast("Didn't catch that"); };
        try { r.start(); } catch {}
      };
      async function run() {
        const q = inp.value.trim(); if (q.length < 2) { toast("Type at least 2 letters"); return; }
        results.innerHTML = '<p class="bp-muted">Searching ' + verSel.value.toUpperCase() + '...</p>';
        try {
          const d = await loadWholeBible(verSel.value);
          let b0 = scopeSel.value === "nt" ? 39 : 0, b1 = scopeSel.value === "ot" ? OT_END : 65;
          if (+bookSel.value >= 0) { b0 = b1 = +bookSel.value; }
          const found = bibleSearch(d, q, b0, b1, 200);
          const hist = shistAll().filter(x => x.q.toLowerCase() !== q.toLowerCase());
          hist.unshift({ q, ts: Date.now() }); save(K.SHIST, hist.slice(0, 15)); drawHist();
          results.innerHTML = '<p class="bp-muted">' + found.length + (found.length >= 200 ? "+" : "") + ' result' + (found.length === 1 ? "" : "s") + ' in ' + verSel.value.toUpperCase() + '</p>';
          const ql = q.toLowerCase();
          found.forEach(r => {
            const i = r.text.toLowerCase().indexOf(ql);
            const marked = esc(r.text.slice(0, i)) + "<mark>" + esc(r.text.slice(i, i + q.length)) + "</mark>" + esc(r.text.slice(i + q.length));
            const row = h('<div class="bp-vrow"><b>' + esc(refOf(r.b, r.c, r.v)) + '</b><p>' + marked + '</p></div>');
            row.onclick = () => { C.goTo(r.b, r.c); closePlus(); };
            results.appendChild(row);
          });
          if (!found.length) results.appendChild(h('<p class="bp-muted">No matches. Try another word or a wider scope.</p>'));
        } catch (e) { console.error(e); results.innerHTML = '<p class="bp-muted">Couldn\'t load that translation for searching. Are you online?</p>'; }
      }
      card.querySelector(".bp-btn.primary").onclick = run;
      inp.onkeydown = e => { if (e.key === "Enter") run(); };
      function drawHist() {
        const hist = shistAll();
        histWrap.innerHTML = hist.length ? '<div class="bp-eyebrow">Recent searches</div>' : "";
        if (!hist.length) return;
        const chips = h('<div class="bp-chips"></div>');
        hist.slice(0, 10).forEach(x => { const c = h('<button class="bp-chip">' + esc(x.q) + '</button>'); c.onclick = () => { inp.value = x.q; run(); }; chips.appendChild(c); });
        const clr = h('<button class="bp-chip">Clear</button>'); clr.onclick = () => { save(K.SHIST, []); drawHist(); };
        chips.appendChild(clr);
        histWrap.appendChild(chips);
      }
      drawHist();
      body.append(card, histWrap, results);
      body.appendChild(h('<p class="bp-muted">Searches the offline translations bundled with Bibley. The drawer search still searches chapters you have opened in any version.</p>'));
    }
  };

  /* ================= trash (soft-delete recovery) ================= */
  const trashAll = () => { const d = load(K.TRASH, []); const cut = Date.now() - 30 * 86400000; const keep = d.filter(x => x.deletedAt > cut); if (keep.length !== d.length) save(K.TRASH, keep); return keep; };
  function pushTrash(kind, label, payload) { const t = trashAll(); t.unshift({ id: "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind, label: String(label || kind).slice(0, 120), payload, deletedAt: Date.now() }); save(K.TRASH, t.slice(0, 100)); }
  // Watch deletions other modules make: capture entries that disappear from watched keys.
  (function watchDeletions() {
    const WATCH = {
      [K.NOTES]: { kind: "Verse note", find: (o, n) => removedFromMap(o, n, e => e.ref || "Verse note") },
      [K.VBM]: { kind: "Saved verse", find: (o, n) => removedFromMap(o, n, e => e.ref || "Saved verse") },
      [K.MEM]: { kind: "Memory verse", find: (o, n) => removedFromMap(o.verses || {}, n.verses || {}, e => e.ref || "Memory verse") },
      [K.SNB]: { kind: "Study note", find: (o, n) => removedFromArr(o, n, e => e.title || "Study note") }
    };
    function removedFromMap(o, n, lab) { const out = []; Object.keys(o).forEach(k => { if (!(k in n)) out.push({ label: lab(o[k]), data: o[k], id: k }); }); return out; }
    function removedFromArr(o, n, lab) { if (!Array.isArray(o) || !Array.isArray(n)) return []; const ids = new Set(n.map(x => x && x.id)); return o.filter(x => x && x.id != null && !ids.has(x.id)).map(x => ({ label: lab(x), data: x, id: x.id })); }
    const snap = {};
    const grab = () => { Object.keys(WATCH).forEach(k => { try { snap[k] = JSON.parse(localStorage.getItem(k) || "null"); } catch { snap[k] = null; } }); };
    grab();
    const rawSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      const had = Object.prototype.hasOwnProperty.call(snap, k) ? snap[k] : undefined;
      const r = rawSet.apply(this, arguments);
      if (this === localStorage && WATCH[k]) {
        try {
          const now = JSON.parse(localStorage.getItem(k) || "null");
          if (had !== undefined && had && now) WATCH[k].find(had, now).forEach(x => pushTrash(WATCH[k].kind, x.label, { key: k, id: x.id, data: x.data }));
          snap[k] = now;
        } catch {}
      }
      return r;
    };
  })();
  function restoreTrash(entry) {
    const { key, id, data } = entry.payload;
    try {
      if (key === K.SNB) { const arr = load(K.SNB, []); if (!arr.some(x => x.id === id)) { arr.push(data); save(K.SNB, arr); } }
      else if (key === K.MEM) { const all = memAll(); if (!all.verses[id]) { all.verses[id] = data; all.v = 1; save(K.MEM, all); } }
      else if (key === K.PRAY) { const d = prayAll(); if (!d.items.some(x => x.id === id)) { d.items.unshift(data); praySave(d); } }
      else { const o = load(key, {}); if (!(id in o)) { o[id] = data; save(key, o); } }
      save(K.TRASH, trashAll().filter(x => x.id !== entry.id));
      return true;
    } catch { return false; }
  }

  /* ================= export ================= */
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; }
    catch { try { const ta = document.createElement("textarea"); ta.value = t; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok; } catch { return false; } }
  }
  function download(name, text, mime) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: mime || "text/plain" }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }
  function exportMarkdown() {
    const L = ["# Bibley export", "", "_" + new Date().toLocaleString() + "_", ""];
    const hl = load(K.HL, {}); const keys = Object.keys(hl);
    if (keys.length) { L.push("## Highlights"); keys.forEach(k => { const e = hl[k]; L.push("- **" + (e.ref || k) + "** (" + (e.color || "") + "): " + (e.text || "")); }); L.push(""); }
    const nt = load(K.NOTES, {});
    if (Object.keys(nt).length) { L.push("## Verse notes"); Object.keys(nt).forEach(k => { const e = nt[k]; L.push("### " + (e.ref || k)); L.push(e.text || ""); L.push(""); }); }
    const vb = load(K.VBM, {});
    if (Object.keys(vb).length) { L.push("## Saved verses"); Object.keys(vb).forEach(k => { const e = vb[k]; L.push("- **" + (e.ref || k) + "**: " + (e.text || "")); }); L.push(""); }
    const mv = memAll().verses;
    if (Object.keys(mv).length) { L.push("## Memory verses"); Object.keys(mv).forEach(k => L.push("- **" + (mv[k].ref || k) + "**: " + (mv[k].text || ""))); L.push(""); }
    const pr = prayAll().items;
    if (pr.length) { L.push("## Prayers"); pr.forEach(p => L.push("- " + (p.answered ? "[Answered] " : "[Active] ") + "**" + p.title + "**" + (p.detail ? " - " + p.detail : ""))); L.push(""); }
    if (jKey && jEntries && jEntries.length) { L.push("## Journal (unlocked)"); jEntries.forEach(e => { L.push("### " + e.d + (e.prompt ? " - " + e.prompt : "")); L.push(e.text); L.push(""); }); }
    return L.join("\n");
  }
  function exportCsv() {
    const q = s => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
    const rows = [["type", "reference", "title", "text", "date"].map(q).join(",")];
    const add = (type, ref, title, text, ts) => rows.push([type, ref, title, text, ts ? tsDay(ts) : ""].map(q).join(","));
    const hl = load(K.HL, {}); Object.keys(hl).forEach(k => add("highlight", hl[k].ref || k, "", hl[k].text, hl[k].added));
    const nt = load(K.NOTES, {}); Object.keys(nt).forEach(k => add("note", nt[k].ref || k, "", nt[k].text, nt[k].added || nt[k].updated));
    const vb = load(K.VBM, {}); Object.keys(vb).forEach(k => add("saved-verse", vb[k].ref || k, "", vb[k].text, vb[k].added));
    prayAll().items.forEach(p => add("prayer", "", p.title, p.detail || "", p.added));
    if (jKey && jEntries) jEntries.forEach(e => add("journal", "", e.prompt || "", e.text, e.ts));
    return rows.join("\n");
  }

  /* ================= tools ================= */
  VIEWS.tools = {
    title: "Tools",
    render(body) {
      const items = [
        ["Print this chapter", "Clean print-friendly view of what you're reading" + (C.isCompare && C.isCompare() ? " (both translations)" : ""), () => {
          document.body.classList.toggle("bp-print-compare", !!(C.isCompare && C.isCompare()));
          window.print();
        }],
        ["Random verse", "Open a random chapter anywhere in the Bible", () => {
          const b = Math.floor(Math.random() * 66);
          C.goTo(b, 1 + Math.floor(Math.random() * BOOKS[b][2]));
          closePlus();
        }],
        ["Export Markdown", "Notes, highlights, saved verses, memory verses, prayers" + (jKey ? ", journal (unlocked)" : ""), () => { download("bibley-notes-" + dayStr() + ".md", exportMarkdown(), "text/markdown"); toast("Markdown downloaded"); }],
        ["Export CSV", "The same data as a spreadsheet file", () => { download("bibley-" + dayStr() + ".csv", exportCsv(), "text/csv"); toast("CSV downloaded"); }],
        ["Print / PDF via browser", "Use your browser's print dialog and choose 'Save as PDF'", () => {
          document.body.classList.toggle("bp-print-compare", !!(C.isCompare && C.isCompare()));
          window.print();
        }]
      ];
      items.forEach(([t, sub, fn]) => {
        const b = h('<button class="bp-menu-item"><span class="mi-ic">' + IC.tool + '</span><span>' + esc(t) + '<span class="mi-sub">' + esc(sub) + '</span></span><span class="mi-arrow">&#8250;</span></button>');
        b.onclick = fn;
        body.appendChild(b);
      });
      body.appendChild(h('<div class="bp-eyebrow">Trash (' + trashAll().length + ')</div>'));
      const tr = trashAll();
      if (!tr.length) body.appendChild(h('<p class="bp-muted">Deleted notes, saved verses, memory verses and prayers land here and can be restored within 30 days.</p>'));
      tr.slice(0, 30).forEach(e => {
        const row = h('<div class="bp-trash-row"><div class="tr-info"><div class="tr-kind">' + esc(e.kind) + '</div><div class="tr-label">' + esc(e.label) + '</div><div class="lr-sub bp-muted">' + esc(tsDay(e.deletedAt) || "") + '</div></div></div>');
        const re = h('<button class="bp-btn small">Restore</button>');
        re.onclick = () => { toast(restoreTrash(e) ? "Restored" : "Couldn't restore"); renderView("tools", true); };
        const del = h('<button class="bp-btn small danger">Delete</button>');
        del.onclick = () => { if (confirm("Delete forever?")) { save(K.TRASH, trashAll().filter(x => x.id !== e.id)); renderView("tools", true); } };
        row.append(re, del);
        body.appendChild(row);
      });
      body.appendChild(h('<p class="bp-muted" style="margin-top:12px">Backup &amp; restore of everything lives in Settings &gt; Backup / My Bible &gt; Backup as before.</p>'));
    }
  };

  /* ================= compare word-diff ================= */
  const diffState = { on: prefs().diffOn, applying: false, lastKey: "" };
  function wordTokens(t) { return t.toLowerCase().match(/[\w\u2019'-]+|[^\s\w\u2019'-]+/g) || []; }
  function lcsMarks(a, b) { // returns [marksA, marksB]: true = changed
    const n = a.length, m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const ma = new Array(n).fill(false), mb = new Array(m).fill(false);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { ma[i++] = true; }
      else { mb[j++] = true; }
    }
    while (i < n) ma[i++] = true;
    while (j < m) mb[j++] = true;
    return [ma, mb];
  }
  function markWords(span, marks) {
    const sup = span.querySelector("sup");
    const text = span.textContent.replace(sup ? sup.textContent : "", "");
    const toks = text.match(/[\w\u2019'-]+|[^\w\s\u2019'-]+|\s+/g) || [];
    let wi = 0;
    const frag = document.createDocumentFragment();
    toks.forEach(tk => {
      if (/^\s+$/.test(tk) || /^[^\w\u2019'-]+$/.test(tk)) { frag.appendChild(document.createTextNode(tk)); return; }
      const changed = marks[wi++];
      if (changed) { const w = document.createElement("w"); w.className = "bp-diff"; w.textContent = tk; frag.appendChild(w); }
      else frag.appendChild(document.createTextNode(tk));
    });
    Array.from(span.childNodes).forEach(nd => { if (nd !== sup) nd.remove(); });
    span.appendChild(frag);
  }
  function unmarkWords(span) {
    const ws = span.querySelectorAll("w.bp-diff"); if (!ws.length) return;
    ws.forEach(w => w.replaceWith(document.createTextNode(w.textContent)));
    span.normalize();
  }
  function paneVerses(k) {
    const out = {};
    document.querySelectorAll('.pane[data-pane="' + k + '"] .verses-text span[data-verse]').forEach(s => { out[s.dataset.verse] = s; });
    return out;
  }
  function applyDiff() {
    if (diffState.applying) return;
    const paneB = document.querySelector('.pane[data-pane="b"]');
    const compareOn = paneB && paneB.style.display !== "none";
    const badgeHost = document.querySelector('.pane[data-pane="b"] .pane-toolbar');
    const oldBadge = badgeHost && badgeHost.querySelector(".bp-diff-badge");
    if (!diffState.on || !compareOn) {
      ["a", "b"].forEach(k => { const vs = paneVerses(k); Object.values(vs).forEach(unmarkWords); });
      if (oldBadge) oldBadge.remove();
      diffState.lastKey = "";
      return;
    }
    const pa = C.panes.a, pb = C.panes.b;
    const key = pa.version + "/" + pa.bookIdx + "/" + pa.chapter + "|" + pb.version + "/" + pb.bookIdx + "/" + pb.chapter;
    // skip only when this exact pairing was already marked AND the marks are still in the DOM
    if (key === diffState.lastKey && document.querySelector('.pane[data-pane="a"] w.bp-diff')) return;
    const va = paneVerses("a"), vb = paneVerses("b");
    if (!Object.keys(va).length || !Object.keys(vb).length) return;
    diffState.applying = true;
    try {
      let totW = 0, totC = 0;
      Object.keys(va).forEach(vn => {
        const sa = va[vn], sb = vb[vn];
        unmarkWords(sa); if (sb) unmarkWords(sb);
        if (!sb) return;
        const ta = sa.textContent.replace(/^\d+/, ""), tb = sb.textContent.replace(/^\d+/, "");
        const [ma, mb] = lcsMarks(wordTokens(ta), wordTokens(tb));
        markWords(sa, ma); markWords(sb, mb);
        totW += Math.max(ma.length, mb.length); totC += ma.filter(Boolean).length + mb.filter(Boolean).length;
      });
      const pct = totW ? Math.round(totC / 2 / totW * 100) : 0;
      if (oldBadge) oldBadge.remove();
      if (badgeHost) badgeHost.appendChild(h('<span class="bp-diff-badge" title="Share of words that differ between the two translations">' + pct + '% different</span>'));
      diffState.lastKey = key;
    } finally { diffState.applying = false; }
  }
  function wireDiff() {
    const tb = document.querySelector('.pane[data-pane="b"] .pane-toolbar');
    if (!tb || tb.querySelector(".bp-diff-toggle")) return;
    const btn = h('<button type="button" class="bp-diff-toggle' + (diffState.on ? " on" : "") + '" title="Highlight word-level differences between the two translations">Diff</button>');
    btn.onclick = () => { diffState.on = !diffState.on; setPref("diffOn", diffState.on); btn.classList.toggle("on", diffState.on); diffState.lastKey = ""; applyDiff(); };
    tb.insertBefore(btn, tb.firstChild);
    let t;
    const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(applyDiff, 350); });
    document.querySelectorAll(".reader-inner").forEach(el => mo.observe(el, { childList: true, subtree: true }));
    const panesEl = document.getElementById("panes");
    if (panesEl) mo.observe(panesEl, { attributes: true, subtree: true, attributeFilter: ["style"] });
  }

  /* ================= back/forward chapter history ================= */
  function wireHistory() {
    const refBtn = document.querySelector('.pane-ref-btn[data-pane="a"]');
    const toolbar = document.querySelector('.pane[data-pane="a"] .pane-toolbar');
    if (!refBtn || !toolbar) return;
    let st; try { st = JSON.parse(sessionStorage.getItem("bibley_plus_hist") || "null"); } catch { st = null; }
    if (!st || !Array.isArray(st.stack)) st = { stack: [], i: -1 };
    let programmatic = false;
    const curRef = () => {
      const m = (refBtn.textContent || "").trim().match(/^(.+?)\s+(\d+)$/);
      if (!m) return null;
      const bi = C.findBookIndex ? C.findBookIndex(m[1]) : BOOKS.findIndex(b => b[1] === m[1]);
      if (bi == null || bi < 0) return null;
      return [bi, +m[2]];
    };
    const back = h('<button type="button" class="bp-hist-btn" title="Back in your reading history">&#8249;</button>');
    const fwd = h('<button type="button" class="bp-hist-btn" title="Forward in your reading history">&#8250;</button>');
    toolbar.insertBefore(fwd, toolbar.firstChild);
    toolbar.insertBefore(back, toolbar.firstChild);
    const upd = () => { back.disabled = st.i <= 0; fwd.disabled = st.i >= st.stack.length - 1; };
    const cur = curRef();
    if (cur) { st.stack = [[cur[0], cur[1]]]; st.i = 0; }
    new MutationObserver(() => {
      const r = curRef(); if (!r) return;
      if (programmatic) { programmatic = false; upd(); return; }
      if (st.i >= 0 && st.stack[st.i] && st.stack[st.i][0] === r[0] && st.stack[st.i][1] === r[1]) { upd(); return; }
      st.stack = st.stack.slice(0, st.i + 1); st.stack.push(r); st.i++;
      if (st.stack.length > 100) { st.stack.shift(); st.i--; }
      try { sessionStorage.setItem("bibley_plus_hist", JSON.stringify(st)); } catch {}
      upd();
    }).observe(refBtn, { childList: true, characterData: true, subtree: true });
    back.onclick = () => { if (st.i <= 0) return; st.i--; programmatic = true; const [b, c] = st.stack[st.i]; C.goTo(b, c); try { sessionStorage.setItem("bibley_plus_hist", JSON.stringify(st)); } catch {} upd(); };
    fwd.onclick = () => { if (st.i >= st.stack.length - 1) return; st.i++; programmatic = true; const [b, c] = st.stack[st.i]; C.goTo(b, c); try { sessionStorage.setItem("bibley_plus_hist", JSON.stringify(st)); } catch {} upd(); };
    upd();
  }

  /* ================= read-aloud bar (sleep timer + speed) ================= */
  function wireTtsBar() {
    if (!("speechSynthesis" in window)) return;
    const bar = h('<div class="bp-tts-bar" style="display:none"><span class="t-label">Reading aloud</span><select title="Sleep timer"><option value="0">No sleep timer</option><option value="5">Stop in 5 min</option><option value="15">Stop in 15 min</option><option value="30">Stop in 30 min</option><option value="45">Stop in 45 min</option><option value="60">Stop in 60 min</option></select><select title="Reading speed (applies from the next verse)"><option value="0.75">Slow</option><option value="0.95">Normal</option><option value="1.15">Fast</option><option value="1.35">Faster</option></select><button type="button">Stop</button></div>');
    document.body.appendChild(bar);
    const [timerSel, rateSel, stopBtn] = bar.querySelectorAll("select,button");
    let deadline = 0;
    timerSel.value = String(prefs().ttsTimer || 0);
    timerSel.onchange = () => {
      const m = +timerSel.value; setPref("ttsTimer", m);
      deadline = m ? Date.now() + m * 60000 : 0;
      if (m) toast("Reading will stop in " + m + " minutes");
    };
    try { rateSel.value = String((JSON.parse(localStorage.getItem(K.SET) || "{}").tts) || 0.95); } catch {}
    rateSel.onchange = () => {
      const cur = load(K.SET, {}); cur.tts = +rateSel.value; save(K.SET, cur);
      toast("Speed applies from the next verse");
    };
    const stopAll = () => {
      const active = document.querySelector(".tts-btn.active");
      if (active) active.click(); else try { speechSynthesis.cancel(); } catch {}
      deadline = 0; timerSel.value = "0"; setPref("ttsTimer", 0);
    };
    stopBtn.onclick = stopAll;
    setInterval(() => {
      const speaking = speechSynthesis.speaking || speechSynthesis.pending;
      bar.style.display = speaking ? "flex" : "none";
      if (speaking && deadline && Date.now() > deadline) { toast("Sleep timer: reading stopped"); stopAll(); }
      if (speaking && deadline) bar.querySelector(".t-label").textContent = "Reading aloud \u00b7 stops in " + Math.max(1, Math.round((deadline - Date.now()) / 60000)) + " min";
      else bar.querySelector(".t-label").textContent = "Reading aloud";
    }, 1000);
  }

  /* ================= drawer extras (voice + random) ================= */
  function wireDrawerExtras() {
    const input = document.getElementById("scriptureSearch");
    if (!input || document.querySelector(".bp-drawer-mic")) return;
    const wrap = input.parentElement;
    const row = h('<div class="bp-row" style="margin-top:6px"></div>');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const mic = h('<button type="button" class="bp-chip bp-drawer-mic">\u{1F3A4} Voice search</button>');
    if (!SR) mic.disabled = true;
    mic.onclick = () => {
      if (!SR) { toast("Voice search needs Chrome or Edge"); return; }
      const r = new SR(); r.lang = "en-US"; r.interimResults = false;
      mic.classList.add("on");
      r.onresult = e => { input.value = e.results[0][0].transcript; input.dispatchEvent(new Event("input", { bubbles: true })); };
      r.onend = () => mic.classList.remove("on");
      r.onerror = () => { mic.classList.remove("on"); toast("Didn't catch that"); };
      try { r.start(); } catch {}
    };
    const rnd = h('<button type="button" class="bp-chip">\u{1F3B2} Random verse</button>');
    rnd.onclick = () => { const b = Math.floor(Math.random() * 66); C.goTo(b, 1 + Math.floor(Math.random() * BOOKS[b][2])); };
    row.append(mic, rnd);
    input.insertAdjacentElement("afterend", row);
  }

  /* ================= init ================= */
  function init() {
    try { addDockButton(); } catch (e) { console.warn("plus dock", e); }
    try { wireDrawerExtras(); } catch (e) { console.warn("plus drawer", e); }
    try { wireDiff(); } catch (e) { console.warn("plus diff", e); }
    try { wireHistory(); } catch (e) { console.warn("plus history", e); }
    try { wireTtsBar(); } catch (e) { console.warn("plus tts", e); }
    window.BibleyPlus = { open: openPlus, close: closePlus, dayRecap, monthRecap, dueCount, _test: { lcsMarks, wordTokens, bibleSearch, easterDate, seasonalPlans, splitDays, cplanState, restoreTrash, journalMeta: () => load(K.JRNL, null) } };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
