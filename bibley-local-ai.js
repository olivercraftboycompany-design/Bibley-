/* bibley-local-ai.js - Bibley 7.8 (2026-11-27): context-aware answers. No more "did not find a passage" wall: every
   question goes to the model, with the verse / chapter on screen (opts.context) and the recent conversation (context.history),
   so word meanings ("what does virtue mean"), follow-ups ("explain that simpler") and general questions are answered
   directly. Question filler ("what does ... mean", "explain", "tell me about") is stripped before the KJV search, so
   "what does virtue mean" searches for virtue. KJV verses and teachings are offered as help, quoted exactly when used.
   Was: Bibley 7.6 (2026-11-27): On-Device AI, twelve models (all under 1.1B parameters, ten of them under 1B)
   sharing one KJV verse-lookup brain plus "teachings" (Augustine and Calvin, and from 7.9 the Church Fathers and Aquinas's Summa Theologiae,
   from bibley-theology.js - each collection can be switched off in Settings > Historic Writings) as cited context.
   Verified 2026-11-27 against WebLLM 0.2.89's prebuilt list (lib/index.js) and the Hugging Face API, and every CPU build was
   loaded with onnxruntime-web 1.22.0-dev.20250409 (the runtime Transformers.js 3.8.1 uses) and run on a short KJV prompt:
     2.3 Qwen3.5 0.8B      WebGPU Qwen3.5-0.8B-q4f16_1-MLC / q4f32_1 (no CPU build: Transformers.js 3.8.1 has no qwen3_5 support)
     2.4 LFM2 700M         CPU onnx-community/LFM2-700M-ONNX @ bf72eea (the newer v4 export needs onnxruntime 1.23+)
     2.5 Qwen2.5 0.5B      WebGPU Qwen2.5-0.5B-Instruct-q4f16_1-MLC / q4f32_1, CPU onnx-community/Qwen2.5-0.5B-Instruct
     2.6 LFM2.5 350M       WebGPU LFM2.5-350M-q4f16_1-MLC / q4f32_1 (every ONNX export needs onnxruntime 1.23+)
     2.7 LFM2 350M         CPU onnx-community/LFM2-350M-ONNX @ 5bc4b3e
     2.8 Granite 4.0 350M  CPU onnx-community/granite-4.0-350m-ONNX-web (the hybrid h-350m needs Mamba cache support 3.8.1 lacks)
     2.9 ERNIE 4.5 0.3B    CPU onnx-community/ERNIE-4.5-0.3B-ONNX (stops on <|end_of_sentence|> = id 100272, not only </s>)
     2.10 SmolLM2 360M     WebGPU SmolLM2-360M-Instruct-q4f16_1-MLC / q4f32_1, CPU HuggingFaceTB/SmolLM2-360M-Instruct
     2.11 Gemma 3 270M     CPU onnx-community/gemma-3-270m-it-ONNX @ cfd5c04
     2.12 SmolLM2 135M     WebGPU SmolLM2-135M-Instruct-q0f16-MLC / q0f32, CPU HuggingFaceTB/SmolLM2-135M-Instruct
   v7.6 fix: the 2026 re-exports of onnx-community/Qwen3-0.6B-ONNX-OPT and gemma-3-1b-it-ONNX (main) fail to load in
   onnxruntime-web 1.22 (GatherBlockQuantized "bits"), so Bibley 2.1 CPU now uses onnx-community/Qwen3-0.6B-ONNX (q8) and
   Bibley 2.2 CPU is pinned to gemma-3-1b-it-ONNX @ 7769a8a (q8). A model with no build for a backend falls back to the other.
   Was: Bibley 7.0 (2026-11-24): On-Device AI, two models sharing one KJV verse-lookup brain.
   Model 1 "Bibley 2.1" = Qwen3 0.6B (fast & light). Model 2 "Bibley 2.2" = Gemma 3 1B Instruct (deeper study).
   Verified 2026-11-24: WebLLM 0.2.89 prebuilt list carries Qwen3-0.6B-q4f16_1-MLC, Qwen3-0.6B-q4f32_1-MLC and
   gemma3-1b-it-q4f16_1-MLC (lib gemma3-1b-it-q4f16_1_cs512-webgpu.wasm, needs WebGPU shader-f16; without it Gemma runs on CPU);
   Hugging Face carries onnx-community/Qwen3-0.6B-ONNX-OPT and onnx-community/gemma-3-1b-it-ONNX (model_q4.onnx + data, Gemma3ForCausalLM).
   Was: Bibley 6.7 (2026-11-23): On-Device AI "Bibley 2.1".
   A port of Oliver's Bibley 2.1 brain (github.com/olivercraftboycompany-design/bibley-ai, server.py)
   that runs in the browser: KJV reference lookup, keyword (BM25) + topical verse search, the
   exact-quote SYSTEM / INSTRUCTIONS prompt, an honest off-topic gate and quote repair, with
   Qwen3-0.6B running on this device through WebLLM (WebGPU) or Transformers.js (CPU / WASM).
   Nothing here downloads until On-Device AI is used: the engines and the model load on demand.
   Stored: localStorage "bibley_ai_engine_v1" = { mode: "cloud" | "local", backend: "auto" | "webgpu" | "cpu", modelId: one of MODELS[].id }.
   The KJV comes from /bibles/kjv.json.gz (or Bibley's offline copy in IndexedDB "bibley_bibles"). */
