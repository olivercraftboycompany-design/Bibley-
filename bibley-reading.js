/* bibley-reading.js - Bibley 7.3 reading tools, built into the reader through window.BibleyCore.
   1. Compare differences: in Compare, words that differ between the two translations are marked in
      both panes, and the second pane's toolbar shows how different the chapter is ("23%"). Tap that
      chip (or Settings > Reading > Compare) to turn it on or off.
      Word-level diff: Myers' O(ND) algorithm in linear space (middle snake), so even Psalm 119 is quick.
      Words are compared without case, punctuation, apostrophes or accents. When both translations
      number the verses the same way, each verse is compared with its partner (verses only one side has
      are marked whole); when the numbering differs, the chapter is compared as one passage so shifted
      verses still line up.
   2. Chapter history: back / forward arrows in the top bar retrace the chapters you opened this
      session, like a browser (a new chapter after going back drops the forward chapters). The phone's
      Back button also steps back through them when nothing else is open; with no history left it does
      what it did before. Kept in sessionStorage, so it lasts until the tab or app is closed.
   3. Print chapter: More menu > Print chapter (and the browser's own Print / Save as PDF) prints a
      clean page: the chapter, the second translation side by side when Compare is open, section
      headings, your highlights and notes, and the copyright lines; no buttons or bars.
   Stored: localStorage "bibley_reading_v1" {diff} (synced like every bibley_ setting) and
   sessionStorage "bibley_chapter_history_v1" {s:[{b,c,y}], i} (this session only, never synced).
   History entries this file adds to the browser: at most one, {bibleyReadBack:1}, under the
   overlays (sheets, Settings, Search) that already use the Back button. ASCII only in this file. */
