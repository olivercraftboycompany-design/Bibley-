/* bibley-scroll.js - Bibley 6.0: the Scroll verse feed and the verse AI sheet.
   Scroll: a full-screen feed, one verse per screen, snapping as you swipe. Today's Daily Wisdom
   passage comes first, wisdom passages return about every 8 cards, and the rest is a mix of
   well-known verses and random ones, in the version picked in the reader.
   Verse AI sheet: Explain, Simple, Ask, Related, Prayer and Words for any verse, streamed as it
   is written and kept on the device so a repeat opens at once.
   Stored on the device, NEW keys: localStorage "bibley_likes_v1" (liked verses) and
   "bibley_ai6_cache_v1" (saved AI answers). Bookmarks use the existing "bibley_vbm_v1".
   ASCII only in this file. */
(() => {
  "use strict";
  const FX = window.BibleyFX, C = window.BibleyCore;
  if (!FX || !C) return;
  const { BOOKS } = C, U = FX.ui, esc = U.esc;
  const K_LIKES = "bibley_likes_v1", K_VBM = "bibley_vbm_v1", K_CACHE = "bibley_ai6_cache_v1", K_PREFETCH = "bibley_scroll_prefetch";
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const sv = (d, w) => '<svg class="ui-ic" viewBox="0 0 24 24" width="' + (w || 22) + '" height="' + (w || 22) + '" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>";
  const IC = {
    feed: sv('<rect x="5" y="3.5" width="14" height="11" rx="2"/><path d="M7 18h10M9 20.5h6"/>', 20),
    back: sv('<path d="M14.5 6l-6 6 6 6"/>'),
    explain: sv('<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>'),
    heart: sv('<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/>'),
    bm: sv('<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/>'),
    share: sv('<path d="M12 15V3.8M8 7.5l4-4 4 4"/><path d="M5.5 12.5v6a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-6"/>'),
    copy: sv('<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>'),
    list: sv('<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/>', 20),
    send: sv('<path d="M4.5 12l15-7.5-5 15-2.5-6.5z"/>', 20)
  };
  const vname = v => U.vname(v);
  const keyOf = (b, c, v, verses) => BOOKS[b][0] + "-" + c + "-" + (verses && verses.length > 1 ? verses.join(".") : v);
  const refOf = (b, c, v, to) => BOOKS[b][1] + " " + c + ":" + v + (to && to !== v ? "-" + to : "");

  /* ================= verse sources ================= */
  const POPULAR = ("John 3:16|Jeremiah 29:11|Philippians 4:13|Romans 8:28|Proverbs 3:5|Isaiah 41:10|Psalm 23:1|Matthew 11:28|Joshua 1:9|2 Timothy 1:7|" +
    "Psalm 46:1|Romans 12:2|Isaiah 40:31|Matthew 6:33|1 Corinthians 13:4|Galatians 5:22|Psalm 119:105|Hebrews 11:1|Romans 5:8|Ephesians 2:8|" +
    "John 14:6|Psalm 27:1|Lamentations 3:22|Micah 6:8|1 Peter 5:7|James 1:5|Psalm 34:18|2 Corinthians 5:17|Matthew 5:16|John 16:33|" +
    "Romans 15:13|Philippians 4:6|Psalm 37:4|Deuteronomy 31:6|Isaiah 26:3|Colossians 3:23|Psalm 121:1|Hebrews 13:8|1 John 4:19|Zephaniah 3:17|" +
    "Matthew 5:9|John 1:5|Psalm 139:14|Romans 10:9|2 Corinthians 12:9|Psalm 51:10|Proverbs 16:3|Ecclesiastes 3:1|Isaiah 9:6|John 15:13|" +
    "1 Thessalonians 5:16|Psalm 91:1|Matthew 7:7|Hebrews 4:12|Psalm 16:8|Nahum 1:7|Psalm 100:4|1 John 1:9|James 4:8|Romans 8:38|" +
    "Joshua 24:15|Exodus 14:14|Psalm 145:18|John 8:12|Matthew 28:20|Ephesians 4:32|Colossians 3:2|Psalm 19:14|Isaiah 43:2|Psalm 118:24|" +
    "John 10:10|Romans 12:12|1 Corinthians 10:13|Galatians 6:9|Psalm 55:22|Proverbs 18:10|Mark 10:27|Luke 1:37|John 11:25|Revelation 21:4|" +
    "Psalm 62:1|Isaiah 53:5|2 Chronicles 7:14|Psalm 103:12|Matthew 22:37|1 Peter 2:9|Hebrews 12:1|Psalm 30:5|Genesis 1:1|Romans 6:23|" +
    "James 1:17|Philippians 1:6|Psalm 32:8|Isaiah 55:8|John 13:34|1 John 4:18|Ephesians 6:10|Psalm 4:8|Matthew 6:34|Psalm 73:26").split("|");
  const RANDOM_BOOKS = [0, 1, 4, 5, 7, 8, 18, 19, 20, 22, 23, 24, 32, 34, 35].concat(Array.from({ length: 27 }, (_, i) => 39 + i)).filter(i => BOOKS[i]);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let popQueue = [], wisdomOrder = [], made = 0;
  function wisdomData() { const W = window.BibleyWisdom; return W && Array.isArray(W.data) ? W.data : []; }
  function nextSpec() {
    const n = made++;
    const W = window.BibleyWisdom, data = wisdomData();
    if (n === 0 && W && W.today) return Object.assign({ kind: "wisdom", today: true }, W.today());
    if (data.length && n % 8 === 0) { if (!wisdomOrder.length) wisdomOrder = shuffle(data.slice()); return Object.assign({ kind: "wisdom" }, wisdomOrder.pop()); }
    if (n % 3 === 2) return { kind: "random" };
    if (!popQueue.length) popQueue = shuffle(POPULAR.slice());
    return { kind: "popular", ref: popQueue.pop() };
  }
  const version = () => (C.panes && C.panes.a && C.panes.a.version) || "kjv";
  async function resolve(spec) {
    const ver = version();
    if (spec.kind === "wisdom") {
      const r = C.parseRef(spec.ref); if (!r) throw new Error("bad-ref");
      const verses = []; for (let i = r.from; i <= r.to; i++) verses.push(i);
      return { kind: "wisdom", today: !!spec.today, bookIdx: r.bookIdx, chapter: r.chapter, verseNum: r.from, verses, ref: spec.ref, text: spec.text, note: spec.note, version: "web" };
    }
    let b, c, v;
    if (spec.kind === "popular") { const r = C.parseRef(spec.ref); if (!r) throw new Error("bad-ref"); b = r.bookIdx; c = r.chapter; v = r.from; }
    for (let tries = 0; tries < 4; tries++) {
      if (spec.kind === "random") { b = RANDOM_BOOKS[Math.floor(Math.random() * RANDOM_BOOKS.length)]; c = 1 + Math.floor(Math.random() * BOOKS[b][2]); }
      const ch = await C.getChapter(ver, b, c);
      if (!ch || !ch.length) throw new Error("no-chapter");
      if (spec.kind === "random") {
        const good = ch.filter(x => x.text && x.text.length > 70 && x.text.length < 300);
        if (!good.length) continue;
        v = good[Math.floor(Math.random() * good.length)].verse;
      }
      const hit = ch.find(x => x.verse === v);
      if (hit && hit.text) return { kind: spec.kind, bookIdx: b, chapter: c, verseNum: v, verses: [v], ref: refOf(b, c, v), text: String(hit.text).replace(/\s+/g, " ").trim(), version: ver };
      if (spec.kind !== "random") break;
    }
    throw new Error("verse-not-found");
  }
  const itemKey = it => keyOf(it.bookIdx, it.chapter, it.verseNum, it.verses);

  /* ================= likes and bookmarks ================= */
  const likes = () => load(K_LIKES, {});
  const isLiked = it => !!likes()[itemKey(it)];
  const isMarked = it => !!load(K_VBM, {})[itemKey(it)];
  function record(it) {
    const o = { ref: it.ref, bookIdx: it.bookIdx, chapter: it.chapter, verseNum: it.verseNum, text: it.text, version: it.version, added: Date.now() };
    if (it.verses && it.verses.length > 1) { o.verses = it.verses.slice(); o.verseEnd = it.verses[it.verses.length - 1]; o.range = true; }
    return o;
  }
  function toggleLike(it, force) {
    const all = likes(), k = itemKey(it);
    if (all[k] && force !== true) { delete all[k]; save(K_LIKES, all); return false; }
    if (!all[k]) { all[k] = record(it); save(K_LIKES, all); }
    return true;
  }
  function toggleMark(it) {
    const all = load(K_VBM, {}), k = itemKey(it); let on;
    if (all[k]) { delete all[k]; on = false; } else { all[k] = record(it); on = true; }
    save(K_VBM, all);
    try { FX.redecorate(); C.refreshLists(); } catch {}
    return on;
  }
  const quote = it => '"' + it.text + '" - ' + it.ref + " (" + vname(it.version) + ")";

  /* ================= the feed ================= */
  let root = null, feed = null, io = null, busy = false, current = null, pushed = false;
  function build() {
    root = document.createElement("section");
    root.className = "bsc"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Scroll verses");
    root.innerHTML = '<header class="bsc-top"><button type="button" class="bsc-hb bsc-back" aria-label="Back">' + IC.back + '</button><div class="bsc-title">Scroll</div>' +
      '<span class="bsc-ver"></span><button type="button" class="bsc-hb bsc-liked" aria-label="Liked verses">' + IC.list + "</button></header><div class=\"bsc-feed\"></div>";
    document.body.appendChild(root);
    feed = root.querySelector(".bsc-feed");
    root.querySelector(".bsc-back").onclick = () => close();
    root.querySelector(".bsc-liked").onclick = () => likedSheet();
    io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const card = e.target;
      if (card.dataset.state === "empty") fill(card);
      if (e.intersectionRatio > 0.6) { current = card; preloadAround(card); maybePrefetch(card); }
    }), { root: feed, threshold: [0.01, 0.65] });
    let lastTap = 0;
    feed.addEventListener("click", e => {
      const btn = e.target.closest("[data-a]"), card = e.target.closest(".bsc-card");
      if (!card || !card._item) return;
      if (btn) { act(btn.dataset.a, card, btn); return; }
      const t = Date.now();
      if (t - lastTap < 320) { if (!isLiked(card._item)) { toggleLike(card._item, true); paint(card); } burst(card); lastTap = 0; } else lastTap = t;
    });
    feed.addEventListener("scroll", () => { if (feed.scrollTop + feed.clientHeight * 4 > feed.scrollHeight) more(4); trim(); }, { passive: true });
  }
  function cardShell() {
    const el = document.createElement("article");
    el.className = "bsc-card"; el.dataset.state = "empty";
    el.innerHTML = '<div class="bsc-in"><div class="bsc-sk"><i></i><i></i><i></i><i class="s"></i></div></div>';
    el._spec = nextSpec();
    io.observe(el);
    return el;
  }
  function more(n) { for (let i = 0; i < n; i++) feed.appendChild(cardShell()); }
  function trim() {
    const cards = feed.children;
    if (cards.length < 46) return;
    const h = feed.clientHeight, idx = Math.round(feed.scrollTop / h);
    if (idx < 30) return;
    const drop = 15;
    for (let i = 0; i < drop; i++) { io.unobserve(cards[0]); cards[0].remove(); }
    feed.scrollTop -= drop * h;
  }
  async function fill(card) {
    if (card.dataset.state !== "empty") return;
    card.dataset.state = "loading";
    let it = null;
    for (let a = 0; a < 3 && !it; a++) { try { it = await resolve(a ? { kind: "popular", ref: POPULAR[Math.floor(Math.random() * POPULAR.length)] } : card._spec); } catch {} }
    if (!it) { card.dataset.state = "empty"; card.querySelector(".bsc-in").innerHTML = '<p class="bsc-err">Couldn\'t load this verse. Check your connection.</p>'; return; }
    card._item = it; card.dataset.state = "ready";
    const len = it.text.length, size = len < 110 ? "xl" : len < 200 ? "l" : len < 320 ? "m" : "s";
    card.innerHTML = '<div class="bsc-in">' + (it.kind === "wisdom" ? '<div class="bsc-tag">Daily Wisdom</div>' : "") +
      '<blockquote class="bsc-text bsc-' + size + '">' + esc(it.text) + "</blockquote>" +
      '<div class="bsc-ref">' + esc(it.ref) + "<span>" + esc(vname(it.version)) + "</span></div>" +
      (it.note ? '<p class="bsc-note">' + esc(it.note) + "</p>" : "") + "</div>" +
      '<div class="bsc-rail">' +
      '<button type="button" data-a="explain" aria-label="Explain">' + IC.explain + "<i>Explain</i></button>" +
      '<button type="button" data-a="like" aria-label="Like">' + IC.heart + "<i>Like</i></button>" +
      '<button type="button" data-a="bm" aria-label="Bookmark">' + IC.bm + "<i>Save</i></button>" +
      '<button type="button" data-a="share" aria-label="Share">' + IC.share + "<i>Share</i></button>" +
      '<button type="button" data-a="copy" aria-label="Copy">' + IC.copy + "<i>Copy</i></button></div>";
    paint(card);
  }
  function paint(card) {
    const it = card._item; if (!it) return;
    const l = card.querySelector('[data-a="like"]'), b = card.querySelector('[data-a="bm"]');
    if (l) { const on = isLiked(it); l.classList.toggle("on", on); l.querySelector("i").textContent = on ? "Liked" : "Like"; }
    if (b) { const on = isMarked(it); b.classList.toggle("on", on); b.querySelector("i").textContent = on ? "Saved" : "Save"; }
  }
  function burst(card) {
    const h = document.createElement("div"); h.className = "bsc-burst"; h.innerHTML = sv('<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/>', 84);
    card.appendChild(h); setTimeout(() => h.remove(), 700);
  }
  async function act(a, card) {
    const it = card._item;
    if (a === "explain") { openAI(it, "explain"); return; }
    if (a === "like") { const on = toggleLike(it); paint(card); if (on) burst(card); return; }
    if (a === "bm") { const on = toggleMark(it); paint(card); U.toast(on ? "Bookmarked" : "Bookmark removed"); return; }
    if (a === "copy") { U.toast(await U.copyText(quote(it)) ? "Copied" : "Couldn't copy"); return; }
    if (a === "share") {
      if (navigator.share) { try { await navigator.share({ title: it.ref, text: quote(it) }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
      U.toast(await U.copyText(quote(it)) ? "Copied to share" : "Couldn't share");
    }
  }
  function preloadAround(card) {
    let n = card.nextElementSibling;
    for (let i = 0; i < 3 && n; i++, n = n.nextElementSibling) if (n.dataset.state === "empty") fill(n);
    if (!card.nextElementSibling || !card.nextElementSibling.nextElementSibling) more(4);
  }
  let prefetchT = 0;
  function maybePrefetch(card) {
    clearTimeout(prefetchT);
    if (!load(K_PREFETCH, false)) return;
    prefetchT = setTimeout(() => { const it = card._item; if (it && card === current && !cacheGet(it, "explain")) runMode(it, "explain", null).catch(() => {}); }, 2500);
  }
  function open() {
    if (!root) build();
    root.querySelector(".bsc-ver").textContent = vname(version());
    if (!feed.children.length) more(5);
    root.classList.add("open"); document.documentElement.classList.add("bsc-lock");
    if (!pushed) { try { history.pushState({ bsc: 1 }, ""); pushed = true; } catch {} }
  }
  function close(fromPop) {
    if (!root || !root.classList.contains("open")) return;
    root.classList.remove("open"); document.documentElement.classList.remove("bsc-lock");
    if (!fromPop && pushed) { pushed = false; try { history.back(); } catch {} } else pushed = false;
  }
  window.addEventListener("popstate", () => { if (root && root.classList.contains("open") && !(history.state && history.state.bsc)) close(true); });
  function jump(b, c, v) {
    close(); try { U.closeSheet(); } catch {}
    setTimeout(() => FX.jumpToVerse(b, c, v), 120);
  }
  function likedSheet() {
    U.openSheet("bsc-liked", "Liked verses", body => {
      const items = Object.keys(likes()).map(k => Object.assign({ key: k }, likes()[k])).sort((a, b) => (b.added || 0) - (a.added || 0));
      if (!items.length) { body.innerHTML = '<p class="bsc-empty">Verses you like show up here.</p>'; return; }
      body.innerHTML = items.map(x => '<div class="bsc-li" data-k="' + esc(x.key) + '"><button type="button" class="bsc-li-go"><b>' + esc(x.ref) + "</b><span>" + esc(x.text) + '</span></button><button type="button" class="bsc-li-x" aria-label="Remove">' + sv('<path d="M6 6l12 12M18 6L6 18"/>', 18) + "</button></div>").join("");
      body.querySelectorAll(".bsc-li").forEach(row => {
        const x = items.find(i => i.key === row.dataset.k);
        row.querySelector(".bsc-li-go").onclick = () => jump(x.bookIdx, x.chapter, x.verseNum);
        row.querySelector(".bsc-li-x").onclick = () => { const all = likes(); delete all[x.key]; save(K_LIKES, all); row.remove(); feed && [...feed.children].forEach(paint); };
      });
    });
  }

  /* ================= verse AI ================= */
  const SYS = "You are Bibley's Bible study helper. Hold a traditional, non-denominational Christian view. Say \"the Lord\", never \"Yahweh\". " +
    "Plain text only: no markdown, no emoji, no headings other than the labels asked for. Be accurate and brief. Never invent facts, quotes or verses. " +
    "Write Hebrew or Greek words in English letters only, and only words you are sure of.";
  const MODES = {
    explain: { label: "Explain", max: 900, ask: "Explain this verse in four labelled parts, each one or two short sentences:\nMEANING: what it means\nCONTEXT: who wrote it, to whom, and what is happening around it\nKEY WORDS: one or two important English words or phrases from the verse and what they mean here\nAPPLY: one concrete way to live it out this week" },
    simple: { label: "Simple", max: 600, ask: "Explain this verse to a 9 year old in 3 or 4 short, warm sentences." },
    ask: { label: "Ask", max: 700 },
    related: { label: "Related", max: 700, ask: "List 5 other Bible verses closely related to this one. One per line, exactly in this form:\nBook chapter:verse - a few words on how it connects\nOnly real verses you are sure of. No other text." },
    prayer: { label: "Prayer", max: 600, ask: "Turn this verse into a short first-person prayer to God (50 to 80 words). End with Amen." },
    words: { label: "Words", max: 800, ask: "Give the 3 most important original-language words in this verse (Hebrew for the Old Testament, Greek for the New). One per line, exactly in this form:\nword in English letters | Hebrew or Greek | English meaning | one short sentence on why it matters here\nNo other text." }
  };
  const ORDER = ["explain", "simple", "ask", "related", "prayer", "words"];
  const ckey = (it, mode) => mode + "|" + itemKey(it) + "|" + it.version;
  function cacheGet(it, mode) { const c = load(K_CACHE, {})[ckey(it, mode)]; return c && c.t; }
  function cachePut(it, mode, t) {
    const c = load(K_CACHE, {}); c[ckey(it, mode)] = { t, at: Date.now() };
    const ks = Object.keys(c); if (ks.length > 150) ks.sort((a, b) => c[a].at - c[b].at).slice(0, ks.length - 150).forEach(k => delete c[k]);
    if (!save(K_CACHE, c)) { save(K_CACHE, {}); }
  }
  const verseLine = it => it.ref + " (" + vname(it.version) + "): \"" + it.text + "\"";
  const inflight = {};
  function runMode(it, mode, onText) {
    const k = ckey(it, mode);
    if (inflight[k]) { if (onText) inflight[k].subs.push(onText); return inflight[k].p; }
    const subs = onText ? [onText] : [];
    const p = window.BibleyAI.stream(SYS, verseLine(it) + "\n\n" + MODES[mode].ask, { maxTokens: MODES[mode].max, onText: t => subs.forEach(f => f(t)) })
      .then(t => { if (t && t.length > 40) cachePut(it, mode, t); return t; })
      .finally(() => { delete inflight[k]; });
    inflight[k] = { p, subs };
    return p;
  }
  const LABELS = ["MEANING", "CONTEXT", "KEY WORDS", "APPLY"];
  const NICE = { MEANING: "Meaning", CONTEXT: "Context", "KEY WORDS": "Key words", APPLY: "Apply it" };
  function fmtExplain(t) {
    const re = /(^|\n)\s*(MEANING|CONTEXT|KEY WORDS|APPLY)\s*:\s*/gi; const parts = []; let m, last = null, idx = 0;
    while ((m = re.exec(t))) { if (last) parts.push([last, t.slice(idx, m.index)]); else if (m.index > 0 && t.slice(0, m.index).trim()) parts.push(["", t.slice(0, m.index)]); last = m[2].toUpperCase(); idx = m.index + m[0].length; }
    if (last) parts.push([last, t.slice(idx)]); else return fmtPlain(t);
    return parts.map(([l, x]) => (l ? '<h4 class="bai-h">' + NICE[l] + "</h4>" : "") + fmtPlain(x)).join("");
  }
  function fmtPlain(t) { return String(t).trim().split(/\n{1,}/).filter(s => s.trim()).map(s => "<p>" + esc(s.replace(/^\s*[-\u2022]\s*/, "")) + "</p>").join(""); }
  function fmtWords(t) {
    const rows = String(t).split("\n").map(l => l.split("|").map(s => s.trim())).filter(r => r.length >= 3 && r[0]);
    if (!rows.length) return fmtPlain(t);
    return rows.map(r => '<div class="bai-word"><div><b>' + esc(r[0]) + "</b><span>" + esc(r[1] || "") + "</span></div><em>" + esc(r[2] || "") + "</em>" + (r[3] ? "<p>" + esc(r.slice(3).join(" ")) + "</p>" : "") + "</div>").join("");
  }
  const REF_RE = /^\s*(?:\d+[.)]\s*)?((?:[1-3]\s?)?[A-Za-z][A-Za-z ]*?\s\d+:\d+(?:\s*[-\u2013]\s*\d+)?)\s*[-:\u2013\u2014]+\s*(.+)$/;
  function fmtRelated(t, body) {
    const rows = String(t).split("\n").map(l => l.match(REF_RE)).filter(Boolean).map(m => ({ ref: m[1].replace(/\s+/g, " ").trim(), why: m[2].trim(), r: C.parseRef(m[1].replace(/\s+/g, " ").trim()) })).filter(x => x.r);
    if (!rows.length) return fmtPlain(t);
    setTimeout(() => rows.forEach(async (x, i) => {
      const el = body && body.querySelector('[data-rel="' + i + '"] .bai-rt'); if (!el || el.dataset.done) return; el.dataset.done = "1";
      try { const ch = await C.getChapter(version(), x.r.bookIdx, x.r.chapter); const v = ch && ch.find(y => y.verse === x.r.from); if (v) el.textContent = v.text; else el.closest(".bai-rel").remove(); } catch {}
    }), 0);
    return rows.map((x, i) => '<button type="button" class="bai-rel" data-rel="' + i + '" data-b="' + x.r.bookIdx + '" data-c="' + x.r.chapter + '" data-v="' + x.r.from + '"><b>' + esc(refOf(x.r.bookIdx, x.r.chapter, x.r.from, x.r.to)) + "</b><span>" + esc(x.why) + '</span><span class="bai-rt"></span></button>').join("");
  }
  function render(mode, t, out) {
    if (mode === "explain") return fmtExplain(t);
    if (mode === "words") return fmtWords(t);
    if (mode === "related") return fmtRelated(t, out);
    return fmtPlain(t);
  }
  const SKEL = '<div class="bai-sk"><i></i><i></i><i></i><i class="s"></i></div>';
  let chat = null;
  function openAI(it, mode) {
    mode = mode || "explain";
    let ctl = { stale: false };
    U.openSheet("bai", it.ref, body => {
      body.innerHTML = '<p class="bai-verse">' + esc(it.text) + " <span>" + esc(vname(it.version)) + "</span></p>" +
        '<div class="bai-tabs" role="tablist">' + ORDER.map(m => '<button type="button" role="tab" data-m="' + m + '">' + MODES[m].label + "</button>").join("") + "</div>" +
        '<div class="bai-out" aria-live="polite"></div>';
      const out = body.querySelector(".bai-out");
      out.addEventListener("click", e => { const r = e.target.closest(".bai-rel"); if (r) jump(+r.dataset.b, +r.dataset.c, +r.dataset.v); });
      const show = m => {
        ctl.stale = true; ctl = { stale: false }; const my = ctl; delete out.dataset.done;
        body.querySelectorAll(".bai-tabs button").forEach(b => b.classList.toggle("on", b.dataset.m === m));
        if (m === "ask") { askView(it, out); return; }
        const hit = cacheGet(it, m);
        if (hit) { out.innerHTML = render(m, hit, out); out.dataset.src = "cache"; return; }
        out.dataset.src = "live"; out.innerHTML = SKEL;
        runMode(it, m, t => { if (!my.stale) out.innerHTML = render(m, t, null) + '<span class="bai-cur"></span>'; })
          .then(t => { if (!my.stale) { out.innerHTML = render(m, t, out); out.dataset.done = "1"; } })
          .catch(e => { if (my.stale) return; out.innerHTML = '<p class="bai-err">' + esc(errMsg(e)) + '</p><button type="button" class="bai-retry">Try again</button>'; out.querySelector(".bai-retry").onclick = () => show(m); });
      };
      body.querySelectorAll(".bai-tabs button").forEach(b => b.onclick = () => show(b.dataset.m));
      show(mode);
    });
    U.onClose(() => { ctl.stale = true; });
  }
  function errMsg(e) { try { return C.ai.errorMessage(e); } catch { return "Couldn't reach the study helper. Try again in a moment."; } }
  function askView(it, out) {
    if (!chat || chat.key !== itemKey(it)) chat = { key: itemKey(it), msgs: [] };
    out.innerHTML = '<div class="bai-chat"></div><form class="bai-ask"><input type="text" maxlength="300" placeholder="Ask about this verse" aria-label="Your question"/><button type="submit" aria-label="Send">' + IC.send + "</button></form>";
    const list = out.querySelector(".bai-chat"), form = out.querySelector("form"), input = form.querySelector("input");
    const draw = () => { list.innerHTML = chat.msgs.map(m => '<div class="bai-msg ' + m.role + '">' + (m.role === "user" ? esc(m.content) : fmtPlain(m.content || "")) + "</div>").join(""); };
    draw();
    form.onsubmit = async e => {
      e.preventDefault(); const q = input.value.trim(); if (!q) return; input.value = "";
      chat.msgs.push({ role: "user", content: q }); const a = { role: "assistant", content: "" }; chat.msgs.push(a); draw();
      list.lastElementChild.innerHTML = SKEL;
      const hist = chat.msgs.slice(0, -1).slice(-6);
      const sys = SYS + " The user is reading " + verseLine(it) + " Answer their question about it in under 120 words.";
      try {
        const t = await window.BibleyAI.stream(sys, hist, { maxTokens: 700, onText: t => { a.content = t; if (list.isConnected) { list.lastElementChild.innerHTML = fmtPlain(t); } } });
        a.content = t; if (list.isConnected) draw();
      } catch (er) { a.content = errMsg(er); if (list.isConnected) draw(); }
    };
  }

  /* ================= entry points ================= */
  function addHeaderButton() {
    const hr = document.querySelector("header .header-right"); if (!hr || document.getElementById("bscBtn")) return;
    const b = document.createElement("button"); b.type = "button"; b.id = "bscBtn"; b.className = "bn-hb"; b.setAttribute("aria-label", "Scroll verses"); b.title = "Scroll verses"; b.innerHTML = IC.feed;
    b.onclick = open;
    const s = document.getElementById("bnSearchBtn"); if (s) hr.insertBefore(b, s); else hr.appendChild(b);
  }
    function fromSel(t) { return { bookIdx: t.bookIdx, chapter: t.chapter, verseNum: t.verseNum, verses: t.verses && t.verses.length ? t.verses : [t.verseNum], ref: t.ref, text: t.text, version: t.version }; }
  if (location.hash === "#scroll") { setTimeout(open, 300); history.replaceState(null, "", location.pathname + location.search); }
  window.BibleyScroll = { open, close, likedSheet, toggleLike, isLiked };
  window.BibleyVerseAI = { open: (t, mode) => openAI(fromSel(t), mode), modes: ORDER.slice(), cacheGet: (t, m) => cacheGet(fromSel(t), m) };
})();