(function () {
  "use strict";
  var KEY = "bibley_ai_engine_v1";
  var WEBLLM_URL = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.89/+esm";
  var TJS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm";
  var MODEL_F16 = "Qwen3-0.6B-q4f16_1-MLC", MODEL_F32 = "Qwen3-0.6B-q4f32_1-MLC";
  var CPU_REPO = "onnx-community/Qwen3-0.6B-ONNX";
  var MAX_NEW = 420;
  // The on-device models. Every one runs through the same KJV lookup (reference parsing, BM25 + topics, exact-quote prompt,
  // off-topic gate, quote repair) and gets matching "teachings" passages. webgpu: { f16, f32 } WebLLM ids or null (no WebGPU build);
  // cpu: Transformers.js repo or null (no CPU build); rev pins a Hugging Face commit; eos adds stop ids; small = a tighter prompt
  // (5 verses, 1 short teaching) for models of about 360M parameters and under.
  var MODELS = [
    { id: "qwen3-0.6b", name: "Bibley 2.1", family: "Qwen", model: "Qwen3 0.6B", params: "0.6B", tag: "Fast & Light", size: "~350 MB WebGPU / ~620 MB CPU",
      desc: "Quick answers with real KJV quotes. Light enough for most phones.", webgpu: { f16: MODEL_F16, f32: MODEL_F32 }, cpu: CPU_REPO, dtype: "q8", thinking: true, cacheRe: /Qwen3-0\.6B/i },
    { id: "gemma3-1b", name: "Bibley 2.2", family: "Gemma", model: "Gemma 3 1B Instruct", params: "1B", tag: "Deeper Study", size: "~600 MB WebGPU / ~1 GB CPU",
      desc: "Google's Gemma 3: fuller, more careful explanations of the verses it finds. Best on newer devices.", webgpu: { f16: "gemma3-1b-it-q4f16_1-MLC", f32: null }, cpu: "onnx-community/gemma-3-1b-it-ONNX", rev: "7769a8aff8978adbdcd57ad7915a97ba389fb547", dtype: "q8", noSystem: true, cacheRe: /gemma-?3-1b-it/i },
    { id: "qwen3.5-0.8b", name: "Bibley 2.3", family: "Qwen", model: "Qwen3.5 0.8B", params: "0.8B", tag: "Smartest Small", size: "~440 MB WebGPU only",
      desc: "Alibaba's newest small Qwen: the strongest reasoning in the lineup under 1B. Needs WebGPU.", webgpu: { f16: "Qwen3.5-0.8B-q4f16_1-MLC", f32: "Qwen3.5-0.8B-q4f32_1-MLC" }, cpu: null, dtype: "q4", thinking: true, cacheRe: /Qwen3\.5-0\.8B/i },
    { id: "lfm2-700m", name: "Bibley 2.4", family: "Liquid", model: "LFM2 700M", params: "0.74B", tag: "Strong on CPU", size: "~840 MB CPU only",
      desc: "Liquid AI's hybrid model built for phones and laptops: clear, well-organised answers without a GPU.", webgpu: null, cpu: "onnx-community/LFM2-700M-ONNX", rev: "bf72eeabfe73a798674db899830a0dca99f8eabc", dtype: "q4", cacheRe: /LFM2-700M/i },
    { id: "qwen2.5-0.5b", name: "Bibley 2.5", family: "Qwen", model: "Qwen2.5 0.5B Instruct", params: "0.5B", tag: "Reliable All-Rounder", size: "~285 MB WebGPU / ~790 MB CPU",
      desc: "A dependable small Qwen that follows the quote-then-explain format well. Runs on GPU or CPU.", webgpu: { f16: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", f32: "Qwen2.5-0.5B-Instruct-q4f32_1-MLC" }, cpu: "onnx-community/Qwen2.5-0.5B-Instruct", dtype: "q4", cacheRe: /Qwen2\.5-0\.5B-Instruct/i },
    { id: "lfm2.5-350m", name: "Bibley 2.6", family: "Liquid", model: "LFM2.5 350M", params: "0.35B", tag: "Tiny & Sharp", size: "~205 MB WebGPU only",
      desc: "Liquid AI's 2026 350M model: very fast, with instruction following well above its size. Needs WebGPU.", webgpu: { f16: "LFM2.5-350M-q4f16_1-MLC", f32: "LFM2.5-350M-q4f32_1-MLC" }, cpu: null, dtype: "q4", small: true, cacheRe: /LFM2\.5-350M/i },
    { id: "lfm2-350m", name: "Bibley 2.7", family: "Liquid", model: "LFM2 350M", params: "0.35B", tag: "Light on CPU", size: "~485 MB CPU only",
      desc: "Liquid AI's compact hybrid model: quick short answers on devices without WebGPU.", webgpu: null, cpu: "onnx-community/LFM2-350M-ONNX", rev: "5bc4b3e8cfd21660c0b1b9faa447ffbd9926b829", dtype: "q4", small: true, cacheRe: /LFM2-350M/i },
    { id: "granite4-350m", name: "Bibley 2.8", family: "Granite", model: "Granite 4.0 350M", params: "0.35B", tag: "Careful & Plain", size: "~580 MB CPU only",
      desc: "IBM's Granite 4.0 Nano: steady, plain-spoken answers that stick to the verses.", webgpu: null, cpu: "onnx-community/granite-4.0-350m-ONNX-web", dtype: "q4", small: true, cacheRe: /granite-4\.0-350m/i },
    { id: "ernie4.5-0.3b", name: "Bibley 2.9", family: "ERNIE", model: "ERNIE 4.5 0.3B", params: "0.36B", tag: "Short & Direct", size: "~655 MB CPU only",
      desc: "Baidu's ERNIE 4.5: short, direct summaries of what the verses say.", webgpu: null, cpu: "onnx-community/ERNIE-4.5-0.3B-ONNX", dtype: "q4", eos: [2, 100272], small: true, cacheRe: /ERNIE-4\.5-0\.3B/i },
    { id: "smollm2-360m", name: "Bibley 2.10", family: "SmolLM", model: "SmolLM2 360M Instruct", params: "0.36B", tag: "Small & Quick", size: "~205 MB WebGPU / ~390 MB CPU",
      desc: "Hugging Face's SmolLM2: a quick, light model for older phones. Runs on GPU or CPU.", webgpu: { f16: "SmolLM2-360M-Instruct-q4f16_1-MLC", f32: "SmolLM2-360M-Instruct-q4f32_1-MLC" }, cpu: "HuggingFaceTB/SmolLM2-360M-Instruct", dtype: "q4", small: true, cacheRe: /SmolLM2-360M-Instruct/i },
    { id: "gemma3-270m", name: "Bibley 2.11", family: "Gemma", model: "Gemma 3 270M", params: "0.27B", tag: "Tiny (Experimental)", size: "~805 MB CPU only",
      desc: "Google's smallest Gemma 3. Very small, so its explanations are simple and can wander; the verse quotes are still checked.", webgpu: null, cpu: "onnx-community/gemma-3-270m-it-ONNX", rev: "cfd5c04f84a64766d63efc5bb1d2cf31f34a4a90", dtype: "q4", noSystem: true, small: true, cacheRe: /gemma-3-270m-it/i },
    { id: "smollm2-135m", name: "Bibley 2.12", family: "SmolLM", model: "SmolLM2 135M Instruct", params: "0.13B", tag: "Smallest", size: "~270 MB WebGPU / ~185 MB CPU",
      desc: "The smallest model: runs almost anywhere. Best for looking up verses; its explanations are basic.", webgpu: { f16: "SmolLM2-135M-Instruct-q0f16-MLC", f32: "SmolLM2-135M-Instruct-q0f32-MLC" }, cpu: "HuggingFaceTB/SmolLM2-135M-Instruct", dtype: "q4", small: true, cacheRe: /SmolLM2-135M-Instruct/i }
  ];
  function modelInfo(id) { id = id || getConfig().modelId; for (var i = 0; i < MODELS.length; i++) if (MODELS[i].id === id) return MODELS[i]; return MODELS[0]; }

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

  async function passage(b, c, v1, v2) { await ensureKJV(); var out = []; v1 = Math.max(1, v1 | 0 || 1); v2 = Math.max(v1, v2 | 0 || v1); for (var v = v1; v <= v2 && v < v1 + 40; v++) { var x = verse(b, c, v); if (x) out.push(x); } return out; }
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
  var STOP = {}; ("what does the bible say about is it a an and or of to in on for me my i do how should can are was be with that this you your we our they them he she his her who whom which why when where will would could about from at by as if so not no yes there their than then into out up down all any some get got have has had just like very much more most tell verse verses scripture scriptures god's" +
    // v7.8: question filler, so "what does virtue mean" searches for "virtue" (and "explain this verse" for nothing extra)
    " mean means meaning meanings meant define defines definition word words term explain explanation explaining tell telling told talk talking" +
    " here say says said saying please simpler simple simply again also really thing things sort show understand" +
    " chapter passage part line book bible's whats what's who's whos does did doing done am being been isn't").split(" ").forEach(function (w) { STOP[w] = 1; });
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
    salvation: ["saved salvation save eternal born again redeemed redemption", "salvation saved believe everlasting", "John 3:16,Romans 10:9,Ephesians 2:8,Acts 4:12"],
    strength: ["strength strong weak weakness tired weary exhausted", "strength strengthen weary power", "Isaiah 40:31,Philippians 4:13,2 Corinthians 12:9,Isaiah 41:10"],
    wisdom: ["wisdom wise decision decisions wisdom understanding", "wisdom understanding knowledge", "James 1:5,Proverbs 3:5,Proverbs 2:6,Proverbs 9:10"],
    marriage: ["marriage married marry husband wife spouse wedding divorce", "wife husband marriage cleave", "Genesis 2:24,Ephesians 5:25,Mark 10:9,Hebrews 13:4"],
    temptation: ["temptation tempted tempt addiction lust resist", "temptation tempted resist flee", "1 Corinthians 10:13,James 1:12,James 4:7,Matthew 26:41"],
    depression: ["depression depressed hopeless lonely alone despair down", "hope comfort brokenhearted heaviness", "Psalms 34:18,Psalms 42:11,Isaiah 41:10,Matthew 11:28"],
    anger: ["anger angry mad rage furious temper", "wrath anger angry", "Ephesians 4:26,James 1:19,Proverbs 15:1,Ephesians 4:31"],
    money: ["money rich wealth poor debt finances greed job", "money riches treasure mammon", "1 Timothy 6:10,Matthew 6:24,Hebrews 13:5,Matthew 6:19"],
    guidance: ["guidance guide direction lost plan purpose future path", "direct paths lead way", "Proverbs 3:5,Proverbs 3:6,Psalms 32:8,Jeremiah 29:11,Psalms 119:105"],
    // v7.0: more study topics
    grace: ["grace gracious mercy merciful undeserved unearned favor favour", "grace mercy gift", "Ephesians 2:8,Ephesians 2:9,2 Corinthians 12:9,Titus 2:11,Hebrews 4:16"],
    healing: ["heal healing healed sick sickness illness ill disease cancer hospital surgery pain", "heal healed sick health", "Jeremiah 17:14,James 5:15,Psalms 147:3,Isaiah 53:5,Exodus 15:26"],
    courage: ["courage courageous brave bravery bold boldness confidence", "courage strong dismayed bold", "Joshua 1:9,Deuteronomy 31:6,Psalms 27:1,Psalms 31:24,2 Timothy 1:7"],
    creation: ["creation create created creator world universe earth beginning evolution", "created heaven earth beginning made", "Genesis 1:1,Genesis 1:27,John 1:3,Colossians 1:16,Psalms 19:1,Hebrews 11:3"],
    prophecy: ["prophecy prophecies prophet prophets prophesy foretold messiah fulfilled", "prophecy prophet fulfilled", "Isaiah 53:5,Isaiah 7:14,Micah 5:2,Isaiah 9:6,2 Peter 1:21"],
    spirit: ["spirit holy ghost comforter pentecost", "spirit ghost comforter", "John 14:26,Acts 1:8,Galatians 5:22,Romans 8:26,Acts 2:4"],
    heaven: ["heaven heavenly afterlife paradise die dying dead", "heaven mansions paradise", "John 14:2,Revelation 21:4,Philippians 3:20,2 Corinthians 5:8,1 Thessalonians 4:17"],
    hope: ["hope hopeful hoping future", "hope expectation", "Romans 15:13,Jeremiah 29:11,Hebrews 6:19,Lamentations 3:22,Romans 5:5"],
    joy: ["joy happy happiness rejoice glad", "joy rejoice glad", "Nehemiah 8:10,Psalms 16:11,Philippians 4:4,John 15:11,Psalms 30:5"],
    patience: ["patience patient waiting wait", "patience wait patient", "Isaiah 40:31,James 1:4,Psalms 27:14,Romans 12:12,Galatians 6:9"],
    thanks: ["thankful thanks thanksgiving gratitude grateful", "thanks thanksgiving give", "1 Thessalonians 5:18,Psalms 100:4,Colossians 3:17,Psalms 107:1"],
    family: ["family children child kids parents parent mother father son daughter", "children father mother", "Proverbs 22:6,Ephesians 6:1,Ephesians 6:4,Exodus 20:12,Psalms 127:3"],
    humility: ["humble humility pride proud arrogant ego", "humble pride lowly", "James 4:6,Proverbs 16:18,Philippians 2:3,Micah 6:8,1 Peter 5:6"]
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
  // v7.8: no longer a gate. "weak" = nothing named, no topic, and the words barely occur in the KJV: the verses found are then
  // offered only as optional background and the model is told to simply answer the question (a definition, history, general).
  function isOffTopic(direct, ranked) {
    if (direct.length || ranked.topics.length) return false;
    if (!ranked.length || !ranked.terms) return true;
    return ranked.coverage < 0.6 || ranked.best < Math.min(2, ranked.terms);
  }
  function offTopicReply(ranked) {
    var c = ranked && ranked[0], msg = "I searched the Bible text I have here and did not find a passage matching this question.\n\n";
    if (c) msg += "The closest verse my search found is " + c.ref + ": \"" + c.text + "\" - but it is only loosely related.\n\n";
    return msg + "Ask me anything about God, faith, or life and I will search the real verses for it.";
  }

  /* ---------------- theology retrieval (bibley-theology.js bridge) ----------------
     Lexical search over Augustine's Confessions (Pusey) and Calvin's Institutes (Allen, vol. 1), plus (7.9) the Church Fathers and
     Aquinas's Summa Theologiae - only the collections switched on in Settings > Historic Writings (search returns [] with AI use off).
     Retrieval only: no model call, no generated answer from these sources. The matched passages
     are their authors' words, never Scripture, and the UI labels them separately. */
  async function theologyTry(q, minTerms) {
    var T = window.BibleyTheology;
    if (!T || !T.search) return null;
    try {
      var hits = await T.search(q, { k: 3 });
      if (!hits || !hits.length) return null;
      // Relevance guard for the additive route: at least minTerms of the query's content words
      // must actually appear in the record, and it must cover at least half the query. The words
      // "bible"/"scripture" don't count - every question to a Bible app contains them for free.
      if (minTerms > 1) hits = hits.filter(function (h) {
        var real = (h.matched_terms || []).filter(function (t) { return t !== "bible" && t !== "scripture" && t !== "scriptures"; });
        return real.length >= minTerms && (h.query_coverage || 0) >= 0.5;
      });
      return hits.length ? hits : null;
    } catch (e) { return null; }
  }
  function theologyNote(hits) {
    var works = []; hits.forEach(function (h) { var w = (h.author ? h.author + ", " : "") + (h.work || "") + (h.edition ? " (" + h.edition.replace(/, Gutenberg.*$/, "") + ")" : ""); if (works.indexOf(w) < 0) works.push(w); });
    return "I searched the Bible text I have here and did not find a passage matching this question.\n\nBut it does come up in historic Christian writings: " +
      hits.length + " matching passage" + (hits.length > 1 ? "s" : "") + " from " + works.join(" and ") +
      ". Those are their authors' words, not Scripture. The full passages are below - tap one to read it, with a link to the whole source for context.";
  }
  // Separate source cards for theology hits: clearly NOT Referenced Verses, each links to the public-domain source text.
  function theologyHtml(hits) {
    if (!hits || !hits.length) return "";
    return '<div class="lai-theo"><span>From historic Christian writings - not Scripture</span>' + hits.map(function (h) {
      var head = '<b>' + escH(h.work || "") + '</b>' + (h.section ? ' <u>' + escH(h.section) + '</u>' : '') + '<i>' + escH(h.author || "unknown author") + (h.edition ? ' \u00b7 ' + escH(h.edition) : '') + (h.usedInAnswer ? ' \u00b7 given to the AI with the verses' : '') + '</i>';
      var snippet = escH((h.text || "").slice(0, 140)) + (h.text && h.text.length > 140 ? "\u2026" : "");
      var link = (h.hw_key && window.BibleyHistoric && window.BibleyHistoric.visible() ? '<button type="button" class="lai-theo-in" onclick="BibleyHistoric.open(\'' + escH(h.hw_key) + '\',' + (h.hw_sec | 0) + ')">Read in Bibley</button> ' : "") +
        (h.source_url ? '<a class="lai-theo-src" href="' + escH(h.source_url) + '" target="_blank" rel="noopener">Read this in the full public-domain source text</a>' : "");
      return '<details class="lai-theo-card"><summary>' + head + '<em>' + snippet + '</em><u class="lai-theo-more">tap to read the full passage</u></summary><div class="lai-theo-full">' + escH(h.text || "") + "</div>" + link + "</details>";
    }).join("") + "</div>";
  }

  /* ---------------- prompt (Bibley 7.8: context-aware) ----------------
     The model always answers. It is told what the person is reading (context.ref / context.text) and gets the recent
     conversation as real chat turns, so follow-ups work; the KJV verses found are help it may quote word for word. */
  var SYSTEM = "You are Bibley, a warm, knowledgeable, context-aware assistant inside a Bible app, running right on this device. You can define words, explain passages in context, answer follow-up questions, and answer general questions clearly in plain language - not only Bible trivia. When King James verses or historic Christian writings are given to you, use them naturally when they really help, and if you quote a Bible verse, quote it word for word from the text given - never invent a verse. If a question does not need a Bible passage (a word meaning, history, or a general question), simply answer it directly and helpfully. You are gentle: you never condemn the person asking.";
  var INSTRUCTIONS = "How to answer:\n1. Answer the question first, directly, in 2 to 5 plain sentences. If it asks what a word means, start with the meaning of the word. Use what the person is reading and the earlier conversation to understand what they mean (\"this\", \"that\", \"it\", \"explain that simpler\").\n2. If one or two of the verses above really help, add them after your answer, each on its own line in exactly this shape: the reference copied letter for letter, then a colon, then the exact words inside quote marks. Never change a word of a quote and never quote a verse that is not listed above. If no verse fits, do not quote any.";
  var TEACH_RULE = "\n3. If one of the teachings above really helps, you may add one short sentence that starts 'Teaching:' and names its author and work (for example: Teaching: Augustine, Confessions, says that ...). A teaching is a person's words, never Scripture: do not quote it as a verse.";
  function clip(t, n) { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "\u2026" : t; }
  function readingLine(ctx, small) {
    if (!ctx || (!ctx.ref && !ctx.text && !ctx.chapter)) return "";
    var s = "";
    if (ctx.ref || ctx.text) s += "The person is reading " + (ctx.ref || "a verse") + (ctx.version ? " (" + ctx.version + ")" : "") + (ctx.text ? ": \"" + clip(ctx.text, small ? 260 : 420) + "\"" : "") + "\n";
    if (ctx.chapter && !small) s += "Chapter on screen" + (ctx.chapterRef ? " (" + ctx.chapterRef + ")" : "") + ": " + clip(ctx.chapter, 900) + "\n";
    return s + "\n";
  }
  function userPrompt(q, picked, teach, ctx, weak, small) {
    var t = teach && teach.length ? "\n\nTeachings from historic Christian writers (their own words, not Scripture):\n" + teach.map(function (x) { return x.label + ": \"" + x.excerpt + "\""; }).join("\n") : "";
    var vs = picked && picked.length ? "\n\n" + (weak ? "King James verses that might relate (use one only if it really fits the question):\n" : "Real King James Bible verses found for this question:\n") +
      picked.map(function (v) { return v.ref + ": " + v.text; }).join("\n") : "";
    return readingLine(ctx, small) + "Question: " + q + vs + t + "\n\n" + INSTRUCTIONS + (t ? TEACH_RULE : "");
  }
  // Recent conversation as alternating user / assistant turns (Gemma's template needs strict alternation), newest last,
  // without the question being asked now.
  function historyTurns(hist, q, small) {
    var out = [], n = small ? 4 : 6, max = small ? 280 : 600;
    (Array.isArray(hist) ? hist : []).forEach(function (m) {
      if (!m) return; var role = m.role === "assistant" || m.role === "ai" ? "assistant" : m.role === "user" ? "user" : null;
      var c = clip(m.content != null ? m.content : m.text, max); if (!role || !c) return;
      if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += "\n" + c; else out.push({ role: role, content: c });
    });
    if (out.length && out[out.length - 1].role === "user" && norm(out[out.length - 1].content) === norm(clip(q, max))) out.pop();
    if (out.length && out[out.length - 1].role === "user") out.pop();
    out = out.slice(-n); while (out.length && out[0].role !== "user") out.shift();
    return out;
  }
  // Gemma (and any noSystem model) has no system role: its profile folds SYSTEM into the first user turn (same words, same example).
  // Small models get the 5 best verses instead of 8, so the prompt stays short.
  function buildMessages(q, picked, modelId, teach, ctx, weak) {
    var mi = modelInfo(modelId), msgs = mi.noSystem ? [] : [{ role: "system", content: SYSTEM }], ex = refVerse("Luke 6:36");
    if (ex) msgs.push({ role: "user", content: userPrompt("what does mercy mean?", [ex]) },
      { role: "assistant", content: "Mercy means kindness and compassion shown to someone who does not deserve it, like holding back a punishment they have earned or helping someone who cannot repay you. In the Bible, God shows us mercy by forgiving us, and He asks us to show the same mercy to others.\n" + ex.ref + ": \"" + ex.text + "\"" });
    historyTurns(ctx && ctx.history, q, mi.small).forEach(function (m) { msgs.push(m); });
    msgs.push({ role: "user", content: userPrompt(q, (picked || []).slice(0, mi.small ? 5 : 8), teach, ctx, weak, mi.small) });
    if (mi.noSystem) msgs[0] = { role: "user", content: SYSTEM + "\n\n" + msgs[0].content };
    return msgs;
  }

  /* ---------------- teachings in the prompt (v7.6) ----------------
     The same Augustine / Calvin retrieval as the source cards, now also handed to the model as short, labelled,
     cited context next to the KJV verses: up to 2 excerpts of about 300 characters (1 of about 220 for small models),
     cut around the sentences that match the question. Only for teaching / doctrine questions or a passage that covers
     most of the question. The corpus loads lazily; if it is not ready in time (first use, offline) the answer goes
     ahead with verses only, and the cards still appear under it when retrieval finishes. */
  var TEACH_RE = /\b(teach|teaches|teaching|teachings|taught|doctrines?|doctrinal|theolog\w*|church fathers?|fathers of the church|early church|patristic|augustine|calvin|aquinas|thomas aquinas|summa|athanasius|irenaeus|justin martyr|tertullian|chrysostom|ambrose|basil|gregory of nazianzus|clement of alexandria|enchiridion|virtues?|natural law|eternal law|beatitude|calvinis\w*|reformed|reformers?|reformation|predestin\w*|elect|election|trinity|triune|original sin|free will|freedom of (the )?will|providence|sovereignty|sacraments?|baptism|justification|justified|sanctification|atonement|incarnation|creeds?|catechism|confessions|institutes|heresy|heretics?|what do christians believe|christians? believe|church teach\w*|historic(al)? christian)\b/i;
  function wantsTeaching(q) { return TEACH_RE.test(String(q || "")); }
  function shortLabel(h) {
    var a = String(h.author || "").replace(/ of hippo$/i, "").split(" ").pop() || "Unknown author";
    if (h.group === "summa") return "Aquinas, Summa Theologiae (" + String(h.section || "").split(":")[0] + ")";
    var w = /confessions/i.test(h.work || "") ? "Confessions" : (/institutes/i.test(h.work || "") ? "Institutes" : String(h.work || "").split(",")[0]);
    var sec = String(h.section || "").split(".")[0].replace(/\s+/g, " ").trim().toLowerCase().replace(/^(book|chapter)\b/, function (x) { return x[0].toUpperCase() + x.slice(1); });
    return a + ", " + w + (sec && sec.length < 24 ? " (" + sec.replace(/\b([ivxlc]+)\b/g, function (x) { return x.toUpperCase(); }) + ")" : "");
  }
  // A window of whole sentences around the ones that match the question, capped at max characters.
  function teachExcerpt(text, terms, max) {
    text = String(text || "").replace(/\s+/g, " ").trim(); if (text.length <= max) return text;
    var ss = text.match(/[^.!?;]+[.!?;]+["')\]]*\s*|[^.!?;]+$/g) || [text], t = (terms || []).map(function (x) { return String(x).toLowerCase(); });
    var sc = ss.map(function (x) { var l = x.toLowerCase(), n = 0; t.forEach(function (w) { if (l.indexOf(w) >= 0) n++; }); return n; });
    var best = 0; for (var i = 1; i < ss.length; i++) if (sc[i] > sc[best]) best = i;
    var lo = best, hi = best, out = ss[best].trim();
    while (out.length < max) {
      var nx = hi + 1 < ss.length ? ss[hi + 1] : null, pv = lo > 0 ? ss[lo - 1] : null;
      if (nx && (out + " " + nx.trim()).length <= max) { hi++; out = out + " " + nx.trim(); }
      else if (pv && (pv.trim() + " " + out).length <= max) { lo--; out = pv.trim() + " " + out; }
      else break;
    }
    var cut = out.length > max; if (cut) out = out.slice(0, max - 3).replace(/\s+\S*$/, "").replace(/[,;:]$/, "");
    return (lo > 0 ? "..." : "") + out + ((cut || hi < ss.length - 1) && !/[.!?]["')\]]*$/.test(out) ? "..." : "");
  }
  function pickTeachings(hits, question, mi) {
    if (!hits || !hits.length) return [];
    var intent = wantsTeaching(question), n = mi.small ? 1 : 2, max = mi.small ? 220 : 300;
    return hits.filter(function (h) { return h && h.text && (intent || (h.query_coverage || 0) >= 0.75); }).slice(0, n)
      .map(function (h) { return { id: h.id, label: shortLabel(h), excerpt: teachExcerpt(h.text, h.matched_terms, max), author: h.author, work: h.work, section: h.section, source_url: h.source_url }; });
  }
  function settleWithin(p, ms) { return Promise.race([Promise.resolve(p).catch(function () { return null; }), new Promise(function (r) { setTimeout(function () { r(null); }, ms); })]); }

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
  // v7.6: very small models sometimes copy the worked example (Philippians 4:6, Matthew 6:34) instead of the verses found for
  // the question. Drop those copied lines unless the example verses were really retrieved, and if no quote is left, lead with
  // the top two retrieved verses word for word so every answer still shows real, relevant KJV text.
  var EXAMPLE_REFS = { "Luke 6:36": 1, "Philippians 4:6": 1, "Matthew 6:34": 1 };
  function dropExampleCopies(text, picked) {
    picked = picked || []; var have = {}, dropped = 0; picked.forEach(function (v) { have[v.ref] = 1; });
    var lines = String(text || "").split("\n").filter(function (l) { var m = LINE_RE.exec(l); if (!m) return true; var v = findByReference(m[1])[0]; if (v && EXAMPLE_REFS[v.ref] && !have[v.ref]) { dropped++; return false; } return true; });
    // v7.8: a copied example line is just dropped; answers are no longer forced to lead with verses
    return lines.join("\n").replace(/^\s+/, "").replace(/\n{3,}/g, "\n\n").trim();
  }
  function stripThink(t) { return String(t || "").replace(/<think>[\s\S]*?(<\/think>|$)/g, "").replace(/<\/?think>/g, "").replace(/^\s+/, ""); }

  /* ---------------- settings + device ---------------- */
  var subs = [];
  function emit() { var s = status(); subs.forEach(function (f) { try { f(s); } catch (e) {} }); pill(); }
  function getConfig() { var c = {}; try { c = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {} return { mode: c.mode === "local" ? "local" : "cloud", backend: ["webgpu", "cpu"].indexOf(c.backend) >= 0 ? c.backend : "auto", modelId: MODELS.some(function (m) { return m.id === c.modelId; }) ? c.modelId : MODELS[0].id }; }
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
  // Which WebLLM build this device can use for a model (null if none): Gemma 3 1B has only an f16 build, so a GPU without shader-f16 can't run it.
  function gpuId(mi, c) { if (!mi.webgpu || !c.webgpu) return null; return c.f16 ? (mi.webgpu.f16 || mi.webgpu.f32) : mi.webgpu.f32; }
  // Auto picks WebGPU when this device can run the model's WebGPU build, else CPU. A model with no build for the chosen
  // backend (WebGPU-only Qwen3.5 / LFM2.5, CPU-only LFM2 / Granite / ERNIE / Gemma 270M) falls back to the build it has.
  async function backendFor(cfg, mi) { var c = await detectCapabilities(); mi = mi || modelInfo(cfg.modelId);
    if (cfg.backend === "webgpu") return mi.webgpu ? "webgpu" : "cpu";
    if (cfg.backend === "cpu") return mi.cpu ? "cpu" : "webgpu";
    return gpuId(mi, c) || !mi.cpu ? "webgpu" : "cpu"; }
  // availability(id) -> { ok, backend, note }: whether this device can run the model, and how.
  async function availability(modelId) {
    var mi = modelInfo(modelId), c = await detectCapabilities(), be = await backendFor(getConfig(), mi), cfgBe = getConfig().backend;
    if (be === "webgpu" && !gpuId(mi, c)) return { ok: false, backend: be, note: !c.webgpu ? "Needs WebGPU, which this browser doesn't have" : "Needs WebGPU with shader-f16 here" + (mi.cpu ? ". Choose Auto or CPU" : "") };
    if (be === "cpu" && !c.wasm) return { ok: false, backend: be, note: "This browser can't run on-device AI" };
    var fell = cfgBe !== "auto" && cfgBe !== be;
    return { ok: true, backend: be, note: (be === "webgpu" ? "Runs on WebGPU here" : "Runs on CPU here") + (fell ? " (no " + (cfgBe === "webgpu" ? "WebGPU" : "CPU") + " build)" : "") };
  }

  /* ---------------- engines ---------------- */
  // One model in memory at a time: switching models (or backends) disposes the old engine first so phone RAM stays sane.
  var eng = null, loadP = null;   // eng = { key, backend, model, modelId, gen(msgs, onDelta) }
  function loadModel(onProgress, modelId) {
    if (onProgress && typeof onProgress === "object") { modelId = onProgress.modelId; onProgress = onProgress.onProgress; }
    var mi = modelInfo(modelId);
    var prog = function (p) { set({ percent: p.percent, text: p.text, state: "loading" }); if (onProgress) try { onProgress(p); } catch (e) {} };
    return (async function () {
      var be = await backendFor(getConfig(), mi), key = mi.id + "|" + be;
      if (eng && eng.key === key) return eng;
      if (loadP && loadP.key === key) return loadP;
      if (loadP) { try { await loadP; } catch (e) {} }
      if (eng && eng.key === key) return eng;
      if (eng) await unload();
      var p = (be === "webgpu" ? loadWebLLM(prog, mi) : loadCPU(prog, mi)).then(function (e) { e.key = key; e.model = mi.id; eng = e; loadP = null; set({ state: "ready", backend: be, model: mi.id, modelId: e.modelId, percent: 100, text: mi.name + " is ready", error: "" }); return e; },
        function (e) { loadP = null; set({ state: "error", model: mi.id, error: String(e && e.message || e), text: "Couldn't load " + mi.name }); throw e; });
      p.key = key; loadP = p; set({ state: "loading", backend: be, model: mi.id, percent: 0, text: "Starting...", error: "" });
      return p;
    })();
  }
  async function loadWebLLM(prog, mi) {
    var c = await detectCapabilities();
    if (!c.webgpu) throw new Error(mi.cpu ? "WebGPU is not available in this browser" : mi.model + " needs WebGPU, which this browser doesn't have. Pick a model that runs on CPU in Settings > AI Engine");
    var id = gpuId(mi, c);
    if (!id) throw new Error(mi.model + " needs WebGPU with shader-f16 here. " + (mi.cpu ? "Choose Auto or CPU in Settings > AI Engine" : "Pick a model that runs on CPU in Settings > AI Engine"));
    prog({ percent: 0, stage: "engine", text: "Loading WebLLM..." });
    var W = await import(WEBLLM_URL);
    var e = await W.CreateMLCEngine(id, { initProgressCallback: function (r) { prog({ percent: Math.round((r.progress || 0) * 100), stage: /fetch|download|loading model from cache/i.test(r.text || "") ? "download" : "load", text: r.text || "" }); } });
    return { backend: "webgpu", modelId: id, raw: e, gen: async function (msgs, onDelta) {
      var req = { messages: msgs, stream: true, temperature: 0.1, max_tokens: MAX_NEW }; if (mi.thinking) req.extra_body = { enable_thinking: false };
      var s = await e.chat.completions.create(req);
      for await (var ch of s) { var d = ch.choices && ch.choices[0] && ch.choices[0].delta && ch.choices[0].delta.content; if (d) onDelta(d); }
    }, unload: function () { return e.unload(); } };
  }
  async function loadCPU(prog, mi) {
    if (!mi.cpu) throw new Error(mi.model + " has no CPU build. It needs WebGPU: pick Auto or WebGPU, or another model, in Settings > AI Engine");
    prog({ percent: 0, stage: "engine", text: "Loading the CPU engine..." });
    var T = await import(TJS_URL);
    T.env.allowLocalModels = false; T.env.useBrowserCache = true;
    var files = {};
    var cb = function (x) {
      if (!x || !x.file) return;
      if (x.status === "progress" || x.status === "done") { var f = files[x.file] || (files[x.file] = { l: 0, t: 0 }); if (x.total) f.t = x.total; f.l = x.status === "done" ? f.t : (x.loaded || 0); }
      var l = 0, t = 0; for (var k in files) { l += files[k].l; t += files[k].t; }
      if (t) prog({ percent: Math.min(99, Math.round(l / t * 100)), stage: "download", text: "Downloading " + mi.name + " (" + mi.model + ")... " + Math.round(l / 1048576) + " of " + Math.round(t / 1048576) + " MB" });
    };
    var tok = await T.AutoTokenizer.from_pretrained(mi.cpu, Object.assign({ progress_callback: cb }, mi.rev ? { revision: mi.rev } : {}));
    var model = await T.AutoModelForCausalLM.from_pretrained(mi.cpu, Object.assign({ dtype: mi.dtype, device: "wasm", progress_callback: cb }, mi.rev ? { revision: mi.rev } : {}));
    // Exports that take num_logits_to_keep (a newer optimum input Transformers.js 3.8.1 never feeds): pass 1 = last-token logits.
    var extra = {}, names = (model.sessions && model.sessions.model && model.sessions.model.inputNames) || [];
    if (names.indexOf("num_logits_to_keep") >= 0 && typeof BigInt64Array !== "undefined") { if (model.forward_params && model.forward_params.indexOf("num_logits_to_keep") < 0) model.forward_params.push("num_logits_to_keep"); extra.num_logits_to_keep = new T.Tensor("int64", new BigInt64Array([BigInt(1)]), []); }
    if (mi.eos) extra.eos_token_id = mi.eos;
    return { backend: "cpu", modelId: mi.cpu + (mi.rev ? "@" + mi.rev.slice(0, 7) : "") + " (" + mi.dtype + ")", raw: model, tokenizer: tok, gen: async function (msgs, onDelta) {
      var o = { add_generation_prompt: true, return_dict: true }; if (mi.thinking) o.enable_thinking = false;
      var inp = tok.apply_chat_template(msgs, o);
      var streamer = new T.TextStreamer(tok, { skip_prompt: true, skip_special_tokens: true, callback_function: function (t) { if (t) onDelta(t); } });
      await model.generate(Object.assign({}, inp, extra, { max_new_tokens: MAX_NEW, do_sample: false, repetition_penalty: 1.1, streamer: streamer }));
    }, unload: function () { return model.dispose && model.dispose(); } };
  }
  async function unload() { var e = eng; eng = null; if (e && e.unload) { try { await e.unload(); } catch (x) {} } set({ state: "idle", model: "", modelId: "", percent: 0, text: "" }); }
  // clearCache(modelId) removes one model's files; clearCache() removes every on-device model.
  async function clearCache(modelId) {
    var mi = modelId ? modelInfo(modelId) : null;
    if (!mi || (eng && eng.model === mi.id)) await unload(); var n = 0;
    if (window.caches) for (var k of await caches.keys()) {
      if (!/^webllm|^tvmjs|^transformers-cache/.test(k)) continue;
      if (!mi) { await caches.delete(k); n++; continue; }
      var c = await caches.open(k), rs = await c.keys();
      for (var r of rs) if (mi.cacheRe.test(r.url)) { await c.delete(r); n++; }
    }
    set({ state: "idle", text: (mi ? mi.name : "Local models") + " removed from this device" });
    return n;
  }
  async function isCached(modelId) {
    var mi = modelInfo(modelId);
    try { if (!window.caches) return false; var ks = await caches.keys();
      for (var k of ks) { if (!/^webllm\/model|^transformers-cache/.test(k)) continue; var c = await caches.open(k), r = await c.keys();
        if (r.some(function (q) { return mi.cacheRe.test(q.url) && /params_shard|\.onnx/.test(q.url); })) return true; }
    } catch (e) {} return false;
  }

  /* ---------------- ask ---------------- */
  // Retrieval only (no model): what every model is grounded on for a question. v7.8: ctx = { ref, text, version, chapter,
  // chapterRef, history } - the verse on screen leads the verses offered, a follow-up with no words of its own ("explain that
  // simpler") searches with the previous question, and nothing here ever refuses: messages are always built.
  function cleanCtx(c) {
    if (!c || typeof c !== "object") return null;
    var o = { ref: c.ref ? String(c.ref).slice(0, 60) : "", text: c.text ? String(c.text).slice(0, 1200) : "", version: c.version ? String(c.version).slice(0, 40) : "",
      chapter: c.chapter ? String(c.chapter).slice(0, 4000) : "", chapterRef: c.chapterRef ? String(c.chapterRef).slice(0, 60) : "", history: Array.isArray(c.history) ? c.history.slice(-12) : [] };
    return o.ref || o.text || o.chapter || o.history.length ? o : null;
  }
  async function retrieve(question, modelId, ctx) {
    await ensureKJV(); ctx = cleanCtx(ctx);
    var direct = findByReference(question).slice(0, 6), skip = {}, onScreen = [];
    if (ctx && ctx.ref) onScreen = findByReference(ctx.ref).slice(0, 3);
    var sq = question;
    if (!toks(question).length && ctx && ctx.history.length) {   // follow-up: borrow the last thing the person asked
      var lastU = ctx.history.filter(function (m) { return m && m.role === "user" && norm(m.content || m.text) !== norm(question); }).pop();
      if (lastU) sq = String(lastU.content || lastU.text || "") + " " + question;
    }
    direct.concat(onScreen).forEach(function (v) { skip[v.ref] = 1; });
    var ranked = toks(sq).length ? searchKJV(sq, { k: 5, skip: skip }) : Object.assign([], { topics: [], coverage: 0, best: 0, terms: 0 });
    var weak = isOffTopic(direct.concat(onScreen), ranked);
    var seen = {}, picked = direct.concat(onScreen, weak ? ranked.slice(0, 3) : ranked).filter(function (v) { if (seen[v.ref]) return false; seen[v.ref] = 1; return true; }).slice(0, 8);
    return { direct: direct, onScreen: onScreen, ranked: ranked, topics: ranked.topics, weak: weak, offTopic: false, context: ctx, picked: picked,
      messages: buildMessages(question, picked, modelId, null, ctx, weak), model: modelInfo(modelId).id };
  }
  // The verses an answer actually quotes (after repair), else the top retrieved ones: for "Referenced Verses" chips.
  function citedVerses(text, picked) {
    var out = [], seen = {};
    String(text || "").split("\n").forEach(function (l) { var m = LINE_RE.exec(l); if (!m) return; var v = findByReference(m[1])[0]; if (v && !seen[v.ref]) { seen[v.ref] = 1; out.push(v); } });
    if (!out.length) (picked || []).slice(0, 3).forEach(function (v) { var x = findByReference(v.ref)[0]; if (x && !seen[x.ref]) { seen[x.ref] = 1; out.push(x); } });
    return out.map(function (v) { return { ref: v.ref, text: v.text, b: v.b, c: v.c, v: v.v }; });
  }
  // prepareAsk(question, { modelId, teachWaitMs, context }) -> retrieval for one answer: KJV verses plus matching teachings
  // (when the theology corpus answers in time). R.messages is exactly what the model is given. No model is loaded here.
  // v7.8: R.offTopic is always false - there is no refusal route; R.weak says the verses are only loosely related.
  async function prepareAsk(question, opts) {
    opts = opts || {}; var mi = modelInfo(opts.modelId);
    var R = await retrieve(question, mi.id, opts.context), intent = wantsTeaching(question);
    R.theologyP = theologyTry(question, intent ? 1 : 2);
    var wait = opts.teachWaitMs != null ? opts.teachWaitMs : (intent ? 2500 : 1200);
    R.teachings = pickTeachings(await settleWithin(R.theologyP, wait), question, mi);
    if (R.teachings.length) R.messages = buildMessages(question, R.picked, mi.id, R.teachings, R.context, R.weak);
    return R;
  }
  // generate(question, { onToken(textSoFar), onProgress({percent,stage,text}), modelId, context }) -> { text, sources, refs, offTopic, engine, model, theology?, teachings? }
  // context = { ref, text, version, chapter, chapterRef, history: [{ role: "user"|"assistant", content }] }
  async function generate(question, opts) {
    opts = opts || {}; var prog = opts.onProgress || function () {}, mi = modelInfo(opts.modelId);
    if (!KJV) prog({ percent: 0, stage: "bible", text: "Opening the King James Bible..." });
    var R = await prepareAsk(question, { modelId: mi.id, context: opts.context }), thP = R.theologyP;
    var e = await loadModel(prog, mi.id), raw = "";
    await e.gen(R.messages, function (d) { raw += d; if (opts.onToken) try { opts.onToken(stripThink(raw)); } catch (x) {} });
    var text = dropExampleCopies(repairQuotes(stripThink(raw).trim(), R.picked), R.picked);
    if (!text) throw new Error("empty-local-answer");
    // Chips only for verses the answer really quotes (or, when the search was on-topic, the top verses found)
    var refs = citedVerses(text, R.weak ? [] : R.picked);
    var th = await settleWithin(thP, 4000), out = { text: text, sources: R.weak ? [] : R.picked.slice(0, 3).map(function (v) { return { ref: v.ref, text: v.text }; }), refs: refs, offTopic: false, weak: R.weak, engine: e.backend, modelId: e.modelId, model: mi.id, modelName: mi.name };
    var used = {}; R.teachings.forEach(function (t) { used[t.id] = 1; });
    if (th) out.theology = th.map(function (h) { return used[h.id] ? Object.assign({}, h, { usedInAnswer: true }) : h; });
    if (R.teachings.length) out.teachings = R.teachings;
    return out;
  }

  /* ---------------- Referenced Verses chips (tap = open the verse in the reader) ---------------- */
  function escH(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function chipsHtml(refs) {
    refs = (refs || []).filter(function (r) { return r && r.b != null; }); if (!refs.length) return "";
    return '<div class="lai-refs"><span>Referenced Verses</span>' + refs.slice(0, 8).map(function (r) { return '<button type="button" class="lai-chip" data-b="' + r.b + '" data-c="' + r.c + '" data-v="' + r.v + '" title="' + escH(r.text || "") + '">' + escH(r.ref.replace(/^Psalms /, "Psalm ")) + "</button>"; }).join("") + "</div>";
  }
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest && e.target.closest(".lai-chip"); if (!b) return; e.preventDefault();
    var FX = window.BibleyFX; if (FX && FX.jumpToVerse) FX.jumpToVerse(+b.dataset.b, +b.dataset.c, +b.dataset.v || null);
  });

  /* ---------------- quick switcher in the AI panel (Cloud AI / Model 1 ... Model 12) ---------------- */
  function label(cfg) { cfg = cfg || getConfig(); if (cfg.mode !== "local") return "Cloud AI"; var mi = modelInfo(cfg.modelId); return mi.name + " \u00b7 " + mi.family + " " + mi.params; }
  function pill() {
    var b = document.getElementById("aiEnginePill"); if (!b) return;
    var cfg = getConfig(), local = cfg.mode === "local";
    b.textContent = label(cfg) + " \u25be";
    b.classList.toggle("local", local); b.classList.toggle("loading", local && st.state === "loading");
    b.title = local ? (st.state === "loading" ? st.text : "On-device AI. Tap to switch") : "Tap to switch the AI engine";
    b.setAttribute("aria-haspopup", "menu");
  }
  function closeMenu() { var m = document.getElementById("laiMenu"); if (m) m.remove(); document.removeEventListener("click", outside, true); }
  function outside(e) { var m = document.getElementById("laiMenu"); if (m && !m.contains(e.target) && e.target.id !== "aiEnginePill") closeMenu(); }
  function choose(v) {
    if (v === "settings") { closeMenu(); if (window.BibleySettings) window.BibleySettings.open("aiengine"); return; }
    var c = v === "cloud" ? setConfig({ mode: "cloud" }) : setConfig({ mode: "local", modelId: v }); closeMenu();
    var t = window.BibleyFX && window.BibleyFX.ui && window.BibleyFX.ui.toast; if (t) t(c.mode === "local" ? label(c) + " is on. It downloads once, the first time you ask." : "Cloud AI is on");
    if (c.mode === "local" && eng && eng.model !== c.modelId) unload();
  }
  function openMenu(b) {
    if (document.getElementById("laiMenu")) { closeMenu(); return; }
    var cfg = getConfig(), r = b.getBoundingClientRect(), m = document.createElement("div");
    m.id = "laiMenu"; m.className = "lai-menu"; m.setAttribute("role", "menu");
    var opt = function (v, t, s, on, fam) { return '<button type="button" role="menuitemradio" aria-checked="' + on + '" class="lai-opt' + (on ? " on" : "") + '" data-v="' + v + '"><span class="lai-t">' + escH(t) + (fam ? ' <em class="lai-fam ' + fam.toLowerCase() + '">' + fam + "</em>" : "") + "<small>" + escH(s) + '</small></span><span class="lai-ck">' + (on ? "\u2713" : "") + "</span></button>"; };
    m.innerHTML = opt("cloud", "Cloud AI", "Fast, needs internet", cfg.mode !== "local") +
      MODELS.map(function (mi, i) { return opt(mi.id, "Model " + (i + 1) + ": " + mi.name + " \u00b7 " + mi.model, mi.tag + " \u00b7 " + mi.size.split(" / ")[0] + " \u00b7 KJV verses + teachings", cfg.mode === "local" && cfg.modelId === mi.id, mi.family); }).join("") +
      '<button type="button" class="lai-opt lai-set" data-v="settings"><span class="lai-t">AI Engine settings\u2026<small>Download, test, backend</small></span></button>';
    document.body.appendChild(m);
    var W = Math.min(330, innerWidth - 16); m.style.width = W + "px"; m.style.left = Math.max(8, Math.min(r.right - W, innerWidth - W - 8)) + "px"; m.style.top = (r.bottom + 6) + "px";
    m.addEventListener("click", function (e) { var o = e.target.closest(".lai-opt"); if (o) { e.stopPropagation(); choose(o.dataset.v); } });
    setTimeout(function () { document.addEventListener("click", outside, true); }, 0);
  }
  function mountPill() {
    var b = document.getElementById("aiEnginePill"); if (!b || b.dataset.wired) return pill(); b.dataset.wired = "1";
    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openMenu(b); });
    if (!document.getElementById("laiCss")) { var s = document.createElement("style"); s.id = "laiCss"; s.textContent =
      ".lai-menu{position:fixed;z-index:90;max-height:min(70vh,560px);overflow-y:auto;overscroll-behavior:contain;background:var(--bg-panel,#0d1326);color:var(--ink,#eee);border:1px solid var(--panel-border,#c9a86744);border-radius:14px;box-shadow:0 16px 40px rgba(0,0,0,.45);padding:6px;box-sizing:border-box}" +
      ".lai-opt{display:flex;align-items:center;gap:8px;width:100%;border:0;background:none;color:inherit;text-align:left;padding:9px 10px;border-radius:10px;cursor:pointer;font:500 14px/1.3 system-ui,-apple-system,sans-serif}.lai-opt:hover,.lai-opt.on{background:#c9a8671f}" +
      ".lai-t{flex:1;min-width:0}.lai-t small{display:block;font-weight:400;font-size:12px;opacity:.7;margin-top:2px}.lai-ck{color:var(--gold,#c9a867);font-weight:700}.lai-set{border-top:1px solid #c9a86726;border-radius:0 0 10px 10px;margin-top:4px}" +
      ".lai-fam{font-style:normal;font-size:10.5px;font-weight:700;padding:1px 6px;border-radius:6px;margin-left:4px;vertical-align:1px}.lai-fam.qwen{background:#7fa3b833;color:#9cc3da}.lai-fam.gemma{background:#9c90b833;color:#c0b5e6}" +
      // v7.6: family colours for the new models, shared with the Settings cards (.ai-fam)
      ".lai-fam.liquid,.ai-fam.liquid{background:#5fb39a33;color:#8fd6bf}.lai-fam.granite,.ai-fam.granite{background:#7f8fa833;color:#aebad0}.lai-fam.ernie,.ai-fam.ernie{background:#c98a6733;color:#e7b08f}.lai-fam.smollm,.ai-fam.smollm{background:#c9b86733;color:#e3d28d}" +
      "html.theme-light .ai-fam.liquid,html.theme-sepia .ai-fam.liquid{color:#2c6e5a}html.theme-light .ai-fam.granite,html.theme-sepia .ai-fam.granite{color:#44526a}html.theme-light .ai-fam.ernie,html.theme-sepia .ai-fam.ernie{color:#8a4a26}html.theme-light .ai-fam.smollm,html.theme-sepia .ai-fam.smollm{color:#6e5d14}" +
      ".lai-refs{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:10px}.lai-refs span{font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;opacity:.7;margin-right:2px}" +
      ".lai-chip{border:1px solid var(--gold,#c9a867);background:#c9a86714;color:var(--gold,#c9a867);border-radius:999px;padding:5px 11px;font:600 12.5px/1 system-ui,-apple-system,sans-serif;cursor:pointer}.lai-chip:hover{background:#c9a86733}" +
      ".lai-theo{margin-top:10px}.lai-theo>span{display:block;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;opacity:.7;margin-bottom:6px}" +
      ".lai-theo-card{display:block;border:1px solid var(--panel-border,#c9a86744);border-radius:10px;padding:8px 10px;margin:6px 0;color:inherit;text-decoration:none;font:400 13px/1.45 system-ui,-apple-system,sans-serif}.lai-theo-card:hover{background:#c9a86714}" +
      ".lai-theo-card b{color:var(--gold,#c9a867)}.lai-theo-card u{text-decoration:none;opacity:.85}.lai-theo-card i{display:block;font-style:normal;font-size:11.5px;opacity:.65;margin-top:2px}.lai-theo-card em{display:block;font-style:italic;font-size:12px;opacity:.8;margin-top:4px}" +
      ".lai-theo-card summary{cursor:pointer;list-style:none}.lai-theo-card summary::-webkit-details-marker{display:none}" +
      ".lai-theo-card .lai-theo-more{display:inline-block;margin-top:3px;font-size:11px;color:var(--gold,#c9a867);opacity:.9}" +
      ".lai-theo-card[open] .lai-theo-more{display:none}" +
      ".lai-theo-full{margin-top:8px;padding-top:8px;border-top:1px solid var(--panel-border,#c9a86744);font-size:13px;line-height:1.6;white-space:pre-wrap}" +
      ".lai-theo-src{display:inline-block;margin-top:8px;font-size:12px;color:var(--gold,#c9a867)}";
      document.head.appendChild(s); }
    pill();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountPill); else mountPill();
  window.addEventListener("storage", function (e) { if (e.key === KEY) emit(); });

  var api = { version: "7.8", models: { webgpu: [MODEL_F16, MODEL_F32], cpu: CPU_REPO, webllmUrl: WEBLLM_URL, transformersUrl: TJS_URL },
    // webgpu: [] when a model has no WebGPU build; cpu: null when it has no CPU build; backends lists what it has.
    MODELS: MODELS.map(function (m) { return { id: m.id, name: m.name, family: m.family, model: m.model, params: m.params, tag: m.tag, size: m.size, desc: m.desc, webgpu: m.webgpu ? [m.webgpu.f16, m.webgpu.f32].filter(Boolean) : [], cpu: m.cpu || null, rev: m.rev || null, dtype: m.dtype, backends: [m.webgpu ? "webgpu" : "", m.cpu ? "cpu" : ""].filter(Boolean) }; }),
    availability: availability, prepareAsk: prepareAsk, wantsTeaching: wantsTeaching, teachExcerpt: teachExcerpt,
    modelInfo: function (id) { var m = modelInfo(id); return api.MODELS.filter(function (x) { return x.id === m.id; })[0]; }, label: label,
    getConfig: getConfig, setConfig: setConfig, isLocal: function () { return getConfig().mode === "local"; }, detectCapabilities: detectCapabilities,
    loadModel: loadModel, generate: generate, ask: generate, retrieve: retrieve, clearCache: clearCache, isCached: isCached, status: status, unload: unload,
    on: function (f) { subs.push(f); return function () { subs = subs.filter(function (x) { return x !== f; }); }; },
    ensureKJV: ensureKJV, kjvReady: function () { return !!KJV; }, passage: passage, findByReference: findByReference, searchKJV: searchKJV, search: searchKJV, isOffTopic: isOffTopic, offTopicReply: offTopicReply,
    buildMessages: buildMessages, buildPrompt: buildMessages, historyTurns: historyTurns, STOPWORDS: STOP, tokens: function (q) { return toks(q); }, repairQuotes: repairQuotes, dropExampleCopies: dropExampleCopies, citedVerses: citedVerses, chipsHtml: chipsHtml, stripThink: stripThink, SYSTEM: SYSTEM, INSTRUCTIONS: INSTRUCTIONS, TOPICS: Object.keys(TOPICS), lastRepair: null,
    theologyTry: theologyTry, theologyHtml: theologyHtml,
    openSwitcher: function () { var b = document.getElementById("aiEnginePill"); if (b) openMenu(b); } };
  window.BibleyLocalAI = api;
})();
