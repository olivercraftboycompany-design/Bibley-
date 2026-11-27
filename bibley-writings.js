/* bibley-writings.js - Bibley 7.7 (2026-11-27): Writings. Post a Study Notebook note as a writing anyone
   signed in to Bibley can read, browse everyone's writings (All / Mine / Shared with me), search, read with
   comments, and let friends edit (the author adds them as editors by username).
   Server: bibley.sites.tab.bot/api/writings* (same SQLite database and Bearer sign-in as Accounts & Cloud
   Sync, bibley-sync.js). Until the server has the Writings routes (they answer 404), the screen shows a
   friendly "Writings is almost ready" state instead of errors. Signed out: a prompt to sign in (Settings >
   Account & Cloud Sync).
   Rendering is safe: every title, name, comment and body is HTML-escaped; bodies are Markdown drawn by the
   Study Notebook's own renderer (escape first, then formatting) or a plain fallback here.
   Editing uses the live formatting editor (window.BibleyMdEditor, bibley-mdedit.js): no ** marks shown.
   Saves send the version they started from; a 409 shows Keep mine / Load theirs.
   Stored: "bibley_writings_posts_v1" {noteId: {id, user, at, v}} (which notes were posted as which writing;
   syncs with the account so "Update post" works on every device). Nothing else is stored.
   Public: window.BibleyWritings = { open(opts), close(), isOpen(), postFromNote(note), postedFor(noteId), icon } */