(() => {
  "use strict";
  if (window.BibleyReading) return;
  const C = window.BibleyCore;
  if (!C) { console.warn("Bibley reading tools: reader bridge missing"); return; }
  const { BOOKS } = C;
  const K_PREF = "bibley_reading_v1", K_HIST = "bibley_chapter_history_v1";
  const $ = id => document.getElementById(id);
  const FX = () => window.BibleyFX || null;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const load = (store, k, d) => { try { const v = JSON.parse(store.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (store, k, v) => { try { store.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const toast = (m, ms) => { const f = FX(); if (f && f.ui && f.ui.toast) f.ui.toast(m, ms); };
  const paneEl = (sel, k) => document.querySelector('.pane[data-pane="' + k + '"] ' + sel);
  const refLabel = (b, c) => BOOKS[b] ? BOOKS[b][1] + " " + c : "";
  const sv = d => '<svg class="ui-ic" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>";
  const IC = {
    back: sv('<path d="M19 12H5.5M11 6l-6 6 6 6"/>'),
    fwd: sv('<path d="M5 12h13.5M13 6l6 6-6 6"/>'),
    diff: sv('<path d="M5 9.5h14M5 14.5h14M15.5 5l-7 14"/>'),
    print: sv('<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14.5h10v6H7z"/>')
  };

  /* =====================================================================
     Word diff
     ===================================================================== */
  // A word is letters/digits with inner apostrophes or hyphens ("God's", "fifty-two").
  const WORD = /[\p{L}\p{N}]+(?:['\u2019\u02bc-][\p{L}\p{N}]+)*/gu;
  const keyOf = w => w.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/['\u2019\u02bc-]/g, "");
  // Pieces of a verse: separators and words, in order; words carry their comparison key.
  function tokenize(text) {
    const parts = []; let last = 0, m; text = String(text || "");
    WORD.lastIndex = 0;
    while ((m = WORD.exec(text))) {
      if (m.index > last) parts.push({ t: text.slice(last, m.index) });
      parts.push({ t: m[0], k: keyOf(m[0]) });
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push({ t: text.slice(last) });
    return parts;
  }

  // Myers diff (linear space). a, b: arrays of keys. Marks ca[i] / cb[j] = 1 for words not in the LCS.
  function myers(a, b) {
    const ca = new Uint8Array(a.length).fill(1), cb = new Uint8Array(b.length).fill(1);
    const stack = [[0, a.length, 0, b.length]];
    while (stack.length) {
      let [a0, a1, b0, b1] = stack.pop();
      while (a0 < a1 && b0 < b1 && a[a0] === b[b0]) { ca[a0++] = 0; cb[b0++] = 0; }
      while (a0 < a1 && b0 < b1 && a[a1 - 1] === b[b1 - 1]) { ca[--a1] = 0; cb[--b1] = 0; }
      if (a0 === a1 || b0 === b1) continue;           // only insertions or only deletions left
      const s = midSnake(a, a0, a1 - a0, b, b0, b1 - b0);
      for (let x = s[0], y = s[1]; x < s[2]; x++, y++) { ca[a0 + x] = 0; cb[b0 + y] = 0; }
      stack.push([a0, a0 + s[0], b0, b0 + s[1]], [a0 + s[2], a1, b0 + s[3], b1]);
    }
    return { ca, cb };
  }
  // The middle snake of a[a0..a0+N) vs b[b0..b0+M): [xStart, yStart, xEnd, yEnd] relative to a0/b0.
  // Both ends of the range are known to differ (common prefix/suffix were stripped), so D >= 2 and
  // both halves it splits the problem into are strictly smaller.
  function midSnake(a, a0, N, b, b0, M) {
    const max = Math.ceil((N + M) / 2) + 1, off = max + 1, delta = N - M, odd = (delta & 1) !== 0;
    const vf = new Int32Array(2 * max + 3), vb = new Int32Array(2 * max + 3);
    for (let d = 0; d <= max; d++) {
      for (let k = -d; k <= d; k += 2) {
        let x = (k === -d || (k !== d && vf[off + k - 1] < vf[off + k + 1])) ? vf[off + k + 1] : vf[off + k - 1] + 1;
        let y = x - k; const xs = x, ys = y;
        while (x < N && y < M && a[a0 + x] === b[b0 + y]) { x++; y++; }
        vf[off + k] = x;
        if (odd && k >= delta - (d - 1) && k <= delta + (d - 1) && x + vb[off + delta - k] >= N) return [xs, ys, x, y];
      }
      for (let k = -d; k <= d; k += 2) {
        let x = (k === -d || (k !== d && vb[off + k - 1] < vb[off + k + 1])) ? vb[off + k + 1] : vb[off + k - 1] + 1;
        let y = x - k; const xs = x, ys = y;
        while (x < N && y < M && a[a0 + N - x - 1] === b[b0 + M - y - 1]) { x++; y++; }
        vb[off + k] = x;
        if (!odd && k >= delta - d && k <= delta + d && x + vf[off + delta - k] >= N) return [N - x, M - y, N - xs, M - ys];
      }
    }
    return [0, 0, 0, 0]; // not reached
  }

  // Compare two chapters. va, vb: [{verse, text}]. Returns per-verse pieces with a changed flag on words.
  function diffChapters(va, vb) {
    const run = byVerse => {
      const prep = vs => vs.map(v => { const parts = tokenize(v.text); return { verse: String(v.verse), parts, words: parts.filter(p => p.k) }; });
      const A = prep(va || []), B = prep(vb || []);
      if (byVerse) {
        const mapB = new Map(B.map(v => [v.verse, v])), mapA = new Map(A.map(v => [v.verse, v]));
        A.forEach(v => { const o = mapB.get(v.verse); if (!o) { v.only = true; v.words.forEach(w => w.ch = 1); return; } mark(v.words, o.words); });
        B.forEach(v => { if (!mapA.has(v.verse)) { v.only = true; v.words.forEach(w => w.ch = 1); } });
      } else mark([].concat(...A.map(v => v.words)), [].concat(...B.map(v => v.words)));
      const count = vs => vs.reduce((n, v) => n + v.words.length, 0), changed = vs => vs.reduce((n, v) => n + v.words.filter(w => w.ch).length, 0);
      const total = count(A) + count(B), diff = changed(A) + changed(B);
      return { a: A, b: B, byVerse, total, changed: diff, pct: total ? diff * 100 / total : 0 };
    };
    const numsA = (va || []).map(v => String(v.verse)), numsB = (vb || []).map(v => String(v.verse));
    const sameNumbering = numsA.length === numsB.length && numsA.every((n, i) => n === numsB[i]);
    if (sameNumbering) return Object.assign(run(true), { sameNumbering });
    // The verse numbers differ. A verse missing on one side is marked whole and the rest compared verse
    // by verse; but when the numbering is shifted (a psalm title counted as verse 1, a verse split in two),
    // comparing the chapter as one passage lines the words up far better, so use whichever fits.
    const setB = new Set(numsB), setA = new Set(numsA);
    const per = orderAgrees(numsA, numsB, setA, setB) && numsA.some(n => setB.has(n)) ? run(true) : null;
    const whole = run(false);
    return Object.assign(per && per.pct - whole.pct <= 10 ? per : whole, { sameNumbering });
  }
  function orderAgrees(na, nb, sa, sb) { const x = na.filter(n => sb.has(n)), y = nb.filter(n => sa.has(n)); return x.length === y.length && x.every((n, i) => n === y[i]); }
  function mark(wa, wb) {
    const r = myers(wa.map(w => w.k), wb.map(w => w.k));
    wa.forEach((w, i) => { w.ch = r.ca[i]; }); wb.forEach((w, j) => { w.ch = r.cb[j]; });
  }
  const pctLabel = p => p <= 0 ? "0%" : p < 1 ? "<1%" : Math.round(p) + "%";

  /* ---------- Compare differences in the reader ---------- */
  const diffOn = () => load(localStorage, K_PREF, {}).diff !== false;   // on by default
  function setDiff(on) { const p = load(localStorage, K_PREF, {}); p.diff = !!on; save(localStorage, K_PREF, p); applyDiff(); }
  let lastDiff = null, chip = null, applyT = 0;

  function ensureChip() {
    if (chip && chip.isConnected) return chip;
    const bar = paneEl(".pane-toolbar", "b"); if (!bar) return null;
    chip = document.createElement("button"); chip.type = "button"; chip.className = "bx-dchip";
    chip.innerHTML = IC.diff + '<span class="bx-dchip-t"></span>';
    const tts = bar.querySelector(".tts-btn");
    bar.insertBefore(chip, tts || null);
    // phones: both compare toolbars wrap to two matching rows (reference + version, then the buttons)
    const brk = () => { const s = document.createElement("span"); s.className = "bx-tbreak"; s.setAttribute("aria-hidden", "true"); return s; };
    bar.insertBefore(brk(), chip);
    const barA = paneEl(".pane-toolbar", "a"), ttsA = barA && barA.querySelector(".tts-btn");
    if (barA && !barA.querySelector(".bx-tbreak")) barA.insertBefore(brk(), ttsA || null);
    chip.onclick = () => { const on = !diffOn(); setDiff(on); toast(on ? "Showing differences between the translations" : "Differences hidden"); };
    return chip;
  }
  function paintChip(state, r) {
    const c = ensureChip(); if (!c) return;
    const on = diffOn(), t = c.querySelector(".bx-dchip-t");
    c.classList.toggle("on", on); c.setAttribute("aria-pressed", on ? "true" : "false");
    let label = "Differences", title = "Highlight the words that differ between the two translations";
    if (on) {
      if (state === "ready" && r) {
        label = pctLabel(r.pct) + '<span class="bx-dchip-x"> different</span>';
        title = pctLabel(r.pct) + " of the words differ between " + C.versionName(C.panes.a.version) + " and " + C.versionName(C.panes.b.version) + " in this chapter" + (r.byVerse ? "" : " (the verse numbering differs, so the chapter was compared as one passage)") + ". Tap to hide the differences.";
      } else if (state === "apart") { label = "\u2014"; title = "The two panes show different chapters. Open the same chapter in both to see the differences."; }
      else if (state === "wait") { label = "\u2026"; title = "Waiting for both chapters to load"; }
      else if (state === "missing") { label = "\u2014"; title = "This chapter couldn't be loaded in one of the translations, so there is nothing to compare."; }
    }
    t.innerHTML = label;
    c.title = title; c.setAttribute("aria-label", title);
  }
  function clearMarks(k) {
    document.querySelectorAll('.pane[data-pane="' + k + '"] .verses-text span[data-verse]').forEach(span => {
      if (span.classList.contains("bx-dv-only")) span.classList.remove("bx-dv-only");
      if (!span.querySelector("mark.bx-dw")) return;
      let text = ""; const kill = [];
      span.childNodes.forEach(n => { if (n.nodeName === "SUP") return; if (n.nodeType === 3 || (n.nodeName === "MARK" && n.classList.contains("bx-dw"))) { text += n.textContent; kill.push(n); } });
      kill.forEach(n => n.remove()); span.appendChild(document.createTextNode(text));
    });
  }
  // Rebuild a verse's text node as plain text + <mark class="bx-dw"> runs (marks, not spans: the reader
  // styles every span inside .verses-text as a verse).
  function paintVerse(span, v) {
    const tn = Array.from(span.childNodes).filter(n => n.nodeType === 3).pop(); if (!tn) return;
    const tail = /\s*$/.exec(tn.textContent)[0];
    const frag = document.createDocumentFragment(); const parts = v.parts; let i = 0, plain = "";
    const flush = () => { if (plain) { frag.appendChild(document.createTextNode(plain)); plain = ""; } };
    while (i < parts.length) {
      const p = parts[i];
      if (!(p.k && p.ch)) { plain += p.t; i++; continue; }
      // a run of changed words, with the spaces/punctuation between them
      let run = p.t; i++;
      while (i < parts.length) { if (!parts[i].k && i + 1 < parts.length && parts[i + 1].k && parts[i + 1].ch) { run += parts[i].t + parts[i + 1].t; i += 2; } else break; }
      flush(); const m = document.createElement("mark"); m.className = "bx-dw"; m.textContent = run; frag.appendChild(m);
    }
    plain += tail; flush();
    span.replaceChild(frag, tn);
    if (v.only) span.classList.add("bx-dv-only");
  }
  function applyDiff() {
    clearTimeout(applyT); applyT = 0;
    const cmp = C.isCompare && C.isCompare();
    if (!cmp) { clearMarks("a"); clearMarks("b"); lastDiff = null; return; }
    const on = diffOn(), pa = C.panes.a, pb = C.panes.b;
    clearMarks("a"); clearMarks("b");
    if (!on) { lastDiff = null; paintChip("off"); return; }
    if (pa.bookIdx !== pb.bookIdx || pa.chapter !== pb.chapter) { lastDiff = null; paintChip("apart"); return; }
    const va = C.paneVerses("a"), vb = C.paneVerses("b");
    const shownA = paneEl(".verses-text", "a"), shownB = paneEl(".verses-text", "b");
    if (!va || !vb || !shownA || !shownB) {
      lastDiff = null;
      paintChip(paneEl(".reader-inner .state-msg", "a") || paneEl(".reader-inner .state-msg", "b") ? "missing" : "wait"); return;
    }
    const r = diffChapters(va, vb); lastDiff = { r, b: pa.bookIdx, c: pa.chapter, va: pa.version, vb: pb.version };
    [["a", r.a], ["b", r.b]].forEach(([k, list]) => {
      const byNum = new Map(list.map(v => [v.verse, v]));
      document.querySelectorAll('.pane[data-pane="' + k + '"] .verses-text span[data-verse]').forEach(span => { const v = byNum.get(String(span.dataset.verse)); if (v) paintVerse(span, v); });
    });
    paintChip("ready", r);
  }
  const scheduleDiff = () => { if (!applyT) applyT = setTimeout(applyDiff, 0); };

  /* =====================================================================
     Chapter history (back / forward)
     ===================================================================== */
  const MAX_HIST = 100, SENT = "bibleyReadBack";
  let hist = load(sessionStorage, K_HIST, null);
  if (!hist || !Array.isArray(hist.s) || typeof hist.i !== "number") hist = { s: [], i: -1 };
  hist.s = hist.s.filter(e => e && BOOKS[e.b] && e.c >= 1 && e.c <= BOOKS[e.b][2]);
  hist.i = Math.min(Math.max(hist.i, -1), hist.s.length - 1);
  let restoreY = null, sentinel = !!(history.state && history.state[SENT]), ignorePopUntil = 0, syncT = 0;
  const saveHist = () => save(sessionStorage, K_HIST, hist);
  const curEntry = () => hist.s[hist.i] || null;
  const canBack = () => hist.i > 0, canFwd = () => hist.i < hist.s.length - 1;

  function noteChapter(b, c) {
    const cur = curEntry();
    if (cur && cur.b === b && cur.c === c) return;               // same chapter (version change, retry, re-render, or back/forward)
    // leaving the current chapter: remember how far down it was read
    if (cur) { const rm = paneEl(".reader-main", "a"); if (rm) cur.y = Math.round(rm.scrollTop); }
    hist.s = hist.s.slice(0, hist.i + 1); hist.s.push({ b, c, y: 0 });
    if (hist.s.length > MAX_HIST) hist.s = hist.s.slice(hist.s.length - MAX_HIST);
    hist.i = hist.s.length - 1; saveHist(); paintHist(); syncSentinelSoon();
  }
  function go(step) {
    const j = hist.i + step; if (j < 0 || j >= hist.s.length) return false;
    const cur = curEntry(); if (cur) { const rm = paneEl(".reader-main", "a"); if (rm) cur.y = Math.round(rm.scrollTop); }
    hist.i = j; const e = hist.s[j]; saveHist();
    restoreY = { b: e.b, c: e.c, y: e.y || 0 };
    C.goTo(e.b, e.c);
    paintHist(); syncSentinelSoon();
    return true;
  }
  const back = () => go(-1), forward = () => go(1);

  let hb = null;
  function buildHistButtons() {
    const header = document.querySelector("header"), nav = $("openNavBtn"); if (!header || !nav) return;
    hb = document.createElement("div"); hb.className = "bx-hist"; hb.setAttribute("role", "group"); hb.setAttribute("aria-label", "Chapter history");
    hb.innerHTML = '<button type="button" class="bn-hb bx-hb" data-h="back">' + IC.back + '</button><button type="button" class="bn-hb bx-hb" data-h="fwd">' + IC.fwd + "</button>";
    nav.insertAdjacentElement("afterend", hb);
    hb.querySelector('[data-h="back"]').onclick = () => back();
    hb.querySelector('[data-h="fwd"]').onclick = () => forward();
    paintHist();
  }
  function paintHist() {
    if (!hb) return;
    const bb = hb.querySelector('[data-h="back"]'), fb = hb.querySelector('[data-h="fwd"]');
    const pb = hist.s[hist.i - 1], pf = hist.s[hist.i + 1];
    bb.disabled = !pb; fb.disabled = !pf; hb.classList.toggle("bx-nofwd", !pf);
    const bt = pb ? "Back to " + refLabel(pb.b, pb.c) : "Back (no earlier chapter)", ft = pf ? "Forward to " + refLabel(pf.b, pf.c) : "Forward (no later chapter)";
    bb.title = bt; bb.setAttribute("aria-label", bt); fb.title = ft; fb.setAttribute("aria-label", ft);
    // hidden until there is somewhere to go, so a fresh start keeps the bar as it was
    hb.hidden = hist.s.length < 2;
  }
  // The phone's Back button: one history entry of ours sits under any overlay while there is a chapter
  // to go back to. Pressing Back with nothing open pops it, and we step back one chapter.
  function syncSentinelSoon() { clearTimeout(syncT); syncT = setTimeout(syncSentinel, 400); }
  function syncSentinel() {
    const st = history.state;
    if (canBack()) {
      if (st == null && !sentinel) { try { history.pushState({ [SENT]: 1 }, ""); sentinel = true; } catch (e) {} }
    } else if (st && st[SENT]) {
      // nothing left to go back to: take our entry off so Back works as it did before
      ignorePopUntil = Date.now() + 800; sentinel = false; try { history.back(); } catch (e) {}
    }
  }
  window.addEventListener("popstate", e => {
    if (Date.now() < ignorePopUntil) { ignorePopUntil = 0; return; }
    const st = e.state;
    if (st && st[SENT]) { sentinel = true; return; }              // an overlay above ours closed
    if (st != null) return;                                        // another screen's entry
    if (!sentinel) return;                                         // an overlay closed; ours wasn't there
    sentinel = false;
    // Back with the Books drawer or Study panel open closes it (they keep no history entry of their own)
    const drawerOpen = document.querySelector("#drawer.open, #aiPanel.open");
    if (drawerOpen) { try { C.closeDrawer(); C.closeAi(); } catch (err) {} }
    else if (!openOverlay() && canBack()) back();
    syncSentinelSoon();
  });
  const openOverlay = () => !!(document.querySelector(".fx-sheet.open, .bs-root.open, .bn-search.open, .lb-root.open, .dv-focus.open") || /\b(snbx-on|bsc-lock|bwr-on)\b/.test(document.documentElement.className));

  /* =====================================================================
     Print chapter
     ===================================================================== */
  let printRoot = null, printing = false;
  function copyrightOf(k) {
    const box = paneEl(".reader-inner .fade-in", k); if (!box) return "";
    return Array.from(box.children).filter(el => !el.matches(".chapter-heading, .verses-text, .fx-done") && !el.querySelector("button"))
      .map(el => { const c = el.cloneNode(true); c.querySelectorAll('a[href*="audio.esv.org"], br').forEach(x => x.remove()); return c.textContent.replace(/\s+/g, " ").trim(); })
      .filter(Boolean).join(" ");
  }
  function headsMap(k) {
    const p = C.panes[k], S = window.BibleySections, m = new Map();
    try { if (S && S.prefs().head) (S.headsFor(p.bookIdx, p.chapter, p.version) || []).forEach(h => m.set(String(h[0]), h.slice(1))); } catch (e) {}
    return m;
  }
  function chapterNotes(b, c) {
    const f = FX(); let all = {}; try { all = (f && f.legacyNotes && f.legacyNotes.all()) || {}; } catch (e) {}
    return Object.keys(all).map(k => all[k]).filter(n => n && n.bookIdx === b && n.chapter === c && n.text)
      .sort((x, y) => x.verseNum - y.verseNum);
  }
  function versesHtml(list, pieces, hls, noteSet, key) {
    // pieces: optional diff result for these verses (marks words), keyed by verse number
    return list.map(v => {
      const hl = hls[key(v.verse)], d = pieces && pieces.get(String(v.verse));
      const body = d ? d.parts.map(p => p.k && p.ch ? '<mark class="bx-dw">' + esc(p.t) + "</mark>" : esc(p.t)).join("") : esc(v.text);
      return '<span class="bxp-v' + (hl ? " bxp-hl-" + esc(hl.color) : "") + '"><sup>' + esc(v.verse) + "</sup>" + body + (noteSet.has(String(v.verse)) ? '<sup class="bxp-nm">\u2020</sup>' : "") + "</span> ";
    }).join("");
  }
  function buildPrint() {
    const pa = C.panes.a, va = C.paneVerses("a");
    if (!va || !va.length) return null;
    const cmp = C.isCompare && C.isCompare(), pb = C.panes.b, vb = cmp ? C.paneVerses("b") : null;
    const two = !!(cmp && vb && vb.length);
    const same = two && pa.bookIdx === pb.bookIdx && pa.chapter === pb.chapter;
    const hls = (() => { try { return C.getHighlights() || {}; } catch (e) { return {}; } })();
    const keyFor = (b, c) => n => BOOKS[b][0] + "-" + c + "-" + n;
    const notesA = chapterNotes(pa.bookIdx, pa.chapter);
    const noteSet = new Set(); notesA.forEach(n => { (Array.isArray(n.verses) && n.verses.length ? n.verses : [n.verseNum]).forEach(x => noteSet.add(String(x))); });
    const useDiff = same && diffOn();
    const dr = useDiff ? diffChapters(va, vb) : null;
    const pieceMap = list => new Map(list.map(v => [v.verse, v]));
    const vn = id => esc(C.versionName(id)), vfull = id => esc(C.versionFullName ? C.versionFullName(id) : C.versionName(id));
    const title = esc(refLabel(pa.bookIdx, pa.chapter));
    let html = '<div class="bxp-head"><div class="bxp-eyebrow">Bibley</div><h1>' + (same || !two ? title : title + " \u00b7 " + esc(refLabel(pb.bookIdx, pb.chapter))) + "</h1>" +
      '<div class="bxp-sub">' + vfull(pa.version) + (two ? " \u00b7 " + vfull(pb.version) : "") + "</div></div>";
    if (same) {
      // side by side, lined up verse by verse
      const heads = headsMap("a"), mapA = new Map(va.map(v => [String(v.verse), v])), mapB = new Map(vb.map(v => [String(v.verse), v]));
      const order = []; const seen = new Set();
      va.forEach(v => { const n = String(v.verse); if (!seen.has(n)) { seen.add(n); order.push(n); } });
      vb.forEach(v => { const n = String(v.verse); if (!seen.has(n)) { seen.add(n); const at = order.findIndex(x => +x > +n); if (at < 0) order.push(n); else order.splice(at, 0, n); } });
      const pmA = dr ? pieceMap(dr.a) : null, pmB = dr ? pieceMap(dr.b) : null, key = keyFor(pa.bookIdx, pa.chapter);
      html += '<table class="bxp-par"><thead><tr><th>' + vn(pa.version) + "</th><th>" + vn(pb.version) + "</th></tr></thead><tbody>";
      order.forEach(n => {
        const h = heads.get(n); if (h && h[0]) html += '<tr class="bxp-sec"><td colspan="2">' + esc(h[0]) + "</td></tr>";
        const a = mapA.get(n), b = mapB.get(n);
        html += "<tr><td>" + (a ? versesHtml([a], pmA, hls, noteSet, key) : "") + "</td><td>" + (b ? versesHtml([b], pmB, hls, noteSet, key) : "") + "</td></tr>";
      });
      html += "</tbody></table>";
      if (dr) html += '<p class="bxp-legend"><mark class="bx-dw">Underlined words</mark> differ between ' + vn(pa.version) + " and " + vn(pb.version) + " (" + pctLabel(dr.pct) + " of the words in this chapter).</p>";
    } else {
      const block = (k, list) => {
        const p = C.panes[k], heads = headsMap(k), key = keyFor(p.bookIdx, p.chapter);
        let out = '<section class="bxp-ch">' + (two ? "<h2>" + esc(refLabel(p.bookIdx, p.chapter)) + " \u00b7 " + vn(p.version) + "</h2>" : "") + '<div class="bxp-text">';
        let para = [];
        const flushPara = () => { if (para.length) { out += "<p>" + versesHtml(para, null, hls, k === "a" ? noteSet : new Set(), key) + "</p>"; para = []; } };
        list.forEach(v => { const h = heads.get(String(v.verse)); if (h && h[0]) { flushPara(); out += "<h3>" + esc(h[0]) + "</h3>"; } para.push(v); });
        flushPara();
        return out + "</div></section>";
      };
      html += block("a", va);
      if (two) html += block("b", vb);
    }
    if (notesA.length) {
      html += '<section class="bxp-notes"><h2>My notes</h2>' + notesA.map(n => {
        const vs = Array.isArray(n.verses) && n.verses.length > 1 ? n.verses[0] + "\u2013" + n.verses[n.verses.length - 1] : n.verseNum;
        return '<div class="bxp-note"><b>' + esc(refLabel(n.bookIdx, n.chapter) + ":" + vs) + "</b> " + esc(n.text).replace(/\n/g, "<br>") + "</div>";
      }).join("") + "</section>";
    }
    const cr = ["a"].concat(two ? ["b"] : []).map(copyrightOf).filter(Boolean);
    const d = new Date();
    html += '<div class="bxp-foot">' + cr.map(t => "<p>" + esc(t) + "</p>").join("") + "<p>Printed from Bibley \u00b7 " + esc(d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })) + "</p></div>";
    const el = document.createElement("div"); el.id = "bxPrint"; el.className = "bxp" + (same ? " bxp-two" : ""); el.innerHTML = html;
    return el;
  }
  function mountPrint() {
    unmountPrint();
    const el = buildPrint(); if (!el) return false;
    document.body.appendChild(el); printRoot = el; document.documentElement.classList.add("bx-printing");
    return true;
  }
  function unmountPrint() { if (printRoot) { printRoot.remove(); printRoot = null; } document.documentElement.classList.remove("bx-printing"); }
  function printChapter() {
    if (printing) return;
    // the Android app's WebView has no print dialog (window.print() does nothing there)
    if (window.AndroidApp && typeof window.AndroidApp.print !== "function") {
      toast("Printing isn't available inside the app yet. Open Bibley in Chrome to print or save as PDF.", 4200); return;
    }
    if (!mountPrint()) { toast("Open a chapter first, then print it"); return; }
    printing = true;
    const done = () => { window.removeEventListener("afterprint", done); printing = false; unmountPrint(); };
    window.addEventListener("afterprint", done);
    setTimeout(() => {
      try { if (window.AndroidApp && typeof window.AndroidApp.print === "function") window.AndroidApp.print(document.title); else window.print(); } catch (e) { done(); }
      // some browsers never fire afterprint (or print() returns at once); keep the page tidy either way
      setTimeout(() => { if (printing && !matchMedia("print").matches) done(); }, 1500);
    }, 60);
  }
  // The browser's own Print (Ctrl+P, menu > Print): print the chapter too, unless another screen
  // (the Study Notebook) is printing its own page.
  window.addEventListener("beforeprint", () => {
    if (printing || document.documentElement.classList.contains("snbx-printing") || openOverlay()) return;
    if (mountPrint()) { const done = () => { window.removeEventListener("afterprint", done); if (!printing) unmountPrint(); }; window.addEventListener("afterprint", done); }
  });

  /* =====================================================================
     Wiring
     ===================================================================== */
  document.addEventListener("bibley:navigate", e => {
    const d = e.detail || {};
    if (d.pane === "a") noteChapter(d.bookIdx, d.chapter);
    if (C.isCompare && C.isCompare() && diffOn()) paintChip("wait");
  });
  document.addEventListener("bibley:chapter", e => {
    const d = e.detail || {};
    if (d.pane === "a" && restoreY && restoreY.b === d.bookIdx && restoreY.c === d.chapter) {
      const y = restoreY.y; restoreY = null;
      if (y > 0) requestAnimationFrame(() => { const rm = paneEl(".reader-main", "a"); if (rm) rm.scrollTop = y; });
    }
    if (C.isCompare && C.isCompare()) scheduleDiff();
  });
  document.addEventListener("bibley:compare", e => { if (e.detail && e.detail.on) { ensureChip(); paintChip(diffOn() ? "wait" : "off"); scheduleDiff(); } else applyDiff(); });

  buildHistButtons();
  // the reader opened its first chapter before this file loaded
  noteChapter(C.panes.a.bookIdx, C.panes.a.chapter);
  if (sentinel && !canBack()) syncSentinelSoon();
  ensureChip(); if (C.isCompare && C.isCompare()) scheduleDiff();

  window.BibleyReading = {
    version: "7.3",
    diff: { get: diffOn, set: setDiff, last: () => lastDiff, chapters: diffChapters, words: (a, b) => { const r = myers(a, b); return { a: Array.from(r.ca), b: Array.from(r.cb) }; }, tokenize, keyOf },
    history: { back, forward, canBack, canFwd, state: () => ({ stack: hist.s.map(e => refLabel(e.b, e.c)), index: hist.i }) },
    print: printChapter,
    _test: { buildPrint, mountPrint, unmountPrint }
  };
})();
