/* Bibley 7.9: Historic Writings - a reading library of Church Fathers and Thomas Aquinas's Summa Theologiae.
   Open from More > Historic Writings, the Books drawer, or "Read in Bibley" on an AI teaching card (BibleyHistoric.open(key, section)).
   No lock (unlike Lost Books). Every work is a public-domain English translation, credited on its page:
   Ante-Nicene / Nicene & Post-Nicene Fathers (1885-1900) and the Summa's 1920 English Dominican translation, text via New Advent.
   Data (loaded only when the library is opened): hw-index.json (catalog + section titles), then the one
   hw-fathers-N.json / hw-summa-N.json bundle that holds the work being read. bibley-theology.js reads the same bundles for AI.
   Settings > Historic Writings: localStorage "bibley_historic_prefs_v1" {lib, ai, fathers, summa, classic} (all default on, synced
   with the account); every change fires window event "bibley:historic-prefs". Stored here too: "bibley_hw_last" (last section read). */
(function () {
  "use strict";
  if (window.BibleyHistoric) return;
  var K = "bibley_historic_prefs_v1", K_LAST = "bibley_hw_last", DEF = { lib: true, ai: true, fathers: true, summa: true, classic: true };
  var ICON = '<svg class="ui-ic" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20.5h16M5.5 20.5V10M9.8 20.5V10M14.2 20.5V10M18.5 20.5V10M3.5 10h17L12 4z"/></svg>';
  var GN = { fathers: "Church Fathers", summa: "Summa Theologiae" };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function base() { return location.hostname === "appassets.androidplatform.net" ? "https://olivercraftboycompany-design.github.io/Bibley-/" : ""; }
  function prefs() { var p = {}; try { p = JSON.parse(localStorage.getItem(K) || "{}") || {}; } catch (e) {} var o = {}; for (var k in DEF) o[k] = typeof p[k] === "boolean" ? p[k] : DEF[k]; return o; }
  function setPrefs(patch) { var p = Object.assign(prefs(), patch || {}); try { localStorage.setItem(K, JSON.stringify(p)); } catch (e) {} fire(); return p; }
  function fire() { try { window.dispatchEvent(new CustomEvent("bibley:historic-prefs", { detail: prefs() })); } catch (e) {} }
  function shelves() { var p = prefs(); return p.lib ? ["fathers", "summa"].filter(function (g) { return p[g]; }) : []; }
  function visible() { return shelves().length > 0; }
  var idxP = null, files = {};
  function catalog() { if (!idxP) { idxP = fetch(base() + "hw-index.json").then(function (r) { if (!r.ok) throw new Error("hw-index " + r.status); return r.json(); }); idxP.catch(function () { idxP = null; }); } return idxP; }
  function bundle(f) { if (!files[f]) { files[f] = fetch(base() + f).then(function (r) { if (!r.ok) throw new Error(f + " " + r.status); return r.json(); }); files[f].catch(function () { delete files[f]; }); } return files[f]; }
  function size() { try { return Math.max(15, Math.min(28, (window.FX && FX.prefs && FX.prefs.get().size) || 18)); } catch (e) { return 18; } }
  function toast(t) { try { (window.FX && FX.ui && FX.ui.toast) ? FX.ui.toast(t) : window.bibleyToast && window.bibleyToast(t); } catch (e) {} }

  var root = null, stack = [], shelf = "all", q = "", cat = null;
  function build() {
    if (root) return;
    root = document.createElement("section"); root.className = "hw-root"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Historic Writings");
    root.innerHTML = '<div class="hw-top"><button type="button" class="hw-hb hw-back" aria-label="Back"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button><div class="hw-title">Historic Writings</div><button type="button" class="hw-hb hw-x" aria-label="Close"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="hw-body"></div>';
    document.body.appendChild(root);
    root.querySelector(".hw-back").onclick = function () { history.back(); };
    root.querySelector(".hw-x").onclick = close;
    window.addEventListener("popstate", function (e) {
      if (!root.classList.contains("open")) return;
      var n = e.state && e.state.bibleyHW;
      if (!n) { hide(); return; }
      if (n < stack.length) { stack = stack.slice(0, n); render(); }
    });
  }
  function isOpen() { return !!(root && root.classList.contains("open")); }
  function go(v) { stack.push(v); try { history.pushState({ bibleyHW: stack.length }, ""); } catch (e) {} render(); }
  function open(key, sec) {
    if (!visible()) { toast("Historic Writings is turned off in Settings"); return; }
    build();
    if (!isOpen()) { stack = []; root.classList.add("open"); document.documentElement.classList.add("hw-noscroll"); go({ v: "home" }); }
    if (key) catalog().then(function (c) { var w = find(c, key); if (!w || shelves().indexOf(w.g) < 0) return; go(sec != null ? { v: "read", k: key, s: +sec } : { v: "work", k: key }); });
  }
  function hide() { if (!root) return; root.classList.remove("open"); document.documentElement.classList.remove("hw-noscroll"); stack = []; }
  function close() { if (!isOpen()) return; var n = stack.length; hide(); if (n) try { history.go(-n); } catch (e) {} }
  function find(c, k) { for (var i = 0; i < c.works.length; i++) if (c.works[i].k === k) return c.works[i]; return null; }
  function title(t) { root.querySelector(".hw-title").textContent = t; }
  function body() { var b = root.querySelector(".hw-body"); b.scrollTop = 0; return b; }
  function render() {
    var top = stack[stack.length - 1]; if (!top) return;
    root.querySelector(".hw-back").style.visibility = stack.length > 1 ? "visible" : "hidden";
    var b = body(); if (!cat) b.innerHTML = '<div class="hw-load">Loading the library\u2026</div>';
    catalog().then(function (c) {
      cat = c;
      if (top !== stack[stack.length - 1]) return;
      if (top.v === "home") vHome(b, c); else if (top.v === "work") vWork(b, c, top); else vRead(b, c, top);
    }).catch(function () { b.innerHTML = '<div class="hw-card hw-c"><p>Could not load Historic Writings. Check your connection and try again.</p><button type="button" class="hw-btn" data-retry>Try again</button></div>'; b.querySelector("[data-retry]").onclick = render; });
  }
  function gname(c, g) { var x = (c.groups || []).filter(function (y) { return y.id === g; })[0]; return x || { name: GN[g] || g }; }
  function credit(c, w) { return w.c || gname(c, w.g).c || ""; }
  function vHome(b, c) {
    title("Historic Writings");
    var sh = shelves(); if (shelf !== "all" && sh.indexOf(shelf) < 0) shelf = "all";
    var last = null; try { last = JSON.parse(localStorage.getItem(K_LAST) || "null"); } catch (e) {}
    var lw = last && find(c, last.k);
    b.innerHTML = '<div class="hw-search"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg><input type="search" placeholder="Search title, author, topic or Question" aria-label="Search Historic Writings" value="' + esc(q) + '"></div>' +
      '<div class="hw-chips">' + [["all", "All"]].concat(sh.map(function (g) { return [g, GN[g]]; })).map(function (x) { return '<button type="button" data-shelf="' + x[0] + '" class="' + (shelf === x[0] ? "on" : "") + '">' + x[1] + "</button>"; }).join("") + "</div>" +
      (lw && sh.indexOf(lw.g) >= 0 && !q ? '<button type="button" class="hw-cont" data-k="' + esc(lw.k) + '" data-s="' + (+last.s || 0) + '"><small>Continue reading</small><b>' + esc(lw.t) + "</b><span>" + esc(lw.x[+last.s || 0] || "") + "</span></button>" : "") +
      '<div class="hw-list"></div>';
    var inp = b.querySelector("input"), list = b.querySelector(".hw-list");
    function draw() {
      var words = q.toLowerCase().split(/\s+/).filter(Boolean), html = "", n = 0, lastPart = "";
      sh.forEach(function (g) {
        if (shelf !== "all" && shelf !== g) return;
        var gi = gname(c, g), items = "";
        c.works.forEach(function (w) {
          if (w.g !== g) return;
          var hay = (w.t + " " + (w.a || gi.a || "") + " " + (w.part || "") + " " + (w.n || "") + " " + (w.d || "") + " " + (g === "summa" ? "summa theologiae aquinas thomas question q" + w.q : "church fathers")).toLowerCase();
          var secHits = [];
          if (words.length && !words.every(function (x) { return hay.indexOf(x) >= 0; })) {
            w.x.forEach(function (st, si) { var s = st.toLowerCase(); if (words.every(function (x) { return s.indexOf(x) >= 0 || hay.indexOf(x) >= 0; })) secHits.push(si); });
            if (!secHits.length) return;
          }
          n++;
          if (g === "summa" && w.part !== lastPart) { lastPart = w.part; items += '<div class="hw-part">' + esc(w.part) + "</div>"; }
          items += '<button type="button" class="hw-item" data-k="' + esc(w.k) + '"><b>' + esc(g === "summa" ? w.t.replace(/^[IV-]+, /, "") : w.t) + "</b><small>" + esc(g === "summa" ? w.n : (w.a + " \u00b7 " + w.d + " \u00b7 " + w.n)) + "</small></button>" +
            secHits.slice(0, 4).map(function (si) { return '<button type="button" class="hw-hit" data-k="' + esc(w.k) + '" data-s="' + si + '">' + esc(w.x[si]) + "</button>"; }).join("");
        });
        if (items) html += '<div class="hw-shelf"><div class="hw-sh"><b>' + esc(gi.name) + "</b>" + (words.length ? "" : "<span>" + esc(gi.note || "") + "</span>") + '</div><div class="hw-card hw-pad0">' + items + "</div></div>";
      });
      list.innerHTML = html || '<div class="hw-empty">Nothing matches \u201c' + esc(q) + "\u201d.</div>";
      list.querySelectorAll("[data-k]").forEach(function (x) { x.onclick = function () { go(x.dataset.s != null ? { v: "read", k: x.dataset.k, s: +x.dataset.s } : { v: "work", k: x.dataset.k }); }; });
    }
    inp.oninput = function () { q = inp.value.trim(); draw(); };
    b.querySelectorAll("[data-shelf]").forEach(function (x) { x.onclick = function () { shelf = x.dataset.shelf; vHome(b, c); }; });
    var ct = b.querySelector(".hw-cont"); if (ct) ct.onclick = function () { go({ v: "read", k: ct.dataset.k, s: +ct.dataset.s }); };
    draw();
  }
  function head(c, w) {
    var gi = gname(c, w.g);
    return '<div class="hw-card hw-head"><span class="hw-tag">' + esc(gi.name) + "</span><h2>" + esc(w.g === "summa" ? "Summa Theologiae" : w.t) + "</h2>" + (w.g === "summa" ? "<h3>" + esc(w.t) + "</h3>" : "") +
      '<p class="hw-by">' + esc(w.a || gi.a || "") + " \u00b7 " + esc(w.d || gi.d || "") + " \u00b7 " + esc(w.n || "") + '</p><p class="hw-credit">' + esc(credit(c, w)) + ' <a href="' + esc(w.u) + '" target="_blank" rel="noopener">Source</a></p></div>';
  }
  function vWork(b, c, top) {
    var w = find(c, top.k); if (!w) { b.innerHTML = '<div class="hw-empty">This work is not in the library.</div>'; return; }
    title(w.g === "summa" ? "Summa Theologiae" : w.a);
    b.innerHTML = head(c, w) + '<div class="hw-card hw-pad0 hw-toc">' + w.x.map(function (t, i) { return '<button type="button" class="hw-item" data-s="' + i + '"><b>' + esc(t) + "</b></button>"; }).join("") + "</div>";
    b.querySelectorAll("[data-s]").forEach(function (x) { x.onclick = function () { go({ v: "read", k: w.k, s: +x.dataset.s }); }; });
    bundle(w.f).catch(function () {});   // warm the bundle while they pick a section
  }
  function vRead(b, c, top) {
    var w = find(c, top.k); if (!w) { b.innerHTML = '<div class="hw-empty">This work is not in the library.</div>'; return; }
    var s = Math.max(0, Math.min(w.x.length - 1, top.s | 0));
    title(w.g === "summa" ? w.t.split(":")[0] : w.t);
    b.innerHTML = '<div class="hw-load">Opening ' + esc(w.x[s]) + "\u2026</div>";
    bundle(w.f).then(function (d) {
      if (top !== stack[stack.length - 1]) return;
      var secs = d.works && d.works[w.k]; if (!secs || !secs[s]) throw new Error("missing");
      try { localStorage.setItem(K_LAST, JSON.stringify({ k: w.k, s: s })); } catch (e) {}
      var nav = '<div class="hw-nav"><button type="button" class="hw-btn" data-to="' + (s - 1) + '"' + (s ? "" : " disabled") + '>\u2039 Previous</button><span>' + (s + 1) + " / " + secs.length + '</span><button type="button" class="hw-btn" data-to="' + (s + 1) + '"' + (s < secs.length - 1 ? "" : " disabled") + ">Next \u203a</button></div>";
      b.innerHTML = '<article class="hw-read" style="font-size:' + size() + 'px"><p class="hw-rw"><button type="button" class="hw-link" data-work>' + esc(w.g === "summa" ? "Summa Theologiae \u00b7 " + w.t : w.t + " \u00b7 " + w.a) + "</button></p><h2>" + esc(secs[s][0]) + "</h2>" +
        secs[s][1].map(function (p) { var m = /^(Objection \d+\.|On the contrary,|I answer that,|Reply to Objection \d+\.)\s*/.exec(p); return "<p>" + (m ? "<b>" + esc(m[1]) + "</b> " + esc(p.slice(m[0].length)) : esc(p)) + "</p>"; }).join("") +
        "</article>" + nav + '<p class="hw-credit hw-foot">' + esc(credit(c, w)) + ' <a href="' + esc(w.u) + '" target="_blank" rel="noopener">Source</a></p>';
      b.querySelectorAll("[data-to]").forEach(function (x) { x.onclick = function () { var t = +x.dataset.to; if (t < 0 || t >= secs.length) return; stack[stack.length - 1] = { v: "read", k: w.k, s: t }; render(); }; });
      b.querySelector("[data-work]").onclick = function () { go({ v: "work", k: w.k }); };
    }).catch(function () { b.innerHTML = '<div class="hw-card hw-c"><p>Could not open this work. Check your connection and try again.</p><button type="button" class="hw-btn" data-retry>Try again</button></div>'; b.querySelector("[data-retry]").onclick = render; });
  }

  /* entry in the Books drawer (beside Lost Books); hidden while the library is switched off */
  function entry() {
    var drawer = document.getElementById("drawer"); if (!drawer) return;
    var wrap = document.getElementById("hwEntryWrap");
    if (!wrap) {
      wrap = document.createElement("div"); wrap.id = "hwEntryWrap"; wrap.className = "hw-entry-wrap";
      wrap.innerHTML = '<button type="button" id="hwDrawerBtn" class="hw-entry"><span class="hw-entry-ico">' + ICON + "</span><span><b>Historic Writings</b><small></small></span></button>";
      var lb = document.querySelector(".lb-entry-wrap"), headEl = drawer.querySelector(".drawer-head");
      if (lb && lb.parentNode === drawer) drawer.insertBefore(wrap, lb.nextSibling); else if (headEl && headEl.nextSibling) drawer.insertBefore(wrap, headEl.nextSibling); else drawer.appendChild(wrap);
      wrap.querySelector("button").onclick = function () { var cb = document.getElementById("closeNavBtn"); if (cb) cb.click(); setTimeout(function () { open(); }, 60); };
    }
    var sh = shelves(); wrap.hidden = !sh.length;
    wrap.querySelector("small").textContent = sh.map(function (g) { return GN[g]; }).join(" \u00b7 ");
  }
  window.addEventListener("bibley:historic-prefs", function () {
    entry();
    if (!isOpen()) return;
    var top = stack[stack.length - 1], w = top && top.k && cat && find(cat, top.k);
    if (!visible() || (w && shelves().indexOf(w.g) < 0)) close(); else if (top && top.v === "home") render();
  });
  function boot() {
    if (!document.querySelector("link[data-hw]")) { var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "bibley-historic.css"; l.dataset.hw = "1"; document.head.appendChild(l); }
    entry(); setTimeout(entry, 1500); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  window.BibleyHistoric = { open: open, close: close, isOpen: isOpen, prefs: prefs, setPrefs: setPrefs, visible: visible, shelves: shelves, catalog: catalog, icon: ICON };
})();
