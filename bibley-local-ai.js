/* bibley-local-ai.js - Bibley 6.7 (2026-11-23): On-Device AI "Bibley 2.1".
   A port of Oliver's Bibley 2.1 brain (github.com/olivercraftboycompany-design/bibley-ai, server.py)
   that runs in the browser: KJV reference lookup, keyword (BM25) + topical verse search, the
   exact-quote SYSTEM / INSTRUCTIONS prompt, an honest off-topic gate and quote repair, with
   Qwen3-0.6B running on this device through WebLLM (WebGPU) or Transformers.js (CPU / WASM).
   Nothing here downloads until On-Device AI is used: the engines and the model load on demand.
   Stored: localStorage "bibley_ai_engine_v1" = { mode: "cloud" | "local", backend: "auto" | "webgpu" | "cpu" }.
   The KJV comes from /bibles/kjv.json.gz (or Bibley's offline copy in IndexedDB "bibley_bibles"). */
(function () {
  "use strict";
  var KEY = "bibley_ai_engine_v1";
  var WEBLLM_URL = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.89/+esm";
  var TJS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm";
  var MODEL_F16 = "Qwen3-0.6B-q4f16_1-MLC", MODEL_F32 = "Qwen3-0.6B-q4f32_1-MLC";
  var CPU_REPO = "onnx-community/Qwen3-0.6B-ONNX-OPT";
  var MAX_NEW = 420;

  /* ---------------- books ---------------- */
  // name|abbreviations (lowercase, no spaces)
  var BOOKS = ("Genesis|gen,ge,gn;Exodus|ex,exo,exod;Leviticus|lev,le,lv;Numbers|num,nu,nm,numb;Deuteronomy|deut,de,dt,deu;Joshua|josh,jos,jsh;Judges|judg,jdg,jg,jdgs;Ruth|ru,rth,rut;" +
    "1 Samuel|1sam,1sa,1sm,1s;2 Samuel|2sam,2sa,2sm,2s;1 Kings|1kgs,1ki,1kin,1kg;2 Kings|2kgs,2ki,2kin,2kg;1 Chronicles|1chr,1ch,1chron;2 Chronicles|2chr,2ch,2chron;Ezra|ezr;Nehemiah|neh,ne;Esther|esth,est,es;" +
    "Job|jb;Psalms|ps,psa,psalm,pss,psm,pslm;Proverbs|prov,pro,prv,pr;Ecclesiastes|eccl,ecc,ec,eccles,qoheleth;Song of Solomon|song,sos,songofsongs,canticles,ss;Isaiah|isa,is;Jeremiah|jer,je,jr;Lamentations|lam,la;" +
    "Ezekiel|ezek,eze,ezk;Daniel|dan,da,dn;Hosea|hos,ho;Joel|jl,joe;Amos|am;Obadiah|obad,ob;Jonah|jon,jnh;Micah|mic,mc;Nahum|nah,na;Habakkuk|hab,hb;Zephaniah|zeph,zep,zp;Haggai|hag,hg;Zechariah|zech,zec,zc;Malachi|mal,ml;" +
    "Matthew|matt,mt,mat;Mark|mk,mar,mrk,mr;Luke|lk,luk;John|jn,jhn,joh;Acts|ac,act;Romans|rom,ro,rm;1 Corinthians|1cor,1co;2 Corinthians|2cor,2co;Galatians|gal,ga;Ephesians|eph,ephes;Philippians|phil,php,pp,philip;" +
    "Colossians|col,co;1 Thessalonians|1thess,1th,1thes;2 Thessalonians|2thess,2th,2thes;1 Timothy|1tim,1ti,1tm;2 Timothy|2tim,2ti,2tm;Titus|tit,ti;Philemon|philem,phm,phlm;Hebrews|heb;James|jas,jm,jam;" +
    "1 Peter|1pet,1pe,1pt,1p;2 Peter|2pet,2pe,2pt,2p;1 John|1jn,1jo,1jhn,1joh;2 John|2jn,2jo,2jhn;3 John|3jn,3jo,3jhn;Jude|jud,jd;Revelation|rev,re,revelations,rv,apocalypse").split(";").map(function (s) { var p = s.split("|"); return { name: p[0], ab: p[1].split(",") }; });
  var LOOK = {};
  BOOKS.forEach(function (b, i) {
    var k = b.name.toLowerCase().replace(/\s+/g, "");
    LOOK[k] = i; b.ab.forEach(function (a) { if (!(a in LOOK)) LOOK[a] = i; });
    if (/^[123]/.test(k)) { var ord = { 1: ["i", "first"], 2: ["ii", "second"], 3: ["iii", "third"] }[k[0]], rest = k.slice(1); ord.forEach(function (o) { LOOK[o + rest] = i; }); }
  });
  var PFX = { "1": "1", "2": "2", "3": "3", i: "1", ii: "2", iii: "3", first: "1", second: "2", third: "3" };
  var REF_RE = /\b(?:([123]|iii|ii|i|first|second|third)\s*)?(song\s+of\s+(?:solomon|songs)|[a-z]+)\.?\s*(\d{1,3})(?:\s*:\s*(\d{1,3})(?:\s*[-\u2013\u2014]\s*(\d{1,3}))?)?(?![\d:])/gi;
  function bookIdx(pfx, name) {
    var n = name.toLowerCase().replace(/\s+/g, "");
    if (pfx) { var p = PFX[pfx.toLowerCase()]; if ((p + n) in LOOK) return LOOK[p + n]; }
    return n in LOOK ? LOOK[n] : -1;
  }

  /* ---------------- the KJV ---------------- */
  var KJV = null, kjvP = null, V = [];   // V[i] = { ref, text, b, c, v }
  function clean(t) { return String(t || "").replace(/\u00b6\s*/g, "").replace(/\s+/g, " ").trim(); }
  function idbKJV() {
    return new Promise(function (res) {
      try {
        var rq = indexedDB.open("bibley_bibles", 1);
        rq.onupgradeneeded = function () { var db = rq.result; if (!db.objectStoreNames.contains("bibles")) db.createObjectStore("bibles"); };
        rq.onsuccess = function () { try { var g = rq.result.transaction("bibles", "readonly").objectStore("bibles").get("kjv"); g.onsuccess = function () { res(g.result || null); }; g.onerror = function () { res(null); }; } catch (e) { res(null); } };
        rq.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
  }
  async function gunzip(buf) {
    var u8 = new Uint8Array(buf);
    if (!(u8[0] === 0x1f && u8[1] === 0x8b)) return new TextDecoder().decode(u8);
    if (typeof DecompressionStream === "undefined") throw new Error("no-gzip-support");
    return await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  }
  function setKJV(d) {
    KJV = d; V = [];
    d.b.forEach(function (bk, bi) { bk.forEach(function (ch, ci) { ch.forEach(function (t, vi) { if (t) V.push({ ref: BOOKS[bi].name + " " + (ci + 1) + ":" + (vi + 1), text: clean(t), b: bi, c: ci + 1, v: vi + 1 }); }); }); });
    INV = null; TEXT2 = null;
    return d;
  }
  function ensureKJV() {
    if (KJV) return Promise.resolve(KJV);
    if (kjvP) return kjvP;
    kjvP = (async function () {
      var d = await idbKJV();
      if (!d || !Array.isArray(d.b) || d.b.length !== 66) {
        var base = location.hostname === "appassets.androidplatform.net" ? "https://olivercraftboycompany-design.github.io/Bibley-/bibles/" : "bibles/";
        var r = await fetch(base + "kjv.json.gz");
        if (!r.ok) throw new Error("kjv-" + r.status);
        d = JSON.parse(await gunzip(await r.arrayBuffer()));
      }
      if (!d || !Array.isArray(d.b) || d.b.length !== 66) throw new Error("kjv-bad");
      return setKJV(d);
    })();
    kjvP.catch(function () { kjvP = null; });
    return kjvP;
  }
  function verse(b, c, v) { var t = KJV && KJV.b[b] && KJV.b[b][c - 1] && KJV.b[b][c - 1][v - 1]; return t ? { ref: BOOKS[b].name + " " + c + ":" + v, text: clean(t), b: b, c: c, v: v } : null; }

  // Verses the user named directly: "John 3:16-17", "Psalm 23:1", "ps 23", "1 Cor 13:4".
  function findByReference(q) {
    var out = [], m; REF_RE.lastIndex = 0;
    while ((m = REF_RE.exec(String(q || "")))) {
      var bi = bookIdx(m[1], m[2]);
      if (bi < 0 && m[1]) { bi = bookIdx("", m[2]); }
      if (bi < 0) continue;
      var c = +m[3], v1 = m[4] ? +m[4] : 1, v2 = m[5] ? +m[5] : (m[4] ? v1 : 6);
      if (!m[4] && m[2].length < 3) continue;      // "is 3" etc. is not a chapter
      if (v2 < v1) { var x = v1; v1 = v2; v2 = x; }
      for (var v = v1; v <= v2 && v < v1 + 12; v++) { var hit = verse(bi, c, v); if (hit) out.push(hit); }
    }
    return out;
  }

  /* ---------------- keyword search (BM25) + topics ---------------- */
  var STOP = {}; ("what does the bible say about is it a an and or of to in on for me my i do how should can are was be with that this you your we our they them he she his her who whom which why when where will would could about from at by as if so not no yes there their than then into out up down all any some get got have has had just like very much more most tell verse verses scripture scriptures god's").split(" ").forEach(function (w) { STOP[w] = 1; });
  function stem(w) {
    if (w.length > 4) w = w.replace(/(eth|est|ing|edst|ed|es|s)$/, "");
    if (w.length > 3) w = w.replace(/e$/, "").replace(/y$/, "i");
    return w;
  }
  function toks(s, keepStop) { return (String(s || "").toLowerCase().match(/[a-z]+/g) || []).filter(function (w) { return keepStop || !STOP[w]; }).map(stem); }
  var INV = null, DL = null, AVG = 0, TEXT2 = null;
  function buildIndex() {
    if (INV) return;
    INV = new Map(); DL = new Uint16Array(V.length); var tot = 0;
    for (var i = 0; i < V.length; i++) {
      var t = toks(V[i].text, true), tf = {};
      DL[i] = t.length; tot += t.length;
      for (var j = 0; j < t.length; j++) tf[t[j]] = (tf[t[j]] || 0) + 1;
      for (var w in tf) { var a = INV.get(w); if (!a) INV.set(w, a = []); a.push(i, tf[w]); }
    }
    AVG = tot / V.length;
  }
  // topic: [triggers, KJV words added to the search, key verses]
  var TOPICS = {
    anxiety: ["anxiety anxious worry worried worrying stress stressed nervous overwhelmed", "careful care troubled peace cast", "Philippians 4:6,Philippians 4:7,1 Peter 5:7,Matthew 6:34,John 14:27"],
    peace: ["peace calm rest restless", "peace rest quiet still", "John 14:27,Isaiah 26:3,Philippians 4:7,Matthew 11:28"],
    fear: ["fear afraid scared terrified frightened panic", "fear afraid dismayed courage", "Isaiah 41:10,2 Timothy 1:7,Psalms 56:3,Joshua 1:9"],
    forgiveness: ["forgive forgiveness forgiving forgiven guilt guilty shame sin sins", "forgive forgiven trespasses iniquity cleanse", "1 John 1:9,Ephesians 4:32,Colossians 3:13,Matthew 6:14"],
    prayer: ["pray prayer praying prayers", "pray prayer ask supplication", "Matthew 6:6,1 Thessalonians 5:17,James 5:16,Philippians 4:6"],
    grief: ["grief grieving grieve loss lost died death mourning mourn sad sorrow funeral", "mourn comfort sorrow tears brokenhearted", "Matthew 5:4,Psalms 34:18,Revelation 21:4,2 Corinthians 1:3"],
    faith: ["faith believe believing trust doubt doubts doubting", "faith believe trust", "Hebrews 11:1,Hebrews 11:6,Proverbs 3:5,Mark 11:24"],
    love: ["love loving loved", "love charity", "1 Corinthians 13:4,John 3:16,1 John 4:8,Romans 8:38,John 15:13"],
    salvation: ["saved salvation save heaven eternal born again die afterlife", "salvation saved believe everlasting", "John 3:16,Romans 10:9,Ephesians 2:8,Acts 4:12"],
    strength: ["strength strong weak weakness tired weary exhausted", "strength strengthen weary power", "Isaiah 40:31,Philippians 4:13,2 Corinthians 12:9,Isaiah 41:10"],
    wisdom: ["wisdom wise decision decisions wisdom understanding", "wisdom understanding knowledge", "James 1:5,Proverbs 3:5,Proverbs 2:6,Proverbs 9:10"],
    marriage: ["marriage married marry husband wife spouse wedding divorce", "wife husband marriage cleave", "Genesis 2:24,Ephesians 5:25,Mark 10:9,Hebrews 13:4"],
    temptation: ["temptation tempted tempt addiction lust resist", "temptation tempted resist flee", "1 Corinthians 10:13,James 1:12,James 4:7,Matthew 26:41"],
    depression: ["depression depressed hopeless lonely alone despair down", "hope comfort brokenhearted heaviness", "Psalms 34:18,Psalms 42:11,Isaiah 41:10,Matthew 11:28"],
    anger: ["anger angry mad rage furious temper", "wrath anger angry", "Ephesians 4:26,James 1:19,Proverbs 15:1,Ephesians 4:31"],
    money: ["money rich wealth poor debt finances greed job", "money riches treasure mammon", "1 Timothy 6:10,Matthew 6:24,Hebrews 13:5,Matthew 6:19"],
    guidance: ["guidance guide direction lost plan purpose future path", "direct paths lead way", "Proverbs 3:5,Proverbs 3:6,Psalms 32:8,Jeremiah 29:11,Psalms 119:105"]
  };
  var TOPIC_T = {}; Object.keys(TOPICS).forEach(function (k) { TOPICS[k][0].split(" ").forEach(function (w) { TOPIC_T[w] = k; }); });
  function refVerse(r) { var m = /^(.*) (\d+):(\d+)$/.exec(r), bi = m ? bookIdx("", m[1]) : -1; return bi < 0 ? null : verse(bi, +m[2], +m[3]); }
  // Top KJV verses for a question: [{ ref, text, score }], plus .topics and .coverage and .best (terms matched by the best verse).
  function searchKJV(q, opts) {
    opts = opts || {}; var k = opts.k || 5, skip = opts.skip || {};
    if (!V.length) return Object.assign([], { topics: [], coverage: 0, best: 0, terms: 0 });
    buildIndex();
    var raw = (String(q).toLowerCase().match(/[a-z]+/g) || []), topics = [];
    raw.forEach(function (w) { var t = TOPIC_T[w]; if (t && topics.indexOf(t) < 0) topics.push(t); });
    var qt = toks(q), uniq = qt.filter(function (w, i) { return qt.indexOf(w) === i; });
    var known = uniq.filter(function (w) { return INV.has(w); });
    var extra = []; topics.forEach(function (t) { toks(TOPICS[t][1]).forEach(function (w) { if (uniq.indexOf(w) < 0 && extra.indexOf(w) < 0) extra.push(w); }); });
    var sc = new Map(), hits = new Map(), N = V.length;
    function add(w, wt, own) {
      var a = INV.get(w); if (!a) return; var df = a.length / 2, idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      for (var j = 0; j < a.length; j += 2) { var d = a[j], tf = a[j + 1], s = idf * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * DL[d] / AVG)) * wt;
        sc.set(d, (sc.get(d) || 0) + s); if (own) hits.set(d, (hits.get(d) || 0) + 1); }
    }
    known.forEach(function (w) { add(w, 1, true); }); extra.forEach(function (w) { add(w, 0.35, false); });
    var arr = []; sc.forEach(function (s, d) { arr.push([d, s]); });
    arr.sort(function (a, b) { return b[1] - a[1]; });
    var top = arr.length ? arr[0][1] : 1, bestHits = 0;
    for (var i = 0; i < Math.min(arr.length, 30); i++) bestHits = Math.max(bestHits, hits.get(arr[i][0]) || 0);
    var out = [], seen = {};
    topics.forEach(function (t, ti) { TOPICS[t][2].split(",").forEach(function (r, ri) { var v = refVerse(r); if (v && !seen[v.ref] && !skip[v.ref]) { seen[v.ref] = 1; out.push({ ref: v.ref, text: v.text, score: top * (1.6 - ti * 0.2 - ri * 0.12) }); } }); });
    for (var j = 0; j < arr.length && out.length < k + 10; j++) { var vv = V[arr[j][0]]; if (seen[vv.ref] || skip[vv.ref]) continue; seen[vv.ref] = 1; out.push({ ref: vv.ref, text: vv.text, score: arr[j][1] }); }
    out.sort(function (a, b) { return b.score - a.score; });
    out = out.slice(0, k);
    out.topics = topics; out.terms = uniq.length; out.coverage = uniq.length ? known.length / uniq.length : 0; out.best = bestHits;
    return out;
  }
  // Honesty gate (server.py's OFFTOPIC_GATE, here by keywords): nothing named, no topic, and the words barely occur in the KJV.
  function isOffTopic(direct, ranked) {
    if (direct.length || ranked.topics.length) return false;
    if (!ranked.length || !ranked.terms) return true;
    return ranked.coverage < 0.6 || ranked.best < Math.min(2, ranked.terms);
  }
  function offTopicReply(ranked) {
    var c = ranked && ranked[0], msg = "I searched the whole Bible for this, and honestly, the Bible does not really talk about that.\n\n";
    if (c) msg += "The closest verse I found is " + c.ref + ": \"" + c.text + "\" - but it is only loosely related.\n\n";
    return msg + "In plain words: this one is outside what the Bible covers. Ask me anything about God, faith, or life and I will find the real verses for it.";
  }

  /* ---------------- prompt (Bibley 2.1) ---------------- */
  var SYSTEM = "You are Bibley, a warm and honest Bible helper running right on this device. You answer questions about the Bible using the real King James verses provided. You always quote the verses word for word before explaining them, and you explain them in plain words. You are gentle: you never condemn the person asking.";
  var INSTRUCTIONS = "Write your answer like this:\n1. Quote the 2 or 3 most important verses, each on its own line, in exactly this shape: the reference copied letter for letter from the list above, then a colon, then the exact words inside quote marks. Never change a single word or a single letter of a quote or of a reference.\n2. Then write 'In plain words:' and explain in 2 or 3 simple sentences what these verses say about the question, gently and honestly. Only claim what these verses actually say - do not add big claims they do not make. If the verses do not really answer the question, say so honestly instead of pretending they do.";
  function userPrompt(q, picked) { return "Question: " + q + "\n\nReal King James Bible verses found for this question:\n" + picked.map(function (v) { return v.ref + ": " + v.text; }).join("\n") + "\n\n" + INSTRUCTIONS; }
  function buildMessages(q, picked) {
    var msgs = [{ role: "system", content: SYSTEM }], p = refVerse("Philippians 4:6"), m = refVerse("Matthew 6:34");
    if (p && m) msgs.push({ role: "user", content: userPrompt("what does the Bible say about worry?", [p, m]) },
      { role: "assistant", content: p.ref + ": \"" + p.text + "\"\n" + m.ref + ": \"" + m.text + "\"\n\nIn plain words: God does not want you to live worried. Instead of carrying every fear by yourself, bring each one to Him in prayer with thanks, and take life one day at a time. That is His way out of worry: pray, and trust Him daily." });
    msgs.push({ role: "user", content: userPrompt(q, picked) });
    return msgs;
  }

  /* ---------------- quote repair ---------------- */
  function norm(s) { return String(s || "").replace(/\s+([,.;:!?])/g, "$1").replace(/[\u201c\u201d"*]/g, "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function words(s) { return norm(s).replace(/[^a-z0-9 ]/g, "").split(" ").filter(Boolean); }
  function sim(a, b) {   // word-level LCS ratio
    var x = words(a), y = words(b); if (!x.length || !y.length) return 0;
    var prev = new Array(y.length + 1).fill(0);
    for (var i = 1; i <= x.length; i++) { var cur = [0]; for (var j = 1; j <= y.length; j++) cur[j] = x[i - 1] === y[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]); prev = cur; }
    return 2 * prev[y.length] / (x.length + y.length);
  }
  var LINE_RE = /^\s*(?:[-*\u2022]|\d+[.)])?\s*\**([1-3]?\s?[A-Za-z][A-Za-z ]*?\s\d{1,3}:\d{1,3})\**\s*[:\-\u2013\u2014]\s*[\"'\u201c*]+(.+?)[\"'\u201d*]+\s*$/;
  // Checks each quoted "Ref: "text"" line: right words under the wrong reference get the true reference,
  // a slight misquote of a retrieved verse is replaced by the exact KJV words, an invented quote is dropped.
  function repairQuotes(reply, picked) {
    picked = picked || []; var fixed = 0, dropped = 0;
    if (!TEXT2 && V.length) { TEXT2 = new Map(); V.forEach(function (v) { var n = norm(v.text); if (!TEXT2.has(n)) TEXT2.set(n, v); }); }
    var out = String(reply || "").split("\n").map(function (line) {
      var m = LINE_RE.exec(line); if (!m) return line;
      var claimed = m[1].trim(), quote = m[2].trim(), n = norm(quote), hit = TEXT2 && TEXT2.get(n);
      if (!hit && n.length >= 25 && V.length) { var c = V.filter(function (v) { return norm(v.text).indexOf(n) >= 0; }); if (c.length === 1) hit = c[0]; }
      if (!hit) {
        var pool = picked.slice(), cr = findByReference(claimed); if (cr[0]) pool.unshift(cr[0]);
        var best = null, bs = 0; pool.forEach(function (v) { var s = sim(quote, v.text); if (s > bs) { bs = s; best = v; } });
        if (best && bs >= 0.6) { hit = best; fixed++; return best.ref + ": \"" + best.text + "\""; }
      }
      if (!hit) { dropped++; return null; }
      if (hit.ref.toLowerCase() !== claimed.toLowerCase().replace(/^psalm /, "psalms ")) fixed++;
      return hit.ref + ": \"" + quote + "\"";
    }).filter(function (l) { return l !== null; }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    api.lastRepair = { fixed: fixed, dropped: dropped };
    return out;
  }
  function stripThink(t) { return String(t || "").replace(/<think>[\s\S]*?(<\/think>|$)/g, "").replace(/<\/?think>/g, "").replace(/^\s+/, ""); }

  /* ---------------- settings + device ---------------- */
  var subs = [];
  function emit() { var s = status(); subs.forEach(function (f) { try { f(s); } catch (e) {} }); pill(); }
  function getConfig() { var c = {}; try { c = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {} return { mode: c.mode === "local" ? "local" : "cloud", backend: ["webgpu", "cpu"].indexOf(c.backend) >= 0 ? c.backend : "auto" }; }
  function setConfig(p) { var c = Object.assign(getConfig(), p || {}); try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} c = getConfig(); emit(); return c; }
  var capsP = null;
  function detectCapabilities() {
    if (capsP) return capsP;
    capsP = (async function () {
      var ua = navigator.userAgent || "", ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
      var c = { webgpu: false, f16: false, wasm: typeof WebAssembly === "object", ios: ios, mobile: ios || /Android|Mobi/i.test(ua), adapter: "" };
      try { if (navigator.gpu) { var a = await navigator.gpu.requestAdapter(); if (a) { c.webgpu = true; c.f16 = !!(a.features && a.features.has("shader-f16")); try { var info = a.info || (a.requestAdapterInfo && await a.requestAdapterInfo()); c.adapter = (info && (info.vendor || info.description)) || ""; } catch (e) {} } } } catch (e) {}
      c.recommended = c.webgpu ? "webgpu" : "cpu";
      c.label = c.webgpu ? "Detected: WebGPU available" + (c.f16 ? " (f16)" : "") : (c.wasm ? "Detected: CPU mode (WebGPU not available in this browser)" : "Detected: this browser can't run on-device AI");
      return c;
    })();
    return capsP;
  }
  var st = { state: "idle", backend: "", percent: 0, text: "", modelId: "", error: "" };
  function status() { return Object.assign({}, st, { config: getConfig() }); }
  function set(p) { Object.assign(st, p); emit(); }
  async function backendFor(cfg) { var c = await detectCapabilities(); if (cfg.backend === "webgpu") return "webgpu"; if (cfg.backend === "cpu") return "cpu"; return c.recommended; }

  /* ---------------- engines ---------------- */
  var eng = null, loadP = null;   // eng = { backend, modelId, gen(msgs, onDelta) }
  function loadModel(onProgress) {
    var prog = function (p) { set({ percent: p.percent, text: p.text, state: "loading" }); if (onProgress) try { onProgress(p); } catch (e) {} };
    return (async function () {
      var be = await backendFor(getConfig());
      if (eng && eng.backend === be) return eng;
      if (loadP && loadP.be === be) return loadP;
      if (eng) await unload();
      var p = (be === "webgpu" ? loadWebLLM(prog) : loadCPU(prog)).then(function (e) { eng = e; loadP = null; set({ state: "ready", backend: be, modelId: e.modelId, percent: 100, text: "Bibley 2.1 is ready", error: "" }); return e; },
        function (e) { loadP = null; set({ state: "error", error: String(e && e.message || e), text: "Couldn't load Bibley 2.1" }); throw e; });
      p.be = be; loadP = p; set({ state: "loading", backend: be, percent: 0, text: "Starting...", error: "" });
      return p;
    })();
  }
  async function loadWebLLM(prog) {
    var c = await detectCapabilities(); if (!c.webgpu) throw new Error("WebGPU is not available in this browser");
    var id = c.f16 ? MODEL_F16 : MODEL_F32;
    prog({ percent: 0, stage: "engine", text: "Loading WebLLM..." });
    var W = await import(WEBLLM_URL);
    var e = await W.CreateMLCEngine(id, { initProgressCallback: function (r) { prog({ percent: Math.round((r.progress || 0) * 100), stage: /fetch|download|loading model from cache/i.test(r.text || "") ? "download" : "load", text: r.text || "" }); } });
    return { backend: "webgpu", modelId: id, raw: e, gen: async function (msgs, onDelta) {
      var s = await e.chat.completions.create({ messages: msgs, stream: true, temperature: 0.1, max_tokens: MAX_NEW, extra_body: { enable_thinking: false } });
      for await (var ch of s) { var d = ch.choices && ch.choices[0] && ch.choices[0].delta && ch.choices[0].delta.content; if (d) onDelta(d); }
    }, unload: function () { return e.unload(); } };
  }
  async function loadCPU(prog) {
    prog({ percent: 0, stage: "engine", text: "Loading the CPU engine..." });
    var T = await import(TJS_URL);
    T.env.allowLocalModels = false; T.env.useBrowserCache = true;
    var files = {};
    var cb = function (x) {
      if (!x || !x.file) return;
      if (x.status === "progress" || x.status === "done") { var f = files[x.file] || (files[x.file] = { l: 0, t: 0 }); if (x.total) f.t = x.total; f.l = x.status === "done" ? f.t : (x.loaded || 0); }
      var l = 0, t = 0; for (var k in files) { l += files[k].l; t += files[k].t; }
      if (t) prog({ percent: Math.min(99, Math.round(l / t * 100)), stage: "download", text: "Downloading Bibley 2.1 model... " + Math.round(l / 1048576) + " of " + Math.round(t / 1048576) + " MB" });
    };
    var tok = await T.AutoTokenizer.from_pretrained(CPU_REPO, { progress_callback: cb });
    var model = await T.AutoModelForCausalLM.from_pretrained(CPU_REPO, { dtype: "q4", device: "wasm", progress_callback: cb });
    return { backend: "cpu", modelId: CPU_REPO + " (q4)", raw: model, tokenizer: tok, gen: async function (msgs, onDelta) {
      var inp = tok.apply_chat_template(msgs, { add_generation_prompt: true, return_dict: true, enable_thinking: false });
      var streamer = new T.TextStreamer(tok, { skip_prompt: true, skip_special_tokens: true, callback_function: function (t) { if (t) onDelta(t); } });
      await model.generate(Object.assign({}, inp, { max_new_tokens: MAX_NEW, do_sample: false, repetition_penalty: 1.1, streamer: streamer }));
    }, unload: function () { return model.dispose && model.dispose(); } };
  }
  async function unload() { var e = eng; eng = null; if (e && e.unload) { try { await e.unload(); } catch (x) {} } set({ state: "idle", modelId: "", percent: 0, text: "" }); }
  async function clearCache() {
    await unload(); var n = 0;
    if (window.caches) for (var k of await caches.keys()) if (/^webllm|^tvmjs|^transformers-cache/.test(k)) { await caches.delete(k); n++; }
    set({ state: "idle", text: "Local model removed from this device" });
    return n;
  }
  async function isCached() {
    try { if (!window.caches) return false; var ks = await caches.keys();
      for (var k of ks) { if (!/^webllm\/model|^transformers-cache/.test(k)) continue; var c = await caches.open(k), r = await c.keys();
        if (r.some(function (q) { return /Qwen3-0\.6B/i.test(q.url) && /params_shard|\.onnx/.test(q.url); })) return true; }
    } catch (e) {} return false;
  }

  /* ---------------- ask ---------------- */
  // generate(question, { onToken(textSoFar), onProgress({percent,stage,text}) }) -> { text, sources, offTopic, engine }
  async function generate(question, opts) {
    opts = opts || {}; var prog = opts.onProgress || function () {};
    if (!KJV) prog({ percent: 0, stage: "bible", text: "Opening the King James Bible..." });
    await ensureKJV();
    var direct = findByReference(question).slice(0, 6), skip = {}; direct.forEach(function (v) { skip[v.ref] = 1; });
    var ranked = searchKJV(question, { k: 5, skip: skip });
    if (isOffTopic(direct, ranked)) return { text: offTopicReply(ranked), sources: ranked.slice(0, 1), offTopic: true, engine: "none" };
    var picked = direct.concat(ranked).slice(0, 8);
    var e = await loadModel(prog), raw = "";
    await e.gen(buildMessages(question, picked), function (d) { raw += d; if (opts.onToken) try { opts.onToken(stripThink(raw)); } catch (x) {} });
    var text = repairQuotes(stripThink(raw).trim(), picked);
    if (!text) throw new Error("empty-local-answer");
    return { text: text, sources: picked.slice(0, 3).map(function (v) { return { ref: v.ref, text: v.text }; }), offTopic: false, engine: e.backend, modelId: e.modelId };
  }

  /* ---------------- header pill in the AI panel ---------------- */
  function pill() {
    var b = document.getElementById("aiEnginePill"); if (!b) return;
    var local = getConfig().mode === "local";
    b.textContent = local ? "Bibley 2.1 \u00b7 On-Device" : "Cloud AI";
    b.classList.toggle("local", local); b.classList.toggle("loading", local && st.state === "loading");
    b.title = local ? (st.state === "loading" ? st.text : "On-device AI. Tap to change") : "Tap to change the AI engine";
  }
  function mountPill() {
    var b = document.getElementById("aiEnginePill"); if (!b || b.dataset.wired) return pill(); b.dataset.wired = "1";
    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); if (window.BibleySettings) window.BibleySettings.open("aiengine"); });
    pill();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountPill); else mountPill();
  window.addEventListener("storage", function (e) { if (e.key === KEY) emit(); });

  var api = { version: "2.1", models: { webgpu: [MODEL_F16, MODEL_F32], cpu: CPU_REPO, webllmUrl: WEBLLM_URL, transformersUrl: TJS_URL },
    getConfig: getConfig, setConfig: setConfig, isLocal: function () { return getConfig().mode === "local"; }, detectCapabilities: detectCapabilities,
    loadModel: loadModel, generate: generate, ask: generate, clearCache: clearCache, isCached: isCached, status: status, unload: unload,
    on: function (f) { subs.push(f); return function () { subs = subs.filter(function (x) { return x !== f; }); }; },
    ensureKJV: ensureKJV, findByReference: findByReference, searchKJV: searchKJV, isOffTopic: isOffTopic, offTopicReply: offTopicReply,
    buildMessages: buildMessages, repairQuotes: repairQuotes, stripThink: stripThink, SYSTEM: SYSTEM, INSTRUCTIONS: INSTRUCTIONS, lastRepair: null };
  window.BibleyLocalAI = api;
})();
