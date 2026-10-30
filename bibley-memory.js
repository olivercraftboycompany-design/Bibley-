/* bibley-memory.js - Bibley 6.4 (2026-10-29): Bibley remembers your chats.
   Everything stays on this phone:
   - Chats: typed Study Assistant chats and call transcripts live in IndexedDB (bible_reader_db,
     the same "conversations"/"messages" stores the Chatbot already used; calls have kind:"call").
     History is capped at 200 chats (oldest removed first).
   - Memory: a short list of facts about the person (15 lines or fewer) in localStorage
     "bibley_memory_v1" = {lines:[...], updated, seen:{convoId: lastTs}}.
     After a chat ends or a call hangs up, one small AI call (through the bibley-ai proxy)
     returns the updated list. Every AI request then gets this list (see block()).
   API: window.BibleyMemory { lines, text, set, clear, block, noteChat, noteCall, ready, forget, forgetAll, cap } */
(function () {
  "use strict";
  var PROXY = "https://bibley-ai.sites.tab.bot/";
  var K = "bibley_memory_v1", MAX_LINES = 15, MAX_LINE = 140, CAP = 200;
  var inflight = null;
  function load() { try { var v = JSON.parse(localStorage.getItem(K) || "null"); if (v && Array.isArray(v.lines)) { v.seen = v.seen || {}; return v; } } catch (e) {} return { lines: [], updated: 0, seen: {} }; }
  function save(m) { try { localStorage.setItem(K, JSON.stringify(m)); } catch (e) {} fire(); }
  function fire() { try { window.dispatchEvent(new CustomEvent("bibley-memory")); } catch (e) {} }
  function clean(lines) {
    var out = [];
    (lines || []).forEach(function (l) {
      l = String(l || "").replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
      if (!l || /^(none|n\/a|no facts?|nothing)\.?$/i.test(l) || /^(memory|facts|updated memory)\s*:?$/i.test(l)) return;
      if (l.length > MAX_LINE) l = l.slice(0, MAX_LINE - 1).replace(/\s+\S*$/, "") + "\u2026";
      if (out.indexOf(l) < 0) out.push(l);
    });
    return out.slice(0, MAX_LINES);
  }
  function lines() { return load().lines.slice(); }
  function text() { return lines().join("\n"); }
  function set(t) { var m = load(); m.lines = clean(String(t || "").split(/\n+/)); m.updated = Date.now(); save(m); return m.lines; }
  function clear() { var m = load(); m.lines = []; m.updated = Date.now(); save(m); }
  function block() {
    var l = lines(); if (!l.length) return "";
    return "\n\nWHAT YOU REMEMBER ABOUT THIS PERSON from earlier chats on this phone (use it naturally when it helps, for example \"last time you asked about Psalm 23\" or using their name; never invent other memories, and never read this list out unless they ask what you remember):\n- " + l.join("\n- ");
  }

  var SYS = "You keep a short memory for Bibley, a Bible study app, about the one person who uses it. " +
    "You get the current memory and a new conversation. Return the UPDATED memory: at most 15 short lines, one fact per line, plain text, no numbering, no intro, nothing else. " +
    "Keep only useful lasting facts: their name, age group, favourite verses or books, what they are studying or reading, prayer requests and things going on in their life they shared, how they like answers. " +
    "Include one line starting \"Last talked about:\" with the date given and the main topic of the new conversation. " +
    "Merge duplicates, update facts that changed, drop the least important lines when over 15. Never store passwords, addresses, phone numbers or other private identifiers. " +
    "Write facts about the person in third person, like \"Name is Sam\" or \"Favourite psalm: Psalm 91\". If nothing new was learned, return the current memory with the Last talked about line updated.";

  function transcript(msgs) {
    var t = msgs.map(function (m) { return (m.role === "user" ? "Person: " : "Bibley: ") + String(m.text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600); }).join("\n");
    if (t.length > 5200) t = t.slice(t.length - 5200);
    return t;
  }
  async function ask(sys, user) {
    var ctl = new AbortController(), tm = setTimeout(function () { ctl.abort(); }, 20000);
    try {
      var r = await fetch(PROXY, { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctl.signal,
        body: JSON.stringify({ messages: [{ role: "system", content: sys }, { role: "user", content: user }], mode: "memory", stream: false, max_tokens: 500 }) });
      if (!r.ok) throw new Error("memory " + r.status);
      var d = await r.json();
      var c = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      if (c) return String(c);
      throw new Error("empty");
    } catch (e) {
      if (window.BibleyAI && window.BibleyAI.generate) return String(await window.BibleyAI.generate(sys, user, 300) || "");
      throw e;
    } finally { clearTimeout(tm); }
  }
  // fold a finished conversation into the memory: one small AI call
  function update(id, msgs, kind) {
    var m = load(), since = m.seen[id] || 0;
    var fresh = (msgs || []).filter(function (x) { return (x.ts || 0) > since && x.text; });
    if (!fresh.some(function (x) { return x.role === "user"; })) return Promise.resolve(false);
    var lastTs = fresh.reduce(function (n, x) { return Math.max(n, x.ts || 0); }, 0);
    var day = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    var user = "Current memory:\n" + (m.lines.length ? m.lines.join("\n") : "(empty)") + "\n\nNew " + (kind === "call" ? "voice call" : "chat") + " on " + day + ":\n" + transcript(fresh);
    var run = (inflight || Promise.resolve()).then(function () {
      return ask(SYS, user).then(function (out) {
        out = String(out || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        var l = clean(out.split(/\n+/));
        if (!l.length) return false;
        var mm = load(); mm.lines = l; mm.updated = Date.now(); mm.seen[id] = lastTs;
        var ks = Object.keys(mm.seen); if (ks.length > CAP + 20) ks.sort(function (a, b) { return mm.seen[a] - mm.seen[b]; }).slice(0, ks.length - CAP).forEach(function (k) { delete mm.seen[k]; });
        save(mm); return true;
      });
    }).catch(function (e) { console.warn("memory update", e && e.message); return false; });
    inflight = run; run.then(function () { if (inflight === run) inflight = null; });
    return run;
  }
  function ready(ms) { if (!inflight) return Promise.resolve(); return Promise.race([inflight, new Promise(function (r) { setTimeout(r, ms || 9000); })]); }
  function db() { return window.BibleyCore && window.BibleyCore.chatDB; }
  async function noteChat(id) {
    var D = db(); if (!D || !id) return false;
    try { return await update(id, await D.getMessages(id), "chat"); } catch (e) { return false; }
  }
  // save a finished call (captions of both sides) as a chat, then fold it into the memory
  async function noteCall(log, started) {
    var D = db(); if (!D || !log || !log.some(function (x) { return x.role === "user"; })) return null;
    try {
      var when = new Date(started || Date.now());
      var c = await D.createConversation("Call \u00b7 " + when.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ", " + when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }), { kind: "call" });
      for (var i = 0; i < log.length; i++) await D.addMessage(c.id, log[i].role, log[i].text, null, log[i].ts);
      await D.touchConversation(c.id);
      await cap();
      if (window.BibleyCore.refreshConvos) window.BibleyCore.refreshConvos();
      update(c.id, log, "call");
      return c.id;
    } catch (e) { console.warn("save call", e); return null; }
  }
  async function cap() {
    var D = db(); if (!D) return;
    var all = await D.listConversations(), active = window.BibleyCore.activeConvo ? window.BibleyCore.activeConvo() : null;
    var extra = all.filter(function (c) { return c.id !== active; }).slice(CAP - 1);
    for (var i = 0; i < extra.length; i++) await D.deleteConversation(extra[i].id);
  }
  var STOP = /^(that|this|the|about|what|said|just|thing|things|from|with|have|please|forget|bibley|everything|okay|they|them|their|there|said|told|you|your|and)$/i;
  // remove memory lines that share a real word with what they asked to forget
  function forget(what) {
    var words = String(what || "").toLowerCase().match(/[a-z0-9]{3,}/g) || [];
    words = words.filter(function (w) { return !STOP.test(w); });
    if (!words.length) return 0;
    var m = load(), before = m.lines.length;
    m.lines = m.lines.filter(function (l) { var low = l.toLowerCase(); return !words.some(function (w) { return low.indexOf(w) >= 0; }); });
    m.updated = Date.now(); save(m);
    return before - m.lines.length;
  }
  async function forgetAll() {
    var m = load(); m.lines = []; m.seen = {}; m.updated = Date.now(); save(m);
    var D = db(); if (!D) return;
    var all = await D.listConversations();
    for (var i = 0; i < all.length; i++) await D.deleteConversation(all[i].id);
    if (window.BibleyCore.resetChats) await window.BibleyCore.resetChats();
  }
  window.BibleyMemory = { lines: lines, text: text, set: set, clear: clear, block: block, noteChat: noteChat, noteCall: noteCall, ready: ready, forget: forget, forgetAll: forgetAll, cap: cap, MAX_LINES: MAX_LINES, CAP: CAP };
})();
