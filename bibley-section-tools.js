/* Tools integrated into Bibley’s existing reader and study sections.
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
  if (!C) { console.warn("Bibley section tools: reader bridge missing"); return; }
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
  const tr = s => window.BibleyLocale?.text(s) ?? s;
  const isEs = () => window.BibleyLocale?.get() === "es";
  const amount = (n, one, many) => n + " " + (n === 1 ? one : many);
  const h = html => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const pad = n => String(n).padStart(2, "0");
  const dayStr = (d = new Date()) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const addDays = (s, n) => { const [y, m, d] = s.split("-").map(Number); const t = new Date(y, m - 1, d + n); return dayStr(t); };
  const monthStr = (d = new Date()) => d.getFullYear() + "-" + pad(d.getMonth() + 1);
  const tsDay = ts => { const d = new Date(ts); return isNaN(d) ? null : dayStr(d); };
  const refOf = (b, c, v) => BOOKS[b][1] + " " + c + (v ? ":" + v : "");
  function toast(msg, ms) {
    msg = tr(msg);
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

  /* All tool screens use the reader’s own sheet and navigation. */
  let sheetBody, returnTo;
  function openPanel(view, title, draw, back = returnTo) {
    const fx = window.BibleyFX;
    if (!fx) return;
    if (view === "journal" && fx.ui.isOpen("tool-journal")) fx.ui.onClose(null);
    fx.ui.openSheet("tool-" + view, tr(title), host => {
      if (back) {
        const b = h(("<button type=\"button\" class=\"bp-btn small bp-section-back\">" + esc(tr("← Back")) + "</button>"));
        b.onclick = back;
        host.append(b);
      }
      sheetBody = h('<div class="bp-content"></div>');
      host.append(sheetBody);
      draw(sheetBody);
    });
    if (view === "journal") fx.ui.onClose(() => { lockJournal(); if (sheetBody) sheetBody.replaceChildren(); });
  }
  function renderView(view) {
    const V = VIEWS[view];
    if (!V) return;
    openPanel(view, V.title, V.render, view === "plan-builder" ? () => renderView("plans") : returnTo);
  }
  function openTool(view, back) { returnTo = back; renderView(view); }
  function closeTool() { window.BibleyFX?.ui.closeSheet(); }

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
    return jEntries ? Array.from(new Set(jEntries.map(e => e.d))) : [];
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
      planDays: pd, journalDays: journalDays().filter(d => d.startsWith(month)).length
    };
  }
  function recapText(d) {
    const L = [tr("Bibley recap") + " - " + d.day];
    const count = (label, n) => { if (n) L.push(tr(label) + ": " + n); };
    if (d.chapters.length) L.push(tr("Read") + ": " + summarizeChapters(d.chapters));
    count("Reading plan days completed", d.planDays);
    count("Notes written", d.notes);
    count("Highlights", d.highlights);
    count("Verses saved", d.savedVerses);
    count("Prayers added", d.prayersAdded);
    count("Prayers answered", d.prayersAnswered.length);
    count("Memory verses reviewed", d.memReviews);
    if (d.journal) L.push(tr("Journaled: yes"));
    if (L.length === 1) L.push(tr("Nothing recorded for this day."));
    const s = streak(); if (s.n) L.push(tr("Current streak") + ": " + (isEs() ? amount(s.n, "día", "días") : amount(s.n, "day", "days")));
    return L.join("\n");
  }

  const VIEWS = {};
  VIEWS["recap-day"] = {
    title: "Daily recap",
    render(body) {
      let day = dayStr();
      const head = h(("<div class=\"bp-row spread\"><button class=\"bp-btn small\">" + esc(tr("‹ Prev")) + "</button><b style=\"font-family:Fraunces;color:var(--gold-soft)\"></b><button class=\"bp-btn small\">" + esc(tr("Next ›")) + "</button></div>"));
      const [prev, label, next] = head.querySelectorAll("button,b");
      prev.textContent = tr("‹ Prev"); next.textContent = tr("Next ›");
      const content = h('<div></div>');
      const draw = () => {
        next.disabled = day >= dayStr();
        label.textContent = day === dayStr() ? tr("Today") : day;
        const d = dayRecap(day);
        content.innerHTML = "";
        const rows = [];
        if (d.chapters.length) rows.push(["\u{1F4D6}", "Read", summarizeChapters(d.chapters)]);
        if (d.planDays) rows.push(["\u{1F4C5}", "Reading plan", isEs() ? amount(d.planDays, "día completado", "días completados") : amount(d.planDays, "day completed", "days completed")]);
        if (d.notes) rows.push(["\u270D\uFE0F", "Notes", isEs() ? amount(d.notes, "escrita", "escritas") : d.notes + " written"]);
        if (d.highlights) rows.push(["\u{1F3A8}", "Highlights", String(d.highlights)]);
        if (d.savedVerses) rows.push(["\u{1F516}", "Verses saved", String(d.savedVerses)]);
        if (d.prayersAdded) rows.push(["\u{1F64F}", "Prayers added", String(d.prayersAdded)]);
        d.prayersAnswered.forEach(p => rows.push(["\u2728", "Prayer answered", p.title]));
        if (d.memReviews) rows.push(["\u{1F9E0}", "Memory review", isEs() ? amount(d.memReviews, "versículo repasado", "versículos repasados") : amount(d.memReviews, "verse reviewed", "verses reviewed")]);
        if (d.journal) rows.push(["\u{1F4D3}", "Journal", tr("Entry written")]);
        const card = h('<div class="bp-card gold"></div>');
        if (rows.length) rows.forEach(([ic, t, sub]) => card.appendChild(h('<div class="bp-list-row"><span class="lr-ic">' + ic + '</span><span class="lr-txt">' + esc(tr(t)) + '<span class="lr-sub">' + esc(sub) + '</span></span></div>')));
        else card.innerHTML = '<p class="bp-muted" style="margin:0">' + esc(tr(day === dayStr() ? "Nothing recorded for today yet." : "Nothing recorded for this day.")) + " " + esc(tr("Reading, notes, highlights, saved verses, prayers, memory practice and journal entries show up here as you do them.")) + '</p>';
        content.appendChild(card);
        const s = streak();
        content.appendChild(h('<div class="bp-stat-grid"><div class="bp-stat"><b>' + d.chapters.length + '</b><span>' + esc(tr("chapters")) + '</span></div><div class="bp-stat"><b>' + s.n + '</b><span>' + esc(tr("current streak")) + '</span></div><div class="bp-stat"><b>' + (d.notes + d.highlights + d.savedVerses) + '</b><span>' + esc(tr("study marks")) + '</span></div></div>'));
        const cp = h('<button class="bp-btn block">' + esc(tr("Copy recap as text")) + '</button>');
        cp.onclick = async () => { const ok = await copyText(recapText(d)); toast(tr(ok ? "Recap copied" : "Couldn't copy")); };
        content.appendChild(cp);
      };
      prev.onclick = () => { day = addDays(day, -1); draw(); };
      next.onclick = () => { day = addDays(day, 1); draw(); };
      draw();
      body.append(head, content);
      body.appendChild(h('<p class="bp-muted">' + esc(tr("Based on records available on this device. Deleted items and unavailable history aren’t counted.")) + '</p>'));
    }
  };
  VIEWS["recap-month"] = {
    title: "Monthly recap",
    render(body) {
      let month = monthStr();
      const head = h(("<div class=\"bp-row spread\"><button class=\"bp-btn small\">" + esc(tr("‹ Prev")) + "</button><b style=\"font-family:Fraunces;color:var(--gold-soft)\"></b><button class=\"bp-btn small\">" + esc(tr("Next ›")) + "</button></div>"));
      const [prev, label, next] = head.querySelectorAll("button,b");
      prev.textContent = tr("‹ Prev"); next.textContent = tr("Next ›");
      const content = h('<div></div>');
      const draw = () => {
        next.disabled = month >= monthStr();
        const [y, m] = month.split("-").map(Number);
        label.textContent = new Intl.DateTimeFormat(isEs() ? "es" : "en", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1)) + (month === monthStr() ? " " + tr("(so far)") : "");
        const r = monthRecap(month);
        content.innerHTML = "";
        content.appendChild(h('<div class="bp-stat-grid"><div class="bp-stat"><b>' + r.chapters + '</b><span>' + esc(tr("chapters read")) + '</span></div><div class="bp-stat"><b>' + r.activeDays + '</b><span>' + esc(tr("days active")) + '</span></div><div class="bp-stat"><b>' + r.bestStreak + '</b><span>' + esc(tr("best streak")) + '</span></div><div class="bp-stat"><b>' + r.notes + '</b><span>' + esc(tr("notes")) + '</span></div><div class="bp-stat"><b>' + r.highlights + '</b><span>' + esc(tr("highlights")) + '</span></div><div class="bp-stat"><b>' + r.savedVerses + '</b><span>' + esc(tr("verses saved")) + '</span></div><div class="bp-stat"><b>' + r.prayersAdded + '</b><span>' + esc(tr("prayers added")) + '</span></div><div class="bp-stat"><b>' + r.prayersAnswered + '</b><span>' + esc(tr("prayers answered")) + '</span></div><div class="bp-stat"><b>' + r.memReviews + '</b><span>' + esc(tr("memory reviews")) + '</span></div></div>'));
        if (r.topBooks.length) content.appendChild(h('<div class="bp-card"><div class="bp-eyebrow">' + esc(tr("Most read")) + '</div><p style="margin:4px 0 0;font-size:14px">' + esc(r.topBooks.join(" \u00b7 ")) + '</p></div>'));
        const more = [];
        if (r.planDays) more.push(isEs() ? amount(r.planDays, "día del plan completado", "días del plan completados") : amount(r.planDays, "reading-plan day completed", "reading-plan days completed"));
        if (r.journalDays) more.push(isEs() ? amount(r.journalDays, "día con entradas en el diario", "días con entradas en el diario") : amount(r.journalDays, "day with journal entries", "days with journal entries"));
        if (more.length) content.appendChild(h('<p class="bp-muted">' + esc(more.join(" \u00b7 ")) + '</p>'));
        if (![r.chapters, r.activeDays, r.notes, r.highlights, r.savedVerses, r.prayersAdded, r.prayersAnswered, r.memReviews, r.planDays, r.journalDays].some(Boolean)) content.appendChild(h('<p class="bp-muted">' + esc(tr("Nothing recorded for this month. Counts start from activity recorded on this device.")) + '</p>'));
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
      const addCard = h('<div class="bp-card"><div class="bp-eyebrow">' + esc(tr("New prayer")) + '</div><input class="bp-input" placeholder="' + esc(tr("What are you praying for?")) + '" maxlength="120"/><textarea class="bp-textarea" placeholder="' + esc(tr("Details (optional)")) + '" style="margin-top:8px"></textarea><button class="bp-btn primary block">' + esc(tr("Add prayer")) + '</button></div>');
      const [inp, ta, btn] = [addCard.querySelector("input"), addCard.querySelector("textarea"), addCard.querySelector("button")];
      btn.onclick = () => {
        const title = inp.value.trim(); if (!title) { toast(tr("Give the prayer a short title")); return; }
        const dd = prayAll(); dd.items.unshift({ id: "p" + Date.now().toString(36), title, detail: ta.value.trim(), added: Date.now(), answered: 0 });
        praySave(dd); logEvent("prayer", 1); toast(tr("Prayer added")); renderView("prayers", true);
      };
      body.appendChild(addCard);
      body.appendChild(h('<p class="bp-muted">' + esc(tr("Private: your prayers live on this device and in your Bibley account when signed in. They are never public.")) + '</p>'));
      if (active.length) {
        body.appendChild(h('<div class="bp-eyebrow">' + esc(tr("Active")) + ' (' + active.length + ')</div>'));
        active.forEach(p => body.appendChild(prayerCard(p)));
      }
      if (answered.length) {
        body.appendChild(h('<div class="bp-eyebrow">' + esc(tr("Answered")) + ' (' + answered.length + ')</div>'));
        answered.forEach(p => body.appendChild(prayerCard(p)));
      }
      body.appendChild(h('<div class="bp-eyebrow">' + esc(tr("Guided prayers")) + '</div>'));
      GUIDED.forEach(g => {
        const b = h('<button class="bp-menu-item"><span class="mi-ic">' + IC.pray + '</span><span>' + esc(g.name) + '<span class="mi-sub">' + esc(g.ref) + '</span></span><span class="mi-arrow">&#8250;</span></button>');
        b.onclick = () => {
          openPanel("guided-prayer", g.name, panel => {
          const card = h('<div class="bp-card gold"><p class="bp-muted" style="margin:0 0 8px">' + esc(g.ref) + '</p><div class="bp-guided">' + esc(g.text) + '</div></div>');
          const use = h('<button class="bp-btn block">' + esc(tr("Save as a prayer request")) + '</button>');
          use.onclick = () => { const dd = prayAll(); dd.items.unshift({ id: "p" + Date.now().toString(36), title: g.name + " prayer", detail: g.ref, added: Date.now(), answered: 0 }); praySave(dd); logEvent("prayer", 1); toast(tr("Added to your prayer list")); renderView("prayers", true); };
          panel.append(card, use);
          }, () => renderView("prayers"));
        };
        body.appendChild(b);
      });
    }
  };
  function prayerCard(p) {
    const card = h('<div class="bp-prayer' + (p.answered ? " answered" : "") + '"><b>' + esc(p.title) + '</b>' + (p.detail ? '<p>' + esc(p.detail) + '</p>' : "") + '<div class="pr-meta">' + esc(tr("Added")) + ' ' + esc(tsDay(p.added) || "") + (p.answered ? " \u00b7 " + esc(tr("answered")) + " " + esc(tsDay(p.answered) || "") : "") + '</div><div class="bp-row" style="margin-top:8px"></div></div>');
    const row = card.querySelector(".bp-row");
    if (!p.answered) {
      const ans = h('<button class="bp-btn small primary">' + esc(tr("Mark answered")) + '</button>');
      ans.onclick = () => { const d = prayAll(); const it = d.items.find(x => x.id === p.id); if (it) { it.answered = Date.now(); praySave(d); logEvent("prayer_answered", 1); toast(tr("Marked as answered ✨")); renderView("prayers", true); } };
      row.appendChild(ans);
    } else {
      const re = h('<button class="bp-btn small">' + esc(tr("Make active again")) + '</button>');
      re.onclick = () => { const d = prayAll(); const it = d.items.find(x => x.id === p.id); if (it) { it.answered = 0; praySave(d); renderView("prayers", true); } };
      row.appendChild(re);
    }
    const del = h('<button class="bp-btn small danger">' + esc(tr("Delete")) + '</button>');
    del.onclick = () => { if (!confirm(tr("Delete this prayer? (goes to Trash for 30 days)"))) return; const d = prayAll(); const i = d.items.findIndex(x => x.id === p.id); if (i >= 0) { pushTrash("prayer", p.title, { key: K.PRAY, id: p.id, data: d.items[i] }); d.items.splice(i, 1); praySave(d); renderView("prayers", true); } };
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
  let jKey = null, jEntries = null, jLockTimer = 0, jEpoch = 0;
  const b64 = buf => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const journalMeta = () => load(K.JRNL, null);
  async function deriveKey(pin, salt) {
    const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function journalUnlock(pin) {
    const m = journalMeta(), epoch = jEpoch; if (!m) return false;
    try {
      const key = await deriveKey(pin, unb64(m.salt));
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(m.iv) }, key, unb64(m.ct));
      const data = JSON.parse(new TextDecoder().decode(pt));
      if (!data || (data.v !== 1 && data.v !== 2) || !Array.isArray(data.entries)) return false;
      if (epoch !== jEpoch) return false;
      jKey = key; jEntries = data.entries; armJournalLock(); return true;
    } catch { return false; }
  }
  async function journalSetup(pin) {
    const epoch = jEpoch, salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(pin, salt);
    if (epoch !== jEpoch) return false;
    await journalPersist([], key, b64(salt));
    return epoch === jEpoch;
  }
  async function journalPersist(entries, key = jKey, salt = journalMeta()?.salt) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const payload = { v: 2, entries, days: Array.from(new Set(entries.map(e => e.d))) };
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(payload)));
    if (!save(K.JRNL, { salt, iv: b64(iv), ct: b64(ct), updated: Date.now() })) throw new Error("Storage write failed");
  }
  function lockJournal() { jEpoch++; jKey = null; jEntries = null; clearTimeout(jLockTimer); }
  function armJournalLock() { clearTimeout(jLockTimer); jLockTimer = setTimeout(() => { lockJournal(); if (window.BibleyFX?.ui.isOpen("tool-journal")) renderView("journal", true); }, 10 * 60 * 1000); }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { lockJournal(); if (window.BibleyFX?.ui.isOpen("tool-journal")) renderView("journal"); } });

  VIEWS.journal = {
    title: "Journal",
    render(body) {
      const m = journalMeta();
      if (!jKey) {
        const wrap = h('<div class="bp-lock-wrap"><div class="bp-lock-ic">' + IC.lock + '</div></div>');
        if (!m) {
          wrap.appendChild(h(("<p style=\"font-family:Fraunces;font-size:17px;color:var(--gold-soft);margin:0 0 6px\">" + esc(tr("Lock your journal")) + "</p>")));
          wrap.appendChild(h(("<p class=\"bp-muted\">" + esc(tr("Entries are encrypted on this device with a key made from your PIN or passphrase; if you sync, only the encrypted copy ever leaves the device.")) + " <b>" + esc(tr("Strength matters:")) + "</b> " + esc(tr("a short numeric PIN can be guessed by someone who gets hold of your data - a longer passphrase is much stronger. Encryption protects the stored entries; it cannot protect against malicious software on the device itself. If you forget your PIN or passphrase, these entries")) + " <b>" + esc(tr("cannot be recovered")) + "</b>" + esc(tr(". There is no reset.")) + "</p>")));
          const p1 = h(("<input class=\"bp-input\" type=\"password\" placeholder=\"" + esc(tr("Choose a PIN or passphrase (longer is stronger)")) + "\" maxlength=\"64\"/>"));
          const p2 = h(("<input class=\"bp-input\" type=\"password\" placeholder=\"" + esc(tr("Repeat it")) + "\" maxlength=\"64\" style=\"margin-top:8px\"/>"));
          const btn = h(("<button class=\"bp-btn primary block\" style=\"margin-top:10px\">" + esc(tr("Create locked journal")) + "</button>"));
          btn.onclick = async () => {
            const a = p1.value.trim();
            if (a.length < 4) { toast("Needs at least 4 characters - longer is stronger"); return; }
            if (a !== p2.value.trim()) { toast("They don't match"); return; }
            btn.disabled = true;
            try { if (await journalSetup(a)) { toast("Journal created and locked"); renderView("journal"); } }
            catch (e) { console.error(e); toast("Encryption isn't available in this browser"); btn.disabled = false; }
          };
          wrap.append(p1, p2, btn);
        } else {
          wrap.appendChild(h(("<p style=\"font-family:Fraunces;font-size:17px;color:var(--gold-soft);margin:0 0 6px\">" + esc(tr("Journal is locked")) + "</p>")));
          wrap.appendChild(h(("<p class=\"bp-muted\">" + esc(tr("Entries are encrypted on this device. A wrong PIN or passphrase cannot open them, and a forgotten one cannot be recovered.")) + "</p>")));
          const p1 = h(("<input class=\"bp-input\" type=\"password\" placeholder=\"" + esc(tr("PIN or passphrase")) + "\" maxlength=\"64\"/>"));
          const btn = h(("<button class=\"bp-btn primary block\" style=\"margin-top:10px\">" + esc(tr("Unlock")) + "</button>"));
          const go = async () => { btn.disabled = true; const ok = await journalUnlock(p1.value); if (!body.isConnected || !body.contains(p1)) return; btn.disabled = false; if (ok) renderView("journal"); else { toast("Wrong PIN"); p1.value = ""; p1.focus(); } };
          btn.onclick = go; p1.onkeydown = e => { if (e.key === "Enter") go(); };
          wrap.append(p1, btn);
        }
        body.appendChild(wrap);
        return;
      }
      armJournalLock();
      const bar = h('<div class="bp-row spread"><span class="bp-muted">' + jEntries.length + (isEs() ? (jEntries.length === 1 ? ' entrada' : ' entradas') : ' entr' + (jEntries.length === 1 ? "y" : "ies")) + ("</span><button class=\"bp-btn small\">" + esc(tr("Lock now")) + "</button></div>"));
      bar.querySelector("button").onclick = () => { lockJournal(); renderView("journal", true); };
      body.appendChild(bar);
      if (jEntries.length) {
        const row = h(("<div class=\"bp-row\"><button class=\"bp-btn small\">" + esc(tr("Export journal Markdown")) + "</button><button class=\"bp-btn small\">" + esc(tr("Export journal CSV")) + "</button></div>"));
        const prompts = ['Markdown', 'CSV'];
        row.querySelectorAll('button').forEach((b, i) => b.onclick = () => {
          if (!jEntries || !confirm(isEs() ? '¿Exportar el diario desbloqueado como archivo ' + prompts[i] + ' legible y sin cifrar?' : 'Export your unlocked journal as a readable, unencrypted ' + prompts[i] + ' file?')) return;
          const text = i ? [['date','prompt','text'], ...jEntries.map(e => [e.d, e.prompt, e.text])].map(r => r.map(csvCell).join(',')).join('\n') : '# Bibley journal\n\n' + jEntries.map(e => '## ' + e.d + '\n' + e.prompt + '\n\n' + e.text).join('\n\n');
          download('bibley-journal-' + dayStr() + (i ? '.csv' : '.md'), text, i ? 'text/csv' : 'text/markdown');
        });
        body.append(row);
      }
      if (jEntries.length) {
        const pdf = h('<button class="bp-btn block">' + esc(tr("Print journal / Save PDF")) + '</button>');
        pdf.onclick = () => {
          if (!jEntries || !confirm(tr("Open a readable, unencrypted journal print preview? It stays open after you lock the journal. Close it when finished."))) return;
          printText(tr("Bibley journal"), jEntries.map(e => e.d + "\n" + (e.prompt || "") + "\n\n" + e.text).join("\n\n────────\n\n"));
        };
        body.append(pdf);
      }
      const PROMPTS = ["What are you grateful to God for today?", "What is God teaching you right now?", "A verse that stayed with you today", "Who is on your heart to pray for?", "What do you want to remember from today?"];
      const prompt = tr(PROMPTS[new Date().getDate() % PROMPTS.length]);
      const card = h(("<div class=\"bp-card\"><div class=\"bp-eyebrow\">" + esc(tr("Today ·")) + " ") + esc(prompt) + ("</div><textarea class=\"bp-textarea\" placeholder=\"" + esc(tr("Write freely - this is between you and God.")) + "\"></textarea><button class=\"bp-btn primary block\">" + esc(tr("Save entry")) + "</button></div>"));
      const ta = card.querySelector("textarea"), sv = card.querySelector("button");
      sv.onclick = async () => {
        const t = ta.value.trim(); if (!t) { toast("Write something first"); return; }
        const epoch = jEpoch;
        const next = [{ id: crypto.randomUUID(), d: dayStr(), prompt, text: t, ts: Date.now() }, ...jEntries];
        sv.disabled = true;
        try { await journalPersist(next); if (epoch === jEpoch) { jEntries = next; toast("Entry saved"); renderView("journal"); } }
        catch { toast("Couldn’t save your journal entry"); sv.disabled = false; }
      };
      body.appendChild(card);
      jEntries.forEach(e => {
        const el = h('<div class="bp-j-entry"><div class="je-date">' + esc(e.d) + '</div><div class="je-prompt">' + esc(e.prompt || "") + '</div><div class="je-text">' + esc(e.text) + '</div><div class="bp-row" style="margin-top:6px"><button class="bp-btn small danger">' + esc(tr("Delete")) + '</button></div></div>');
        el.querySelector("button").onclick = async () => {
          if (sv.disabled || !confirm(tr("Delete this journal entry? This cannot be undone."))) return;
          const epoch = jEpoch, next = jEntries.filter(x => x.id !== e.id); sv.disabled = true;
          try { await journalPersist(next); if (epoch === jEpoch) { jEntries = next; renderView("journal"); } }
          catch { toast("Couldn’t delete the entry"); sv.disabled = false; }
        };
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
    c.due = addDays(dayStr(), Math.max(1, c.ivl)); c.last = dayStr(); s.cards[key] = c; srsSave(s); logEvent("mem", 1);
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
      body.appendChild(h('<div class="bp-stat-grid"><div class="bp-stat"><b>' + due.length + ("</b><span>" + esc(tr("due today")) + "</span></div><div class=\"bp-stat\"><b>") + learned.length + ("</b><span>" + esc(tr("scheduled")) + "</span></div><div class=\"bp-stat\"><b>") + list.length + ("</b><span>" + esc(tr("total verses")) + "</span></div></div>")));
      if (!list.length) {
        body.appendChild(h(("<p class=\"bp-muted\">" + esc(tr("No memory verses yet. Verses you save in Memorize mode (tap a verse in the reader) appear here, or start with a small starter set.")) + "</p>")));
        const st = h(("<button class=\"bp-btn primary block\">" + esc(tr("Add 8 well-known starter verses")) + "</button>"));
        st.onclick = async () => { st.disabled = true; const n = await addStarterVerses(); toast(n ? (isEs() ? n + " versículos añadidos" : n + " verses added") : "Couldn't add verses (offline?)"); renderView("memory", true); };
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
      body.appendChild(h('<div class="bp-eyebrow">' + (due.length ? (isEs() ? "Repasar " + due.length + " versículo(s) pendiente(s)" : "Review " + due.length + " due verse" + (due.length === 1 ? "" : "s")) : tr("Nothing due - practice anyway")) + '</div>'));
      MODES.forEach(([m, name]) => {
        const b = h('<button class="bp-menu-item"><span class="mi-ic">' + IC.cards + '</span><span>' + esc(tr(name)) + '</span><span class="mi-arrow">&#8250;</span></button>');
        b.onclick = () => startSession(m, pool);
        body.appendChild(b);
      });
      body.appendChild(h(("<p class=\"bp-muted\">" + esc(tr("Spaced repetition: verses you know well come back less often; ones you miss come back tomorrow. Reviews count toward your recaps.")) + "</p>")));
    }
  };
  let session = null;
  function startSession(mode, pool) {
    session = { mode, queue: pool.slice().sort(() => Math.random() - .5).slice(0, 10), done: 0 };
    openPanel("memory-session", MODES.find(m => m[0] === mode)[1], nextCard, () => renderView("memory"));
  }
  function nextCard() {
    sheetBody.innerHTML = "";
    if (!session.queue.length) {
      sheetBody.appendChild(h(("<div class=\"bp-card gold\" style=\"text-align:center\"><p style=\"font-family:Fraunces;font-size:17px;margin:6px 0\">" + esc(tr("Session complete")) + "</p><p class=\"bp-muted\">") + session.done + (isEs() ? ' versículo(s) repasado(s). Buen trabajo.' : ' verse' + (session.done === 1 ? "" : "s") + ' reviewed. Nice work.') + '</p></div>'));
      const back = h(("<button class=\"bp-btn block\">" + esc(tr("Back to Memory practice")) + "</button>"));
      back.onclick = () => renderView("memory", true);
      sheetBody.appendChild(back);
      return;
    }
    const v = session.queue[0];
    sheetBody.appendChild(h('<div class="bp-progress"><i style="width:' + Math.round(session.done / (session.done + session.queue.length) * 100) + '%"></i></div>'));
    const box = h('<div class="bp-flash"><div class="bp-flash-inner"></div></div>');
    const inner = box.querySelector(".bp-flash-inner");
    const grades = h(("<div class=\"bp-grade-row\"><button>" + esc(tr("Again")) + "<small>" + esc(tr("tomorrow")) + "</small></button><button>" + esc(tr("Hard")) + "<small>" + esc(tr("shorter gap")) + "</small></button><button>" + esc(tr("Good")) + "<small>" + esc(tr("normal gap")) + "</small></button><button>" + esc(tr("Easy")) + "<small>" + esc(tr("longer gap")) + "</small></button></div>"));
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
      inner.innerHTML = '<div class="bp-flash-ref">' + esc(v.ref) + '</div><div class="bp-flash-text">' + html + ("</div><p class=\"bp-muted\" style=\"margin:0\">" + esc(tr("Tap to reveal the missing words")) + "</p>");
      inner.onclick = () => { inner.querySelectorAll(".blank").forEach(b => b.classList.add("shown")); reveal(); };
    } else if (session.mode === "first") {
      const fl = v.text.split(/\s+/).map(w => { const m = w.match(/[\p{L}\p{N}]/u); return m ? m[0] : ""; }).join(" ");
      inner.innerHTML = '<div class="bp-flash-ref">' + esc(v.ref) + '</div><div class="bp-firstletters">' + esc(fl) + '</div><div class="bp-flash-text" hidden>' + esc(v.text) + ("</div><p class=\"bp-muted\" style=\"margin:0\">" + esc(tr("Say it from the first letters, then tap")) + "</p>");
      inner.onclick = () => { inner.querySelector(".bp-flash-text").hidden = false; reveal(); };
    } else { // quiz: pick the reference
      const others = memList().filter(x => x.key !== v.key).sort(() => Math.random() - .5).slice(0, 3);
      const opts = others.concat([v]).sort(() => Math.random() - .5);
      inner.innerHTML = '<div class="bp-flash-text">' + esc(v.text) + ("</div><p class=\"bp-muted\" style=\"margin:0\">" + esc(tr("Which verse is this?")) + "</p>");
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
  const splitDays = (list, days) => {
    // A short book must not produce empty reading days (which cannot be opened).
    days = Math.min(list.length, Math.max(1, Math.floor(days)));
    return Array.from({ length: days }, (_, d) => list.slice(Math.floor(d * list.length / days), Math.floor((d + 1) * list.length / days)));
  };
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
      .filter(s => s.end >= today).sort((a, b) => a.start < b.start ? -1 : 1);
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
    title: "Custom & seasonal plans",
    render(body) {
      const d = cplanAll();
      const mine = d.plans.find(p => p.id === d.active) || null;
      if (mine) {
        const st = cplanState(mine);
        const card = h('<div class="bp-card gold"><div class="bp-row spread"><b style="font-family:Fraunces;color:var(--gold-soft)">' + esc(mine.name) + '</b><span class="bp-muted">' + st.doneCount + '/' + st.total + (isEs() ? ' días \u00b7 ' : ' days \u00b7 ') + st.pct + '%</span></div><div class="bp-progress"><i style="width:' + st.pct + '%"></i></div></div>');
        if (st.behind > 0 && !st.finished) {
          const cu = h('<button class="bp-btn small">' + (isEs() ? 'Ponerse al día (' + st.behind + ' día(s) de retraso)' : 'Catch up (' + st.behind + ' day' + (st.behind === 1 ? "" : "s") + ' behind)') + '</button>');
          cu.onclick = () => { const dd = cplanAll(); const pl = dd.plans.find(p => p.id === dd.active); pl.started = addDays(dayStr(), -(st.doneCount + Object.keys(pl.skipped || {}).length)); cplanSave(dd); toast("Schedule moved up - today is your next reading"); renderView("plans", true); };
          card.appendChild(cu);
        }
        body.appendChild(card);
        if (!st.finished) {
          const todays = mine.days[st.idx];
          const tc = h(("<div class=\"bp-card\"><div class=\"bp-eyebrow\">" + esc(tr("Today · Day")) + " ") + (st.idx + 1) + '</div><p style="font-size:15px;margin:4px 0 10px">' + esc(summarizeChapters(todays)) + '</p><div class="bp-row"></div></div>');
          const row = tc.querySelector(".bp-row");
          const open = h(("<button class=\"bp-btn small\">" + esc(tr("Open reading")) + "</button>"));
          open.onclick = () => { C.goTo(todays[0][0], todays[0][1]); closeTool(); };
          const done = h(("<button class=\"bp-btn small primary\">" + esc(tr("Mark day done")) + "</button>"));
          done.onclick = () => {
            const dd = cplanAll(); const pl = dd.plans.find(p => p.id === dd.active);
            pl.done = pl.done || {}; pl.done[st.idx] = dayStr(); cplanSave(dd);
            const rm = readMap(); todays.forEach(([b, c]) => { if (!rm[BOOKS[b][0] + "-" + c]) rm[BOOKS[b][0] + "-" + c] = dayStr(); }); save(K.READ, rm);
            markActive(); logEvent("plan", 1);
            const after = cplanState(pl);
            toast(after.finished ? "Plan complete - well done!" : (isEs() ? "Día " + (st.idx + 1) + " completado" : "Day " + (st.idx + 1) + " done \u2713"), 3000);
            renderView("plans", true);
          };
          const skip = h(("<button class=\"bp-btn small\">" + esc(tr("Skip this day")) + "</button>"));
          skip.onclick = () => { if (!confirm(isEs() ? "¿Omitir el día " + (st.idx + 1) + "? Se quitará su lectura, no se moverá." : "Skip Day " + (st.idx + 1) + "? Its reading is dropped, not moved.")) return; const dd = cplanAll(); const pl = dd.plans.find(p => p.id === dd.active); pl.skipped = pl.skipped || {}; pl.skipped[st.idx] = dayStr(); cplanSave(dd); renderView("plans", true); };
          const quit = h(("<button class=\"bp-btn small danger\">" + esc(tr("End plan")) + "</button>"));
          quit.onclick = () => { if (!confirm(tr("End this plan? Your progress is kept in history."))) return; const dd = cplanAll(); dd.active = null; cplanSave(dd); renderView("plans", true); };
          row.append(open, done, skip, quit);
          body.appendChild(tc);
        } else {
          body.appendChild(h(("<p class=\"bp-muted\">" + esc(tr("Plan complete. Start another below.")) + "</p>")));
        }
      }
      body.appendChild(h('<div class="bp-eyebrow">' + esc(tr(mine ? "Start a different plan" : "Start a plan")) + '</div>'));
      const custom = h('<button class="bp-menu-item"><span class="mi-ic">' + IC.route + ("</span><span>" + esc(tr("Build a custom plan")) + "<span class=\"mi-sub\">" + esc(tr("Choose the books and the pace")) + "</span></span><span class=\"mi-arrow\">&#8250;</span></button>"));
      custom.onclick = () => renderView("plan-builder");
      body.appendChild(custom);
      const seasons = activeSeasonal();
      body.appendChild(h(("<div class=\"bp-eyebrow\">" + esc(tr("Seasonal")) + "</div>")));
      seasons.slice(0, 3).forEach(s => {
        const b = h('<button class="bp-menu-item"><span class="mi-ic">' + IC.cal + '</span><span>' + esc(tr(s.name)) + '<span class="mi-sub">' + esc(tr(s.blurb)) + ' \u00b7 ' + esc(s.start) + ' \u2192 ' + esc(s.end) + '</span></span><span class="mi-arrow">&#8250;</span></button>');
        b.onclick = () => {
          const dd = cplanAll();
          const id = s.id + "-" + s.start;
          if (!dd.plans.some(p => p.id === id)) dd.plans.push({ id, name: s.name + " " + s.start.slice(0, 4), days: s.days, started: dayStr(), done: {}, skipped: {}, seasonal: s.id });
          dd.active = id; cplanSave(dd); toast(isEs() ? "Plan de " + tr(s.name) + " iniciado" : s.name + " plan started"); renderView("plans", true);
        };
        body.appendChild(b);
      });
      body.appendChild(h(("<p class=\"bp-muted\">" + esc(tr("These plans sit alongside the built-in plans (Plans button in the dock) - pick whichever you like; both count toward your streak. If you switch, progress on the other plan is kept.")) + "</p>")));
    }
  };
  VIEWS["plan-builder"] = {
    title: "Custom plan",
    render(body) {
      const scopes = [["Whole Bible", 0, 65], ["Old Testament", 0, OT_END], ["New Testament", 39, 65], ["Gospels", 39, 42], ["Gospels & Acts", 39, 43], ["Letters", 44, 64], ["Psalms", 18, 18], ["Proverbs", 19, 19]];
      const card = h(("<div class=\"bp-card\"><div class=\"bp-eyebrow\">" + esc(tr("Build your plan")) + "</div>") +
        ("<input class=\"bp-input\" placeholder=\"" + esc(tr("Plan name (optional)")) + "\" maxlength=\"60\"/>") +
        ("<div class=\"bp-eyebrow\" style=\"margin-top:10px\">" + esc(tr("What to read")) + "</div><select class=\"bp-select\"></select>") +
        ("<div class=\"bp-eyebrow\" style=\"margin-top:10px\">" + esc(tr("Pace")) + "</div><div class=\"bp-row\"><input class=\"bp-input\" type=\"number\" min=\"1\" max=\"365\" value=\"30\" style=\"width:90px\"/><span class=\"bp-muted\">" + esc(tr("days to finish")) + "</span></div>") +
        '<div class="bp-day-list" style="margin-top:10px"></div>' +
        ("<button class=\"bp-btn primary block\" style=\"margin-top:10px\">" + esc(tr("Start this plan")) + "</button></div>"));
      const [nameIn, sel, daysIn, preview, start] = [card.querySelector("input"), card.querySelector("select"), card.querySelector("input[type=number]"), card.querySelector(".bp-day-list"), card.querySelector("button")];
      scopes.concat(BOOKS.map((b, i) => [b[1], i, i])).forEach(([n, b0, b1]) => sel.appendChild(h('<option value="' + b0 + '-' + b1 + '">' + esc(tr(n)) + '</option>')));
      const draw = () => {
        const [b0, b1] = sel.value.split("-").map(Number);
        const list = chRange(b0, b1);
        const days = Math.max(1, Math.min(365, list.length, Math.floor(+daysIn.value || 30)));
        daysIn.max = String(Math.min(365, list.length));
        const dd = splitDays(list, days);
        preview.textContent = isEs() ? list.length + " capítulos en " + days + " días · Día 1: " + summarizeChapters(dd[0]) + (dd[1] ? " · Día 2: " + summarizeChapters(dd[1]) : "") : list.length + " chapters over " + days + " days · Day 1: " + summarizeChapters(dd[0]) + (dd[1] ? " · Day 2: " + summarizeChapters(dd[1]) : "");
      };
      sel.onchange = draw; daysIn.oninput = draw; draw();
      start.onclick = () => {
        const [b0, b1] = sel.value.split("-").map(Number);
        const list = chRange(b0, b1);
        const days = Math.max(1, Math.min(365, list.length, Math.floor(+daysIn.value || 30)));
        const name = nameIn.value.trim() || (sel.options[sel.selectedIndex].text + (isEs() ? " en " : " in ") + days + (isEs() ? " días" : " days"));
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
    title: "Filtered Bible search",
    render(body) {
      const versions = Object.keys(C.jsonBibles || { web: 1, kjv: 1 });
      const card = h(("<div class=\"bp-card\"><div class=\"bp-row\"><input class=\"bp-input\" placeholder=\"" + esc(tr("Search the whole Bible...")) + "\" style=\"flex:1\"/><button class=\"bp-btn small\" title=\"" + esc(tr("Voice search")) + "\">&#x1F3A4;</button></div>") +
        '<div class="bp-row" style="margin-top:8px"><select class="bp-select" style="flex:1"></select><select class="bp-select" style="flex:1"></select><select class="bp-select" style="flex:1"></select></div>' +
        ("<button class=\"bp-btn primary block\" style=\"margin-top:8px\">" + esc(tr("Search")) + "</button></div>"));
      const [inp, mic] = card.querySelectorAll("input,button");
      const [scopeSel, bookSel, verSel] = card.querySelectorAll("select");
      [["all", "Old & New Testament"], ["ot", "Old Testament"], ["nt", "New Testament"]].forEach(([v, n]) => scopeSel.appendChild(h('<option value="' + v + '">' + esc(tr(n)) + '</option>')));
      const updBooks = () => {
        bookSel.innerHTML = ("<option value=\"-1\">" + esc(tr("All books")) + "</option>");
        const a = scopeSel.value === "nt" ? 39 : 0, b = scopeSel.value === "ot" ? OT_END : 65;
        for (let i = a; i <= b; i++) bookSel.appendChild(h('<option value="' + i + '">' + esc(BOOKS[i][1]) + '</option>'));
      };
      scopeSel.onchange = updBooks; updBooks();
      versions.forEach(v => verSel.appendChild(h('<option value="' + v + '"' + (v === (C.panes.a.version || "web") ? " selected" : "") + '>' + v.toUpperCase() + '</option>')));
      const results = h('<div></div>');
      const histWrap = h('<div></div>');
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) mic.disabled = true, mic.title = tr("Voice search needs Chrome or Edge");
      mic.onclick = () => {
        if (!SR) { toast("Voice search needs Chrome or Edge"); return; }
        const r = new SR(); r.lang = isEs() ? "es-ES" : "en-US"; r.interimResults = false;
        mic.style.color = "#e6bf69";
        r.onresult = e => { inp.value = e.results[0][0].transcript; run(); };
        r.onend = () => { mic.style.color = ""; };
        r.onerror = () => { mic.style.color = ""; toast("Didn't catch that"); };
        try { r.start(); } catch {}
      };
      let searchSeq = 0;
      async function run() {
        const q = inp.value.trim(); if (q.length < 2) { toast("Type at least 2 letters"); return; }
        const seq = ++searchSeq;
        results.innerHTML = ("<p class=\"bp-muted\">" + esc(tr("Searching")) + " ") + verSel.value.toUpperCase() + '...</p>';
        try {
          const ver = verSel.value, scope = scopeSel.value, book = +bookSel.value;
          const d = await C.loadJsonBible(ver);
          if (!results.isConnected || seq !== searchSeq) return;
          let b0 = scope === "nt" ? 39 : 0, b1 = scope === "ot" ? OT_END : 65;
          if (book >= 0) { b0 = b1 = book; }
          const found = bibleSearch(d, q, b0, b1, 200);
          const hist = shistAll().filter(x => x.q.toLowerCase() !== q.toLowerCase());
          hist.unshift({ q, ts: Date.now() }); save(K.SHIST, hist.slice(0, 15)); drawHist();
          results.innerHTML = '<p class="bp-muted">' + found.length + (found.length >= 200 ? "+" : "") + (isEs() ? ' resultado' + (found.length === 1 ? '' : 's') + ' en ' : ' result' + (found.length === 1 ? "" : "s") + ' in ') + esc(ver.toUpperCase()) + '</p>';
          const ql = q.toLowerCase();
          found.forEach(r => {
            const i = r.text.toLowerCase().indexOf(ql);
            const marked = esc(r.text.slice(0, i)) + "<mark>" + esc(r.text.slice(i, i + q.length)) + "</mark>" + esc(r.text.slice(i + q.length));
            const row = h('<button type="button" class="bp-vrow"><b>' + esc(refOf(r.b, r.c, r.v)) + '</b><span>' + marked + '</span></button>');
            row.onclick = () => window.BibleyFX.jumpToVerse(r.b, r.c, r.v);
            results.appendChild(row);
          });
          if (!found.length) results.appendChild(h(("<p class=\"bp-muted\">" + esc(tr("No matches. Try another word or a wider scope.")) + "</p>")));
        } catch (e) { if (seq !== searchSeq) return; results.innerHTML = ("<p class=\"bp-muted\">" + esc(tr("Couldn't load that translation for searching. Are you online?")) + "</p>"); }
      }
      card.querySelector(".bp-btn.primary").onclick = run;
      inp.onkeydown = e => { if (e.key === "Enter") run(); };
      function drawHist() {
        const hist = shistAll();
        histWrap.innerHTML = hist.length ? ("<div class=\"bp-eyebrow\">" + esc(tr("Recent searches")) + "</div>") : "";
        if (!hist.length) return;
        const chips = h('<div class="bp-chips"></div>');
        hist.slice(0, 10).forEach(x => { const c = h('<button class="bp-chip">' + esc(x.q) + '</button>'); c.onclick = () => { inp.value = x.q; run(); }; chips.appendChild(c); });
        const clr = h(("<button class=\"bp-chip\">" + esc(tr("Clear")) + "</button>")); clr.onclick = () => { save(K.SHIST, []); drawHist(); };
        chips.appendChild(clr);
        histWrap.appendChild(chips);
      }
      drawHist();
      body.append(card, histWrap, results);
      body.appendChild(h(("<p class=\"bp-muted\">" + esc(tr("Searches the offline translations bundled with Bibley. The drawer search still searches chapters you have opened in any version.")) + "</p>")));
    }
  };

  /* ================= trash (soft-delete recovery) ================= */
  const trashAll = () => { const d = load(K.TRASH, []); const cut = Date.now() - 30 * 86400000; const keep = d.filter(x => x.deletedAt > cut); if (keep.length !== d.length) save(K.TRASH, keep); return keep; };
  function pushTrash(kind, label, payload) { const t = trashAll(); t.unshift({ id: "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind, label: String(label || kind).slice(0, 120), payload, deletedAt: Date.now() }); save(K.TRASH, t.slice(0, 100)); }
  function restoreTrash(entry) {
    const { key, id, data } = entry.payload;
    if (![K.SNB, K.MEM, K.PRAY, K.NOTES, K.VBM].includes(key) || typeof id !== "string" || ["__proto__", "constructor", "prototype"].includes(id) || !data || typeof data !== "object") return false;
    try {
      if (key === K.SNB) { const arr = load(K.SNB, []); if (!arr.some(x => x.id === id)) { arr.push(data); if (!save(K.SNB, arr)) return false; } }
      else if (key === K.MEM) { const all = memAll(); if (!all.verses[id]) { all.verses[id] = data; all.v = 1; if (!save(K.MEM, all)) return false; } }
      else if (key === K.PRAY) { const d = prayAll(); if (!d.items.some(x => x.id === id)) { d.items.unshift(data); if (!save(K.PRAY, d)) return false; } }
      else { const o = load(key, {}); if (!(id in o)) { o[id] = data; if (!save(key, o)) return false; } }
      const ok = save(K.TRASH, trashAll().filter(x => x.id !== entry.id));
      if (ok) { C.rerender(); C.refreshLists(); }
      return ok;
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
  function printText(title, text) {
    const popup = window.open("", "_blank");
    if (!popup) { toast("Allow pop-ups to open the print preview"); return; }
    popup.opener = null;
    popup.document.write('<!doctype html><html lang="' + (isEs() ? 'es' : 'en') + '"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>' + esc(title) + '</title><style>body{max-width:52rem;margin:2rem auto;padding:0 1rem;color:#222;font:16px/1.65 Georgia,serif}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}button{padding:.7rem 1rem;font:inherit}@media print{button{display:none}body{margin:0;max-width:none}pre{orphans:3;widows:3}}</style></head><body><button type="button" id="print">' + esc(tr("Print / Save PDF")) + '</button><h1>' + esc(title) + '</h1><pre></pre></body></html>');
    popup.document.close();
    popup.document.querySelector('pre').textContent = text;
    popup.document.getElementById('print').onclick = () => popup.print();
  }
  function exportMarkdown() {
    const L = ["# Bibley export", "", "_" + new Date().toLocaleString() + "_", ""];
    const hl = load(K.HL, {}); const keys = Object.keys(hl);
    if (keys.length) { L.push("## Highlights"); keys.forEach(k => { const e = hl[k]; L.push("- **" + (e.ref || k) + "** (" + (e.color || "") + "): " + (e.text || "")); }); L.push(""); }
    const nt = load(K.NOTES, {});
    if (Object.keys(nt).length) { L.push("## Verse notes"); Object.keys(nt).forEach(k => { const e = nt[k]; L.push("### " + (e.ref || k)); L.push(e.text || ""); L.push(""); }); }
    const vb = load(K.VBM, {});
    if (Object.keys(vb).length) { L.push("## Saved verses"); Object.keys(vb).forEach(k => { const e = vb[k]; L.push("- **" + (e.ref || k) + "**: " + (e.text || "")); }); L.push(""); }
    const studyNotes = load(K.SNB, []);
    if (studyNotes.length) { L.push("## Study notebook"); studyNotes.forEach(e => L.push("### " + (e.title || "Untitled"), e.body || "", "")); }
    const mv = memAll().verses;
    if (Object.keys(mv).length) { L.push("## Memory verses"); Object.keys(mv).forEach(k => L.push("- **" + (mv[k].ref || k) + "**: " + (mv[k].text || ""))); L.push(""); }
    const pr = prayAll().items;
    if (pr.length) { L.push("## Prayers"); pr.forEach(p => L.push("- " + (p.answered ? "[Answered] " : "[Active] ") + "**" + p.title + "**" + (p.detail ? " - " + p.detail : ""))); L.push(""); }
    return L.join("\n");
  }
  const csvCell = s => { const v = String(s == null ? "" : s); return '"' + (/^[\s]*[=+@-]|^[\t\r\n]/.test(v) ? "'" : "") + v.replace(/"/g, '""') + '"'; };
  function exportCsv() {
    const q = csvCell;
    const rows = [["type", "reference", "title", "text", "date"].map(q).join(",")];
    const add = (type, ref, title, text, ts) => rows.push([type, ref, title, text, ts ? tsDay(ts) : ""].map(q).join(","));
    const hl = load(K.HL, {}); Object.keys(hl).forEach(k => add("highlight", hl[k].ref || k, "", hl[k].text, hl[k].added));
    const nt = load(K.NOTES, {}); Object.keys(nt).forEach(k => add("note", nt[k].ref || k, "", nt[k].text, nt[k].added || nt[k].updated));
    const vb = load(K.VBM, {}); Object.keys(vb).forEach(k => add("saved-verse", vb[k].ref || k, "", vb[k].text, vb[k].added));
    load(K.SNB, []).forEach(e => add("study-note", "", e.title || "Untitled", e.body, e.created || e.updated));
    Object.values(memAll().verses).forEach(e => add("memory-verse", e.ref, "", e.text, e.added));
    prayAll().items.forEach(p => add("prayer", "", p.title, p.detail || "", p.added));
    return rows.join("\n");
  }

  /* ================= tools ================= */
  function printChapter() {
    document.body.classList.add("bp-print-chapter");
    document.body.classList.toggle("bp-print-compare", !!C.isCompare());
    const cleanup = () => document.body.classList.remove("bp-print-chapter", "bp-print-compare");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
  }
  VIEWS.tools = {
    title: "Exports & trash",
    render(body) {
      const items = [
        ["Print this chapter", "Clean print-friendly view of what you're reading" + (C.isCompare && C.isCompare() ? " (both translations)" : ""), printChapter],
        ["Print / Save PDF", "Notes, highlights, saved verses, memory verses, prayers", () => printText(tr("Bibley study records"), exportMarkdown())],
        ["Export Markdown", "Notes, highlights, saved verses, memory verses, prayers", () => { download("bibley-notes-" + dayStr() + ".md", exportMarkdown(), "text/markdown"); toast("Markdown downloaded"); }],
        ["Export CSV", "Study records in a spreadsheet file", () => { download("bibley-" + dayStr() + ".csv", exportCsv(), "text/csv"); toast("CSV downloaded"); }]
      ];
      items.forEach(([t, sub, fn]) => {
        const b = h('<button class="bp-menu-item"><span class="mi-ic">' + IC.tool + '</span><span>' + esc(tr(t)) + '<span class="mi-sub">' + esc(tr(sub)) + '</span></span><span class="mi-arrow">&#8250;</span></button>');
        b.onclick = fn;
        body.appendChild(b);
      });
      body.appendChild(h('<div class="bp-eyebrow">' + esc(tr('Trash')) + ' (' + trashAll().length + ')</div>'));
      const deleted = trashAll();
      if (!deleted.length) body.appendChild(h(("<p class=\"bp-muted\">" + esc(tr("Deleted notes, saved verses, memory verses and prayers land here and can be restored within 30 days.")) + "</p>")));
      deleted.forEach(e => {
        const row = h('<div class="bp-trash-row"><div class="tr-info"><div class="tr-kind">' + esc(e.kind) + '</div><div class="tr-label">' + esc(e.label) + '</div><div class="lr-sub bp-muted">' + esc(tsDay(e.deletedAt) || "") + '</div></div></div>');
        const re = h(("<button class=\"bp-btn small\">" + esc(tr("Restore")) + "</button>"));
        re.onclick = () => { toast(restoreTrash(e) ? "Restored" : "Couldn't restore"); renderView("tools", true); };
        const del = h('<button class="bp-btn small danger">' + esc(tr("Delete")) + '</button>');
        del.onclick = () => { if (confirm(tr("Delete forever?"))) { save(K.TRASH, trashAll().filter(x => x.id !== e.id)); renderView("tools", true); } };
        row.append(re, del);
        body.appendChild(row);
      });
      body.appendChild(h(("<p class=\"bp-muted\" style=\"margin-top:12px\">" + esc(tr("Backup & restore of everything lives in Settings > Backup / My Bible > Backup as before.")) + "</p>")));
    }
  };

  /* Strong’s definitions use the bundled Open Scriptures dictionaries, not AI. */
  const studyFiles = new Map();
  function getStudyFile(path) {
    if (!studyFiles.has(path)) {
      const job = (async () => {
        const r = await fetch("./study-data/" + path + ".json.gz");
        if (!r.ok) throw new Error("Study data unavailable");
        const raw = await r.arrayBuffer(), u = new Uint8Array(raw);
        return u[0] === 31 && u[1] === 139
          ? new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("gzip"))).json()
          : JSON.parse(new TextDecoder().decode(raw));
      })();
      studyFiles.set(path, job); job.catch(() => studyFiles.delete(path));
      if (studyFiles.size > 18) studyFiles.delete(studyFiles.keys().next().value);
    }
    return studyFiles.get(path);
  }
  const lexicons = new Map();
  async function getLexicon(lang) {
    if (!lexicons.has(lang)) {
      const req = (async () => {
        const r = await fetch("./study-data/" + lang + ".json.gz");
        if (!r.ok) throw new Error("Lexicon unavailable");
        const raw = await r.arrayBuffer(), u = new Uint8Array(raw);
        const text = u[0] === 31 && u[1] === 139
          ? await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("gzip"))).text()
          : new TextDecoder().decode(raw);
        return JSON.parse(text);
      })();
      lexicons.set(lang, req); req.catch(() => lexicons.delete(lang));
    }
    return lexicons.get(lang);
  }
  const lexNorm = t => String(t || "").normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
  VIEWS.lexicon = {
    title: "Strong’s word study",
    render(body) {
      const form = h('<form class="bp-card"><label class="bp-eyebrow" for="bp-lex-q">' + esc(tr("Strong’s number, original word, or transliteration")) + '</label><div class="bp-row"><input id="bp-lex-q" class="bp-input" type="search" placeholder="' + esc(tr("e.g. G26, agape, H1")) + '" required maxlength="72"><button class="bp-btn primary" type="submit">' + esc(tr("Look up")) + '</button></div></form>');
      const input = form.querySelector('input');
      const results = h('<div role="status" aria-live="polite"></div>');
      let seq = 0;
      form.onsubmit = async e => {
        e.preventDefault();
        const q = input.value.trim(); if (!q) return;
        const n = ++seq, id = q.match(/^([gh])\s*0*(\d+)$/i);
        results.textContent = tr("Looking up…");
        try {
          const langs = id ? [id[1].toLowerCase() === 'g' ? 'greek' : 'hebrew'] : ['hebrew', 'greek'];
          const data = await Promise.all(langs.map(getLexicon));
          if (n !== seq || !results.isConnected) return;
          const needle = lexNorm(q);
          const fields = e => [e.lemma, e.xlit || e.translit].map(lexNorm);
          const code = id ? id[1].toUpperCase() + Number(id[2]) : null;
          const found = code ? (data[0][code] ? [[code,data[0][code]]] : []) : data.flatMap(d => Object.entries(d)).filter(([,e]) => fields(e).some(t => t.startsWith(needle))).sort((a,b) => +fields(b[1]).includes(needle) - +fields(a[1]).includes(needle));
          results.replaceChildren();
          if (!found.length) { results.textContent = tr("No matching Strong’s entries."); return; }
          for (const [k, e] of found.slice(0, 30)) {
            const card = h('<article class="bp-card"><div class="bp-eyebrow">' + esc(k) + (k[0] === 'G' ? ' · Greek' : ' · Hebrew / Aramaic') + '</div><h3><bdi>' + esc(e.lemma || '') + '</bdi></h3><p>' + esc([e.xlit || e.translit, e.pron].filter(Boolean).join(' · ')) + '</p><p>' + esc(e.strongs_def || '') + '</p>' + (e.kjv_def ? '<p class="bp-muted">KJV: ' + esc(e.kjv_def) + '</p>' : '') + '</article>');
            results.append(card);
          }
          if (found.length > 30) results.prepend(h('<p class="bp-muted">' + esc(tr("Showing 30 matches. Type more of the word to narrow the results.")) + '</p>'));
        } catch { if (n === seq && results.isConnected) results.textContent = tr("Couldn’t load the dictionary in this browser. Try again online."); }
      };
      body.append(form, results, h(("<p class=\"bp-muted\">Dictionary entries with transliteration, not a verse-by-verse interlinear. <a href=\"./study-data/README.md\" target=\"_blank\" rel=\"noopener\">" + esc(tr("Open Scriptures credits")) + "</a></p>")));
    }
  };

  /* Use the cross-reference data already shipped with the repository, not AI guesses. */
  const availableRefs = b => Number.isInteger(b) && b >= 0 && b < 66 && !!BOOKS[b];
  function openReferences(bookIdx, chapter, verse) {
    const book = BOOKS[bookIdx]?.[1].replaceAll(" ", "");
    if (!availableRefs(bookIdx)) return;
    openPanel("references", tr("Cross-references") + " · " + refOf(bookIdx, chapter, verse), async body => {
      body.append(h('<p class="bp-muted" role="status">' + esc(tr("Loading cross-references…")) + '</p>'));
      try {
        const legacy = bookIdx < 15 ? fetch("./crossrefs/bsb/" + book + ".json").then(r => r.ok ? r.json() : null).catch(() => null) : null;
        const linked = await getStudyFile("linked/" + (bookIdx + 1));
        const historical = bookIdx < 15 ? (await legacy)?.[chapter]?.[verse] : null;
        if (!body.isConnected) return;
        body.replaceChildren();
        const voted = linked?.[chapter]?.[verse] || [];
        const groups = [...(historical || []), ...(voted.length ? [[tr("Related passages · OpenBible.info"), voted]] : [])];
        if (!groups.length) { body.append(h('<p class="bp-muted">' + esc(tr("No linked passages are listed for this verse.")) + '</p>')); return; }
        const label = r => {
          const [b, c, v, endC, endV] = r;
          if (![b, c, v].every(Number.isInteger) || b < 1 || !BOOKS[b-1] || c < 1 || v < 1) return null;
          return refOf(b - 1, c, v) + (endV ? "–" + (endC !== c ? endC + ":" : "") + endV : "");
        };
        const rendered = new Set();
        for (const [phrase, refs] of groups) {
          const card = h('<div class="bp-card"><div class="bp-eyebrow">' + esc(phrase || tr("Related passages")) + '</div><div class="bp-chips"></div></div>');
          for (const entry of refs) {
            const parts = Array.isArray(entry[0]) ? entry : [entry];
            for (const r of parts) {
              const t = label(r); if (!t || (refs === voted && rendered.has(t))) continue;
              rendered.add(t);
              const button = h('<button type="button" class="bp-chip">' + esc(t) + '</button>');
              button.onclick = () => window.BibleyFX.jumpToVerse(r[0] - 1, r[1], r[2]);
              card.lastElementChild.append(button);
            }
          }
          if (card.lastElementChild.children.length) body.append(card);
        }
        body.append(h('<p class="bp-muted">OpenBible.info, CC BY 4.0. Up to 24 vote-ranked suggestions; relevance and verse numbering can vary. Berean links also appear where bundled.</p>'));
      } catch { if (body.isConnected) body.replaceChildren(h('<p class="bp-muted" role="status">' + esc(tr("Couldn’t load linked passages. Try again online.")) + '</p>')); }
    }, null);
  }

  function openVerseWords(b, c, v) {
    if (!availableRefs(b)) return;
    openPanel("verse-words", tr("Original words") + " · " + refOf(b,c,v), async body => {
      const source = h('<button type="button" class="bp-btn primary block">' + esc(tr("Hebrew & Greek interlinear")) + '</button>');
      source.onclick = () => openInterlinear(b, c, v);
      const tagged = h('<div role="region" aria-label="' + esc(tr("World English Bible tags")) + '">' + esc(tr("Loading tagged words…")) + '</div>');
      body.append(source, tagged);
      try {
        const [book, entries] = await Promise.all([getStudyFile("web-words/" + (b + 1)), getLexicon(b < 39 ? "hebrew" : "greek")]);
        if (!body.isConnected) return;
        tagged.replaceChildren(h('<p class="bp-muted">English words tagged in the World English Bible, with Strong’s dictionary forms and transliteration. Untagged words are omitted; this is not a parsing of the original sentence.</p>'));
        const words = book?.[c]?.[v]?.[0] || [];
        if (!words.length) tagged.append(h('<p>' + esc(tr("No tagged words are available for this verse.")) + '</p>'));
        for (const [word, codes] of words) {
          const entry = h('<details class="bp-card"><summary>' + esc(word) + ' · ' + esc(codes.join(", ")) + '</summary></details>');
          for (const code of codes) {
            const info = entries[code];
            if (!info) continue;
            entry.append(h('<p><bdi>' + esc(info.lemma || '') + '</bdi> · ' + esc(info.xlit || info.translit || '') + '</p>'), h('<p>' + esc(info.strongs_def || '') + '</p>'));
          }
          tagged.append(entry);
        }
      } catch { if (body.isConnected) tagged.textContent = tr("Couldn’t load tagged words. Try again online."); }
    }, null);
  }

  function openInterlinear(b, c, v) {
    if (!availableRefs(b)) return;
    const greek = b >= 39, readerChapter = c, readerVerse = v;
    openPanel("interlinear", tr(greek ? "Greek interlinear" : "Hebrew interlinear") + " · " + BOOKS[b][1], async body => {
      const credits = h('<p class="bp-muted"></p>');
      credits.append(document.createTextNode(tr("Source-order words and English glosses from") + " "), h('<a href="https://github.com/STEPBible/STEPBible-Data/tree/5de0a47f35f0fc13dfe1430d104e5db8a4285f9c" target="_blank" rel="noopener noreferrer">STEPBible Data (CC BY 4.0)</a>'), document.createTextNode(". " + tr(greek ? "Greek rows tagged NA28." : "Main Hebrew and Aramaic readings.") + " " + tr("English-reference numbering from the source. This is not word alignment to your selected translation; chapter and verse numbers can differ.")));
      body.append(credits);
      const result = h('<div role="status">' + esc(tr("Loading interlinear…")) + '</div>');
      body.append(result);
      try {
        const book = await getStudyFile("interlinear/" + (b + 1));
        if (!result.isConnected) return;
        const chapters = Object.keys(book || {}).filter(k => /^\d+$/.test(k)).map(Number).sort((a,b) => a-b);
        const controls = h('<div class="bp-form bp-source-navigation"><label>' + esc(tr("Source chapter")) + '<select aria-label="' + esc(tr("Source chapter")) + '"></select></label><label>' + esc(tr("Source verse")) + '<select aria-label="' + esc(tr("Source verse")) + '"></select></label></div>');
        const [chapterSelect, verseSelect] = controls.querySelectorAll("select");
        const ref = h('<p class="bp-source-reference" role="status" aria-live="polite"></p>');
        const option = (select, number, absent) => {
          const opt = document.createElement("option"); opt.value = String(number);
          opt.textContent = String(number) + (absent ? " · " + tr("Not available in this source") : "");
          select.append(opt);
        };
        if (!chapters.includes(c)) option(chapterSelect, c, true);
        chapters.forEach(n => option(chapterSelect, n, false)); chapterSelect.value = String(c);
        const versesFor = chapter => Object.keys(book?.[chapter] || {}).filter(k => /^\d+$/.test(k) && book[chapter][k]?.length).map(Number).sort((a,b) => a-b);
        const draw = () => {
          ref.textContent = tr("Source reference") + ": " + refOf(b,c,v);
          const words = book?.[c]?.[v];
          if (!words?.length) { result.replaceChildren(document.createTextNode(tr("No source words for this verse number."))); return; }
          const tokens = h('<ol class="bp-card bp-interlinear"></ol>');
          tokens.setAttribute("aria-label", tr("Interlinear words")); tokens.dir = greek ? 'ltr' : 'rtl';
          for (const [word, translit, gloss, codes, morphology] of words) {
            const token = h('<li><bdi class="bp-source-word" lang="' + (greek ? 'grc' : 'he') + '">' + esc(word) + '</bdi><bdi class="bp-muted">' + esc(translit) + '</bdi><bdi>' + esc(gloss) + '</bdi></li>');
            if (codes.length || morphology) token.append(h('<bdi class="bp-muted bp-morphology">' + esc([...codes, morphology].filter(Boolean).join(' · ')) + '</bdi>'));
            tokens.append(token);
          }
          result.replaceChildren(tokens);
        };
        const populateVerses = () => {
          verseSelect.replaceChildren(); const verses = versesFor(c);
          if (!verses.includes(v)) option(verseSelect, v, true);
          verses.forEach(n => option(verseSelect,n,false)); verseSelect.value = String(v);
        };
        // These selectors browse source numbering only; they never change the reader's translation or text.
        chapterSelect.onchange = () => { c = Number(chapterSelect.value); v = versesFor(c)[0] || 1; populateVerses(); draw(); };
        verseSelect.onchange = () => { v = Number(verseSelect.value); draw(); };
        body.insertBefore(controls,result); body.insertBefore(ref,result); populateVerses(); draw();
      } catch { if (result.isConnected) result.textContent = tr("Couldn’t load the interlinear. Try again online."); }
    }, () => openVerseWords(b, readerChapter, readerVerse));
  }

  // Match entire source-marked runs to the existing WEB reader text. Never replace its text or
  // transfer the markup to other translations with different word order or verse numbering.
  const markedPassages = new WeakMap();
  function redLetterRanges(text, runs) {
    const rx = /[\p{L}\p{M}\p{N}]+(?:[’'-][\p{L}\p{M}\p{N}]+)*/gu;
    const hits = [...text.matchAll(rx)];
    const normal = t => t.normalize("NFC").replaceAll("’", "'").toLowerCase();
    const words = hits.map(m => normal(m[0]));
    const ranges = [];
    let after = 0;
    for (const run of runs) {
      const wanted = [...run.matchAll(rx)].map(m => normal(m[0]));
      if (!wanted.length) continue;
      const starts = [];
      for (let i = after; i + wanted.length <= words.length; i++) {
        if (wanted.every((word, offset) => word === words[i + offset])) starts.push(i);
      }
      if (starts.length !== 1) continue;
      const start = starts[0], end = start + wanted.length - 1;
      ranges.push([hits[start].index, hits[end].index + hits[end][0].length]);
      after = end + 1;
    }
    return ranges;
  }
  async function paintRedLetters(k) {
    const p = C.panes[k];
    const host = document.querySelector('.pane[data-pane="' + k + '"] .verses-text');
    if (!host || p.version !== "web" || !prefs().redLetters || markedPassages.has(host)) return;
    const b = p.bookIdx, ch = p.chapter;
    if (!availableRefs(b) || b < 39) return;
    markedPassages.set(host, true);
    try {
      const book = await getStudyFile("web-words/" + (b + 1));
      if (!host.isConnected || p.version !== "web" || p.bookIdx !== b || p.chapter !== ch || !prefs().redLetters) { markedPassages.delete(host); return; }
      host.querySelectorAll('[data-verse]').forEach(el => {
        const runs = book?.[ch]?.[el.dataset.verse]?.[1];
        if (!runs?.length) return;
        unmarkWords(el);
        const node = [...el.childNodes].find(n => n.nodeType === 3);
        if (!node) return;
        const text = node.textContent, ranges = redLetterRanges(text, runs);
        if (!ranges.length) return;
        const frag = document.createDocumentFragment(); let start = 0;
        for (const [a,z] of ranges) {
          frag.append(text.slice(start,a));
          const red = document.createElement("span"); red.className = "bp-jesus"; red.textContent = text.slice(a,z); frag.append(red);
          start = z;
        }
        frag.append(text.slice(start)); node.replaceWith(frag);
      });
      diffState.lastKey = "";
      applyDiff();
    } catch { markedPassages.delete(host); }
  }
  function wireRedLetters() {
    for (const k of ["a", "b"]) {
      const pane = document.querySelector('.pane[data-pane="' + k + '"]');
      if (!pane) continue;
      const sync = () => {
        const head = pane.querySelector('.chapter-heading .right');
        if (head && C.panes[k].version === "web" && !head.querySelector('.bp-red-toggle')) {
          const button = h(("<button type=\"button\" class=\"bp-red-toggle\" title=\"" + esc(tr("Words of Jesus · World English Bible")) + "\">" + esc(tr("Red letters")) + "</button>"));
          button.onclick = () => {
            setPref("redLetters", !prefs().redLetters);
            document.documentElement.classList.toggle("bp-red-letters", !!prefs().redLetters);
            document.querySelectorAll('.bp-red-toggle').forEach(b => b.setAttribute("aria-pressed", String(!!prefs().redLetters)));
            ["a","b"].forEach(paintRedLetters);
          };
          button.setAttribute("aria-pressed", String(!!prefs().redLetters)); head.prepend(button);
        }
        paintRedLetters(k);
      };
      document.documentElement.classList.toggle("bp-red-letters", !!prefs().redLetters);
      new MutationObserver(sync).observe(pane.querySelector('.reader-inner'), { childList: true });
      sync();
    }
  }

  const STUDY_BOOK_IDS = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(' ');
  VIEWS.commentary = {
    title: "Commentaries & book outline",
    render(body) {
      const {bookIdx, chapter} = C.panes.a;
      const id = STUDY_BOOK_IDS[bookIdx];
      if (!id) { body.textContent = tr("This book is not covered by the bundled outline and commentary sources."); return; }
      const source = h('<select class="bp-input" aria-label="' + esc(tr("Commentary source")) + '"><option value="matthew-henry">Matthew Henry</option><option value="jamieson-fausset-brown">Jamieson, Fausset &amp; Brown</option></select>');
      const intro = h('<div role="status"></div>'), outline = h('<details class="bp-card"><summary>' + esc(tr("Book outline · chapter headings")) + '</summary></details>');
      const content = h('<div role="status"></div>');
      body.append(h('<h3>' + esc(refOf(bookIdx, chapter)) + '</h3>'), outline, source, intro, content,
        h('<p class="bp-muted">Headings: Berean Standard Bible. Public-domain historical commentaries via the Free Use Bible API; introductions reflect the cited author’s interpretation.</p>'));
      let loadedOutline = false;
      outline.addEventListener('toggle', async () => {
        if (!outline.open || loadedOutline) return;
        loadedOutline = true;
        const result = h('<div class="bp-study-prose">' + esc(tr("Loading chapter headings…")) + '</div>'); outline.append(result);
        try {
          const r = await fetch('./sections.json'); if (!r.ok) throw Error();
          const chapters = (await r.json()).b?.[bookIdx] || [];
          result.replaceChildren();
          if (!chapters.length) result.textContent = tr("No headings are available for this book.");
          chapters.forEach((rows, i) => {
            if (!rows.length) return;
            const row = h(("<div class=\"bp-card\"><button type=\"button\" class=\"bp-chip\">" + esc(tr("Chapter")) + " ") + (i+1) + '</button><div class="bp-study-prose"></div></div>');
            row.firstElementChild.onclick = () => { closeTool(); C.goTo(bookIdx, i+1); };
            row.lastElementChild.textContent = rows.map(v => v[0] + '. ' + v[1]).join('\n'); result.append(row);
          });
        } catch { result.textContent = tr("Couldn’t load headings online."); loadedOutline = false; outline.addEventListener('toggle', () => { if (!outline.open) result.remove(); }, {once:true}); }
      });
      let request = 0;
      const draw = async () => {
        const n = ++request, name = source.selectedOptions[0].textContent;
        intro.replaceChildren(); content.textContent = 'Loading ' + name + '…';
        try {
          const r = await fetch('https://bible.helloao.org/api/c/' + source.value + '/' + id + '/' + chapter + '.json', {signal: AbortSignal.timeout(14000)});
          if (n !== request || !body.isConnected) return;
          if (r.status === 404) { content.textContent = tr("This source has no entry for this chapter."); return; }
          if (!r.ok) throw Error();
          const result = await r.json(); if (n !== request || !body.isConnected) return;
          const addIntro = (title, value) => {
            if (typeof value !== 'string' || !value.trim()) return;
            const box = h('<details class="bp-card"><summary>' + esc(title) + '</summary><p class="bp-study-prose"></p></details>');
            box.lastElementChild.textContent = value.trim(); intro.append(box);
          };
          addIntro('Book introduction', result.book?.introduction);
          addIntro('Chapter introduction', result.chapter?.introduction);
          const rows = (result.chapter?.content || []).filter(row => Array.isArray(row.content) && row.content.some(p => typeof p === 'string'));
          content.replaceChildren();
          if (!rows.length) content.textContent = tr("No commentary text is listed for this chapter.");
          for (const row of rows) {
            const p = h('<div class="bp-card"><div class="bp-eyebrow"></div><div class="bp-study-prose"></div></div>');
            p.firstElementChild.textContent = row.number ? 'Verse ' + row.number : name;
            p.lastElementChild.textContent = row.content.filter(t => typeof t === 'string').join('\n\n').trim();
            content.append(p);
          }
        } catch { if (n === request && body.isConnected) content.textContent = tr("Couldn’t load this commentary. Try again online."); }
      };
      source.onchange = draw; draw();
    }
  };
  VIEWS.dictionary = {
    title: "Easton’s Bible dictionary",
    async render(body) {
      const input = h('<input aria-label="' + esc(tr("Search people, places or terms")) + '" class="bp-input" type="search" placeholder="' + esc(tr("e.g. Nicodemus, Zion, covenant")) + '">');
      const results = h('<div role="status">' + esc(tr("Loading the dictionary…")) + '</div>');
      body.append(input, results, h('<p class="bp-muted">Easton’s Illustrated Bible Dictionary, third edition (1897), public domain. This is a historical reference work.</p>'));
      try {
        const entries = Object.entries(await getStudyFile('eastons')).map(([term, defs]) => [term, defs, lexNorm(term)]);
        if (!body.isConnected) return;
        const draw = () => {
          const q = lexNorm(input.value.trim());
          results.replaceChildren();
          if (!q) { results.textContent = tr("Search by a person, place or topic."); return; }
          const hits = entries.filter(([, , term]) => term.includes(q)).sort((a,b) => +b[2].startsWith(q) - +a[2].startsWith(q)).slice(0,30);
          if (!hits.length) results.textContent = tr("No matching entries.");
          for (const [term, defs] of hits) {
            const row = h('<details class="bp-card"><summary></summary></details>'); row.firstElementChild.textContent = term;
            row.open = hits.length === 1;
            for (const def of defs) { const p = h('<p class="bp-study-prose"></p>'); p.textContent = def; row.append(p); }
            results.append(row);
          }
        };
        input.oninput = draw; draw();
      } catch { if (body.isConnected) results.textContent = tr("Couldn’t load the dictionary. Try again online."); }
    }
  };
  VIEWS.maps = {
    title: "Bible places map",
    async render(body) {
      const input = h('<input class="bp-input" aria-label="' + esc(tr("Find a Bible place")) + '" type="search" placeholder="' + esc(tr("e.g. Jerusalem")) + '">');
      const results = h('<div class="bp-chips" role="status">' + esc(tr("Loading places…")) + '</div>');
      const map = h('<div></div>');
      body.append(input, results, map, h('<p class="bp-muted">Possible locations from OpenBible.info (CC BY 4.0), using Wikimedia-sourced points. Ancient identifications may be uncertain; the pin is not a proven site.</p>'));
      try {
        const sites = await getStudyFile('places'); if (!body.isConnected) return;
        const mapFor = ([name, slug, refs, candidates]) => {
          const refsText = refs.length ? 'Appears in ' + refs.join(', ') : '';
          const title = h('<h3></h3>'); title.textContent = name;
          const about = h('<p class="bp-muted"></p>'); about.textContent = refsText;
          const buttons = h('<div class="bp-chips"></div>');
          const canvas = h('<div></div>');
          map.replaceChildren(title, about, buttons, canvas);
          for (const [label, lat, lon] of candidates) {
            const b = h('<button class="bp-chip" type="button"></button>'); b.textContent = 'Map: ' + label;
            b.onclick = () => {
              const d = 0.13, params = new URLSearchParams({bbox:[lon-d,lat-d,lon+d,lat+d].join(','),layer:'mapnik',marker:lat+','+lon});
              const f = document.createElement('iframe'); f.className='bp-map-frame'; f.title='Possible location: '+label; f.referrerPolicy='no-referrer'; f.src='https://www.openstreetmap.org/export/embed.html?'+params;
              canvas.replaceChildren(f);
            }; buttons.append(b);
          }
          const a = h(("<a class=\"bp-chip\" target=\"_blank\" rel=\"noopener noreferrer\">" + esc(tr("Sources and alternate identifications")) + "</a>"));
          a.href = 'https://www.openbible.info/geo/ancient/' + encodeURIComponent(slug); buttons.append(a);
        };
        const draw = () => {
          const q = lexNorm(input.value.trim());
          results.replaceChildren(); map.replaceChildren();
          const hits = q ? sites.filter(p => lexNorm(p[0]).includes(q)).slice(0,25) : sites.filter(p => ['Jerusalem','Nazareth','Capernaum','Bethlehem','Rome'].includes(p[0]));
          if (!hits.length) results.textContent = tr("No mapped places match.");
          for (const p of hits) { const b = h('<button class="bp-chip" type="button"></button>'); b.textContent = p[0]; b.onclick = () => mapFor(p); results.append(b); }
        };
        input.oninput = draw; draw();
      } catch { if (body.isConnected) results.textContent = tr("Couldn’t load places. Try again online."); }
    }
  };

  const recordLinks = refs => {
    const buttons = h('<div class="bp-chips"></div>');
    for (const r of refs) {
      const book = Number(r.slice(0,2))-1, chapter = Number(r.slice(2,5)), verse = Number(r.slice(5));
      if (!availableRefs(book) || chapter < 1 || verse < 1) continue;
      const button = h('<button class="bp-chip" type="button"></button>'); button.textContent = refOf(book,chapter,verse);
      button.onclick = () => { closeTool(); window.BibleyFX.jumpToVerse(book,chapter,verse); };
      buttons.append(button);
    }
    return buttons;
  };
  const timelineYear = text => {
    const m = /^(-?\d{4})(?:-|$)/.exec(text);
    if (!m) return 'Date not listed';
    const year = Number(m[1]); return year <= 0 ? (1-year) + ' BC' : 'AD ' + year;
  };
  function studyDirectory(kind) {
    const timeline = kind === 'timeline';
    return {
      title: timeline ? 'Bible timeline' : 'Bible character profiles',
      async render(body) {
        const form = h('<div class="bp-row"><input type="search" class="bp-input" aria-label="' + esc(tr(timeline ? "Search events or participants" : "Search Bible characters")) + '" placeholder="' + esc(tr(timeline ? "e.g. Exodus" : "e.g. Aaron")) + '"></div>');
        const input = form.firstElementChild, results = h('<div role="status">' + esc(tr("Loading study data…")) + '</div>');
        const count = h('<div class="bp-row"><button class="bp-chip" type="button">' + esc(tr("Previous")) + '</button><span class="bp-muted"></span><button class="bp-chip" type="button">' + esc(tr("Next")) + '</button></div>');
        const [prev,next] = count.querySelectorAll('button');
        body.append(form, results, count, h('<p class="bp-muted">Adapted from <a href="https://github.com/robertrouse/theographic-bible-metadata" target="_blank" rel="noopener">Theographic Bible Metadata</a> (CC BY-SA 4.0). ' + (timeline ? 'Dates shown are estimates from this dataset’s traditional chronology, not a consensus historical chronology.' : 'Where included, descriptions are historical dictionary entries. References follow KJV numbering.') + '</p>'));
        let page = 0;
        try {
          const data = await getStudyFile(kind); if (!body.isConnected) return;
          const draw = () => {
            const q = lexNorm(input.value.trim()), size = 24;
            const all = q ? data.filter(row => lexNorm(timeline ? row[0]+' '+row[3].join(' ') : row[0]+' '+row[1]).includes(q)) : data;
            results.replaceChildren();
            for (const row of all.slice(page*size,(page+1)*size)) {
              const details = h('<details class="bp-card"><summary></summary><p class="bp-study-prose"></p></details>');
              details.firstElementChild.textContent = timeline ? timelineYear(row[1])+' · '+row[0] : [row[0],row[1]].filter(Boolean).join(' · ');
              details.lastElementChild.textContent = timeline ? row[3].join(', ') : row[2];
              details.append(recordLinks(timeline ? row[2] : row[3]));
              results.append(details);
            }
            if (!all.length) results.textContent = tr("No matches found.");
            count.querySelector('span').textContent = all.length ? (page*size+1)+'–'+Math.min(all.length,(page+1)*size)+' of '+all.length : '';
            prev.disabled = !page; next.disabled = (page+1)*size >= all.length;
          };
          input.oninput = () => { page=0; draw(); }; prev.onclick = () => { page--; draw(); }; next.onclick = () => { page++; draw(); }; draw();
        } catch { if (body.isConnected) results.textContent = tr("Couldn’t load the study data. Try again online."); }
      }
    };
  }
  VIEWS.timeline = studyDirectory('timeline');
  VIEWS.people = studyDirectory('people');

  /* ================= compare word-diff ================= */
  const diffState = { on: prefs().diffOn, applying: false, lastKey: "", lastA: null, lastB: null };
  function wordTokens(t) { return t.normalize("NFC").toLocaleLowerCase().match(/[\p{L}\p{M}\p{N}]+(?:[’'-][\p{L}\p{M}\p{N}]+)*/gu) || []; }
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
  const verseText = span => Array.from(span.childNodes).filter(n => n.nodeType === 3 || n.matches?.("mark.bp-diff, span.bp-jesus")).map(n => n.textContent).join("");
  function markWords(span, marks) {
    let wi = 0;
    for (const node of [...span.childNodes].flatMap(n => n.nodeType === 1 && n.classList.contains("bp-jesus") ? [...n.childNodes] : [n])) {
      if (node.nodeType !== 3) continue;
      const text = node.textContent, frag = document.createDocumentFragment();
      let pos = 0;
      for (const m of text.matchAll(/[\p{L}\p{M}\p{N}]+(?:[’'-][\p{L}\p{M}\p{N}]+)*/gu)) {
        frag.append(text.slice(pos, m.index));
        if (marks[wi++]) { const w = document.createElement("mark"); w.className = "bp-diff"; w.textContent = m[0]; frag.appendChild(w); }
        else frag.append(m[0]);
        pos = m.index + m[0].length;
      }
      frag.append(text.slice(pos)); node.replaceWith(frag);
    }
  }
  function unmarkWords(span) {
    const ws = span.querySelectorAll("mark.bp-diff"); if (!ws.length) return;
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
    const compareOn = paneB && C.isCompare();
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
    const aa = document.querySelector('.pane[data-pane="a"] .verses-text');
    const bb = paneB.querySelector('.verses-text');
    if (key === diffState.lastKey && aa === diffState.lastA && bb === diffState.lastB) return;
    const remember = () => Object.assign(diffState, { lastKey: key, lastA: aa, lastB: bb });
    const va = paneVerses("a"), vb = paneVerses("b");
    diffState.applying = true;
    try {
      if (oldBadge) oldBadge.remove();
      Object.values(va).forEach(unmarkWords); Object.values(vb).forEach(unmarkWords);
      if (pa.bookIdx !== pb.bookIdx || pa.chapter !== pb.chapter) {
        badgeHost?.append(h(("<span class=\"bp-diff-badge\">" + esc(tr("Match chapters to compare")) + "</span>"))); remember(); return;
      }
      if (!aa || !bb) return;
      let totW = 0, totC = 0;
      for (const n of new Set([...Object.keys(va), ...Object.keys(vb)])) {
        const sa = va[n], sb = vb[n];
        const a = sa ? wordTokens(verseText(sa)) : [], b = sb ? wordTokens(verseText(sb)) : [];
        const [ma, mb] = lcsMarks(a, b);
        if (sa) markWords(sa, ma);
        if (sb) markWords(sb, mb);
        totW += a.length + b.length; totC += ma.filter(Boolean).length + mb.filter(Boolean).length;
      }
      const pct = totW ? Math.round(totC / totW * 100) : 0;
      badgeHost?.append(h(("<span class=\"bp-diff-badge\" title=\"" + esc(tr("Unmatched words as a share of all words in both translations")) + "\">") + pct + (isEs() ? '% diferente</span>' : '% different</span>')));
      remember();
    } finally { diffState.applying = false; }
  }
  function wireDiff() {
    const tb = document.querySelector('.pane[data-pane="b"] .pane-toolbar');
    if (!tb || tb.querySelector(".bp-diff-toggle")) return;
    const btn = h('<button type="button" class="bp-diff-toggle' + (diffState.on ? " on" : "") + '" aria-pressed="' + diffState.on + ("\" title=\"" + esc(tr("Highlight word-level differences between the two translations")) + "\">" + esc(tr("Diff")) + "</button>"));
    btn.onclick = () => { diffState.on = !diffState.on; setPref("diffOn", diffState.on); btn.classList.toggle("on", diffState.on); btn.setAttribute("aria-pressed", String(diffState.on)); diffState.lastKey = ""; applyDiff(); };
    tb.insertBefore(btn, tb.firstChild);
    let t;
    const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(applyDiff, 350); });
    document.querySelectorAll(".reader-inner").forEach(el => mo.observe(el, { childList: true, subtree: true }));
    const panesEl = document.getElementById("panes");
    if (panesEl) mo.observe(panesEl, { attributes: true, subtree: true, attributeFilter: ["style"] });
  }

  /* ================= back/forward chapter history ================= */
  let chapterHistory = null;
  function wireHistory() {
    const refBtn = document.querySelector('.pane-ref-btn[data-pane="a"]');
    if (!refBtn) return;
    let st; try { st = JSON.parse(sessionStorage.getItem("bibley_plus_hist") || "null"); } catch {}
    if (!st || !Array.isArray(st.stack) || !Number.isInteger(st.i) || !st.stack.every(x => Array.isArray(x) && BOOKS[x[0]] && Number.isInteger(x[1]))) st = { stack: [], i: -1 };
    let pending = null;
    const record = () => { try { sessionStorage.setItem("bibley_plus_hist", JSON.stringify(st)); } catch {} };
    const remember = () => {
      const r = [C.panes.a.bookIdx, C.panes.a.chapter], matches = other => other?.[0] === r[0] && other[1] === r[1];
      if (matches(pending)) { pending = null; return; }
      if (matches(st.stack[st.i])) return;
      st.stack = st.stack.slice(0, st.i + 1); st.stack.push(r); st.i++;
      if (st.stack.length > 100) { st.stack.shift(); st.i--; }
      record();
    };
    chapterHistory = {
      can: offset => st.i + offset >= 0 && st.i + offset < st.stack.length,
      move(offset) {
        if (!this.can(offset)) return;
        st.i += offset; pending = st.stack[st.i]; record(); C.goTo(...pending);
      }
    };
    remember();
    new MutationObserver(remember).observe(refBtn, { childList: true, characterData: true, subtree: true });
  }

  /* ================= read-aloud bar (sleep timer + speed) ================= */
  function wireTtsBar() {
    if (!("speechSynthesis" in window)) return;
    const bar = h(("<div class=\"bp-tts-bar\" style=\"display:none\"><span class=\"t-label\">" + esc(tr("Reading aloud")) + "</span><select title=\"" + esc(tr("Sleep timer")) + "\"><option value=\"0\">" + esc(tr("No sleep timer")) + "</option><option value=\"5\">" + esc(tr("Stop in 5 min")) + "</option><option value=\"15\">" + esc(tr("Stop in 15 min")) + "</option><option value=\"30\">" + esc(tr("Stop in 30 min")) + "</option><option value=\"45\">" + esc(tr("Stop in 45 min")) + "</option><option value=\"60\">" + esc(tr("Stop in 60 min")) + "</option></select><select title=\"" + esc(tr("Reading speed (applies from the next verse)")) + "\"><option value=\"0.75\">" + esc(tr("Slow")) + "</option><option value=\"0.95\">" + esc(tr("Normal")) + "</option><option value=\"1.15\">" + esc(tr("Fast")) + "</option><option value=\"1.35\">" + esc(tr("Faster")) + "</option></select><button type=\"button\">" + esc(tr("Stop")) + "</button></div>"));
    document.body.appendChild(bar);
    const [timerSel, rateSel, stopBtn] = bar.querySelectorAll("select,button");
    let deadline = 0;
    timerSel.value = "0";
    timerSel.onchange = () => {
      const m = +timerSel.value;
      deadline = m ? Date.now() + m * 60000 : 0;
      if (m) toast(isEs() ? "La lectura se detendrá en " + m + " minutos" : "Reading will stop in " + m + " minutes");
    };
    try { rateSel.value = String((JSON.parse(localStorage.getItem(K.SET) || "{}").tts) || 0.95); } catch {}
    rateSel.onchange = () => {
      if (window.BibleySettings?.setTtsRate) window.BibleySettings.setTtsRate(+rateSel.value);
      else { const cur = load(K.SET, {}); cur.tts = +rateSel.value; save(K.SET, cur); }
      toast("Speed applies from the next verse");
    };
    const stopAll = () => {
      const active = document.querySelector(".tts-btn.active");
      if (active) active.click(); else try { speechSynthesis.cancel(); } catch {}
      deadline = 0; timerSel.value = "0";
    };
    stopBtn.onclick = stopAll;
    setInterval(() => {
      const speaking = speechSynthesis.speaking || speechSynthesis.pending;
      bar.style.display = speaking ? "flex" : "none";
      if (!speaking && !document.querySelector(".tts-btn.active")) { deadline = 0; timerSel.value = "0"; }
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
    const mic = h(("<button type=\"button\" class=\"bp-chip bp-drawer-mic\">" + esc(tr("🎤 Voice search")) + "</button>"));
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
    const rnd = h(("<button type=\"button\" class=\"bp-chip\">" + esc(tr("Random verse")) + "</button>"));
    rnd.onclick = async () => {
      rnd.disabled = true;
      try {
        const b = Math.floor(Math.random() * 66), c = 1 + Math.floor(Math.random() * BOOKS[b][2]);
        const data = await C.getChapter(C.panes.a.version, b, c);
        const verses = Array.isArray(data) ? data : data?.verses;
        if (!verses?.length) throw new Error("No verses");
        const verse = verses[Math.floor(Math.random() * verses.length)];
        if (!verse.verse) throw new Error("No verse number");
        C.closeDrawer(); window.BibleyFX.jumpToVerse(b, c, verse.verse);
      } catch { toast("Couldn’t load a random verse in this translation"); }
      finally { rnd.disabled = false; }
    };
    const filters = h(("<button type=\"button\" class=\"bp-chip\">" + esc(tr("Filters & history")) + "</button>"));
    filters.onclick = () => { C.closeDrawer(); openTool("search", () => { closeTool(); document.getElementById("openNavBtn")?.click(); }); };
    row.append(filters, mic, rnd);
    wrap.append(row);
  }

  /* ================= init ================= */
  function init() {
    try { wireDrawerExtras(); } catch (e) { console.warn("Bibley search controls", e); }
    try { wireDiff(); } catch (e) { console.warn("Bibley comparison controls", e); }
    try { wireRedLetters(); } catch (e) { console.warn("Bibley red letters", e); }
    try { wireHistory(); } catch (e) { console.warn("Bibley reading history", e); }
    try { wireTtsBar(); } catch (e) { console.warn("Bibley read-aloud controls", e); }
    window.BibleyTools = { open: openTool, pushTrash, printChapter, availableRefs, openReferences, openVerseWords, history: chapterHistory, dayRecap, monthRecap, dueCount, _test: { lcsMarks, wordTokens, bibleSearch, easterDate, seasonalPlans, splitDays, cplanState, restoreTrash, journalMeta: () => load(K.JRNL, null) } };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
