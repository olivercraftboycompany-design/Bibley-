/* bibley-sections.js - Bibley 6.5 (2026-10-31): section headings and section context.
   Headings: the Berean Standard Bible's section headings (public domain), stored in
   sections.json as b[bookIdx][chapter-1] = [[firstVerse, heading, subheading...], ...]. They are
   keyed by verse number, so they show over every translation (Psalms are skipped for the
   Douay-Rheims, whose psalm numbering differs).
   Context: tap a heading for a short note about the section, written by Bibley AI on first open
   and kept on this phone. Headings are not part of the verse spans, so verse tap, highlights,
   bookmarks, notes, read-aloud and search are untouched.
   Stored on the device, NEW keys: "bibley_sections_v1" {head, ctx} and "bibley_sec_ctx_v1"
   (saved notes). ASCII only in this file. */
(() => {
  "use strict";
  const K_PREF = "bibley_sections_v1", K_CTX = "bibley_sec_ctx_v1", MAX_NOTES = 800;
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CHEV = '<svg class="bx-sec-chev" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

  let data = null, loading = null;
  const open = new Set(), pending = {};

  function prefs() { const p = load(K_PREF, {}); return { head: p.head !== false, ctx: p.ctx !== false }; }
  function setPrefs(patch) { save(K_PREF, Object.assign(prefs(), patch)); refresh(); }

  function fetchData() {
    if (data) return Promise.resolve(data);
    if (!loading) loading = fetch("sections.json").then(r => r.ok ? r.json() : Promise.reject(new Error("http " + r.status)))
      .then(j => { data = j && j.b; return data; })
      .catch(() => { loading = null; return null; });
    return loading;
  }
  function headsFor(bookIdx, chapter, version) {
    if (!data || !data[bookIdx]) return [];
    if (version === "dra" && bookIdx === 18) return [];
    return data[bookIdx][chapter - 1] || [];
  }

  function notes() { return load(K_CTX, {}); }
  function saveNote(key, text) {
    const all = notes(); all[key] = { t: text, at: Date.now() };
    const keys = Object.keys(all);
    if (keys.length > MAX_NOTES) keys.sort((a, b) => (all[a].at || 0) - (all[b].at || 0)).slice(0, keys.length - MAX_NOTES).forEach(k => delete all[k]);
    save(K_CTX, all);
  }
  function clean(t) {
    t = String(t || "").replace(/\*\*|__|`|#+\s*/g, "").replace(/^\s*(context|background|note)\s*:\s*/i, "").replace(/\s+/g, " ").trim();
    t = t.replace(/\bYahweh\b/g, "the Lord").replace(/\bYHWH\b/g, "the Lord");
    const s = t.match(/[^.!?]+[.!?]+["')\]]*/g);
    if (s && s.length > 2) t = s.slice(0, 2).join("").trim();
    return t;
  }
  const SYS = "You write the short background note shown under a section heading in a Bible reading app. " +
    "Write one or two plain sentences, 45 words at most: what is happening in this section, who is speaking or acting, and the setting or background. " +
    "Be factual and neutral, in line with traditional Christian understanding. Refer to God as \"the Lord\" or \"God\", never \"Yahweh\". " +
    "No preaching, no application, no questions, no lists, no headings, no quotation marks, and do not repeat the heading.";

  function getNote(key, info, h, endV, firstText) {
    const hit = notes()[key]; if (hit && hit.t) return Promise.resolve(hit.t);
    if (pending[key]) return pending[key];
    if (typeof navigator !== "undefined" && navigator.onLine === false) return Promise.reject(new Error("offline"));
    if (!window.BibleyAI || !window.BibleyAI.generate) return Promise.reject(new Error("noai"));
    const ref = info.bookName + " " + info.chapter + ":" + h[0] + (endV > h[0] ? "-" + endV : "");
    const user = "Section: " + ref + ", headed \"" + h[1] + "\"." + (firstText ? " It begins: " + firstText.slice(0, 220) : "");
    pending[key] = window.BibleyAI.generate(SYS, user, 160, { labels: [] }).then(t => {
      const out = clean(t); if (out.length < 20) throw new Error("short");
      saveNote(key, out); return out;
    }).finally(() => { delete pending[key]; });
    return pending[key];
  }

  function fill(box, key, info, h, endV, firstText) {
    const cached = notes()[key];
    if (cached && cached.t) { box.innerHTML = '<p class="bx-sec-txt">' + esc(cached.t) + "</p>"; return; }
    box.innerHTML = '<div class="bx-sec-load" aria-label="Loading"><i></i><i></i></div>';
    getNote(key, info, h, endV, firstText).then(t => {
      if (!box.isConnected) return; box.innerHTML = '<p class="bx-sec-txt">' + esc(t) + "</p>";
    }).catch(e => {
      if (!box.isConnected) return;
      const off = (e && e.message === "offline") || (typeof navigator !== "undefined" && navigator.onLine === false);
      box.innerHTML = '<p class="bx-sec-err">' + (off ? "You're offline." : "Couldn't load this.") + ' <button type="button" class="bx-sec-retry">Try again</button></p>';
      box.querySelector(".bx-sec-retry").onclick = ev => { ev.stopPropagation(); fill(box, key, info, h, endV, firstText); };
    });
  }

  function decorate(paneKey, vEl, info) {
    if (!vEl) return;
    vEl.querySelectorAll(".bx-sec").forEach(n => n.remove());
    const pr = prefs(); if (!pr.head) return;
    if (!data) { fetchData().then(d => { if (d && vEl.isConnected) decorate(paneKey, vEl, info); }); return; }
    const heads = headsFor(info.bookIdx, info.chapter, info.version); if (!heads.length) return;
    const spans = Array.from(vEl.querySelectorAll("span[data-verse]")); if (!spans.length) return;
    const num = s => parseInt(s.dataset.verse, 10) || 0;
    const lastV = num(spans[spans.length - 1]);
    heads.forEach((h, i) => {
      const at = spans.find(s => num(s) >= h[0]); if (!at) return;
      const endV = i + 1 < heads.length ? heads[i + 1][0] - 1 : lastV;
      const key = info.bookIdx + "." + info.chapter + "." + h[0];
      const el = document.createElement("div");
      el.className = "bx-sec" + (i === 0 && num(at) === num(spans[0]) ? " bx-sec-first" : ""); el.dataset.sv = h[0];
      const subs = h.slice(2).map(s => '<div class="bx-sec-sub">' + esc(s) + "</div>").join("");
      if (pr.ctx) {
        el.innerHTML = '<button type="button" class="bx-sec-h" aria-expanded="false"><b>' + esc(h[1]) + "</b>" + CHEV + "</button>" + subs + '<div class="bx-sec-note" hidden></div>';
        const btn = el.querySelector(".bx-sec-h"), box = el.querySelector(".bx-sec-note");
        const firstText = () => { const s = spans.find(x => num(x) >= h[0]); if (!s) return ""; const c = s.cloneNode(true); c.querySelectorAll("sup").forEach(x => x.remove()); return c.textContent.trim(); };
        const show = on => { btn.setAttribute("aria-expanded", on ? "true" : "false"); el.classList.toggle("open", on); box.hidden = !on; if (on) fill(box, key, info, h, endV, firstText()); };
        btn.addEventListener("click", ev => { ev.stopPropagation(); const on = !el.classList.contains("open"); if (on) open.add(key); else open.delete(key); show(on); });
        if (open.has(key)) show(true);
      } else {
        el.innerHTML = '<div class="bx-sec-h"><b>' + esc(h[1]) + "</b></div>" + subs;
      }
      vEl.insertBefore(el, at);
    });
  }

  function refresh() {
    const C = window.BibleyCore; if (!C || !C.panes) return;
    ["a", "b"].forEach(k => {
      const vEl = document.querySelector('.pane[data-pane="' + k + '"] .verses-text'); const p = C.panes[k];
      if (!vEl || !p || !C.BOOKS[p.bookIdx]) return;
      decorate(k, vEl, { bookIdx: p.bookIdx, chapter: p.chapter, version: p.version, bookName: C.BOOKS[p.bookIdx][1] });
    });
  }

  window.BibleySections = { decorate, refresh, prefs, setPrefs, headsFor: (b, c, v) => headsFor(b, c, v), ready: fetchData, cachedNote: key => (notes()[key] || {}).t || null };
  if (prefs().head) fetchData().then(d => { if (d) refresh(); });
})();
