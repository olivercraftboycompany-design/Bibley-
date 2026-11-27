/* bibley-versefind.js - Bibley 7.5 (2026-11-27): Find a verse with AI.
   Describe a verse in your own words ("the one where God so loved the world", "verse about not
   worrying about tomorrow", "be strong and courageous") and Bibley lists the matching verses in a
   pop-up sheet. Tap a verse to open it in the reader; "Add to notebook" starts a Study Notebook note.

   How it works:
     1. A plain reference typed in ("John 3:16", "Ps 23:1-3") is looked up directly, no AI.
     2. Otherwise the description goes to Bibley's AI engine (window.BibleyAI.raw, same provider chain
        as the rest of the app: Groq through Oliver's proxy first, then the free services). The AI
        answers ONLY with references in a strict format: "REF: <Book> <ch>:<v>[-<v>] | <first words>".
     3. Every reference is checked against the real King James text (window.BibleyLocalAI.ensureKJV:
        IndexedDB "bibley_bibles" or /bibles/kjv.json.gz). A reference that does not exist is dropped.
        If the AI's quoted first words clearly belong to a verse next to the one it named (off-by-one
        numbering), the reference is moved to that verse. The verse text shown is always the KJV
        text from the app's data, never text written by the AI.
     4. If the AI can't be reached (offline, every provider busy) the on-device keyword + topic search
        (BibleyLocalAI.searchKJV) fills in, clearly labelled as keyword matches, with "Try again".
   Public: window.BibleyVerseFind = { open(query, opts), find(query), icon, version }.
     opts.from: "notebook" | "books" (only changes the wording and closes the notebook before a jump).
   Stores nothing on the device (answers are kept in memory for this visit only). ASCII only in this file. */
