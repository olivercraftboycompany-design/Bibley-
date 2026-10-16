/* bibley-study.js - Bibley 5.4 study upgrades (2026-10-16).
   1. Grounded verse citations: whenever the AI cites a verse next to a quote, the quote is checked
      against the real text (the version you're reading, plus BSB/KJV wording). A wrong label is
      corrected on the chip (e.g. "AI said John 6:47, corrected to John 6:50-51"); a quote that isn't
      in the Bible at that spot is flagged. Every AI answer gets a "Real verse text" list with the
      actual words of each verse it cited, in your version, tap to open the chapter.
   2. Explore tab: Explain, Cross-references, Background and Quiz me for the chapter or the verse you
      tapped, with Simple / Normal / Deep depth and follow-up questions that remember the passage.
   3. Reliable loading: a seconds counter while the AI thinks, and Try again on every failure.
   AI stays in the normal Bible: Lost Books never feeds this tab.
   Stored on the device only: localStorage "bibley_ai_depth_v1". No notifications. ASCII only. */
(() => {
  "use strict";
  const C = window.BibleyCore;
  if (!C || !C.ai) { console.warn("Bibley study: core bridge missing"); return; }
  const BOOKS = C.BOOKS, esc = C.escapeHtml;
  const K_DEPTH = "bibley_ai_depth_v1";
  const DASH = "\u2014", ARROW = "\u2192", CHECK = "\u2713";

  const css = `
  .vref.fixed{border-color:#e0a84a !important;color:#e0a84a !important}
  .vref.mismatch{border-color:#ff8a7a !important;color:#ff8a7a !important}
  .vref-fixnote{font-size:11px;color:#e0a84a;margin:0 4px}
  .vref-fixnote.bad{color:#ff8a7a}
  details.bst-cited{margin-top:10px;border-top:1px solid var(--border);padding-top:8px;font-size:13px}
  details.bst-cited summary{cursor:pointer;color:var(--gold);font-size:12px;list-style:revert}
  .bst-cv{margin:8px 0;line-height:1.5}
  .bst-cv b{color:var(--gold);font-weight:600}
  .bst-cv a{font-size:12px;color:var(--ink-dim);margin-left:6px}
  .bst-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0;font-size:13px;color:var(--ink-dim)}
  .bst-chip{background:transparent;border:1px solid var(--border);color:var(--ink-dim);border-radius:999px;padding:5px 11px;font-size:12px;font-family:inherit;cursor:pointer}
  .bst-chip.on{border-color:var(--gold);color:var(--gold)}
  .bst-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
  .bst-grid button{margin:0 !important;width:100%}
  .bst-body{line-height:1.6;font-size:14px}
  .bst-sub{margin-top:12px;padding-top:10px;border-top:1px dashed var(--border)}
  .bst-q{font-size:13px;color:var(--gold);margin-bottom:4px}
  .bst-follow{display:flex;gap:6px;margin-top:12px}
  .bst-follow input{flex:1;min-width:0;background:transparent;border:1px solid var(--border);border-radius:8px;color:inherit;padding:8px 10px;font-family:inherit;font-size:14px}
  .bst-follow button{border:1px solid var(--gold);background:transparent;color:var(--gold);border-radius:8px;padding:0 12px;font-family:inherit}
  .bst-wait{font-size:12px;color:var(--ink-faint);margin-top:6px}
  .bst-quiz{margin:10px 0 14px}
  .bst-quiz .qq{font-size:14px;margin-bottom:6px;line-height:1.45}
  .bst-quiz button.opt{display:block;width:100%;text-align:left;margin:5px 0;background:transparent;border:1px solid var(--border);color:inherit;border-radius:8px;padding:8px 10px;font-family:inherit;font-size:13px}
  .bst-quiz button.opt.right{border-color:#7fc98f;color:#7fc98f}
  .bst-quiz button.opt.wrong{border-color:#ff8a7a;color:#ff8a7a}
  .bst-quiz .why{font-size:12.5px;color:var(--ink-dim);margin-top:6px;line-height:1.5}
  .bst-note{font-size:12px;color:var(--ink-faint);line-height:1.5;margin-top:10px}
  `;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  // ---------- 1. Grounding ----------
  const STOP = new Set("the and that for his him her she you your with not but are was were this they them their thee thou thy shall will unto from have has had all who which what when then there into upon also our out one may did said says say let its it's is be to of in a an i he we me my by as at or so do no on if up".split(" "));
  function words(t) { return String(t || "").toLowerCase().replace(/[\u2018\u2019']/g, "").replace(/[^a-z\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)); }
  function recall(qw, text) { if (!qw.length) return 0; const tw = new Set(words(text)); let hit = 0; qw.forEach(w => { if (tw.has(w) || tw.has(w.replace(/(eth|est|s)$/, "")) || tw.has(w + "s")) hit++; }); return hit / qw.length; }
  const QUOTE_AFTER = /^[\s)\],:;]*(?:\([^)]{0,30}\))?[\s,]*(?:says|said|reads|states|tells us|records|promises|declares|puts it)?[\s,:]*["\u201c]([^"\u201c\u201d]{12,500})["\u201d]/i;
  const QUOTE_BEFORE = /["\u201c]([^"\u201c\u201d]{12,500})["\u201d][\s,.;:\-\u2013\u2014]*[(\[]?\s*$/;
  function nearbyQuote(btn) {
    let before = "", n = btn.previousSibling;
    while (n && before.length < 600) { if (n.nodeType === 1 && n.classList && n.classList.contains("vref")) break; before = (n.textContent || "") + before; n = n.previousSibling; }
    let after = ""; n = btn.nextSibling;
    while (n && after.length < 600) { if (n.nodeType === 1 && n.classList && (n.classList.contains("vref") || n.classList.contains("vref-text"))) break; after += (n.textContent || ""); n = n.nextSibling; }
    const b = before.match(QUOTE_BEFORE); if (b) return b[1];
    const a = after.match(QUOTE_AFTER); if (a) return a[1];
    return null;
  }
  const chapP = {};
  function chapterFor(version, bookIdx, chapter) {
    const k = version + "/" + bookIdx + "/" + chapter;
    if (!chapP[k]) chapP[k] = C.getChapter(version, bookIdx, chapter).catch(() => null);
    return chapP[k];
  }
  function refStr(bookIdx, ch, a, b) { return BOOKS[bookIdx][1] + " " + ch + ":" + a + (b && b !== a ? "-" + b : ""); }
  function rangeText(verses, a, b) { return (verses || []).filter(v => v.verse >= a && v.verse <= b).map(v => v.text).join(" "); }
  function bestWindow(qw, verses) {
    let best = { score: 0 };
    if (!verses) return best;
    for (let i = 0; i < verses.length; i++) {
      for (let w = 1; w <= 3 && i + w <= verses.length; w++) {
        const sl = verses.slice(i, i + w); const sc = recall(qw, sl.map(v => v.text).join(" ")) - (w - 1) * 0.02;
        if (sc > best.score + 0.001) best = { score: sc, from: sl[0].verse, to: sl[sl.length - 1].verse };
      }
    }
    return best;
  }
  async function groundOne(btn) {
    const r = C.parseRef(btn.dataset.ref); if (!r) return;
    const quote = nearbyQuote(btn); if (!quote) return;
    const qw = words(quote); if (qw.length < 3) return;
    const ver = C.panes.a.version;
    const versions = [ver]; if (ver !== "bsb") versions.push("bsb"); if (ver !== "kjv" && C.isJsonBibleSaved("kjv")) versions.push("kjv");
    let citedScore = 0, best = { score: 0 }, bestCh = r.chapter;
    for (const v of versions) {
      const vs = await chapterFor(v, r.bookIdx, r.chapter); if (!vs) continue;
      citedScore = Math.max(citedScore, recall(qw, rangeText(vs, r.from, r.to)));
      if (citedScore >= 0.6) break;
      const bw = bestWindow(qw, vs); if (bw.score > best.score) { best = bw; bestCh = r.chapter; }
    }
    if (citedScore >= 0.6) { btn.classList.add("quote-ok"); btn.title = "Quote checked against the real text " + CHECK + " tap to read it"; return; }
    if (best.score < 0.6) {
      for (const dc of [-1, 1]) {
        const ch = r.chapter + dc; if (ch < 1 || ch > BOOKS[r.bookIdx][2]) continue;
        const vs = await chapterFor(ver === "esv" ? "bsb" : ver, r.bookIdx, ch); const bw = bestWindow(qw, vs);
        if (bw.score > best.score) { best = bw; bestCh = ch; }
      }
    }
    const old = btn.dataset.ref;
    if (best.score >= 0.6 && best.score > citedScore + 0.2) {
      const fixed = refStr(r.bookIdx, bestCh, best.from, best.to);
      if (fixed === old) return;
      btn.dataset.ref = fixed; btn.dataset.aiRef = old; btn.textContent = fixed;
      btn.classList.remove("bad"); btn.classList.add("fixed");
      btn.title = "The AI labeled this quote " + old + ". The words are really from " + fixed + ".";
      const note = document.createElement("span"); note.className = "vref-fixnote"; note.textContent = "(AI said " + old + "; corrected)";
      btn.insertAdjacentElement("afterend", note);
    } else if (citedScore < 0.35) {
      btn.classList.add("mismatch");
      btn.title = "This quote doesn't match " + old + ". Tap to read what it really says.";
      const note = document.createElement("span"); note.className = "vref-fixnote bad"; note.textContent = "(quote not found in " + old + "; tap for the real verse)";
      btn.insertAdjacentElement("afterend", note);
    }
  }
  async function citedBlock(root) {
    if (!root) return;
    const prevDet = root.querySelector("details.bst-cited"); const wasOpen = prevDet && prevDet.open; if (prevDet) prevDet.remove();
    const seen = [], btns = Array.from(root.querySelectorAll(".vref[data-known='1']"));
    btns.forEach(b => { if (!b.classList.contains("bad") && seen.indexOf(b.dataset.ref) < 0) seen.push(b.dataset.ref); });
    if (!seen.length) return;
    const refs = seen.slice(0, 8), ver = C.panes.a.version;
    const det = document.createElement("details"); det.className = "bst-cited";
    if (root.dataset.bstOpen === "1" || wasOpen) det.open = true;
    det.innerHTML = "<summary>Real verse text (" + refs.length + " cited, " + esc(C.versionName(ver)) + ")</summary><div class='bst-cvs'>Loading...</div>";
    const src = root.querySelector(":scope > .sources");
    if (src) root.insertBefore(det, src); else root.appendChild(det);
    const rows = await Promise.all(refs.map(async ref => {
      let t = "", v = ver;
      try { t = await C.fetchVerseText(ref, ver); } catch (e) { try { v = "web"; t = await C.fetchVerseText(ref, "web"); } catch (e2) { t = ""; } }
      if (!t) return "<div class='bst-cv'><b>" + esc(ref) + "</b> " + DASH + " couldn't find this verse; the AI may have it wrong.</div>";
      return "<div class='bst-cv'><b>" + esc(ref) + "</b>" + (v !== ver ? " (" + esc(C.versionName(v)) + ")" : "") + " " + esc(t) + " <a href='#' class='vref-open' data-ref='" + esc(ref) + "'>Open " + ARROW + "</a></div>";
    }));
    const box = det.querySelector(".bst-cvs"); if (box) box.innerHTML = rows.join("");
  }
  function ground(container) {
    if (!container) return;
    const groups = new Map();
    container.querySelectorAll(".vref:not([data-grounded])").forEach(btn => {
      btn.dataset.grounded = "1";
      const root = btn.closest(".msg.ai, .bst-unit") || container;
      if (!groups.has(root)) groups.set(root, []);
      if (btn.dataset.known === "1") groups.get(root).push(groundOne(btn).catch(e => console.warn("quote check", e)));
    });
    groups.forEach((list, root) => { Promise.all(list).then(() => setTimeout(() => citedBlock(root), 400)); });
  }

  // ---------- 2. Explore tab ----------
  const state = { scope: "chapter", busy: false, out: {} };
  function depth() { try { return localStorage.getItem(K_DEPTH) || ""; } catch (e) { return ""; } }
  function setDepth(d) { try { if (d) localStorage.setItem(K_DEPTH, d); else localStorage.removeItem(K_DEPTH); } catch (e) {} }
  function passage() {
    const p = C.panes.a, book = BOOKS[p.bookIdx], sv = C.selectedVerse();
    const verseOk = sv && sv.bookIdx === p.bookIdx && String(sv.chapter) === String(p.chapter) && /^\d+$/.test(String(sv.verseNum));
    const scope = (state.scope === "verse" && verseOk) ? "verse" : "chapter";
    return { p, book, sv: verseOk ? sv : null, scope, label: scope === "verse" ? book[1] + " " + p.chapter + ":" + sv.verseNum : book[1] + " " + p.chapter,
      key: p.version + "/" + p.bookIdx + "/" + p.chapter + "/" + (scope === "verse" ? sv.verseNum : "all") };
  }
  async function passageText(ps) {
    const vs = await C.getChapter(ps.p.version, ps.p.bookIdx, ps.p.chapter);
    const lines = vs.map(v => ps.book[1] + " " + ps.p.chapter + ":" + v.verse + " " + v.text);
    if (ps.scope === "verse") {
      const n = parseInt(ps.sv.verseNum, 10);
      const focus = vs.filter(v => v.verse === n).map(v => v.text).join(" ");
      const ctx = vs.filter(v => v.verse >= n - 3 && v.verse <= n + 3).map(v => ps.book[1] + " " + ps.p.chapter + ":" + v.verse + " " + v.text).join("\n");
      return { vs, text: "FOCUS VERSE " + ps.label + ": " + focus + "\n\nSurrounding verses:\n" + ctx };
    }
    return { vs, text: lines.join("\n").slice(0, 6500) };
  }
  const ACTIONS = {
    explain: { title: "Explain", ask: l => "Explain " + l + " using the text below. Cover: what it says, what it means (in its context), and how it applies to a Christian today. Cite verses as Book chapter:verse. If you quote a verse, quote the text given here exactly." },
    xref: { title: "Cross-references", open: true, ask: l => "Give 5 cross-references for " + l + ". One per line in this exact format: Book chapter:verse - one sentence on how it connects. Use only real verses you are completely sure of. No quotes needed." },
    background: { title: "Background", ask: l => "Give the historical and cultural background for " + l + ": who wrote it, when and to whom (as most scholars and church tradition say), the setting, and one or two customs or ideas of that time that help a reader understand it. Say less rather than guess." }
  };
  function waitHtml(label) { return C.ai.skeleton([92, 85, 70]) + "<div class='bst-wait' data-t0='" + Date.now() + "'>Asking the AI about " + esc(label) + "...</div>"; }
  setInterval(() => { document.querySelectorAll(".bst-wait[data-t0]").forEach(el => { const s = Math.round((Date.now() - (+el.dataset.t0)) / 1000); if (s >= 4) el.textContent = "Thinking... " + s + "s" + (s > 40 ? " (free AI is slow right now, still trying)" : ""); }); }, 1000);

  function render(el) {
    const ps = passage();
    const d = depth();
    const verseBtn = ps.sv ? "<button class='bst-chip" + (ps.scope === "verse" ? " on" : "") + "' data-scope='verse'>Verse " + esc(String(ps.sv.verseNum)) + "</button>" : "<span style='font-size:12px;color:var(--ink-faint)'>(tap a verse in the reader to study just that verse)</span>";
    el.innerHTML = "<div class='ai-card'><h3>Explore " + esc(ps.label) + "</h3>" +
      "<div class='bst-row'>Study: <button class='bst-chip" + (ps.scope === "chapter" ? " on" : "") + "' data-scope='chapter'>Whole chapter</button>" + verseBtn + "</div>" +
      "<div class='bst-row'>Depth: <button class='bst-chip" + (d === "simple" ? " on" : "") + "' data-depth='simple'>Simple</button><button class='bst-chip" + (!d ? " on" : "") + "' data-depth=''>Normal</button><button class='bst-chip" + (d === "deep" ? " on" : "") + "' data-depth='deep'>Deep</button></div>" +
      "<div class='bst-grid'><button class='ai-action-btn' data-act='explain'>Explain</button><button class='ai-action-btn' data-act='xref'>Cross-references</button><button class='ai-action-btn' data-act='background'>Background</button><button class='ai-action-btn' data-act='quiz'>Quiz me</button></div>" +
      "<div class='bst-note'>Every verse the AI cites is checked against the real text in " + esc(C.versionName(ps.p.version)) + ". Depth also applies to the Chatbot.</div></div><div id='bstOut'></div>";
    el.querySelectorAll("[data-scope]").forEach(b => b.addEventListener("click", () => { state.scope = b.dataset.scope; render(el); }));
    el.querySelectorAll("[data-depth]").forEach(b => b.addEventListener("click", () => { setDepth(b.dataset.depth); render(el); }));
    el.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", () => run(b.dataset.act)));
    const prev = state.out[ps.key + "|" + d];
    if (prev) { const out = el.querySelector("#bstOut"); out.appendChild(prev); }
  }
  function outEl() { return document.getElementById("bstOut"); }
  async function run(act) {
    const ps = passage(), d = depth(), out = outEl(); if (!out) return;
    if (act === "quiz") return runQuiz(ps, d);
    const A = ACTIONS[act];
    const unit = document.createElement("div"); unit.className = "ai-card bst-unit"; if (A.open) unit.dataset.bstOpen = "1";
    unit.innerHTML = "<h3>" + esc(A.title) + ": " + esc(ps.label) + "</h3><div class='bst-body'>" + waitHtml(ps.label) + "</div>";
    out.innerHTML = ""; out.appendChild(unit); state.out[ps.key + "|" + d] = unit;
    unit.scrollIntoView({ block: "nearest" });
    const thread = [];
    try {
      const pt = await passageText(ps);
      const ask = A.ask(ps.label);
      const raw = await C.ai.generate(C.ai.systemPrompt(), "Passage (" + C.versionName(ps.p.version) + "):\n" + pt.text + "\n\nTask: " + ask, d === "deep" ? 800 : 600);
      const ans = C.ai.guard(raw).trim();
      thread.push({ q: ask, a: ans });
      const body = unit.querySelector(".bst-body"); body.innerHTML = C.ai.format(ans); C.ai.verify(body.closest(".bst-unit"));
      addFollow(unit, ps, pt, thread);
    } catch (err) {
      console.warn(err);
      unit.querySelector(".bst-body").innerHTML = "<p style='color:var(--ink-faint);font-size:13px'>" + C.ai.errorMessage(err) + "</p><button class='ai-action-btn bst-retry' style='margin-top:8px'>Try again</button>";
      unit.querySelector(".bst-retry").addEventListener("click", () => run(act));
    }
  }
  function addFollow(unit, ps, pt, thread) {
    const f = document.createElement("form"); f.className = "bst-follow";
    f.innerHTML = "<input placeholder='Ask a follow-up about " + esc(ps.label) + "...' autocomplete='off'/><button type='submit'>Ask</button>";
    unit.appendChild(f);
    f.addEventListener("submit", async e => {
      e.preventDefault(); const inp = f.querySelector("input"); const q = inp.value.trim(); if (!q) return;
      inp.value = ""; inp.disabled = true;
      const sub = document.createElement("div"); sub.className = "bst-sub";
      sub.innerHTML = "<div class='bst-q'>" + esc(q) + "</div><div class='bst-body'>" + waitHtml(ps.label) + "</div>";
      unit.insertBefore(sub, f);
      const ask = async () => {
        try {
          const hist = thread.slice(-6).map(t => "Q: " + t.q + "\nA: " + t.a).join("\n\n");
          const raw = await C.ai.generate(C.ai.systemPrompt(), "Passage we are studying (" + C.versionName(ps.p.version) + "):\n" + pt.text + "\n\nOur conversation so far:\n" + hist + "\n\nFollow-up question: " + q + "\n(Answer about this passage; cite verses as Book chapter:verse.)", 550);
          const ans = C.ai.guard(raw).trim(); thread.push({ q, a: ans });
          sub.querySelector(".bst-body").innerHTML = C.ai.format(ans); C.ai.verify(unit);
        } catch (err) {
          sub.querySelector(".bst-body").innerHTML = "<p style='color:var(--ink-faint);font-size:13px'>" + C.ai.errorMessage(err) + "</p><button type='button' class='ai-action-btn bst-retry' style='margin-top:6px'>Try again</button>";
          sub.querySelector(".bst-retry").addEventListener("click", () => { sub.querySelector(".bst-body").innerHTML = waitHtml(ps.label); ask(); });
        }
        inp.disabled = false;
      };
      ask();
    });
  }
  function parseQuiz(raw, vs) {
    const m = String(raw || "").match(/\{[\s\S]*\}/); if (!m) return null;
    let j; try { j = JSON.parse(m[0]); } catch (e) { try { j = JSON.parse(m[0].replace(/,\s*([\]}])/g, "$1")); } catch (e2) { return null; } }
    const nums = new Set(vs.map(v => v.verse));
    const qs = (j.questions || []).filter(q => q && typeof q.q === "string" && Array.isArray(q.choices) && q.choices.length >= 3 && q.choices.length <= 4 && Number.isInteger(+q.answer) && +q.answer >= 0 && +q.answer < q.choices.length)
      .map(q => ({ q: q.q, choices: q.choices.map(String), answer: +q.answer, verse: nums.has(+q.verse) ? +q.verse : null, why: typeof q.why === "string" ? q.why : "" }));
    return qs.length >= 3 ? qs.slice(0, 5) : null;
  }
  async function runQuiz(ps, d) {
    const out = outEl();
    const unit = document.createElement("div"); unit.className = "ai-card bst-unit";
    unit.innerHTML = "<h3>Quiz: " + esc(ps.book[1] + " " + ps.p.chapter) + "</h3><div class='bst-body'>" + waitHtml(ps.book[1] + " " + ps.p.chapter) + "</div>";
    out.innerHTML = ""; out.appendChild(unit); state.out[ps.key + "|" + d] = unit;
    try {
      const vs = await C.getChapter(ps.p.version, ps.p.bookIdx, ps.p.chapter);
      const text = vs.map(v => v.verse + ". " + v.text).join("\n").slice(0, 6500);
      const level = d === "simple" ? "easy" : d === "deep" ? "challenging" : "medium";
      const sys = "You write Bible reading quizzes. Reply with JSON only, no other text.";
      const user = ps.book[1] + " chapter " + ps.p.chapter + ":\n" + text + "\n\nWrite 5 " + level + " multiple-choice questions that test understanding of THIS chapter only, answerable from the text above. JSON format exactly: {\"questions\":[{\"q\":\"question\",\"choices\":[\"A\",\"B\",\"C\",\"D\"],\"answer\":0,\"verse\":3,\"why\":\"one short sentence\"}]} where answer is the index of the correct choice and verse is the verse number in this chapter that shows the answer.";
      let qs = null;
      for (let i = 0; i < 2 && !qs; i++) qs = parseQuiz(await C.ai.generate(sys, user + (i ? "\nIMPORTANT: valid JSON only." : ""), 1100), vs);
      if (!qs) throw new Error("bad-quiz");
      let done = 0, right = 0;
      const body = unit.querySelector(".bst-body"); body.innerHTML = "";
      qs.forEach((q, qi) => {
        const box = document.createElement("div"); box.className = "bst-quiz";
        box.innerHTML = "<div class='qq'><b>" + (qi + 1) + ".</b> " + esc(q.q) + "</div>" + q.choices.map((c, ci) => "<button type='button' class='opt' data-i='" + ci + "'>" + esc(c) + "</button>").join("") + "<div class='why' hidden></div>";
        box.querySelectorAll(".opt").forEach(b => b.addEventListener("click", () => {
          if (box.dataset.done) return; box.dataset.done = "1"; done++;
          const pick = +b.dataset.i; if (pick === q.answer) right++;
          box.querySelectorAll(".opt").forEach(o => { const i = +o.dataset.i; if (i === q.answer) o.classList.add("right"); else if (i === pick) o.classList.add("wrong"); });
          const why = box.querySelector(".why"); why.hidden = false;
          const vt = q.verse ? (vs.find(v => v.verse === q.verse) || {}).text : "";
          why.innerHTML = (pick === q.answer ? "Correct. " : "Not quite. ") + esc(q.why || "") + (vt ? "<br><b>" + esc(ps.book[1] + " " + ps.p.chapter + ":" + q.verse) + "</b> " + esc(vt) : "");
          if (done === qs.length) { const sc = document.createElement("div"); sc.className = "bst-note"; sc.innerHTML = "<b>Score: " + right + " / " + qs.length + "</b>"; body.appendChild(sc); }
        }));
        body.appendChild(box);
      });
      const again = document.createElement("button"); again.className = "ai-action-btn"; again.textContent = "New quiz"; again.addEventListener("click", () => runQuiz(passage(), depth()));
      unit.appendChild(again);
    } catch (err) {
      console.warn(err);
      const msg = err && err.message === "bad-quiz" ? "The AI didn't make a usable quiz this time." : C.ai.errorMessage(err);
      unit.querySelector(".bst-body").innerHTML = "<p style='color:var(--ink-faint);font-size:13px'>" + msg + "</p><button class='ai-action-btn bst-retry' style='margin-top:8px'>Try again</button>";
      unit.querySelector(".bst-retry").addEventListener("click", () => runQuiz(passage(), depth()));
    }
  }
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("#exploreVerseBtn");
    if (b) { e.preventDefault(); state.scope = "verse"; C.switchTab("explore"); }
  });
  window.BibleyStudy = { ground, render, _words: words, _recall: recall, _nearbyQuote: nearbyQuote };
  if (C.currentTab && C.currentTab() === "explore") { const el = document.getElementById("aiContent"); if (el) render(el); }
})();
