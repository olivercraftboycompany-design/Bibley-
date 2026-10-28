/* bibley-ai.js - Bibley's AI engine (v4, 2026-10-14; streaming added in v6, 2026-10-27).
   One job: get a COMPLETE, honest answer from a free AI provider, or fail clearly.

   v6.1 (2026-10-27): "Groq" comes first everywhere. It is Oliver's own Groq account
   (openai/gpt-oss-120b), reached through his private proxy https://bibley-ai.sites.tab.bot,
   which holds the key server-side (no key in this file) and limits requests per visitor and
   per day. If the proxy errors, times out or says it is at its limit, the free services
   below take over automatically.

   Provider chain, tried in order (each with its own timeout and retries):
     1. "PollinationsKey"  gen.pollinations.ai with Oliver's publishable pk_ key.
        Found 2026-10-14: the key itself is valid, but no models are granted to it
        on his Pollinations account (their key check shows permissions.models = []),
        so every call answers HTTP 200 with "this key isn't allowed to use ...".
        That notice is never shown as an answer: the key is skipped for this
        browser session and picked up again automatically once models are granted.
     2. "Pollinations"     text.pollinations.ai keyless (model openai-fast). No key,
        no signup. Identical requests are cached by them, so retries send a fresh seed.
     3. "LLM7"             api.llm7.io keyless. Has a small daily quota per visitor;
        when it says the quota is used up, it is skipped until the quota resets.

   Every answer is checked before it is returned:
     - for labelled formats (MEANING:/CONTEXT:/APPLICATION:, OVERVIEW:/KEY POINTS:/...)
       every label must be present and filled in,
     - it must not stop mid-sentence (cut off by a token limit, open bracket, etc.),
     - Hebrew/Greek script is removed (models invent words in it), and empty brackets left
       behind are tidied.
   A bad answer is retried with a fresh seed, then the next provider is tried. If every
   provider fails, the error is thrown so the page shows "Try again" instead of saving garbage.

   window.BibleyAI.last holds { provider, model, at, ms, attempts } of the last answer.
   Stored on the device: sessionStorage "bibley_ai_keypause", localStorage "bibley_ai_pause_v1",
   localStorage "bibley_ai_last_v1". No notifications. ASCII only in this file. */