(function () {
  "use strict";
  var VIEW = "versefind", MAX = 5, MAX_RANGE = 6;
  var memo = {}, runId = 0, keyHooked = false;
  var ICON = '<svg class="ui-ic bvf-ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1-5.1-1.9 5.1-1.9z"/><path d="M18.5 15.5l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/></svg>';

  var SYSTEM = "You identify Bible verses from a description written in the user's own words: a paraphrase, a half-remembered phrase, a story, or a topic.\n" +
    "Return the verses that best match, best match first, at most " + MAX + ". When the user is clearly thinking of one famous verse, put it first.\n" +
    "Use the 66-book Protestant canon, standard English book names (for example: Genesis, Psalms, Song of Solomon, 1 Corinthians, Revelation) and King James Version verse numbering.\n" +
    "Only give references you are sure exist. A short passage may use a range of up to " + MAX_RANGE + " verses.\n\n" +
    "Reply with ONLY lines in this exact format and nothing else (no numbering, no explanation):\n" +
    "REF: <Book> <chapter>:<verse> | <first six to ten words of that verse in the King James Version>\n" +
    "or for a range:\n" +
    "REF: <Book> <chapter>:<verse>-<verse> | <first words of the first verse>\n\n" +
    "If no verse fits the description, reply with exactly: NONE";

  function FX() { return window.BibleyFX; }
  function C() { return window.BibleyCore; }
  function L() { return window.BibleyLocalAI; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function err(msg) { return new Error(msg); }
  function toast(m, ms) { var f = FX(); if (f && f.ui && f.ui.toast) f.ui.toast(m, ms); }

  /* ---------------- references ---------------- */
  function bookIndex(name) {
    var n = String(name || "").replace(/[*_"\u201c\u201d]/g, "").replace(/\s+/g, " ").trim(), c = C();
    if (!n) return -1;
    n = n.replace(/^(?:the\s+)?(?:book\s+of\s+)/i, "").replace(/^(?:the\s+)?(gospel\s+(?:of|according\s+to)\s+)(?:st\.?\s+)?/i, "").replace(/^st\.?\s+/i, "");
    if (/^revelation of /i.test(n)) n = "Revelation";
    if (/^psalms? of /i.test(n)) n = "Psalms";
    if (c && c.findBookIndex) {
      var i = c.findBookIndex(n); if (i >= 0) return i;
      i = c.findBookIndex(n.replace(/s$/i, "")); if (i >= 0) return i;
    }
    var BOOKS = (c && c.BOOKS) || [], k = n.toLowerCase();
    for (var j = 0; j < BOOKS.length; j++) if (BOOKS[j][0].toLowerCase() === k || BOOKS[j][1].toLowerCase() === k) return j;
    return -1;
  }
  function bookName(b) { var B = C() && C().BOOKS; return B && B[b] ? B[b][1] : ""; }
  function label(r) { return bookName(r.b) + " " + r.c + ":" + r.v1 + (r.v2 > r.v1 ? "-" + r.v2 : ""); }

  // "REF: John 3:16 | For God so loved the world" -> [{ name, c, v1, v2, quote }]
  var LINE_RE = /^\s*(?:(?:\d{1,2}[.)]|[-*\u2022])\s+)?(?:REF\s*[:\-]\s*)?\**\s*((?:[1-3]|I{1,3})?\s*[A-Za-z][A-Za-z .']*?)\s*(\d{1,3})\s*:\s*(\d{1,3})(?:\s*[-\u2013\u2014]\s*(?:\d{1,3}\s*:\s*)?(\d{1,3}))?\**\s*(?:[|:\-\u2013\u2014]\s*(.*))?$/;
  function parseAnswer(text) {
    var t = String(text || "").replace(/<think>[\s\S]*?(<\/think>|$)/g, "").replace(/\r/g, "");
    var lines = t.split("\n"), out = [], refLines = lines.filter(function (l) { return /^\s*(?:(?:\d{1,2}[.)]|[-*\u2022])\s+)?REF\s*[:\-]/i.test(l); });
    (refLines.length ? refLines : lines).forEach(function (l) {
      var m = LINE_RE.exec(l.replace(/\*\*/g, "")); if (!m) return;
      out.push({ name: m[1].trim(), c: +m[2], v1: +m[3], v2: m[4] ? +m[4] : +m[3], quote: (m[5] || "").replace(/^["'\u201c\u2018\s]+|["'\u201d\u2019\s.]+$/g, "") });
    });
    return out;
  }

  /* ---------------- verification against the KJV ---------------- */
  var STOP = {}; "the and of to a in that is was for unto with be his he it not i shall as by they them but are which this all my thy thee me you your ye from or so our at have hath on there".split(" ").forEach(function (w) { STOP[w] = 1; });
  function words(s) { return (String(s || "").toLowerCase().match(/[a-z]+/g) || []).filter(function (w) { return w.length > 2 && !STOP[w]; }); }
  function overlap(quote, text) {
    var q = words(quote); if (q.length < 3) return -1;
    var have = {}; words(text).forEach(function (w) { have[w] = 1; });
    var hit = 0; q.forEach(function (w) { if (have[w]) hit++; });
    return hit / q.length;
  }
  async function verses(b, c, v1, v2) {
    var Lx = L(); if (!Lx || !Lx.passage) throw err("no-bible");
    return Lx.passage(b, c, v1, v2);
  }
  // A parsed AI reference -> { b, c, v1, v2, ref, text } with the real KJV text, or null if it doesn't exist.
  async function resolve(p) {
    var b = bookIndex(p.name), B = C() && C().BOOKS;
    if (b < 0 || !B || !B[b] || p.c < 1 || p.c > B[b][2] || p.v1 < 1) return null;
    var v1 = p.v1, v2 = Math.max(v1, p.v2 || v1); if (v2 - v1 >= MAX_RANGE) v2 = v1 + MAX_RANGE - 1;
    var vs = await verses(b, p.c, v1, v2);
    if (!vs.length || vs[0].v !== v1) return null;               // the verse doesn't exist in that chapter
    if (vs.length === 1 && p.quote) {                              // fix an off-by-a-few verse number
      var s0 = overlap(p.quote, vs[0].text);
      if (s0 >= 0 && s0 < 0.34) {
        var near = await verses(b, p.c, Math.max(1, v1 - 3), v1 + 3), best = null, bs = 0;
        near.forEach(function (x) { var s = overlap(p.quote, x.text); if (s > bs) { bs = s; best = x; } });
        if (best && best.v !== v1 && bs >= 0.6) { v1 = v2 = best.v; vs = [best]; }
      }
    }
    var r = { b: b, c: p.c, v1: v1, v2: vs[vs.length - 1].v };
    r.ref = label(r); r.text = vs.map(function (x) { return x.text; }).join(" ");
    return r;
  }
  function dedupe(list) {
    var seen = {}, out = [];
    list.forEach(function (r) { if (!r) return; var k = r.b + "." + r.c + "." + r.v1; if (seen[k]) return; seen[k] = 1; out.push(r); });
    return out;
  }

  /* ---------------- finding ---------------- */
  function directRef(q) {
    var c = C(); if (!c || !c.parseRef) return null;
    var m = String(q || "").trim().replace(/[.]+$/, "");
    var r = c.parseRef(m); return r ? { name: c.BOOKS[r.bookIdx][1], c: r.chapter, v1: r.from, v2: r.to, quote: "" } : null;
  }
  async function keywordMatches(q) {
    var Lx = L(); if (!Lx || !Lx.searchKJV) return [];
    try {
      var hits = Lx.searchKJV(q, { k: MAX }) || [];
      return dedupe(hits.map(function (h) { var v = Lx.findByReference(h.ref)[0]; if (!v) return null; var r = { b: v.b, c: v.c, v1: v.v, v2: v.v, text: v.text }; r.ref = label(r); return r; }));
    } catch (e) { return []; }
  }
  // find(query) -> { results, source: "reference" | "ai" | "none", keyword: [...], error, provider }
  async function find(query) {
    var q = String(query || "").replace(/\s+/g, " ").trim();
    if (!q) return { results: [], source: "none", keyword: [] };
    if (memo[q.toLowerCase()]) return memo[q.toLowerCase()];
    var Lx = L(); if (!Lx || !Lx.ensureKJV) throw err("no-bible");
    await Lx.ensureKJV();
    var d = directRef(q);
    if (d) { var dr = await resolve(d); if (dr) return (memo[q.toLowerCase()] = { results: [dr], source: "reference", keyword: [] }); }
    var AI = window.BibleyAI, out = { results: [], source: "ai", keyword: [] };
    try {
      if (!AI || !AI.raw) throw err("no-ai");
      var text = await AI.raw(SYSTEM, "Description: " + q.slice(0, 400), {
        maxTokens: 400,
        accept: function (t) { return /\bNONE\b/.test(t) || parseAnswer(t).length > 0; }
      });
      var parsed = /^\s*NONE\b/i.test(String(text).replace(/<think>[\s\S]*?<\/think>/g, "")) ? [] : parseAnswer(text).slice(0, MAX + 3);
      var resolved = [];
      for (var i = 0; i < parsed.length; i++) { try { resolved.push(await resolve(parsed[i])); } catch (e) {} }
      out.results = dedupe(resolved).slice(0, MAX);
      out.dropped = parsed.length - out.results.length;
      out.provider = AI.last && AI.last.provider;
      try { console.info("[Bibley Find] AI gave " + parsed.length + " reference(s), " + out.results.length + " verified"); } catch (e) {}
    } catch (e) {
      out.error = (e && e.message) || "error";
      try { console.warn("[Bibley Find] AI lookup failed:", out.error); } catch (x) {}
    }
    if (!out.results.length) out.keyword = await keywordMatches(q);
    if (!out.error) memo[q.toLowerCase()] = out;
    return out;
  }

  /* ---------------- sheet ---------------- */
  function hookKeys() {
    if (keyHooked) return; keyHooked = true;
    // Escape closes this sheet first (before the notebook or drawer see the key).
    window.addEventListener("keydown", function (e) {
      var f = FX(); if (e.key !== "Escape" || !f || !f.ui || !f.ui.isOpen(VIEW)) return;
      e.stopImmediatePropagation(); e.preventDefault(); f.ui.closeSheet();
    }, true);
  }
  function rowHtml(r, i, canAdd, kind) {
    return '<div class="bvf-r" data-k="' + kind + '" data-i="' + i + '">' +
      '<button type="button" class="bvf-go" data-a="go"><span class="bvf-ref">' + esc(r.ref) + '<em>KJV</em></span><span class="bvf-t">' + esc(r.text) + '</span></button>' +
      '<div class="bvf-acts"><button type="button" class="fx-btn small primary" data-a="go">Open</button>' +
      (canAdd ? '<button type="button" class="fx-btn small" data-a="add">Add to notebook</button>' : "") +
      '<button type="button" class="fx-btn small" data-a="copy">Copy</button></div></div>';
  }
  function skeleton() {
    var s = ""; for (var i = 0; i < 3; i++) s += '<div class="bvf-r bvf-sk" aria-hidden="true"><i></i><i></i><i></i></div>';
    return s;
  }
  function errText(e) {
    if (e === "offline" || (typeof navigator !== "undefined" && navigator.onLine === false)) return "You're offline, so the AI can't be reached.";
    if (e === "no-ai") return "The AI engine isn't available here.";
    return "Couldn't reach the AI right now.";
  }

  function open(query, opts) {
    opts = opts || {};
    var f = FX();
    if (!f || !f.ui || !f.ui.openSheet) { try { console.warn("[Bibley Find] app is still loading"); } catch (e) {} return; }
    hookKeys();
    var state = { q: String(query || "").replace(/\s+/g, " ").trim(), res: null, kw: [] };
    f.ui.openSheet(VIEW, "Find a verse with AI", function (body) {
      body.innerHTML = '<div class="bvf">' +
        '<form class="bvf-form" autocomplete="off"><div class="bvf-box">' + ICON + '<input type="search" class="bvf-q" enterkeyhint="search" aria-label="Describe the verse" placeholder="Describe the verse in your own words"></div>' +
        '<button type="submit" class="fx-btn small primary">Find</button></form>' +
        '<div class="bvf-out" aria-live="polite"></div></div>';
      var form = body.querySelector(".bvf-form"), input = body.querySelector(".bvf-q"), outEl = body.querySelector(".bvf-out");
      input.value = state.q;
      form.addEventListener("submit", function (e) { e.preventDefault(); var v = input.value.trim(); if (!v) { input.focus(); return; } state.q = v; run(); try { input.blur(); } catch (x) {} });
      outEl.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-a]"); if (!btn) return;
        var a = btn.dataset.a;
        if (a === "retry") { delete memo[state.q.toLowerCase()]; run(); return; }
        var row = btn.closest(".bvf-r"); if (!row) return;
        var list = row.dataset.k === "kw" ? state.kw : (state.res || []), r = list[+row.dataset.i]; if (!r) return;
        if (a === "go") jump(r);
        else if (a === "add") addToNotebook(r);
        else if (a === "copy") copy(r);
      });
      function run() {
        var my = ++runId;
        outEl.innerHTML = '<p class="bvf-status"><span class="bvf-spin" aria-hidden="true"></span>' + (L() && L().kjvReady && !L().kjvReady() ? "Opening the King James Bible\u2026" : "Searching Scripture with AI\u2026") + '</p>' + skeleton();
        find(state.q).then(function (o) {
          if (my !== runId || !f.ui.isOpen(VIEW)) return;
          state.res = o.results; state.kw = o.keyword || [];
          var canAdd = !!(window.BibleyStudyNB && window.BibleyStudyNB.newFromVerse), html = "";
          if (o.results.length) {
            html += '<p class="bvf-note">' + (o.source === "reference" ? "Verse found by reference" : "Matches for \u201c" + esc(state.q) + "\u201d, best first") + '</p>';
            html += o.results.map(function (r, i) { return rowHtml(r, i, canAdd, "ai"); }).join("");
            html += '<p class="bvf-foot">' + (o.source === "ai" ? "Found by AI" + (o.provider ? " (" + esc(o.provider) + ")" : "") + ". Every reference is checked against the Bible text; " : "") + "verse text from the King James Version.</p>";
          } else if (o.error) {
            html += '<div class="fx-empty bvf-empty"><b>' + esc(errText(o.error)) + '</b><button type="button" class="fx-btn small primary" data-a="retry">Try again</button></div>';
          } else {
            html += '<div class="fx-empty bvf-empty"><b>No verses found</b><span>Try describing it differently: a phrase you remember, who is speaking, or what it is about.</span></div>';
          }
          if (!o.results.length && state.kw.length) {
            html += '<p class="bvf-note">Keyword matches in the King James Bible' + (o.error ? " (works without AI)" : "") + '</p>';
            html += state.kw.map(function (r, i) { return rowHtml(r, i, canAdd, "kw"); }).join("");
          }
          outEl.innerHTML = html;
        }, function (e) {
          if (my !== runId || !f.ui.isOpen(VIEW)) return;
          var m = String(e && e.message || e);
          outEl.innerHTML = '<div class="fx-empty bvf-empty"><b>' + (m === "no-bible" || /^kjv-|no-gzip/.test(m) ? "Couldn't open the Bible text." : esc(errText(m))) + '</b><button type="button" class="fx-btn small primary" data-a="retry">Try again</button></div>';
        });
      }
      if (state.q) run();
      else { outEl.innerHTML = '<p class="bvf-hint">For example: \u201cthe one where God so loved the world\u201d, \u201cdon\u2019t worry about tomorrow\u201d or \u201cbe strong and courageous\u201d.</p>'; setTimeout(function () { try { input.focus(); } catch (e) {} }, 200); }
    });
    // Above the full-page Study Notebook while open.
    document.documentElement.classList.add("bvf-on");
    f.ui.onClose(function () { runId++; document.documentElement.classList.remove("bvf-on"); });
  }
  function closeNotebook() { var N = window.BibleyStudyNB; try { if (N && N.isOpen && N.isOpen()) N.close(); } catch (e) {} }
  function jump(r) {
    var f = FX(); closeNotebook();
    var list = []; for (var v = r.v1; v <= r.v2; v++) list.push(v);
    if (f && f.jumpToVerse) f.jumpToVerse(r.b, r.c, r.v1, list.length > 1 ? list : null);
    else if (C() && C().goTo) C().goTo(r.b, r.c);
  }
  function addToNotebook(r) {
    var N = window.BibleyStudyNB; if (!N || !N.newFromVerse) { toast("The Study Notebook is still loading"); return; }
    var f = FX(); try { f.ui.closeSheet(); } catch (e) {}
    N.newFromVerse({ ref: r.ref + " (KJV)", text: r.text });
  }
  async function copy(r) {
    var f = FX(), t = "\u201c" + r.text + "\u201d \u2014 " + r.ref + " (KJV)", ok = false;
    try { ok = f && f.ui && f.ui.copyText ? await f.ui.copyText(t) : (await navigator.clipboard.writeText(t), true); } catch (e) { ok = false; }
    toast(ok ? "Copied " + r.ref : "Couldn't copy");
  }

  window.BibleyVerseFind = { version: "7.5", open: open, find: find, icon: ICON, _test: { parseAnswer: parseAnswer, resolve: resolve, bookIndex: bookIndex, overlap: overlap } };
})();
