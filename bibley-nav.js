/* bibley-nav.js - Bibley 5.9 (app 1.9): refined top bar and Books drawer.
   Top bar: Books (top-left) | chapter title | Study | version | Search (top-right) | More.
   Compare, fullscreen, bookmark and read aloud live in the More menu (the original buttons stay
   in the page, hidden, and the menu presses them, so their behaviour is unchanged).
   Books drawer: one book search, Old / New Testament tabs plus Lost Books, bookmarks as a chip row,
   tidy book rows with chapter counts, and a chapter view with a back arrow.
   Verse search moved to its own Search screen (the original search box and results are moved
   there with their handlers). No storage keys are added or changed here. */
(() => {
  "use strict";
  const FX = window.BibleyFX, C = window.BibleyCore;
  if (!FX || !C) return;
  const $ = id => document.getElementById(id);
  const drawer = $("drawer"), header = document.querySelector("header");
  if (!drawer || !header) return;
  const { BOOKS } = C;
  const esc = FX.ui.esc;
  const sv = d => '<svg class="ui-ic" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>";
  const IC = {
    search: sv('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'), more: sv('<circle cx="12" cy="5.5" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="12" cy="18.5" r="1.1"/>'),
    back: sv('<path d="M14.5 6l-6 6 6 6"/>'), close: sv('<path d="M6 6l12 12M18 6L6 18"/>'), chev: sv('<path d="M9.5 6l6 6-6 6"/>'),
    bookmark: sv('<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/>'), compare: sv('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M12 4.5v15"/>'),
    full: sv('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'), audio: sv('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
    sun: sv('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>'),
    gear: sv('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2"/><circle cx="12" cy="12" r="6.3"/>'),
    scroll: sv('<path d="M7 4h11a2 2 0 0 1 2 2v1h-4"/><path d="M16 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1h10"/><path d="M7 4a2 2 0 0 0-2 2v11"/>'),
    heart: sv('<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/>'),
    lock: sv('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>')
  };
  const bname = b => b[1] === "Psalm" ? "Psalms" : b[1];
  const GROUP_NAMES = { law: "Law", history: "History", "history-nt": "History", poetry: "Poetry & Wisdom", wisdom: "Poetry & Wisdom", prophets: "Prophets", "major-prophets": "Major prophets", "minor-prophets": "Minor prophets", gospels: "Gospels", letters: "Letters", "pauline": "Paul's letters", "general": "General letters", prophecy: "Prophecy" };

  /* ================= top bar ================= */
  const hr = header.querySelector(".header-right");
  const vs = $("versionSelect");
  const mk = (id, label, ic) => { const b = document.createElement("button"); b.type = "button"; b.id = id; b.className = "bn-hb"; b.setAttribute("aria-label", label); b.title = label; b.innerHTML = ic; return b; };
  const searchBtn = mk("bnSearchBtn", "Search verses", IC.search), moreBtn = mk("bnMoreBtn", "More", IC.more);
  if (hr) { hr.appendChild(searchBtn); hr.appendChild(moreBtn); }
  document.documentElement.classList.add("bn-on");
  const openNav = $("openNavBtn"); if (openNav) { openNav.setAttribute("aria-label", "Books"); openNav.title = "Books"; }

  // More menu
  let menu = null;
  function menuItems() {
    const bm = $("bookmarkBtn"), cmp = $("compareBtn"), fs = $("fullscreenBtn");
    const marked = bm && bm.classList.contains("active"), comparing = cmp && cmp.classList.contains("active"), full = fs && fs.classList.contains("active");
    return [["scroll", IC.scroll, "Scroll verses"], ["liked", IC.heart, "Liked verses"], ["bm", IC.bookmark, marked ? "Remove chapter bookmark" : "Bookmark this chapter", marked], ["tts", IC.audio, "Read this chapter aloud"], ["cmp", IC.compare, comparing ? "Stop comparing" : "Compare translations", comparing],
      ["fs", IC.full, full ? "Exit fullscreen" : "Fullscreen", full], ["today", IC.sun, "Today"], ["set", IC.gear, "Settings"]];
  }
  function closeMenu() { if (menu) { menu.remove(); menu = null; document.removeEventListener("pointerdown", outside, true); } }
  function outside(e) { if (menu && !menu.contains(e.target) && e.target !== moreBtn && !moreBtn.contains(e.target)) closeMenu(); }
  function openMenu() {
    if (menu) { closeMenu(); return; }
    menu = document.createElement("div"); menu.className = "bn-menu"; menu.setAttribute("role", "menu");
    menu.innerHTML = menuItems().map(([k, ic, t, on]) => '<button type="button" role="menuitem" data-k="' + k + '" class="' + (on ? "on" : "") + '">' + ic + "<span>" + esc(t) + "</span></button>").join("");
    document.body.appendChild(menu);
    menu.querySelectorAll("button").forEach(b => b.onclick = () => {
      const k = b.dataset.k; closeMenu();
      if (k === "bm") { const x = $("bookmarkBtn"); if (x) x.click(); }
      if (k === "cmp") { const x = $("compareBtn"); if (x) x.click(); }
      if (k === "fs") { const x = $("fullscreenBtn"); if (x) x.click(); }
      if (k === "tts") { const x = document.querySelector('.tts-btn[data-pane="a"]'); if (x) x.click(); }
      if (k === "today") FX.open.today();
      if (k === "set") FX.open.settings();
      if (k === "scroll" && window.BibleyScroll) window.BibleyScroll.open();
      if (k === "liked" && window.BibleyScroll) window.BibleyScroll.likedSheet();
    });
    setTimeout(() => document.addEventListener("pointerdown", outside, true), 0);
  }
  moreBtn.onclick = openMenu;

  /* ================= Search screen (verse text) ================= */
  const ss = $("scriptureSearch"), ssRow = $("ssScopeRow"), ssRes = $("scriptureSearchResults");
  let sp = null;
  function buildSearch() {
    sp = document.createElement("section"); sp.className = "bn-search"; sp.setAttribute("role", "dialog"); sp.setAttribute("aria-label", "Search verses");
    sp.innerHTML = '<div class="bn-sh"><button type="button" class="bn-hb bn-sback" aria-label="Back">' + IC.back + '</button><div class="bn-sbox">' + IC.search + '</div></div><div class="bn-sbody"><div class="bn-shint">Type a word or phrase, like <i>shepherd</i> or <i>love your neighbour</i>. Tap a result to open it.</div></div>';
    document.body.appendChild(sp);
    const box = sp.querySelector(".bn-sbox"), body = sp.querySelector(".bn-sbody");
    if (ss) { ss.placeholder = "Search verse text"; box.appendChild(ss); }
    if (ssRow) body.appendChild(ssRow);
    if (ssRes) body.appendChild(ssRes);
    // tidy: the drawer's emptied verse-search wrapper
    drawer.querySelectorAll(".search-wrap").forEach(w => { if (!w.children.length) w.classList.add("bn-gone"); });
    sp.querySelector(".bn-sback").onclick = () => history.back();
    if (ssRes) ssRes.addEventListener("click", e => { if (e.target.closest(".ss-item, [data-key], button:not(#ssWholeBibleBtn)")) setTimeout(() => { if (sp.classList.contains("open")) history.back(); }, 60); });
    window.addEventListener("popstate", () => { if (sp.classList.contains("open") && !(history.state && history.state.bnSearch)) sp.classList.remove("open"); });
  }
  function openSearch() {
    if (!sp) buildSearch();
    try { C.closeDrawer(); } catch {}
    sp.classList.add("open"); try { history.pushState({ bnSearch: 1 }, ""); } catch {}
    setTimeout(() => { try { ss && ss.focus(); } catch {} }, 120);
  }
  searchBtn.onclick = openSearch;
  // move the verse search out of the drawer now (one search field left in the drawer)
  buildSearch();

  /* ================= Books drawer ================= */
  const head = drawer.querySelector(".drawer-head");
  if (head) { const t = head.querySelector(".title"); if (t) t.innerHTML = 'Books<small class="bn-cur"></small>'; }
  const closeBtn = $("closeNavBtn"); if (closeBtn) { closeBtn.innerHTML = IC.close; closeBtn.setAttribute("aria-label", "Close"); }
  const bs = $("bookSearch"); if (bs) bs.placeholder = "Search books";
  const bml = $("bookmarkList");
  const nav = document.createElement("div"); nav.className = "bn-books";
  nav.innerHTML = '<div class="bn-tabs" role="tablist"><button type="button" data-t="ot" role="tab">Old Testament</button><button type="button" data-t="nt" role="tab">New Testament</button><button type="button" data-t="lost" role="tab" class="bn-lost">' + IC.scroll + 'Lost</button></div><div class="bn-list"></div>';
  const chap = document.createElement("div"); chap.className = "bn-chap"; chap.hidden = true;
  const bookListEl = $("bookList");
  if (bookListEl) { bookListEl.parentNode.insertBefore(nav, bookListEl); bookListEl.classList.add("bn-gone"); }
  else drawer.appendChild(nav);
  drawer.appendChild(chap);
  if (bml && nav.parentNode) nav.parentNode.insertBefore(bml, nav);
  let tab = "ot";
  const marks = () => { try { return C.getBookmarks() || []; } catch { return []; } };
  function drawList() {
    const list = nav.querySelector(".bn-list"); const q = (bs && bs.value || "").trim().toLowerCase();
    nav.querySelectorAll(".bn-tabs button").forEach(b => b.classList.toggle("on", !q && b.dataset.t === tab));
    nav.classList.toggle("searching", !!q);
    const cur = C.panes.a.bookIdx, bmSet = new Set(marks().map(m => m.bookIdx));
    let html = "", last = "";
    BOOKS.forEach((b, i) => {
      if (q) { if (!(b[1].toLowerCase().includes(q) || b[0].toLowerCase().includes(q))) return; }
      else if ((tab === "ot") !== (i < 39)) return;
      if (b[3] !== last) { last = b[3]; html += '<div class="bn-sec">' + esc(GROUP_NAMES[b[3]] || b[3]) + "</div>"; }
      html += '<button type="button" class="bn-book' + (i === cur ? " on" : "") + '" data-b="' + i + '"><span>' + esc(bname(b)) + (bmSet.has(i) ? '<i class="bn-dot" title="Bookmarked"></i>' : "") + "</span><small>" + b[2] + "</small></button>";
    });
    if (!html) html = '<div class="bn-empty">No book matches \u201c' + esc(bs.value) + '\u201d.<button type="button" class="fx-btn small" data-a="vs">' + IC.search + "Search verse text instead</button></div>";
    list.innerHTML = html;
    list.querySelectorAll("[data-b]").forEach(b => b.onclick = () => showChapters(+b.dataset.b));
    const vsb = list.querySelector('[data-a="vs"]'); if (vsb) vsb.onclick = () => { const t = bs.value; openSearch(); if (ss) { ss.value = t; ss.dispatchEvent(new Event("input", { bubbles: true })); } };
  }
  function showChapters(b) {
    const book = BOOKS[b]; const cur = C.panes.a; const bm = new Set(marks().filter(m => m.bookIdx === b).map(m => m.chapter));
    let g = ""; for (let c = 1; c <= book[2]; c++) g += '<button type="button" class="bn-ch' + (cur.bookIdx === b && cur.chapter === c ? " on" : "") + (bm.has(c) ? " bm" : "") + '" data-c="' + c + '">' + c + "</button>";
    chap.innerHTML = '<div class="bn-ch-h"><button type="button" class="bn-hb bn-cback" aria-label="Back to books">' + IC.back + '</button><div><b>' + esc(bname(book)) + "</b><small>" + book[2] + (book[2] === 1 ? " chapter" : " chapters") + (book[4] ? " \u00b7 " + esc(book[4]) : "") + '</small></div></div><div class="bn-grid">' + g + "</div>";
    chap.hidden = false; drawer.classList.add("bn-in-chap");
    chap.querySelector(".bn-cback").onclick = backToBooks;
    chap.querySelectorAll("[data-c]").forEach(x => x.onclick = () => { const c = +x.dataset.c; C.goTo(b, c); setTimeout(backToBooks, 300); });
    if (book[2] === 1) { /* one chapter: still let them confirm, it's one tap */ }
  }
  function backToBooks() { chap.hidden = true; drawer.classList.remove("bn-in-chap"); }
  nav.querySelectorAll(".bn-tabs button").forEach(b => b.onclick = () => {
    if (b.dataset.t === "lost") { const lb = $("lbDrawerBtn"); if (lb) lb.click(); else FX.ui.toast("Lost Books is still loading"); return; }
    tab = b.dataset.t; if (bs && bs.value) { bs.value = ""; bs.dispatchEvent(new Event("input", { bubbles: true })); } drawList();
  });
  if (bs) bs.addEventListener("input", drawList);
  function onOpen() {
    try { FX.clearSelection(); } catch {}
    document.querySelectorAll(".verses-text span.selected").forEach(s => s.classList.remove("selected"));
    backToBooks(); closeMenu();
    tab = C.panes.a.bookIdx < 39 ? "ot" : "nt"; drawList();
    const cur = drawer.querySelector(".bn-cur"); if (cur) cur.textContent = "Reading " + BOOKS[C.panes.a.bookIdx][1] + " " + C.panes.a.chapter;
    setTimeout(() => { const on = nav.querySelector(".bn-book.on"); if (on) on.scrollIntoView({ block: "center" }); }, 40);
  }
  let wasOpen = false;
  new MutationObserver(() => { const o = drawer.classList.contains("open"); document.documentElement.classList.toggle("bn-drawer-open", o); if (o && !wasOpen) onOpen(); wasOpen = o; }).observe(drawer, { attributes: true, attributeFilter: ["class"] });
  // swipe the drawer left to close
  let sx = null;
  drawer.addEventListener("touchstart", e => { sx = e.touches[0].clientX; }, { passive: true });
  drawer.addEventListener("touchend", e => { if (sx != null && sx - e.changedTouches[0].clientX > 70) { try { C.closeDrawer(); } catch {} } sx = null; }, { passive: true });
  drawList();

  window.BibleyNav = { openSearch, openMenu, closeMenu, showChapters, backToBooks, drawList };
})();