(function () {
  "use strict";
  var KEY = "pk_wLLzLQrHReXH2Gqc";
  var PROXY = "https://bibley-ai.sites.tab.bot/";
  var LS_PAUSE = "bibley_ai_pause_v1", LS_LAST = "bibley_ai_last_v1", SS_KEYPAUSE = "bibley_ai_keypause";
  var lastKeylessAt = 0;

  var ACCURACY_RULES = "\n\nACCURACY RULES (always follow):\n" +
    "- Do not invent Hebrew, Greek or Aramaic words. Mention an original-language word ONLY if you are certain of its exact meaning, and write it in English letters only (for example: agape). Never use Hebrew or Greek script. If you are not sure, leave original languages out entirely; that is completely fine.\n" +
    "- Do not invent historical facts, dates, names or quotes. If unsure, say less.\n" +
    "- Finish every section with a complete sentence. Keep each section short (under 70 words) so the whole answer fits.";

  function now() { return Date.now(); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function readJSON(store, k, d) { try { var v = JSON.parse(store.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(store, k, v) { try { store.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function pauses() { return readJSON(localStorage, LS_PAUSE, {}); }
  function pausedUntil(name) {
    if (name === "PollinationsKey") return Number(readJSON(sessionStorage, SS_KEYPAUSE, 0)) || 0;
    return Number(pauses()[name]) || 0;
  }
  function pause(name, ms) {
    if (name === "PollinationsKey") { writeJSON(sessionStorage, SS_KEYPAUSE, now() + ms); return; }
    var p = pauses(); p[name] = now() + ms; writeJSON(localStorage, LS_PAUSE, p);
  }

  function err(msg, extra) { var e = new Error(msg); if (extra) for (var k in extra) e[k] = extra[k]; return e; }

  async function post(url, headers, body, timeoutMs) {
    var ctl = new AbortController();
    var t = setTimeout(function () { ctl.abort(); }, timeoutMs);
    try {
      var res = await fetch(url, { method: "POST", headers: headers, body: JSON.stringify(body), signal: ctl.signal, cache: "no-store" });
      var text = await res.text();
      var data = null; try { data = JSON.parse(text); } catch (e) {}
      return { status: res.status, ok: res.ok, data: data, text: text };
    } finally { clearTimeout(t); }
  }
  function choice(data) { return data && data.choices && data.choices[0]; }

  // Pollinations answers some problems with HTTP 200 and a plain-text notice.
  function isProviderNotice(text) {
    return /isn['\u2019]t allowed to use|allow it for this key|enter\.pollinations\.ai|API key (?:used|budget)|insufficient pollen|PAYMENT_REQUIRED|rate limit(?:ed)? (?:exceeded|reached)|queue (?:is )?full|IMPORTANT NOTICE/i.test(String(text || ""));
  }

  /* ---------------- providers ---------------- */
  var PROVIDERS = [
    {
      name: "Groq", timeout: 25000, attempts: 1,
      call: async function (msgs, maxTokens) {
        var r = await post(PROXY, { "Content-Type": "application/json" },
          { messages: msgs, mode: "text", stream: false, max_tokens: Math.min(1200, maxTokens * 2 + 200) }, this.timeout);
        if (r.status === 429) { var ra = Number(r.data && r.data.error && r.data.error.retry_after) || 60; pause(this.name, Math.min(Math.max(ra, 10), 300) * 1000); throw err("api-429", { noRetry: true }); }
        if (!r.ok) throw err("api-" + r.status, { noRetry: true });
        var c = choice(r.data), content = c && c.message && c.message.content;
        if (!content) throw err("empty-response");
        return { text: content, finish: c.finish_reason, model: (r.data && r.data.model) || "groq" };
      }
    },
    {
      name: "PollinationsKey", timeout: 30000, attempts: 1,
      call: async function (msgs, maxTokens, seed) {
        var models = ["openai-mini", "openai"], denied = 0, last;
        for (var i = 0; i < models.length; i++) {
          var r = await post("https://gen.pollinations.ai/v1/chat/completions",
            { "Content-Type": "application/json", "Authorization": "Bearer " + KEY },
            { model: models[i], messages: msgs, seed: seed, reasoning_effort: "low", max_completion_tokens: Math.max(maxTokens * 3, 2000) }, this.timeout);
          if (r.status === 401 || r.status === 402 || r.status === 403) { pause(this.name, 6 * 3600e3); throw err("key-not-allowed", { noRetry: true }); }
          if (!r.ok) { last = err("api-" + r.status); continue; }
          var c = choice(r.data), content = c && c.message && c.message.content;
          if (isProviderNotice(content)) { denied++; continue; }
          if (!content) { last = err("empty-response"); continue; }
          return { text: content, finish: c.finish_reason, model: (r.data && r.data.model) || models[i] };
        }
        if (denied === models.length) { pause(this.name, 6 * 3600e3); throw err("key-not-allowed", { noRetry: true }); }
        throw last || err("empty-response");
      }
    },
    {
      name: "Pollinations", timeout: 45000, attempts: 2,
      call: async function (msgs, maxTokens, seed) {
        // Keyless tier: only "openai-fast"; it answers 402 to temperature/max_tokens/private.
        // It also allows only about one request every 20-30 s per visitor (measured 2026-10-14:
        // HTTP 402 "Payment required" for ~25 s after an answer). So space requests out, and on a
        // 402 wait and try again (up to ~45 s) instead of failing the summary.
        var gap = 20000 - (now() - lastKeylessAt);
        if (gap > 0) await sleep(gap);
        var waits = [5000, 7000, 9000, 11000, 13000], r;
        for (var w = 0; ; w++) {
          r = await post("https://text.pollinations.ai/openai", { "Content-Type": "application/json" },
            { model: "openai-fast", messages: msgs, seed: seed }, this.timeout);
          if (r.status !== 402 && r.status !== 429) break;
          if (w >= waits.length) break;
          try { console.info("[Bibley AI] free tier busy (" + r.status + "), waiting " + (waits[w] / 1000) + " s"); } catch (e) {}
          await sleep(waits[w]);
        }
        lastKeylessAt = now();
        if (!r.ok) throw err("api-" + r.status, { noRetry: r.status === 402 || r.status === 429 });
        var c = choice(r.data), content = c && c.message && c.message.content;
        if (!content) throw err(r.data ? "empty-response" : "malformed-response");
        if (isProviderNotice(content)) throw err("api-429");
        return { text: content, finish: c.finish_reason, model: (r.data && r.data.model) || "openai-fast" };
      }
    },
    {
      name: "LLM7", timeout: 40000, attempts: 2,
      call: async function (msgs, maxTokens, seed) {
        var models = ["gpt-oss:20b", "default"], last;
        for (var i = 0; i < models.length; i++) {
          var r = await post("https://api.llm7.io/v1/chat/completions", { "Content-Type": "application/json" },
            { model: models[i], messages: msgs, temperature: 0.4, seed: seed, max_tokens: Math.max(maxTokens * 3, 1500) }, this.timeout);
          if (r.status === 429 || r.status === 402) {
            var e = r.data && r.data.error, ra = Number(e && e.retry_after) || 0;
            if (/quota/i.test((e && (e.code + " " + e.type + " " + e.message)) || "")) { pause(this.name, Math.max(ra, 60) * 1000); throw err("api-429", { noRetry: true }); }
            if (ra > 20) { pause(this.name, ra * 1000); throw err("api-429", { noRetry: true }); }
            throw err("api-429", { retryAfter: ra });
          }
          if (!r.ok) { last = err("api-" + r.status); continue; }
          var c = choice(r.data), content = c && c.message && c.message.content;
          if (!content) { last = err("empty-response"); continue; }
          return { text: content, finish: c.finish_reason, model: (r.data && r.data.model) || models[i] };
        }
        throw last || err("empty-response");
      }
    }
  ];

  /* ---------------- answer checks ---------------- */
  // Labels the system prompt asks for, e.g. "MEANING:", "KEY POINTS:".
  function labelsOf(system) {
    var out = [], re = /^([A-Z][A-Z ]{2,30}):/gm, m;
    var fmt = String(system).split("MODE INSTRUCTIONS").pop();
    while ((m = re.exec(fmt))) { var l = m[1].trim(); if (out.indexOf(l) < 0 && !/^(ACCURACY RULES|HOW YOU ANSWER|WHAT YOU REFUSE|IMPORTANT|NOTE|MODE INSTRUCTIONS|RULES)$/.test(l)) out.push(l); }
    return out;
  }
  function stripScripts(text) {
    var t = String(text || "");
    // Hebrew (incl. points), Greek and Greek Extended, Syriac: models make words up in these.
    t = t.replace(/[\u0590-\u05FF\uFB1D-\uFB4F\u0370-\u03FF\u1F00-\u1FFF\u0700-\u074F]+/g, "");
    t = t.replace(/\(\s*[,;:\/\-\u2013\u2014]?\s*\)/g, "").replace(/\[\s*\]/g, "");
    t = t.replace(/\(\s*,\s*/g, "(").replace(/[ \t]{2,}/g, " ").replace(/ +([,.;:!?])/g, "$1");
    t = t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/^#+\s*/gm, "");
    return t.trim();
  }
  function endsCleanly(s) {
    s = String(s || "").trim();
    if (!s) return false;
    if (/[.!?]["'\u201D\u2019)\]]*$/.test(s)) return true;
    return false;
  }
  function balanced(s) {
    var o = (s.match(/\(/g) || []).length, c = (s.match(/\)/g) || []).length;
    return o <= c;
  }
  function sectionText(text, labels, i) {
    var re = new RegExp("(^|\\n)\\s*" + labels[i].replace(/ /g, "\\s+") + "\\s*:\\s*", "i");
    var m = text.match(re); if (!m) return null;
    var start = m.index + m[0].length, rest = text.slice(start), end = rest.length;
    for (var j = i + 1; j < labels.length; j++) {
      var mm = rest.match(new RegExp("(^|\\n)\\s*" + labels[j].replace(/ /g, "\\s+") + "\\s*:", "i"));
      if (mm) { end = Math.min(end, mm.index); }
    }
    return rest.slice(0, end).trim();
  }
  function check(text, labels, finish) {
    var problems = [];
    if (!text || text.length < 20) problems.push("empty");
    if (finish === "length") problems.push("cut off (token limit)");
    if (labels.length) {
      labels.forEach(function (l, i) {
        var s = sectionText(text, labels, i);
        if (s == null) problems.push("missing " + l);
        else if (s.replace(/[-\u2022*\s]/g, "").length < 8) problems.push("empty " + l);
      });
      var lastS = sectionText(text, labels, labels.length - 1);
      if (lastS && !endsCleanly(lastS)) problems.push("ends mid-sentence");
      labels.forEach(function (l, i) { var s = sectionText(text, labels, i); if (s && !balanced(s)) problems.push("unclosed bracket in " + l); });
    } else if (!endsCleanly(text.replace(/[\s\u{1F300}-\u{1FAFF}\u2600-\u27BF]+$/u, "")) && finish !== "stop") {
      problems.push("ends mid-sentence");
    }
    return problems;
  }

  /* ---------------- main ---------------- */
  async function generate(system, userMessage, maxTokens, opts) {
    opts = opts || {};
    maxTokens = maxTokens || 500;
    if (typeof navigator !== "undefined" && navigator.onLine === false) throw err("offline");
    var labels = opts.labels || labelsOf(system);
    var msgs = [{ role: "system", content: system + ACCURACY_RULES }, { role: "user", content: userMessage }];
    var started = now(), attempts = 0, lastErr = null, best = null, networkFails = 0, tried = 0;
    for (var p = 0; p < PROVIDERS.length; p++) {
      var prov = PROVIDERS[p];
      if (pausedUntil(prov.name) > now()) { lastErr = lastErr || err("key-paused"); continue; }
      tried++;
      var provNet = false;
      for (var a = 0; a < prov.attempts; a++) {
        attempts++;
        var seed = Math.floor(Math.random() * 1e9);
        try {
          var r = await prov.call(msgs, maxTokens, seed);
          var clean = stripScripts(r.text);
          var problems = check(clean, labels, r.finish);
          if (!problems.length) {
            var info = { provider: prov.name, model: r.model, at: new Date().toISOString(), ms: now() - started, attempts: attempts };
            api.last = info; writeJSON(localStorage, LS_LAST, info);
            try { console.info("[Bibley AI] answered by " + prov.name + " (" + r.model + ") in " + info.ms + " ms, attempt " + attempts); } catch (e) {}
            return clean;
          }
          try { console.info("[Bibley AI] " + prov.name + " answer rejected: " + problems.join(", ")); } catch (e) {}
          if (!best || problems.length < best.problems.length) best = { text: clean, problems: problems, provider: prov.name };
          lastErr = err("malformed-response");
        } catch (e) {
          lastErr = e;
          if (e && e.name === "AbortError") { /* timed out: one more try may work */ }
          if (e instanceof TypeError) provNet = true;
          if (typeof navigator !== "undefined" && navigator.onLine === false) throw err("offline");
          if (e && e.noRetry) break;
          if (e && e.retryAfter) { if (e.retryAfter > 20) break; await sleep(e.retryAfter * 1000 + 300); continue; }
        }
        if (a < prov.attempts - 1) await sleep(600 * Math.pow(2, a) + Math.random() * 300);
      }
      if (provNet) networkFails++;
    }
    if (tried && networkFails === tried) throw err("offline");
    api.lastFailure = { at: new Date().toISOString(), error: lastErr && lastErr.message, best: best && best.problems };
    throw lastErr || err("malformed-response");
  }


  /* ---------------- streaming (v6) ----------------
     stream(system, user, { maxTokens, onText, signal }) returns the full text and calls
     onText(textSoFar) as words arrive. Order: Groq via Oliver's proxy (streams, well under 1 s to the first word), LLM7 (streams, about 2-3 s to the first word),
     then keyless Pollinations (streams, but allows one request every ~20 s per visitor),
     then the non-streaming generate() above. Reasoning tokens are skipped; only the answer shows. */
  async function readSSE(res, onDelta, signal) {
    var reader = res.body.getReader(), dec = new TextDecoder(), buf = "", done = false, finish = null;
    while (!done) {
      if (signal && signal.aborted) { try { reader.cancel(); } catch (e) {} throw err("aborted"); }
      var r = await reader.read(); if (r.done) break;
      buf += dec.decode(r.value, { stream: true });
      var lines = buf.split("\n"); buf = lines.pop();
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i].trim(); if (ln.indexOf("data:") !== 0) continue;
        var d = ln.slice(5).trim(); if (d === "[DONE]") { done = true; break; }
        var j = null; try { j = JSON.parse(d); } catch (e) { continue; }
        if (j && j.error) throw err("api-stream-error");
        var c = j && j.choices && j.choices[0]; if (!c) continue;
        if (c.finish_reason) finish = c.finish_reason;
        var t = c.delta && c.delta.content; if (t) onDelta(t);
      }
    }
    return finish;
  }
  var STREAMERS = [
    { name: "Groq", url: PROXY, body: function (msgs, max, mode) { return { messages: msgs, mode: mode || "chat", max_tokens: Math.min(1200, max + 300) }; } },
    { name: "LLM7", url: "https://api.llm7.io/v1/chat/completions", body: function (msgs, max) { return { model: "gpt-oss:20b", messages: msgs, stream: true, temperature: 0.4, max_tokens: max }; } },
    { name: "Pollinations", url: "https://text.pollinations.ai/openai", body: function (msgs) { return { model: "openai-fast", messages: msgs, stream: true, seed: Math.floor(Math.random() * 1e9) }; }, gap: true }
  ];
  function tidy(t) {
    return stripScripts(String(t || "").replace(/\bYahweh\b/g, "the Lord").replace(/\bYHWH\b/g, "the Lord").replace(/\*+/g, "").replace(/__/g, "").replace(/[\u202f\u00a0]/g, " ").replace(/[\u2010\u2011]/g, "-"));
  }
  var queue = Promise.resolve();
  function stream(system, user, opts) {
    var run = queue.then(function () { return streamNow(system, user, opts); });
    queue = run.catch(function () {});
    return run;
  }
  async function streamNow(system, user, opts) {
    opts = opts || {};
    if (typeof navigator !== "undefined" && navigator.onLine === false) throw err("offline");
    var msgs = Array.isArray(user) ? [{ role: "system", content: system }].concat(user) : [{ role: "system", content: system }, { role: "user", content: user }];
    var max = opts.maxTokens || 900, started = now(), lastErr = null;
    for (var p = 0; p < STREAMERS.length; p++) {
      var S = STREAMERS[p];
      if (pausedUntil(S.name) > now()) continue;
      if (S.gap && now() - lastKeylessAt < 20000) await sleep(20000 - (now() - lastKeylessAt));
      var ctl = new AbortController(), raw = "", first = 0;
      var kill = setTimeout(function () { ctl.abort(); }, 9000);
      if (opts.signal) opts.signal.addEventListener("abort", function () { ctl.abort(); });
      try {
        var res = await fetch(S.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(S.body(msgs, max, opts.mode)), signal: ctl.signal, cache: "no-store" });
        if (S.gap) lastKeylessAt = now();
        if (res.status === 429 || res.status === 402) {
          var ra = 60; try { var ej = await res.json(); ra = Number(ej && ej.error && ej.error.retry_after) || 60; } catch (e) {}
          pause(S.name, Math.min(Math.max(ra, 10), S.gap ? 25 : 300) * 1000); throw err("api-429");
        }
        if (!res.ok || !res.body) throw err("api-" + res.status);
        var finish = await readSSE(res, function (t) {
          if (!first) { first = now() - started; clearTimeout(kill); kill = setTimeout(function () { ctl.abort(); }, 40000); }
          raw += t; if (opts.onText) { try { opts.onText(tidy(raw)); } catch (e) {} }
        }, ctl.signal);
        clearTimeout(kill);
        var out = tidy(raw);
        if (out.length < 20) throw err("empty-response");
        if (isProviderNotice(out)) { pause(S.name, 600000); throw err("api-429"); }
        api.last = { provider: S.name, model: "stream", at: new Date().toISOString(), ms: now() - started, firstWordMs: first, finish: finish };
        writeJSON(localStorage, LS_LAST, api.last);
        try { console.info("[Bibley AI] streamed by " + S.name + ", first word " + first + " ms, done " + (now() - started) + " ms"); } catch (e) {}
        return out;
      } catch (e) {
        clearTimeout(kill); lastErr = e;
        if (opts.signal && opts.signal.aborted) throw err("aborted");
        if (S.name === "Groq" && !raw && pausedUntil("Groq") < now()) pause("Groq", 60000); // proxy down: use the backups for a minute
        if (raw && tidy(raw).length > 60) { api.last = { provider: S.name, model: "stream", partial: true, at: new Date().toISOString(), ms: now() - started, firstWordMs: first }; return tidy(raw); }
        if (typeof navigator !== "undefined" && navigator.onLine === false) throw err("offline");
      }
    }
    var lastUser = Array.isArray(user) ? user.map(function (m) { return m.role + ": " + m.content; }).join("\n") : user;
    var text = await generate(system, lastUser, Math.min(max, 600), { labels: [] });
    if (opts.onText) { try { opts.onText(tidy(text)); } catch (e) {} }
    return tidy(text);
  }

  var api = { generate: generate, stream: stream, tidy: tidy, check: check, stripScripts: stripScripts, labelsOf: labelsOf, providers: PROVIDERS.map(function (p) { return p.name; }), last: readJSON(localStorage, LS_LAST, null), version: 4 };
  window.BibleyAI = api;
})();