(() => {
  "use strict";
  if (window.BibleyWritings) return;
  const FX = window.BibleyFX;
  const HOME = "https://bibley.sites.tab.bot";
  const K_ACC = "bibley_account_v1", K_MAP = "bibley_writings_posts_v1";
  const PAGE = 20, MAX_BODY = 100 * 1024, MAX_TITLE = 200, MAX_COMMENT = 4000;

  /* ---------- small helpers ---------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toast = (m, ms) => { try { if (FX && FX.ui && FX.ui.toast) return FX.ui.toast(m, ms); } catch {} try { if (window.bibleyToast) window.bibleyToast(m); } catch {} };
  const $ = (s, el) => (el || root).querySelector(s);
  const $$ = (s, el) => Array.from((el || root).querySelectorAll(s));
  const sv = (d, s) => '<svg class="ui-ic" viewBox="0 0 24 24" width="' + (s || 20) + '" height="' + (s || 20) + '" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>";
  const I = {
    pen: sv('<path d="M15 4.5l4.5 4.5L9 19.5H4.5V15z"/><path d="M12.5 7l4.5 4.5"/><path d="M13 19.5h6.5"/>'),
    back: sv('<path d="M14.5 6l-6 6 6 6"/>'), x: sv('<path d="M6 6l12 12M18 6L6 18"/>', 18), search: sv('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>', 18),
    plus: sv('<path d="M12 5v14M5 12h14"/>', 18), more: sv('<circle cx="12" cy="5.5" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="12" cy="18.5" r="1.1"/>'),
    chat: sv('<path d="M5 5.5h14v10H10l-4 3.5v-3.5H5z"/>', 15), users: sv('<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><circle cx="16.5" cy="8" r="2.6"/><path d="M16 13c2.4 0 4 1.3 4.5 3.8"/>', 18),
    trash: sv('<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>', 18), globe: sv('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17"/>', 18),
    edit: sv('<path d="M15 4.5l4.5 4.5L9 19.5H4.5V15z"/>', 18), copy: sv('<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5"/>', 18),
    lock: sv('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>', 18), cloud: sv('<path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.1 4.7 4.7 0 0 0 7 18.5z"/>', 18),
    bold: sv('<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>', 18), ital: sv('<path d="M10 5h8M6 19h8M14 5l-4 14"/>', 18),
    quote: sv('<path d="M5 7h5v5H7l-2 4M14 7h5v5h-3l-2 4"/>', 18), list: sv('<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="4.8" cy="7" r=".9"/><circle cx="4.8" cy="12" r=".9"/><circle cx="4.8" cy="17" r=".9"/>', 18),
    ol: sv('<path d="M10 7h10M10 12h10M10 17h10"/><path d="M4 5.5h1.3V9M3.8 9h2.4M3.8 13.5c.3-.9 2.4-1 2.4.2 0 .9-2.4 1.5-2.4 2.8h2.5"/>', 18),
    check: sv('<rect x="3.5" y="4.5" width="6" height="6" rx="1.4"/><path d="M5 7.6l1.2 1.2 2-2.3"/><path d="M12.5 7.5h8M12.5 16.5h8"/><rect x="3.5" y="13.5" width="6" height="6" rx="1.4"/>', 18)
  };

  /* ---------- account + API (same base and Bearer token as bibley-sync.js) ---------- */
  function acc() { try { const a = JSON.parse(localStorage.getItem(K_ACC)); return a && a.token && a.user ? a : null; } catch { return null; } }
  const me = () => { const a = acc(); return a ? a.user : null; };
  const signedIn = () => !!acc() && (!window.BibleySync || window.BibleySync.isSignedIn());
  const apiBase = () => (window.BibleySync && typeof window.BibleySync.api === "string") ? window.BibleySync.api : (location.origin === HOME ? "" : HOME);
  let ready = null;                       // null = not known yet, true = the server has Writings, false = not yet (404)
  function mkErr(kind, status, msg, data) { const e = new Error(msg); e.kind = kind; e.status = status; e.data = data; return e; }
  async function rawCall(path, opts) {
    opts = opts || {};
    const a = acc(); if (!a) throw mkErr("signedout", 401, "Sign in to use Writings");
    let r;
    try { r = await fetch(apiBase() + path, { method: opts.method || "GET", headers: { "Content-Type": "application/json", Authorization: "Bearer " + a.token }, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: "no-store" }); }
    catch { throw mkErr("offline", 0, "You're offline. Writings needs a connection."); }
    let j = null; try { j = await r.json(); } catch {}
    if (r.ok && j && j.ok !== false) return j;
    const msg = (j && j.error) || ("Server error " + r.status);
    if (r.status === 401) throw mkErr("signedout", 401, msg, j);
    if (r.status === 409) throw mkErr("conflict", 409, msg, j);
    if (r.status === 429) throw mkErr("limit", 429, msg || "Too many posts for now. Try again in a little while.", j);
    if (r.status === 404 || r.status === 405 || r.status === 501) throw mkErr("notfound", r.status, msg, j);
    throw mkErr(r.status === 403 ? "forbidden" : r.status === 400 ? "bad" : "server", r.status, msg, j);
  }
  // is the Writings API there? (one list call; a 404 means the server update hasn't landed yet)
  async function probe() {
    try { await rawCall("/api/writings?scope=mine&limit=1"); ready = true; }
    catch (e) { if (e.kind === "notfound") ready = false; else throw e; }
    return ready;
  }
  async function api(path, opts) {
    const isList = /^\/api\/writings(\?|$)/.test(path), isCreate = isList && opts && opts.method === "POST";
    try { const j = await rawCall(path, opts); if (/^\/api\/(writings|users)/.test(path)) ready = true; return j; }
    catch (e) {
      if (e.kind === "notfound") {
        if (isList || isCreate) { ready = false; e.kind = "notready"; }
        else if (ready === false) e.kind = "notready";
        else if (ready === null) { try { if (!(await probe())) e.kind = "notready"; } catch {} }
      }
      throw e;
    }
  }
  // the spec doesn't fix the wrapper key, so accept {writing:{...}} or the fields at the top level
  const pickW = j => j && (j.writing || j.item || (j.id ? j : null));
  const pickList = j => (j && (j.items || j.writings || j.results)) || [];
  const errText = e => e.kind === "offline" ? "You're offline. Writings needs a connection." : e.kind === "signedout" ? "Your sign-in has ended. Sign in again to use Writings." :
    e.kind === "limit" ? (e.message && !/^Server error/.test(e.message) ? e.message : "That's a lot at once. Try again in a little while.") : (e.message || "Something went wrong");

  /* ---------- posted-notes map (syncs) ---------- */
  const mapGet = () => { try { const m = JSON.parse(localStorage.getItem(K_MAP)); return m && typeof m === "object" && !Array.isArray(m) ? m : {}; } catch { return {}; } };
  const mapSet = m => { try { localStorage.setItem(K_MAP, JSON.stringify(m)); } catch {} };
  function postedFor(noteId) { const u = me(), r = mapGet()[noteId]; return r && r.id && u && r.user === u.username ? r : null; }
  function mapPut(noteId, w) { const m = mapGet(), u = me(); m[noteId] = { id: w.id, user: u ? u.username : "", at: Date.now(), v: w.version || 1 }; mapSet(m); }
  function mapDropWriting(wid) { const m = mapGet(); let ch = false; Object.keys(m).forEach(k => { if (m[k] && m[k].id === wid) { delete m[k]; ch = true; } }); if (ch) mapSet(m); }

  /* ---------- formatting ---------- */
  function fmtDate(t) {
    if (!t) return ""; const d = new Date(+t), now = Date.now(), s = (now - d) / 1000;
    if (s < 60) return "just now"; if (s < 3600) return Math.floor(s / 60) + "m ago"; if (s < 86400) return Math.floor(s / 3600) + "h ago"; if (s < 7 * 86400) return Math.floor(s / 86400) + "d ago";
    return d.toLocaleDateString(undefined, d.getFullYear() === new Date().getFullYear() ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
  }
  const fullDate = t => t ? new Date(+t).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  const nameOf = u => u ? (u.display_name || u.username || "Someone") : "Someone";
  const initial = u => (nameOf(u).trim()[0] || "?").toUpperCase();
  const avatar = u => '<span class="bwr-av" aria-hidden="true">' + esc(initial(u)) + "</span>";
  const isMe = u => { const m = me(); return !!(u && m && u.username === m.username); };
  const plain = md => String(md || "").replace(/^\s*```.*$/gm, "").replace(/\*\*([^*\n]+?)\*\*/g, "$1").replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\w)/g, "$1$2").replace(/(^|[^\w])_([^_\n]+?)_(?!\w)/g, "$1$2")
    .replace(/^#{1,3}\s+/gm, "").replace(/^\s*>\s?\[!(\w+)\]\s*/gm, "").replace(/^\s*>\s?/gm, "").replace(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/gm, "").replace(/^\s*[-*]\s\[[ xX]\]\s?/gm, "").replace(/^\s*[-*\u2022]\s+/gm, "").replace(/^\s*\d+[.)]\s+/gm, "");
  // Markdown -> safe HTML. The Study Notebook renderer escapes first and adds verse links; the fallback is plain paragraphs.
  function renderMd(md) {
    const NB = window.BibleyStudyNB;
    if (NB && NB._test && typeof NB._test.render === "function") { try { return NB._test.render(String(md || "")); } catch {} }
    return String(md || "").split(/\n{2,}/).map(p => "<p>" + esc(p).replace(/\n/g, "<br>") + "</p>").join("");
  }
  const bytes = s => { try { return new TextEncoder().encode(s).length; } catch { return String(s).length * 2; } };

  /* ================= the screen ================= */
  let root = null, stack = [], unsub = null, lastUser = null;
  const L = { scope: "all", q: "", items: [], next: null, done: false, loading: false, seq: 0, err: null, state: "" };
  const cache = new Map();                // id -> full writing (reader)
  function build() {
    if (root && root.isConnected) return;
    root = document.createElement("section"); root.className = "bwr"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Writings");
    root.innerHTML = '<div class="bwr-v bwr-list" data-v="list"></div><div class="bwr-v bwr-read" data-v="read" hidden></div><div class="bwr-v bwr-edit" data-v="edit" hidden></div><div class="bwr-modal" hidden></div>';
    document.body.appendChild(root);
    drawListShell();
    window.addEventListener("popstate", onPop);
    document.addEventListener("keydown", onKey, true);
    root.addEventListener("click", e => {
      const r = e.target.closest(".snb-ref[data-ref]");
      if (r && root.contains(r)) { e.preventDefault(); e.stopPropagation(); const [b, c, v, ve] = r.dataset.ref.split(",").map(Number); const verses = v && ve ? Array.from({ length: Math.min(ve - v + 1, 60) }, (_, i) => v + i) : null; close(); setTimeout(() => { try { FX.jumpToVerse(b, c, v || null, verses); } catch {} }, 120); return; }
      const cb = e.target.closest(".bwr-body .snb-cb"); if (cb) { e.preventDefault(); }
    }, true);
    if (window.BibleySync && !unsub) unsub = window.BibleySync.on(s => { const u = s.signedIn && s.user ? s.user.username : null; if (u !== lastUser) { lastUser = u; ready = null; if (isOpen()) { cache.clear(); resetList(); } } });
  }
  const isOpen = () => !!(root && root.classList.contains("open"));
  const top = () => stack[stack.length - 1];
  function show() { const t = top(); if (!t) return; $$(".bwr-v").forEach(v => { v.hidden = v.dataset.v !== t.v; }); }
  function push(entry) { stack.push(entry); try { history.pushState({ bwr: stack.length }, ""); } catch {} show(); }
  function replaceTop(entry) { stack[stack.length - 1] = entry; try { history.replaceState({ bwr: stack.length }, ""); } catch {} show(); }
  function open(opts) {
    opts = opts || {}; build();
    if (!isOpen()) {
      try { if (FX && FX.ui) FX.ui.closeSheet(); } catch {}
      root.classList.add("open"); document.documentElement.classList.add("bwr-on"); stack = [];
      lastUser = me() ? me().username : null;
      push({ v: "list" });
      resetList();                          // fresh list every time the tab opens
    }
    if (opts.id) openReader(opts.id);
  }
  function hide() { if (!root) return; root.classList.remove("open"); document.documentElement.classList.remove("bwr-on"); closeModal(); stack = []; wysEd = null; }
  function close() { if (!isOpen()) return; const n = stack.length; hide(); if (n) try { history.go(-n); } catch {} }
  function onPop(e) {
    if (!isOpen()) return;
    const s = e.state || {};
    if (s.bibleySettings || s.bibleyFx || s.bnSearch || s.bsc) return;      // another screen above ours moved
    const d = s.bwr || 0;
    if (d >= stack.length) return;
    const leaving = top();
    if (leaving && leaving.v === "edit" && editDirty() && !confirm("Discard your changes to this writing?")) { try { history.pushState({ bwr: stack.length }, ""); } catch {} return; }
    if (!d) { hide(); return; }
    stack = stack.slice(0, d); closeModal(); show();
    const t = top(); if (t.v === "read") paintReader(t.id); if (t.v === "list") paintList();
  }
  function onKey(e) {
    if (e.key !== "Escape" || !isOpen()) return;
    if (document.querySelector(".bs-root.open")) return;
    e.stopPropagation(); if (!$(".bwr-modal").hidden) closeModal(); else history.back();
  }

  /* ---------- states shared by list + reader ---------- */
  function stateHtml(kind, msg) {
    if (kind === "signedout") return '<div class="bwr-state">' + I.lock + "<b>Sign in to read and share Writings</b><span>Writings are studies and reflections from people on Bibley. Sign in with your Bibley account to read them, comment, and post your own notes.</span>" +
      '<button type="button" class="fx-btn primary" data-a="signin">Sign in</button><small>Settings \u203a Account & Cloud Sync</small></div>';
    if (kind === "notready") return '<div class="bwr-state">' + I.pen + "<b>Writings is almost ready</b><span>Bibley's server is getting its Writings update. Your notes are safe in your notebook, and you'll be able to post and read writings here very soon.</span>" +
      '<button type="button" class="fx-btn small" data-a="retry">Check again</button></div>';
    if (kind === "offline") return '<div class="bwr-state">' + I.cloud + "<b>You're offline</b><span>Writings needs a connection. Your notebook still works offline.</span>" + '<button type="button" class="fx-btn small" data-a="retry">Try again</button></div>';
    return '<div class="bwr-state">' + I.cloud + "<b>Couldn't load Writings</b><span>" + esc(msg || "Something went wrong.") + '</span><button type="button" class="fx-btn small" data-a="retry">Try again</button></div>';
  }
  function wireState(el, retry) {
    const s = el.querySelector('[data-a="signin"]'); if (s) s.onclick = signIn;
    const r = el.querySelector('[data-a="retry"]'); if (r) r.onclick = () => { ready = null; retry(); };
  }
  function signIn() {
    const S = window.BibleySettings;
    if (S && S.open) S.open("account"); else toast("Open Settings \u203a Account & Cloud Sync to sign in");
  }
  const kindOf = e => e.kind === "notready" || e.kind === "signedout" || e.kind === "offline" ? e.kind : "error";

  /* ================= list ================= */
  function drawListShell() {
    const el = $(".bwr-list");
    el.innerHTML = '<div class="bwr-h"><button type="button" class="bwr-hb" data-a="close" aria-label="Back">' + I.back + '</button><div class="bwr-ht">Writings<small class="bwr-who"></small></div>' +
      '<button type="button" class="bwr-new" data-a="new" aria-label="Write something new">' + I.plus + "<span>Write</span></button></div>" +
      '<div class="bwr-tools"><div class="bwr-seg" role="tablist" aria-label="Show">' + [["all", "All"], ["mine", "Mine"], ["shared", "Shared with me"]].map(([k, l]) => '<button type="button" role="tab" data-scope="' + k + '">' + l + "</button>").join("") + "</div>" +
      '<label class="bwr-search">' + I.search + '<input type="search" placeholder="Search writings" aria-label="Search writings" enterkeyhint="search" autocomplete="off"></label></div>' +
      '<div class="bwr-scroll"><div class="bwr-items" aria-live="polite"></div><div class="bwr-sent"></div></div>';
    el.querySelector('[data-a="close"]').onclick = () => history.back();
    el.querySelector('[data-a="new"]').onclick = () => { if (!signedIn()) { signIn(); return; } if (ready === false) { toast("Writings is almost ready. Check back soon."); return; } openEditor(null); };
    el.querySelectorAll("[data-scope]").forEach(b => b.onclick = () => { if (L.scope === b.dataset.scope) return; L.scope = b.dataset.scope; resetList(); });
    const q = el.querySelector(".bwr-search input"); let qt;
    q.addEventListener("input", () => { clearTimeout(qt); qt = setTimeout(() => { const v = q.value.trim(); if (v === L.q) return; L.q = v; resetList(); }, 320); });
    q.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(qt); L.q = q.value.trim(); resetList(); q.blur(); } });
    const sc = el.querySelector(".bwr-scroll"), sent = el.querySelector(".bwr-sent");
    if ("IntersectionObserver" in window) new IntersectionObserver(es => { if (es.some(x => x.isIntersecting) && isOpen() && top() && top().v === "list") loadMore(); }, { root: sc, rootMargin: "400px 0px" }).observe(sent);
    sc.addEventListener("scroll", () => { if (sc.scrollTop + sc.clientHeight > sc.scrollHeight - 500) loadMore(); }, { passive: true });
  }
  function resetList() { L.items = []; L.next = null; L.done = false; L.err = null; L.state = ""; L.seq++; L.loading = false; const sc = $(".bwr-list .bwr-scroll"); if (sc) sc.scrollTop = 0; paintList(); loadMore(); }
  async function loadMore() {
    if (L.loading || L.done || (L.err && L.items.length === 0 && L.state)) return;
    if (!signedIn()) { L.state = "signedout"; paintList(); return; }
    L.loading = true; const seq = L.seq; paintFoot();
    const qs = "scope=" + encodeURIComponent(L.scope) + (L.q ? "&q=" + encodeURIComponent(L.q) : "") + (L.next != null ? "&before=" + encodeURIComponent(L.next) : "") + "&limit=" + PAGE;
    try {
      const j = await api("/api/writings?" + qs);
      if (seq !== L.seq) return;
      const got = pickList(j), seen = new Set(L.items.map(x => x.id));
      got.forEach(x => { if (x && x.id && !seen.has(x.id)) { L.items.push(x); seen.add(x.id); } });
      const nb = j.next_before != null ? j.next_before : null;
      L.done = !got.length || nb == null || nb === L.next; L.next = nb;
      L.state = "ok"; L.err = null;
    } catch (e) {
      if (seq !== L.seq) return;
      L.err = e; L.state = L.items.length ? "ok" : kindOf(e);
      if (L.items.length) { L.done = false; }
    } finally { if (seq === L.seq) { L.loading = false; paintList(); } }
  }
  function paintList() {
    if (!root) return; const el = $(".bwr-list");
    const u = me(); $(".bwr-who", el).textContent = u ? "@" + u.username : "";
    $$("[data-scope]", el).forEach(b => { const on = b.dataset.scope === L.scope; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
    const box = $(".bwr-items", el), tools = $(".bwr-tools", el);
    const blocking = !signedIn() ? "signedout" : (L.state && L.state !== "ok" ? L.state : "");
    tools.hidden = !!blocking && blocking !== "error" && blocking !== "offline";
    $(".bwr-new", el).hidden = blocking === "signedout";
    if (blocking) { box.innerHTML = stateHtml(blocking, L.err && errText(L.err)); wireState(box, resetList); paintFoot(); return; }
    if (!L.items.length && !L.loading && L.state === "ok") {
      const msg = L.q ? ["Nothing matches \u201c" + esc(L.q) + "\u201d", "Try another word, or look in All."] : L.scope === "mine" ? ["You haven't posted anything yet", "Open a note in your Study Notebook and tap Post, or tap Write here."] :
        L.scope === "shared" ? ["Nothing shared with you yet", "When a friend adds you as an editor, their writing shows up here."] : ["No writings yet", "Be the first: post a note from your Study Notebook."];
      box.innerHTML = '<div class="bwr-state bwr-empty">' + I.pen + "<b>" + msg[0] + "</b><span>" + msg[1] + "</span>" + (L.scope !== "shared" && !L.q ? '<button type="button" class="fx-btn small" data-a="nb">Open Study Notebook</button>' : "") + "</div>";
      const nb = box.querySelector('[data-a="nb"]'); if (nb) nb.onclick = openNotebook;
      paintFoot(); return;
    }
    box.innerHTML = L.items.map(card).join("") || (L.loading ? skel(3) : "");
    $$(".bwr-card", box).forEach(b => b.onclick = () => openReader(b.dataset.id));
    paintFoot();
  }
  function paintFoot() {
    const s = root && $(".bwr-list .bwr-sent"); if (!s) return;
    if (L.loading && L.items.length) s.innerHTML = skel(1);
    else if (L.loading) { const box = $(".bwr-list .bwr-items"); if (box && !box.querySelector(".bwr-card")) box.innerHTML = skel(4); s.innerHTML = ""; }
    else if (L.err && L.items.length) { s.innerHTML = '<div class="bwr-foot"><span>' + esc(errText(L.err)) + '</span><button type="button" class="fx-btn small" data-a="more">Try again</button></div>'; s.querySelector("button").onclick = () => { L.err = null; loadMore(); }; }
    else if (!L.done && L.items.length) { s.innerHTML = '<div class="bwr-foot"><button type="button" class="fx-btn small" data-a="more">Load more</button></div>'; s.querySelector("button").onclick = loadMore; }
    else s.innerHTML = L.items.length > 4 ? '<div class="bwr-end">You\u2019re all caught up</div>' : "";
  }
  const skel = n => Array.from({ length: n }, () => '<div class="bwr-card bwr-sk" aria-hidden="true"><i></i><i></i><i></i></div>').join("");
  function card(w) {
    const ex = plain(w.excerpt || "").replace(/\s+/g, " ").trim(), mine = isMe(w.author), cc = +w.comment_count || 0;
    return '<button type="button" class="bwr-card" data-id="' + esc(w.id) + '"><span class="bwr-ct">' + esc(w.title || "Untitled") + "</span>" + (ex ? '<span class="bwr-cx">' + esc(ex) + "</span>" : "") +
      '<span class="bwr-cm">' + avatar(w.author) + '<span class="bwr-cn">' + esc(mine ? "You" : nameOf(w.author)) + "</span><span>\u00b7</span><span>" + esc(fmtDate(w.updated_at || w.created_at)) + "</span>" +
      '<span class="bwr-grow"></span>' + (w.can_edit && !mine ? '<span class="bwr-tag">Editor</span>' : "") + '<span class="bwr-cc" aria-label="' + cc + ' comments">' + I.chat + cc + "</span></span></button>";
  }

  /* ================= reader ================= */
  function openReader(id) {
    if (!id) return;
    if (top() && top().v === "read" && top().id === id) { paintReader(id); return; }
    push({ v: "read", id }); paintReader(id); fetchWriting(id);
  }
  async function fetchWriting(id, quiet) {
    try { const w = pickW(await api("/api/writings/" + encodeURIComponent(id))); if (!w) throw mkErr("server", 0, "The server sent an empty writing"); cache.set(id, w); syncListItem(w); }
    catch (e) { if (!quiet) cache.set(id, { _err: e, id }); }
    if (top() && top().v === "read" && top().id === id) paintReader(id);
  }
  function syncListItem(w) { const i = L.items.findIndex(x => x.id === w.id); if (i < 0) return; const x = L.items[i]; Object.assign(x, { title: w.title, excerpt: String(w.body || "").slice(0, 240), updated_at: w.updated_at, comment_count: (w.comments || []).length, can_edit: w.can_edit }); }
  function paintReader(id) {
    const el = $(".bwr-read"), w = cache.get(id), li = L.items.find(x => x.id === id);
    const hd = (actions) => '<div class="bwr-h"><button type="button" class="bwr-hb" data-a="back" aria-label="Back to Writings">' + I.back + '</button><div class="bwr-ht bwr-ht-sm">Writings</div>' + (actions || "") + "</div>";
    if (!w || w._err) {
      const e = w && w._err, k = e ? (e.kind === "notfound" ? "gone" : kindOf(e)) : "";
      el.innerHTML = hd("") + '<div class="bwr-scroll">' + (k === "gone" ? '<div class="bwr-state">' + I.pen + "<b>This writing isn't here anymore</b><span>Its author may have deleted it.</span></div>" : k ? stateHtml(k, errText(e)) :
        '<article class="bwr-art">' + (li ? '<h1 class="bwr-title">' + esc(li.title || "Untitled") + '</h1><div class="bwr-by">' + avatar(li.author) + "<span><b>" + esc(nameOf(li.author)) + "</b></span></div>" : "") + '<div class="bwr-sk bwr-skb"><i></i><i></i><i></i><i></i></div></article>') + "</div>";
      el.querySelector('[data-a="back"]').onclick = () => history.back();
      wireState(el, () => { cache.delete(id); paintReader(id); fetchWriting(id); });
      if (k === "gone") { mapDropWriting(id); L.items = L.items.filter(x => x.id !== id); }
      return;
    }
    const auth = !!w.is_author || isMe(w.author), edited = w.updated_at && w.created_at && w.updated_at - w.created_at > 60000;
    const ub = w.updated_by && w.updated_by.username !== (w.author && w.author.username) ? w.updated_by : null;
    const coms = Array.isArray(w.comments) ? w.comments : [], eds = Array.isArray(w.editors) ? w.editors : [];
    el.innerHTML = hd((w.can_edit ? '<button type="button" class="bwr-hbtn" data-a="edit">' + I.edit + "<span>Edit</span></button>" : "") + '<button type="button" class="bwr-hb" data-a="more" aria-label="More">' + I.more + "</button>") +
      '<div class="bwr-scroll"><article class="bwr-art"><h1 class="bwr-title">' + esc(w.title || "Untitled") + "</h1>" +
      '<div class="bwr-by">' + avatar(w.author) + '<span class="bwr-byt"><b>' + esc(nameOf(w.author)) + (auth ? ' <em class="bwr-you">You</em>' : "") + "</b><small>@" + esc(w.author ? w.author.username : "") + " \u00b7 " + esc(fullDate(w.created_at)) + "</small></span></div>" +
      (edited || ub ? '<div class="bwr-edited">Edited ' + esc(fmtDate(w.updated_at)) + (ub ? " by " + esc(nameOf(ub)) + " (@" + esc(ub.username) + ")" : "") + "</div>" : "") +
      '<div class="snb-body bwr-body">' + (renderMd(w.body) || '<p class="bwr-faint">Nothing written yet</p>') + "</div>" +
      (auth || eds.length ? '<div class="bwr-eds">' + I.users + '<span class="bwr-edl">' + (eds.length ? "Editors: " + eds.map(x => "<b>" + esc(nameOf(x)) + "</b>").join(", ") : "Only you can edit this") + "</span>" + (auth ? '<button type="button" class="fx-btn small" data-a="editors">' + (eds.length ? "Manage" : "Add a friend") + "</button>" : "") + "</div>" : "") +
      "</article>" +
      '<section class="bwr-coms" aria-label="Comments"><h2>Comments' + (coms.length ? " <span>" + coms.length + "</span>" : "") + "</h2>" +
      (coms.length ? coms.map(c => '<div class="bwr-com" data-cid="' + esc(c.id) + '">' + avatar(c.author) + '<div class="bwr-comb"><div class="bwr-comh"><b>' + esc(isMe(c.author) ? "You" : nameOf(c.author)) + "</b><small>" + esc(fmtDate(c.created_at)) + "</small>" +
        (c.can_delete ? '<button type="button" class="bwr-cdel" data-a="cdel" aria-label="Delete comment" title="Delete comment">' + I.trash + "</button>" : "") + '</div><div class="bwr-comt">' + esc(c.body).replace(/\n/g, "<br>") + "</div></div></div>").join("") : '<p class="bwr-faint">No comments yet. Say something kind.</p>') +
      '<form class="bwr-cform"><textarea rows="2" maxlength="' + MAX_COMMENT + '" placeholder="Add a comment" aria-label="Add a comment"></textarea><button type="submit" class="fx-btn small primary" disabled>Post</button></form></section></div>';
    el.querySelector('[data-a="back"]').onclick = () => history.back();
    const eb = el.querySelector('[data-a="edit"]'); if (eb) eb.onclick = () => openEditor(w);
    el.querySelector('[data-a="more"]').onclick = () => readerMenu(w, auth);
    const mb = el.querySelector('[data-a="editors"]'); if (mb) mb.onclick = () => editorsSheet(w);
    $$("[data-a=cdel]", el).forEach(b => b.onclick = () => delComment(w, b.closest(".bwr-com").dataset.cid, b));
    $$(".bwr-body .snb-cb", el).forEach(b => { b.disabled = true; b.tabIndex = -1; });
    const f = el.querySelector(".bwr-cform"), ta = f.querySelector("textarea"), go = f.querySelector("button");
    const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight + 2, 180) + "px"; };
    ta.addEventListener("input", () => { go.disabled = !ta.value.trim(); grow(); });
    f.onsubmit = async ev => {
      ev.preventDefault(); const body = ta.value.trim(); if (!body) return;
      go.disabled = true; go.textContent = "Posting\u2026";
      try {
        const j = await api("/api/writings/" + encodeURIComponent(w.id) + "/comments", { method: "POST", body: { body } });
        const c = j.comment || (j.id ? j : null);
        const nc = Object.assign({ id: (c && c.id) || "c" + Date.now(), body, author: me(), created_at: Date.now(), can_delete: true }, c || {});
        if (!nc.author) nc.author = me(); if (nc.can_delete == null) nc.can_delete = true;
        w.comments = coms.concat([nc]); syncListItem(w); paintReader(w.id);
        const sc = $(".bwr-read .bwr-scroll"); if (sc) sc.scrollTop = sc.scrollHeight;
        toast("Comment posted");
      } catch (e) { go.disabled = false; go.textContent = "Post"; toast(e.kind === "notready" ? "Writings is almost ready. Check back soon." : "Couldn't post: " + errText(e), 3500); }
    };
  }
  async function delComment(w, cid, btn) {
    if (!confirm("Delete this comment?")) return;
    btn.disabled = true;
    try { await api("/api/writings/" + encodeURIComponent(w.id) + "/comments/" + encodeURIComponent(cid), { method: "DELETE" }); w.comments = (w.comments || []).filter(c => String(c.id) !== String(cid)); syncListItem(w); paintReader(w.id); toast("Comment deleted"); }
    catch (e) { btn.disabled = false; toast("Couldn't delete: " + errText(e), 3500); }
  }
  function readerMenu(w, auth) {
    const B = (a, ic, t, cls) => '<button type="button" class="bwr-mi' + (cls ? " " + cls : "") + '" data-m="' + a + '">' + ic + "<span>" + t + "</span></button>";
    modal(w.title || "Writing", '<div class="bwr-menu">' + (w.can_edit ? B("edit", I.edit, "Edit") : "") + (auth ? B("editors", I.users, "Editors (friends who can edit)") : "") + B("copy", I.copy, "Copy text") + B("refresh", I.cloud, "Refresh") + (auth ? B("del", I.trash, "Delete writing", "danger") : "") + "</div>", box => {
      $$("[data-m]", box).forEach(b => b.onclick = () => { const m = b.dataset.m; closeModal();
        if (m === "edit") openEditor(w);
        if (m === "editors") editorsSheet(w);
        if (m === "copy") copyText((w.title ? w.title + "\n\n" : "") + plain(w.body) + "\n\n\u2014 " + nameOf(w.author) + " on Bibley");
        if (m === "refresh") fetchWriting(w.id);
        if (m === "del") deleteSheet(w);
      });
    });
  }
  async function copyText(t) { let ok = false; try { if (FX && FX.ui && FX.ui.copyText) ok = await FX.ui.copyText(t); else { await navigator.clipboard.writeText(t); ok = true; } } catch {} toast(ok ? "Copied" : "Couldn't copy"); }
  function deleteSheet(w) {
    modal("Delete this writing?", '<p class="bwr-p">\u201c' + esc(w.title || "Untitled") + "\u201d and its comments will be removed for everyone. Your note in the Study Notebook stays.</p>" +
      '<div class="bwr-row"><button type="button" class="fx-btn" data-a="no">Cancel</button><button type="button" class="fx-btn primary bwr-danger" data-a="yes">Delete</button></div>', box => {
      box.querySelector('[data-a="no"]').onclick = closeModal;
      box.querySelector('[data-a="yes"]').onclick = async ev => {
        const b = ev.currentTarget; b.disabled = true; b.textContent = "Deleting\u2026";
        try {
          await api("/api/writings/" + encodeURIComponent(w.id), { method: "DELETE" });
          cache.delete(w.id); L.items = L.items.filter(x => x.id !== w.id); mapDropWriting(w.id); closeModal(); toast("Writing deleted");
          if (top() && top().v === "read") history.back(); else paintList();
        } catch (e) { b.disabled = false; b.textContent = "Delete"; toast("Couldn't delete: " + errText(e), 3500); }
      };
    });
  }
  function editorsSheet(w) {
    const draw = box => {
      const eds = Array.isArray(w.editors) ? w.editors : [];
      box.innerHTML = '<p class="bwr-p">Friends you add can edit this writing. Everyone with Bibley can still read it and comment.</p>' +
        '<div class="bwr-edlist">' + (eds.length ? eds.map(x => '<div class="bwr-edr">' + avatar(x) + '<span><b>' + esc(nameOf(x)) + "</b><small>@" + esc(x.username) + '</small></span><button type="button" class="fx-btn small" data-rm="' + esc(x.username) + '">Remove</button></div>').join("") : '<p class="bwr-faint">No editors yet.</p>') + "</div>" +
        '<form class="bwr-addf"><label class="bwr-at"><span>@</span><input name="u" autocapitalize="none" autocomplete="off" spellcheck="false" maxlength="24" placeholder="Friend\u2019s username" aria-label="Friend\u2019s username"></label><button type="submit" class="fx-btn small primary">Add</button></form><p class="bwr-err" role="alert" hidden></p>';
      const f = box.querySelector(".bwr-addf"), err = box.querySelector(".bwr-err");
      const fail = m => { err.textContent = m; err.hidden = false; };
      f.onsubmit = async ev => {
        ev.preventDefault(); err.hidden = true; const u = f.u.value.trim().replace(/^@/, ""); const go = f.querySelector("button");
        if (!/^[A-Za-z0-9_-]{3,24}$/.test(u)) return fail("Usernames are 3-24 letters, numbers, _ or -");
        if (isMe({ username: u }) || (w.author && w.author.username === u)) return fail("That's you. You can always edit your own writing.");
        if ((w.editors || []).some(x => x.username.toLowerCase() === u.toLowerCase())) return fail("@" + u + " can already edit this.");
        go.disabled = true; go.textContent = "Finding\u2026";
        try {
          let user;
          try { const j = await api("/api/users/lookup?username=" + encodeURIComponent(u)); user = j.user || j; }
          catch (e) { if (e.kind === "notfound") { go.disabled = false; go.textContent = "Add"; return fail("No Bibley user called @" + u + "."); } throw e; }
          go.textContent = "Adding\u2026";
          const j2 = await api("/api/writings/" + encodeURIComponent(w.id) + "/editors", { method: "POST", body: { username: user.username || u } });
          w.editors = Array.isArray(j2.editors) ? j2.editors : (w.editors || []).concat([{ username: user.username || u, display_name: user.display_name }]);
          toast(nameOf(user) + " can now edit this"); draw(box); if (top() && top().v === "read") paintReader(w.id);
        } catch (e) { go.disabled = false; go.textContent = "Add"; fail(e.kind === "notfound" ? "No Bibley user called @" + u + "." : errText(e)); }
      };
      $$("[data-rm]", box).forEach(b => b.onclick = async () => {
        const u = b.dataset.rm; if (!confirm("Stop @" + u + " from editing this?")) return; b.disabled = true;
        try {
          const j = await api("/api/writings/" + encodeURIComponent(w.id) + "/editors/" + encodeURIComponent(u), { method: "DELETE" });
          w.editors = Array.isArray(j.editors) ? j.editors : (w.editors || []).filter(x => x.username !== u);
          toast("@" + u + " removed"); draw(box); if (top() && top().v === "read") paintReader(w.id);
        } catch (e) { b.disabled = false; toast("Couldn't remove: " + errText(e), 3500); }
      });
    };
    modal("Editors", "<div></div>", box => draw(box));
  }

  /* ================= editor (live formatting) ================= */
  let wysEd = null, ed = null;          // ed = { w (base writing or null), title0, body0 }
  const curMd = () => { if (wysEd && wysEd.connected()) return wysEd.getMd(); const ta = root && $(".bwr-edit .bwr-ta"); return ta ? ta.value : ""; };
  const curTitle = () => { const t = root && $(".bwr-edit .bwr-tin"); return t ? t.value : ""; };
  function editDirty() { return !!(ed && !ed.saving && (curTitle() !== ed.title0 || curMd().replace(/\s+$/, "") !== ed.body0.replace(/\s+$/, ""))); }
  function openEditor(w) {
    ed = { w: w || null, title0: w ? w.title || "" : "", body0: w ? w.body || "" : "" };
    push({ v: "edit", id: w ? w.id : null }); drawEditor();
  }
  function drawEditor() {
    const el = $(".bwr-edit"), w = ed.w, MDE = window.BibleyMdEditor;
    const tb = (f, ic, l, txt) => '<button type="button" data-f="' + f + '" aria-label="' + l + '" title="' + l + '"' + (txt ? ' class="txt"' : "") + ">" + (ic || "") + (txt ? "<span>" + txt + "</span>" : "") + "</button>";
    el.innerHTML = '<div class="bwr-h"><button type="button" class="bwr-hb" data-a="back" aria-label="Cancel">' + I.x + '</button><div class="bwr-ht bwr-ht-sm">' + (w ? "Edit writing" : "New writing") + "</div>" +
      '<button type="button" class="fx-btn small primary bwr-save" data-a="save">' + (w ? "Save" : "Post") + "</button></div>" +
      '<div class="bwr-etools" role="toolbar" aria-label="Formatting">' + tb("h1", "", "Heading 1", "H1") + tb("h2", "", "Heading 2", "H2") + tb("b", I.bold, "Bold") + tb("i", I.ital, "Italic") + '<span class="sep"></span>' + tb("quote", I.quote, "Quote") + tb("ul", I.list, "Bullet list") + tb("ol", I.ol, "Numbered list") + tb("cl", I.check, "Checklist") + "</div>" +
      '<div class="bwr-scroll bwr-escroll"><div class="bwr-page"><input class="bwr-tin" maxlength="' + MAX_TITLE + '" placeholder="Title" aria-label="Title" value="' + esc(ed.title0) + '">' +
      '<div class="bwr-emeta">' + (w ? "by " + esc(nameOf(w.author)) + " \u00b7 version " + esc(w.version || 1) : I.globe + "Anyone with Bibley can read this") + "</div>" +
      (MDE ? '<div class="snb-wys snb-body bwr-wys" aria-label="Writing"></div>' : "") + '<textarea class="bwr-ta" aria-label="Writing"' + (MDE ? " hidden" : "") + ' placeholder="Write here">' + esc(ed.body0) + "</textarea></div></div>" +
      '<div class="bwr-efoot"><span class="bwr-wc"></span><span class="bwr-est"></span></div>';
    const ta = $(".bwr-ta", el); wysEd = null;
    const counts = () => { const t = curMd(), n = (t.match(/[A-Za-z0-9\u00c0-\u024f']+/g) || []).length; $(".bwr-wc", el).textContent = n + " word" + (n === 1 ? "" : "s"); $(".bwr-est", el).textContent = editDirty() ? "Not saved" : (w ? "No changes" : ""); };
    if (MDE) {
      wysEd = MDE.create($(".bwr-wys", el), { md: ed.body0, placeholder: "Write here. Verse references like John 3:16 become links for readers.",
        onChange: md => { ta.value = md; counts(); }, onState: s => $$(".bwr-etools [data-f]", el).forEach(b => b.classList.toggle("on", !!s[b.dataset.f])) });
    } else ta.addEventListener("input", counts);
    $(".bwr-tin", el).addEventListener("input", counts);
    $$(".bwr-etools [data-f]", el).forEach(b => { b.addEventListener("mousedown", e => e.preventDefault()); b.onclick = () => { tool(b.dataset.f); counts(); }; });
    el.querySelector('[data-a="back"]').onclick = () => history.back();
    el.querySelector('[data-a="save"]').onclick = save;
    counts();
    if (!w) setTimeout(() => { const t = $(".bwr-tin", el); if (t && isOpen()) t.focus(); }, 80);
  }
  // block formatting on the Markdown, same prefixes as the notebook
  const PFX = /^(\s*(?:#{1,3}\s+|>\s?|[-*]\s\[[ xX]\]\s?|[-*\u2022]\s+|\d+[.)]\s+))/;
  const KIND = { h1: /^#\s/, h2: /^##\s/, quote: /^\s*>/, cl: /^\s*[-*]\s\[[ xX]\]/, ul: /^\s*[-*\u2022]\s+(?!\[[ xX]\])/, ol: /^\s*\d+[.)]\s/ };
  function tool(f) {
    if (f === "b" || f === "i") { if (wysEd) wysEd.exec(f); else wrapTa(f === "b" ? "**" : "*"); return; }
    const r = wysEd ? wysEd.selectionMd() : (() => { const ta = $(".bwr-edit .bwr-ta"); return { md: ta.value, s: ta.selectionStart, e: ta.selectionEnd }; })();
    if (!r) { if (wysEd) wysEd.focus(); return; }
    const md = r.md, a = md.lastIndexOf("\n", Math.max(0, r.s - 1)) + 1, zEnd = md.indexOf("\n", r.e), z = zEnd < 0 ? md.length : zEnd;
    const lines = md.slice(a, z).split("\n"), all = lines.every(l => KIND[f].test(l));
    let n = 0; const out = lines.map(l => { const bare = l.replace(PFX, ""); if (all) return bare; n++; return (f === "h1" ? "# " : f === "h2" ? "## " : f === "quote" ? "> " : f === "ul" ? "- " : f === "ol" ? n + ". " : "- [ ] ") + bare; }).join("\n");
    const nmd = md.slice(0, a) + out + md.slice(z), caret = a + out.length;
    if (wysEd) { wysEd.setMd(nmd, caret); wysEd.focus(); const ta = $(".bwr-edit .bwr-ta"); if (ta) ta.value = nmd; }
    else { const ta = $(".bwr-edit .bwr-ta"); ta.value = nmd; ta.setSelectionRange(caret, caret); ta.focus(); }
  }
  function wrapTa(m) { const ta = $(".bwr-edit .bwr-ta"), s = ta.selectionStart, e = ta.selectionEnd, v = ta.value; ta.value = v.slice(0, s) + m + v.slice(s, e) + m + v.slice(e); ta.setSelectionRange(s + m.length, e + m.length); ta.focus(); }
  function validate(title, body) {
    if (!title.trim()) return "Add a title first";
    if (title.trim().length > MAX_TITLE) return "Titles can be up to " + MAX_TITLE + " characters";
    if (!body.trim()) return "Write something first";
    if (bytes(body) > MAX_BODY) return "This is too long to post (100 KB max). Try splitting it into parts.";
    return "";
  }
  async function save() {
    const el = $(".bwr-edit"), btn = $(".bwr-save", el), w = ed.w;
    const title = curTitle().trim(), body = curMd().replace(/\s+$/, "");
    const bad = validate(title, body); if (bad) { toast(bad); return; }
    if (w && !editDirty()) { history.back(); return; }
    btn.disabled = true; btn.textContent = "Saving\u2026"; ed.saving = true;
    try {
      let nw;
      if (w) nw = pickW(await api("/api/writings/" + encodeURIComponent(w.id), { method: "PATCH", body: { title, body, version: w.version } }));
      else nw = pickW(await api("/api/writings", { method: "POST", body: { title, body } }));
      if (!nw || !nw.id) nw = Object.assign({}, w || {}, { title, body, version: (w && w.version || 0) + 1 });
      afterSave(nw, !w);
    } catch (e) {
      ed.saving = false; btn.disabled = false; btn.textContent = w ? "Save" : "Post";
      if (e.kind === "conflict" && w) { conflictSheet(w, e, title, body); return; }
      if (e.kind === "notready") { toast("Writings is almost ready. Your text is still here; try again soon.", 4000); return; }
      if (e.kind === "signedout") { toast("Your sign-in ended. Sign in again, then save.", 4000); signIn(); return; }
      toast("Couldn't save: " + errText(e), 4000);
    }
  }
  function afterSave(nw, created) {
    cache.set(nw.id, nw); ed = null;
    if (created) { L.items.unshift({ id: nw.id, title: nw.title, excerpt: String(nw.body || "").slice(0, 240), author: nw.author || me(), created_at: nw.created_at || Date.now(), updated_at: nw.updated_at || Date.now(), comment_count: 0, can_edit: true }); replaceTop({ v: "read", id: nw.id }); paintReader(nw.id); toast("Posted \u2713 Anyone with Bibley can read it"); }
    else { syncListItem(nw); history.back(); toast("Saved \u2713"); }
  }
  async function conflictSheet(w, e, title, body) {
    let theirs = pickW(e.data) || (e.data && e.data.current) || null;
    if (!theirs || theirs.version == null) { try { theirs = pickW(await api("/api/writings/" + encodeURIComponent(w.id))); } catch {} }
    if (!theirs) { toast("Someone else saved this first. Couldn't load their version; try again.", 4000); return; }
    const who = theirs.updated_by ? (isMe(theirs.updated_by) ? "you (on another device)" : nameOf(theirs.updated_by) + " (@" + theirs.updated_by.username + ")") : "someone else";
    const ex = plain(theirs.body).replace(/\s+/g, " ").trim().slice(0, 220);
    modal("This writing changed", '<p class="bwr-p">While you were editing, ' + esc(who) + " saved a newer version" + (theirs.updated_at ? " " + esc(fmtDate(theirs.updated_at)) : "") + ".</p>" +
      '<div class="bwr-theirs"><b>' + esc(theirs.title || "Untitled") + "</b><span>" + esc(ex) + (ex.length >= 220 ? "\u2026" : "") + "</span></div>" +
      '<div class="bwr-col"><button type="button" class="fx-btn primary" data-a="mine">Keep mine<small>Save my version over theirs</small></button><button type="button" class="fx-btn" data-a="theirs">Load theirs<small>Drop my changes and edit the newest version</small></button><button type="button" class="fx-btn small bwr-link" data-a="copy">Copy my text first</button></div>', box => {
      box.querySelector('[data-a="copy"]').onclick = () => copyText(title + "\n\n" + body);
      box.querySelector('[data-a="theirs"]').onclick = () => { closeModal(); cache.set(theirs.id || w.id, theirs); ed = { w: Object.assign({ id: w.id }, theirs), title0: theirs.title || "", body0: theirs.body || "" }; drawEditor(); toast("Loaded the newest version"); };
      box.querySelector('[data-a="mine"]').onclick = async ev => {
        const b = ev.currentTarget; b.disabled = true;
        ed.saving = true;
        try { let nw = pickW(await api("/api/writings/" + encodeURIComponent(w.id), { method: "PATCH", body: { title, body, version: theirs.version } })); if (!nw || !nw.id) nw = Object.assign({}, theirs, { title, body, version: theirs.version + 1 }); closeModal(); afterSave(nw, false); }
        catch (x) { ed.saving = false; b.disabled = false; closeModal(); if (x.kind === "conflict") conflictSheet(Object.assign({}, w, { version: theirs.version }), x, title, body); else toast("Couldn't save: " + errText(x), 4000); }
      };
    });
  }

  /* ---------- in-screen sheet ---------- */
  function modal(title, html, wire, host) {
    const m = host || $(".bwr-modal");
    m.innerHTML = '<div class="bwr-mbox" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="bwr-mh"><b>' + esc(title) + '</b><button type="button" class="bwr-hb" data-a="mx" aria-label="Close">' + I.x + '</button></div><div class="bwr-mb">' + html + "</div></div>";
    m.hidden = false; m.querySelector('[data-a="mx"]').onclick = () => (host ? host._close() : closeModal()); m.onclick = e => { if (e.target === m) (host ? host._close() : closeModal()); };
    wire(m.querySelector(".bwr-mb"));
  }
  function closeModal() { const m = root && $(".bwr-modal"); if (m) { m.hidden = true; m.innerHTML = ""; } }

  /* ================= Post from the Study Notebook ================= */
  let pm = null;
  function postSheet() {
    if (pm && pm.isConnected) return pm;
    pm = document.createElement("div"); pm.className = "bwr-modal bwr-post"; pm.hidden = true;
    pm._close = () => { pm.hidden = true; pm.innerHTML = ""; document.removeEventListener("keydown", pmKey, true); };
    document.body.appendChild(pm); return pm;
  }
  function pmKey(e) { if (e.key === "Escape" && pm && !pm.hidden) { e.stopPropagation(); pm._close(); } }
  function openNotebook() { const NB = window.BibleyStudyNB; close(); setTimeout(() => { if (NB) NB.open({}); }, 60); }
  function openInWritings(id) { const NB = window.BibleyStudyNB; if (pm) pm._close(); try { if (NB && NB.isOpen()) NB.close(); } catch {} setTimeout(() => open({ id }), 60); }
  const noteTitle = n => { const t = String(n.title || "").trim(); if (t) return t.slice(0, MAX_TITLE); const first = plain(n.body).split("\n").map(x => x.trim()).find(Boolean) || ""; return first.slice(0, 80); };
  async function postFromNote(n) {
    if (!n) return; const host = postSheet(); document.addEventListener("keydown", pmKey, true);
    const title = noteTitle(n), body = String(n.body || "").replace(/\s+$/, "");
    const ex = plain(body).replace(/\s+/g, " ").trim(), prev = postedFor(n.id);
    const show = (t, html, wire) => modal(t, html, wire || (() => {}), host);
    if (!signedIn()) {
      show("Post to Writings", '<div class="bwr-state bwr-in">' + I.lock + "<b>Sign in to post</b><span>Writings are shared through your Bibley account. Sign in, then tap Post again.</span><button type=\"button\" class=\"fx-btn primary\" data-a=\"signin\">Sign in</button></div>", b => {
        b.querySelector('[data-a="signin"]').onclick = () => { host._close(); const NB = window.BibleyStudyNB; try { if (NB && NB.isOpen()) NB.close(); } catch {} setTimeout(signIn, 60); };
      });
      return;
    }
    const bad = validate(title, body); if (bad) { show("Post to Writings", '<p class="bwr-p">' + esc(bad === "Add a title first" ? "Give this note a title first." : bad) + "</p>", () => {}); return; }
    const almost = () => show("Writings is almost ready", '<div class="bwr-state bwr-in">' + I.pen + "<b>Writings is almost ready</b><span>Bibley's server is getting its Writings update. Your note is saved; tap Post again soon.</span></div>");
    const ask = (existing, warn) => {
      const upd = !!existing;
      show(upd ? "Update your post" : "Post to Writings",
        '<div class="bwr-pv"><b>' + esc(title) + "</b><span>" + esc(ex.slice(0, 260)) + (ex.length > 260 ? "\u2026" : "") + "</span></div>" +
        '<p class="bwr-pub">' + I.globe + "<span>Anyone with Bibley can read this" + (upd ? ". Your post will be replaced with this note." : " and leave comments.") + "</span></p>" +
        (warn ? '<p class="bwr-warn">' + esc(warn) + "</p>" : "") + '<p class="bwr-err" role="alert" hidden></p>' +
        '<div class="bwr-col"><button type="button" class="fx-btn primary" data-a="go">' + (upd ? "Update post" : "Post") + "</button>" +
        (upd ? '<button type="button" class="fx-btn" data-a="open">Open post in Writings</button><button type="button" class="fx-btn small bwr-link" data-a="new">Post as a new writing instead</button>' : '<button type="button" class="fx-btn" data-a="no">Cancel</button>') + "</div>", b => {
        const err = b.querySelector(".bwr-err"), go = b.querySelector('[data-a="go"]');
        const no = b.querySelector('[data-a="no"]'); if (no) no.onclick = host._close;
        const op = b.querySelector('[data-a="open"]'); if (op) op.onclick = () => openInWritings(existing.id);
        const nw = b.querySelector('[data-a="new"]'); if (nw) nw.onclick = () => ask(null);
        go.onclick = async () => {
          go.disabled = true; go.textContent = upd ? "Updating\u2026" : "Posting\u2026"; err.hidden = true;
          try {
            let w;
            if (upd) w = pickW(await api("/api/writings/" + encodeURIComponent(existing.id), { method: "PATCH", body: { title, body, version: existing.version } }));
            else w = pickW(await api("/api/writings", { method: "POST", body: { title, body } }));
            if (!w || !w.id) w = Object.assign({}, existing || {}, { title, body });
            mapPut(n.id, w); cache.set(w.id, w); L.state = ""; L.items = L.items.filter(x => x.id !== w.id);
            done(w, upd);
          } catch (e) {
            go.disabled = false; go.textContent = upd ? "Update post" : "Post";
            if (e.kind === "notready") { almost(); return; }
            if (e.kind === "conflict" && upd) { const cur = pickW(e.data); if (cur && cur.version != null) { existing = cur; err.textContent = (cur.updated_by && !isMe(cur.updated_by) ? nameOf(cur.updated_by) + " just edited this post. " : "This post just changed. ") + "Tap Update post again to replace it with your note, or open it in Writings first."; err.hidden = false; return; } }
            if (e.kind === "notfound" && upd) { mapDropWriting(existing.id); ask(null, "Your earlier post isn't there anymore, so this will post it again."); return; }
            if (e.kind === "forbidden" && upd) { ask(null, "You can't edit that post anymore, so this will post a new one."); return; }
            err.textContent = errText(e); err.hidden = false;
          }
        };
      });
    };
    const done = (w, upd) => show(upd ? "Post updated" : "Posted", '<div class="bwr-state bwr-in bwr-ok">' + I.globe + "<b>" + (upd ? "Your post is updated \u2713" : "Your note is posted \u2713") + "</b><span>\u201c" + esc(w.title || title) + "\u201d is in Writings, where anyone with Bibley can read and comment. Tap Post again later to update it.</span>" +
      '<div class="bwr-col"><button type="button" class="fx-btn primary" data-a="open">Open in Writings</button><button type="button" class="fx-btn" data-a="done">Done</button></div></div>', b => {
      b.querySelector('[data-a="open"]').onclick = () => openInWritings(w.id); b.querySelector('[data-a="done"]').onclick = host._close;
    });
    if (!prev) {
      if (ready === false) { try { await probe(); } catch {} if (ready === false) { almost(); return; } }
      ask(null); return;
    }
    show("Update your post", '<div class="bwr-sk bwr-skb"><i></i><i></i><i></i></div>');
    try {
      const w = pickW(await api("/api/writings/" + encodeURIComponent(prev.id)));
      if (!w) throw mkErr("notfound", 404, "Not found");
      const warn = w.updated_by && !isMe(w.updated_by) ? nameOf(w.updated_by) + " (@" + w.updated_by.username + ") edited this post " + fmtDate(w.updated_at) + ". Updating replaces their changes with your note." : "";
      ask(w, warn);
    } catch (e) {
      if (e.kind === "notready") { almost(); return; }
      if (e.kind === "notfound" || e.kind === "forbidden") { mapDropWriting(prev.id); ask(null, "Your earlier post isn't there anymore, so this will post it again."); return; }
      if (e.kind === "signedout") { host._close(); postFromNote(n); return; }
      show("Update your post", '<p class="bwr-p">' + esc(errText(e)) + '</p><div class="bwr-col"><button type="button" class="fx-btn" data-a="re">Try again</button></div>', b => { b.querySelector('[data-a="re"]').onclick = () => postFromNote(n); });
    }
  }

  window.BibleyWritings = { version: "7.7", open, close, isOpen, postFromNote, postedFor, icon: I.pen, KEY: K_MAP,
    _test: { api, probe, ready: () => ready, renderMd, plain, state: () => L, stack: () => stack.slice(), editDirty } };
})();
