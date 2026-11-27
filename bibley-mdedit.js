/* bibley-mdedit.js - Bibley 7.5 (2026-11-27): live formatting editor for the Study Notebook.
   A contenteditable editor that SHOWS formatting (bold is bold, headings are headings, lists are lists,
   checklists have boxes) while the note is still SAVED as the same Markdown Bibley has always stored:
     # / ## / ### headings, **bold**, *italic* (and _italic_), > quotes, > [!NOTE] callouts,
     - bullets, 1. numbered lists, - [ ] / - [x] checklists, --- dividers, ``` code blocks.
   One Markdown line = one line in the editor (a paragraph, a heading, a list item, a quote line), and a
   blank line is an empty paragraph, so Markdown -> editor -> Markdown gives the same text back.
   Block changes (toolbar headings, lists, quotes, code) are made on the Markdown and redrawn, with the
   caret carried through as two private-use marker characters (U+E000 / U+E001) that never reach storage.
   Typing shortcuts: "# " "## " "### " "- " "* " "1. " "> " "[] " at the start of a line, **bold**, *italic*,
   ``` or --- then Enter. Paste is plain text (Markdown in it is formatted). No libraries, no network.
   Public: window.BibleyMdEditor = { version, mdToHtml(md), domToMd(el), create(el, opts) }.
   create(el, { md, placeholder, onChange(md), onUndo(), onRedo(), onState(state) }) returns
   { getMd, setMd(md, caretMdOffset), selectionMd(), exec("b" | "i"), focus(), hasFocus(), connected(), state() }.
   ASCII only in this file. */
(function () {
  "use strict";
  var MS = "\uE000", ME = "\uE001", ZW = /[\u200B\uE000\uE001]/g, MARKS = /[\uE000\uE001]/g;
  var CALL = { NOTE: "Note", TIP: "Insight", PRAYER: "Prayer", KEY: "Key truth", WARNING: "Caution", QUESTION: "Question" };
  var RX = {
    fence: /^\s*```/, fenceEnd: /^\s*```\s*$/,
    quote: /^\s*>\s?(.*)$/, callout: /^\[!(\w+)\]\s*(.*)$/,
    cl: /^\s*([-*])\s\[( |x|X)\]\s?(.*)$/, hr: /^\s*(-{3,}|\*{3,}|_{3,})\s*$/,
    ul: /^\s*([-*\u2022])\s+(.*)$/, ol: /^\s*(\d+)([.)])\s+(.*)$/, h: /^(#{1,3})\s+(.*)$/,
    prefix: /^(\s*(?:#{1,3}\s+|>\s?(?:\[!\w+\]\s*)?|[-*]\s\[[ xX]\]\s?|[-*\u2022]\s+|\d+[.)]\s+))/
  };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------------- Markdown -> editor HTML ---------------- */
  // Same inline rules as the notebook's Preview (bibley-studynb.js inline()).
  function inl(t) {
    return esc(t).replace(/\*\*([^*\n]+?)\*\*/g, "<b>$1</b>")
      .replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\w)/g, "$1<i>$2</i>")
      .replace(/(^|[^\w])_([^_\n]+?)_(?!\w)/g, '$1<i data-u="1">$2</i>');
  }
  function cell(t) { return inl(t) + (String(t).replace(MARKS, "") === "" ? "<br>" : ""); }
  function mdToHtml(md) {
    var lines = String(md == null ? "" : md).replace(/\r\n?/g, "\n").split("\n"), out = "", i = 0, m;
    while (i < lines.length) {
      var ln = lines[i];
      if (RX.fence.test(ln)) {
        var lang = ln.replace(/^\s*```/, "").replace(MARKS, "").trim(), body = [], mk = (ln.match(MARKS) || []).join("");
        i++;
        while (i < lines.length && !RX.fenceEnd.test(lines[i].replace(MARKS, ""))) body.push(lines[i++]);
        if (i < lines.length) { mk += (lines[i].match(MARKS) || []).join(""); i++; }
        var txt = body.join("\n") + mk;
        out += '<pre class="mde-code"' + (lang ? ' data-lang="' + esc(lang) + '"' : "") + ">" + esc(txt) + (txt.replace(MARKS, "") === "" || /\n[\uE000\uE001]*$/.test(txt) ? "<br>" : "") + "</pre>";
        continue;
      }
      if (RX.quote.test(ln)) {
        var rows = [];
        while (i < lines.length && (m = RX.quote.exec(lines[i]))) { rows.push(m[1]); i++; }
        var c = RX.callout.exec(rows[0]);
        if (c) rows[0] = c[2];
        out += (c ? '<blockquote class="mde-callout" data-callout="' + esc(c[1]) + '" data-label="' + esc(CALL[c[1].toUpperCase()] || c[1]) + '">' : '<blockquote class="mde-quote">') +
          rows.map(function (r) { return "<p>" + cell(r) + "</p>"; }).join("") + "</blockquote>";
        continue;
      }
      if (RX.cl.test(ln)) {
        out += '<ul class="snb-cl mde-cl">';
        while (i < lines.length && (m = RX.cl.exec(lines[i]))) { out += '<li data-done="' + (m[2] !== " " ? "1" : "0") + '">' + cell(m[3]) + "</li>"; i++; }
        out += "</ul>"; continue;
      }
      if (RX.hr.test(ln)) { out += '<hr contenteditable="false" data-md="' + esc(ln.trim()) + '">'; i++; continue; }
      if (RX.ul.test(ln) && !RX.cl.test(ln)) {
        out += "<ul>";
        while (i < lines.length && !RX.cl.test(lines[i]) && !RX.hr.test(lines[i]) && (m = RX.ul.exec(lines[i]))) { out += (m[1] !== "-" ? '<li data-b="' + esc(m[1]) + '">' : "<li>") + cell(m[2]) + "</li>"; i++; }
        out += "</ul>"; continue;
      }
      if ((m = RX.ol.exec(ln))) {
        out += "<ol" + (+m[1] !== 1 ? ' start="' + (+m[1]) + '"' : "") + (m[2] === ")" ? ' data-d=")"' : "") + ">";
        while (i < lines.length && (m = RX.ol.exec(lines[i]))) { out += "<li>" + cell(m[3]) + "</li>"; i++; }
        out += "</ol>"; continue;
      }
      if ((m = RX.h.exec(ln))) { var n = m[1].length; out += "<h" + (n + 1) + ' class="snb-h' + n + '">' + cell(m[2]) + "</h" + (n + 1) + ">"; i++; continue; }
      out += "<p>" + (ln.replace(MARKS, "").trim() ? cell(ln) : (ln.match(MARKS) || []).join("") + "<br>") + "</p>";
      i++;
    }
    return out || "<p><br></p>";
  }

  /* ---------------- editor DOM -> Markdown ---------------- */
  var BLOCK = /^(P|DIV|H[1-6]|UL|OL|LI|BLOCKQUOTE|PRE|HR|TABLE|THEAD|TBODY|TFOOT|TR|TD|TH|SECTION|ARTICLE|HEADER|FOOTER|ASIDE|NAV|FIGURE|FIGCAPTION|DL|DT|DD|ADDRESS|MAIN|CENTER)$/;
  function isBlock(n) { return n.nodeType === 1 && BLOCK.test(n.tagName); }
  function isBold(el) { if (/^(B|STRONG)$/.test(el.tagName)) return true; var w = el.style && el.style.fontWeight; return w === "bold" || +w >= 600; }
  function isItal(el) { return /^(I|EM)$/.test(el.tagName) || (el.style && el.style.fontStyle === "italic"); }
  function wrap(mark, s) {
    if (!s.replace(MARKS, "").trim()) return s;
    return s.split("\n").map(function (part) {
      if (!part.replace(MARKS, "").trim()) return part;
      var lead = part.match(/^\s*/)[0], trail = part.match(/\s*$/)[0];
      return lead + mark + part.trim() + mark + trail;
    }).join("\n");
  }
  function inline(node, st) {
    st = st || {};
    if (node.nodeType === 3) return node.data.replace(/\u200B/g, "").replace(/\u00A0/g, " ").replace(/\n/g, " ");
    if (node.nodeType !== 1) return "";
    var tag = node.tagName;
    if (tag === "BR") return "\n";
    if (/^(IMG|SCRIPT|STYLE|TEMPLATE|INPUT|BUTTON|SELECT|TEXTAREA|SVG|svg)$/.test(tag)) return "";
    var b = !st.b && isBold(node), it = !st.i && isItal(node), sub = { b: st.b || b, i: st.i || it }, s = "";
    for (var c = node.firstChild; c; c = c.nextSibling) s += isBlock(c) ? "\n" + inline(c, sub) + "\n" : inline(c, sub);
    if (it) s = wrap(node.getAttribute && node.getAttribute("data-u") ? "_" : "*", s);
    if (b) s = wrap("**", s);
    return s;
  }
  function lineOf(el) { var s = inline(el); return s.replace(/\n$/, ""); }       // a trailing <br> is the empty-line placeholder
  function pushLines(s, out, pre) { s.split("\n").forEach(function (l) { out.push((pre || "") + l); }); }
  function listMd(el, out) {
    var cl = el.tagName === "UL" && (el.classList.contains("snb-cl") || el.hasAttribute("data-cl")), ol = el.tagName === "OL";
    var n = ol ? (parseInt(el.getAttribute("start"), 10) || 1) : 0, d = ol ? (el.getAttribute("data-d") || ".") : "";
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3 && !c.data.replace(ZW, "").trim()) continue;
      if (c.nodeType === 1 && (c.tagName === "UL" || c.tagName === "OL")) { listMd(c, out); continue; }
      var nested = [], text = "";
      if (c.nodeType === 1 && c.tagName === "LI") {
        for (var k = c.firstChild; k; k = k.nextSibling) { if (k.nodeType === 1 && (k.tagName === "UL" || k.tagName === "OL")) nested.push(k); else text += isBlock(k) ? " " + lineOf(k) + " " : inline(k); }
        text = text.replace(/\n$/, "").replace(/\s*\n\s*/g, " ");
        if (nested.length) text = text.replace(/^ +| +$/g, "");
      } else text = lineOf(c).replace(/\s*\n\s*/g, " ");
      var done = c.nodeType === 1 && (c.getAttribute("data-done") === "1" || c.classList.contains("done"));
      out.push((cl ? "- [" + (done ? "x" : " ") + "] " : ol ? (n++) + d + " " : ((c.nodeType === 1 && c.getAttribute("data-b")) || "-") + " ") + text);
      nested.forEach(function (x) { listMd(x, out); });
    }
  }
  function blockMd(el, out) {
    var tag = el.tagName, s, m;
    if (tag === "HR") { out.push(el.getAttribute("data-md") || "---"); return; }
    if (/^H[1-6]$/.test(tag)) {
      var hashes = tag === "H1" || tag === "H2" ? "#" : tag === "H3" ? "##" : "###";
      s = lineOf(el).split("\n");
      out.push(hashes + " " + s[0]); s.slice(1).forEach(function (l) { out.push(l); }); return;
    }
    if (tag === "UL" || tag === "OL") { listMd(el, out); return; }
    if (tag === "BLOCKQUOTE") {
      var sub = []; blocks(el, sub); if (!sub.length) sub = [""];
      var key = el.getAttribute("data-callout");
      sub.forEach(function (l, i) {
        if (i === 0 && key) out.push("> [!" + key + "]" + (l.replace(MARKS, "") || l ? " " + l : ""));
        else out.push(l ? "> " + l : ">");
      });
      return;
    }
    if (tag === "PRE") {
      var t = "";
      for (var c = el.firstChild; c; c = c.nextSibling) t += c.nodeType === 1 && c.tagName === "BR" ? (c.nextSibling ? "\n" : "") : (c.nodeType === 3 ? c.data : c.textContent);
      t = t.replace(/\u200B/g, "").replace(/\u00A0/g, " ");
      out.push("```" + (el.getAttribute("data-lang") || ""));
      if (t !== "") pushLines(t, out);
      out.push("```"); return;
    }
    if (tag === "LI") { out.push((el.getAttribute("data-b") || "-") + " " + lineOf(el).replace(/\s*\n\s*/g, " ")); return; }
    for (var k = el.firstChild; k; k = k.nextSibling) if (isBlock(k)) { blocks(el, out); return; }
    pushLines(lineOf(el), out);
  }
  function blocks(container, out) {
    var line = null;
    var flush = function () { if (line !== null) { pushLines(line.replace(/\n$/, ""), out); line = null; } };
    for (var n = container.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3 && line === null && !n.data.replace(/[\s\u200B]/g, "")) continue;   // whitespace between blocks
      if (isBlock(n)) { flush(); blockMd(n, out); }
      else line = (line || "") + inline(n);
    }
    flush();
  }
  function domToMd(root) { var out = []; blocks(root, out); return out.join("\n"); }

  /* ---------------- caret markers ---------------- */
  // Move a Markdown offset to where a caret can live in the editor (not inside "# ", "- [ ] ", a fence or "**").
  function clampPos(md, pos) {
    pos = Math.max(0, Math.min(md.length, pos | 0));
    for (var guard = 0; guard < 3; guard++) {
      var ls = md.lastIndexOf("\n", pos - 1) + 1, le = md.indexOf("\n", pos); if (le < 0) le = md.length;
      var line = md.slice(ls, le);
      if (RX.hr.test(line) || RX.fence.test(line)) {
        var fencesBefore = (md.slice(0, ls).match(/^\s*```/gm) || []).length;
        if (RX.fence.test(line) && fencesBefore % 2 === 1) { pos = ls > 0 ? ls - 1 : 0; continue; }   // closing fence: end of the code
        if (le < md.length) { pos = le + 1; continue; }
        pos = ls > 0 ? ls - 1 : 0; break;
      }
      var p = RX.prefix.exec(line);
      if (p && pos - ls < p[1].length) pos = ls + p[1].length;
      break;
    }
    while (pos > 0 && pos < md.length && /[*_]/.test(md[pos - 1]) && /[*_]/.test(md[pos])) pos++;
    return pos;
  }
  function withMarkers(md, s, e) {
    if (s == null) return md;
    if (e == null || e < s) e = s;
    s = clampPos(md, s); e = Math.max(s, clampPos(md, e));
    return e > s ? md.slice(0, s) + MS + md.slice(s, e) + ME + md.slice(e) : md.slice(0, s) + MS + md.slice(s);
  }

  /* ---------------- the editor ---------------- */
  function create(el, opts) {
    opts = opts || {};
    var last = "", lastRange = null, composing = false, stateT = null;
    el.setAttribute("contenteditable", "true"); el.setAttribute("spellcheck", "true"); el.setAttribute("role", "textbox"); el.setAttribute("aria-multiline", "true");
    el.classList.add("mde");
    if (opts.placeholder) el.setAttribute("data-ph", opts.placeholder);

    function emptyCheck() { el.classList.toggle("mde-empty", !last); }
    function emit() { var md = domToMd(el).replace(MARKS, ""); if (md === last) return; last = md; emptyCheck(); if (opts.onChange) opts.onChange(md); }
    function inEl(node) { return !!node && (node === el || el.contains(node)); }
    function curRange() {
      var sel = window.getSelection && window.getSelection();
      if (sel && sel.rangeCount && inEl(sel.getRangeAt(0).startContainer)) return sel.getRangeAt(0);
      return null;
    }
    // The block that holds a node: a paragraph, heading, list item, quote line or code block.
    function lineEl(node) {
      for (var n = node && node.nodeType === 3 ? node.parentNode : node; n && n !== el; n = n.parentNode) {
        if (n.nodeType === 1 && /^(P|DIV|H[1-6]|LI|PRE)$/.test(n.tagName)) return n;
      }
      return null;
    }
    // A caret between blocks (directly in the editor) is moved into the nearest block.
    function fixRange(r) {
      if (r.startContainer !== el) return r;
      var kids = el.childNodes, k = kids[r.startOffset] || kids[r.startOffset - 1], atEnd = !kids[r.startOffset];
      while (k && k.nodeType === 1 && k.tagName === "HR") { k = atEnd ? k.previousSibling : (k.nextSibling || k.previousSibling); }
      if (!k) return r;
      var nr = document.createRange();
      if (atEnd) { nr.selectNodeContents(k); nr.collapse(false); } else { nr.selectNodeContents(k); nr.collapse(true); }
      return nr;
    }
    function insertMarkers(r) {
      r = fixRange(r);
      var e = r.cloneRange(); e.collapse(false);
      var s = r.cloneRange(); s.collapse(true);
      var nodes = [];
      if (!r.collapsed) { var te = document.createTextNode(ME); e.insertNode(te); nodes.push(te); }
      var ts = document.createTextNode(MS); s.insertNode(ts); nodes.push(ts);
      return nodes;
    }
    // Markdown of the editor with the caret / selection marked, or null when the caret isn't here.
    function markedMd(useLast) {
      var r = curRange() || (useLast && lastRange && inEl(lastRange.startContainer) ? lastRange : null);
      if (!r) return null;
      var nodes = insertMarkers(r), md = domToMd(el);
      nodes.forEach(function (n) { var p = n.parentNode; if (p) { p.removeChild(n); p.normalize && p.normalize(); } });
      return md;
    }
    function selectionMd() {
      var md = markedMd(true); if (md == null) return null;
      var s = md.indexOf(MS), e = md.indexOf(ME), clean = md.replace(MARKS, "");
      if (s < 0) return null;
      if (e < 0) return { s: s, e: s, md: clean };
      if (e < s) { var x = s; s = e; e = x - 1; } else e = e - 1;
      return { s: s, e: e, md: clean };
    }
    function restoreCaret(focus) {
      var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), n, sPos = null, ePos = null, hits = [];
      while ((n = w.nextNode())) if (n.data.indexOf(MS) >= 0 || n.data.indexOf(ME) >= 0) hits.push(n);
      hits.forEach(function (t) {
        var i;
        while ((i = t.data.search(MARKS)) >= 0) {
          var ch = t.data[i]; t.deleteData(i, 1);
          var pos = { node: t, off: i };
          if (ch === MS) sPos = pos; else ePos = pos;
        }
      });
      if (!sPos) return false;
      var fix = function (p) {
        if (p.node.data === "" && p.node.parentNode) { var par = p.node.parentNode, idx = Array.prototype.indexOf.call(par.childNodes, p.node); par.removeChild(p.node); return { node: par, off: idx }; }
        return p;
      };
      var range = document.createRange(), same = ePos && ePos.node === sPos.node;
      if (same && sPos.node.data === "") ePos = null;
      sPos = fix(sPos); if (ePos && !same) ePos = fix(ePos);
      range.setStart(sPos.node, Math.min(sPos.off, sPos.node.nodeType === 3 ? sPos.node.data.length : sPos.node.childNodes.length));
      if (ePos) { try { range.setEnd(ePos.node, Math.min(ePos.off, ePos.node.nodeType === 3 ? ePos.node.data.length : ePos.node.childNodes.length)); } catch (e) {} }
      if (focus !== false) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
      var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); lastRange = range.cloneRange();
      try { var b = (sPos.node.nodeType === 3 ? sPos.node.parentNode : sPos.node); if (b && b.scrollIntoView && b.getBoundingClientRect) { var rc = b.getBoundingClientRect(); if (rc.bottom > innerHeight - 60 || rc.top < 60) b.scrollIntoView({ block: "nearest" }); } } catch (e) {}
      return true;
    }
    // Redraw from Markdown (which may carry markers); emits a change if the clean text differs.
    function render(mdMarked, focus) {
      el.innerHTML = mdToHtml(mdMarked);
      restoreCaret(focus);
      var clean = String(mdMarked).replace(MARKS, "");
      if (clean !== last) { last = clean; emptyCheck(); if (opts.onChange) opts.onChange(clean); }
      else emptyCheck();
      pushState();
    }
    function setMd(md, caret, caretEnd) {
      md = String(md == null ? "" : md).replace(MARKS, "");
      last = md;
      el.innerHTML = mdToHtml(caret == null ? md : withMarkers(md, caret, caretEnd));
      if (caret != null) restoreCaret(true);
      emptyCheck(); pushState();
    }
    // Edit the Markdown lines around the caret: fn(lines, index of the caret line) changes lines in place.
    function editLines(fn) {
      var md = markedMd(false); if (md == null) return false;
      var lines = md.split("\n"), idx = -1;
      for (var i = 0; i < lines.length; i++) if (lines[i].indexOf(MS) >= 0) { idx = i; break; }
      if (idx < 0) return false;
      if (fn(lines, idx) === false) return false;
      render(lines.join("\n"), true);
      return true;
    }

    /* toolbar state */
    function state() {
      var r = curRange(), s = {};
      if (!r) return s;
      try { s.b = document.queryCommandState("bold"); s.i = document.queryCommandState("italic"); } catch (e) {}
      for (var n = r.startContainer; n && n !== el; n = n.parentNode) {
        if (n.nodeType !== 1) continue;
        var t = n.tagName;
        if (t === "H2") s.h1 = true; else if (t === "H3") s.h2 = true; else if (t === "H4") s.h3 = true;
        else if (t === "PRE") s.code = true;
        else if (t === "BLOCKQUOTE") { if (n.getAttribute("data-callout")) s.callout = true; else s.quote = true; }
        else if (t === "OL") s.ol = true;
        else if (t === "UL") { if (n.classList.contains("snb-cl")) s.cl = true; else s.ul = true; }
        else if ((t === "B" || t === "STRONG") && !("b" in s)) s.b = true;
      }
      return s;
    }
    function pushState() { if (!opts.onState) return; clearTimeout(stateT); stateT = setTimeout(function () { opts.onState(state()); }, 30); }
    function onSel() {
      if (!el.isConnected) { document.removeEventListener("selectionchange", onSel); return; }
      var r = curRange(); if (r) { lastRange = r.cloneRange(); pushState(); }
    }
    document.addEventListener("selectionchange", onSel);

    var execing = false;
    function exec(cmd) {
      if (execing) return; execing = true;
      try { execNow(cmd); } finally { execing = false; }
    }
    function execNow(cmd) {
      if (!curRange()) {
        try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
        if (lastRange && inEl(lastRange.startContainer)) { var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(lastRange); }
      }
      try { document.execCommand("styleWithCSS", false, false); } catch (e) {}
      document.execCommand(cmd === "b" ? "bold" : "italic", false, null);
      emit(); pushState();
    }

    /* typing shortcuts */
    function blockShortcut() {
      var r = curRange(); if (!r || !r.collapsed) return false;
      var p = lineEl(r.startContainer); if (!p || p.tagName !== "P" || p.parentNode !== el) return false;
      var pre = document.createRange(); pre.selectNodeContents(p); pre.setEnd(r.startContainer, r.startOffset);
      var before = pre.toString().replace(/\u200B/g, "").replace(/\u00A0/g, " ");
      if (!/^(#{1,3} |[-*] |\d+[.)] |> |\[ ?\] |[-*] \[[ xX]\] )$/.test(before)) return false;
      return editLines(function (lines, i) {
        if (/^\[ ?\] /.test(lines[i])) lines[i] = lines[i].replace(/^\[ ?\] /, "- [ ] ");
      });
    }
    function inlineShortcut() {
      var r = curRange(); if (!r || !r.collapsed || r.startContainer.nodeType !== 3) return false;
      var t = r.startContainer, upto = t.data.slice(0, r.startOffset), m, tag, inner, len;
      if (lineEl(t) && lineEl(t).tagName === "PRE") return false;
      if ((m = /\*\*([^*\n]*[^*\s\n])\*\*$/.exec(upto)) && m[1].trim()) { tag = "b"; inner = m[1]; len = m[0].length; }
      else if ((m = /(^|[^*\w])\*([^*\s\n](?:[^*\n]*[^*\s\n])?)\*$/.exec(upto))) { tag = "i"; inner = m[2]; len = m[2].length + 2; }
      else if ((m = /(^|[^\w])_([^_\s\n](?:[^_\n]*[^_\s\n])?)_$/.exec(upto))) { tag = "i"; inner = m[2]; len = m[2].length + 2; }
      else return false;
      var start = r.startOffset - len, rest = t.splitText(r.startOffset);
      t.deleteData(start, len);
      var node = document.createElement(tag); node.textContent = inner; if (m && upto.slice(-1) === "_") node.setAttribute("data-u", "1");
      var zw = document.createTextNode("\u200B");
      rest.parentNode.insertBefore(node, rest); rest.parentNode.insertBefore(zw, rest);
      var nr = document.createRange(); nr.setStart(zw, 1); nr.collapse(true);
      var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(nr);
      return true;
    }

    /* events */
    el.addEventListener("compositionstart", function () { composing = true; });
    el.addEventListener("compositionend", function () { composing = false; setTimeout(function () { if (!composing) { emit(); } }, 0); });
    el.addEventListener("input", function (e) {
      if (!el.firstChild) el.innerHTML = "<p><br></p>";
      if (!e.isComposing && !composing && e.inputType === "insertText" && e.data) {
        if (/ $/.test(e.data) && blockShortcut()) return;
        if (/[*_]$/.test(e.data) && inlineShortcut()) { emit(); return; }
      }
      if (e.inputType === "insertParagraph") {   // a new checklist item starts unticked
        var r = curRange(), li = r && lineEl(r.startContainer);
        if (li && li.tagName === "LI" && li.getAttribute("data-done") === "1" && !li.textContent.replace(ZW, "").trim()) li.setAttribute("data-done", "0");
      }
      emit(); pushState();
    });
    el.addEventListener("beforeinput", function (e) {
      var t = e.inputType;
      if (t === "historyUndo" || t === "historyRedo") { e.preventDefault(); if (t === "historyUndo") { if (opts.onUndo) opts.onUndo(); } else if (opts.onRedo) opts.onRedo(); return; }
      if (t === "formatBold" || t === "formatItalic") { e.preventDefault(); exec(t === "formatBold" ? "b" : "i"); return; }
      if (t === "insertFromDrop") { e.preventDefault(); return; }
      if (t !== "insertParagraph" || composing) return;
      var r = curRange(); if (!r) return;
      var ln = lineEl(r.startContainer), text = ln ? ln.textContent.replace(ZW, "").replace(/\u00A0/g, " ") : "";
      if (!ln) return;
      if (ln.tagName === "PRE") {
        e.preventDefault();
        editLines(function (lines, i) {
          var line = lines[i], k = line.indexOf(MS);
          if (!line.replace(MARKS, "") && i + 1 < lines.length && RX.fenceEnd.test(lines[i + 1])) {   // Enter on an empty last code line: leave the code block
            lines.splice(i, 1); lines.splice(i + 1, 0, MS); return;
          }
          lines[i] = line.slice(0, k); lines.splice(i + 1, 0, line.slice(k));
        });
        return;
      }
      if (ln.tagName === "LI" && !text.trim()) { e.preventDefault(); editLines(function (lines, i) { lines[i] = MS; }); return; }   // empty item: end the list
      if (ln.tagName === "P" && ln.parentNode && ln.parentNode.tagName === "BLOCKQUOTE" && !text.trim()) {   // empty quote line: leave the quote
        e.preventDefault(); editLines(function (lines, i) { lines[i] = MS; }); return;
      }
      if (ln.tagName === "P" && ln.parentNode === el && (/^```[\w+-]*$/.test(text.trim()) || RX.hr.test(text))) {
        e.preventDefault();
        editLines(function (lines, i) {
          var clean = lines[i].replace(MARKS, "").trim();
          if (/^```/.test(clean)) { lines.splice(i, 1, clean, MS, "```"); }
          else { lines.splice(i, 1, clean, MS); }
        });
      }
    });
    el.addEventListener("keydown", function (e) {
      var mod = e.ctrlKey || e.metaKey, k = (e.key || "").toLowerCase();
      if (mod && !e.altKey && k === "z") { e.preventDefault(); if (e.shiftKey) { if (opts.onRedo) opts.onRedo(); } else if (opts.onUndo) opts.onUndo(); return; }
      if (mod && !e.altKey && k === "y") { e.preventDefault(); if (opts.onRedo) opts.onRedo(); return; }
      if (mod && !e.altKey && (k === "b" || k === "i")) { e.preventDefault(); exec(k); return; }
      if (e.key === "Tab" && !mod) {
        var r = curRange(), ln = r && lineEl(r.startContainer);
        if (ln && ln.tagName === "PRE") { e.preventDefault(); document.execCommand("insertText", false, "  "); }
      }
    });
    // paste: plain text only; Markdown in it is formatted like typed Markdown
    el.addEventListener("paste", function (e) {
      var cd = e.clipboardData || window.clipboardData; if (!cd) return;
      e.preventDefault();
      var text = String(cd.getData("text/plain") || "").replace(/\r\n?/g, "\n").replace(MARKS, "").replace(/\u00A0/g, " ");
      if (!text) return;
      var r = curRange(); if (!r) return;
      if (text.indexOf("\n") < 0) { document.execCommand("insertText", false, text); return; }
      if (!r.collapsed) { r.deleteContents(); }
      editLines(function (lines, i) {
        var line = lines[i].replace(ME, ""), k = line.indexOf(MS);
        var parts = (line.slice(0, k) + text + MS + line.slice(k + 1)).split("\n");
        lines.splice.apply(lines, [i, 1].concat(parts));
      });
    });
    el.addEventListener("drop", function (e) { e.preventDefault(); });
    // checklist boxes: a tap on the box ticks it (the box is drawn by CSS in the item's left padding)
    function boxHit(e) {
      var li = e.target && e.target.closest ? e.target.closest("ul.snb-cl > li") : null;
      if (!li || !inEl(li)) return null;
      var rc = li.getBoundingClientRect(), x = (e.clientX != null ? e.clientX : 0) - rc.left;
      return x >= -4 && x < 30 ? li : null;
    }
    el.addEventListener("mousedown", function (e) { if (boxHit(e)) e.preventDefault(); });
    el.addEventListener("click", function (e) {
      var li = boxHit(e); if (!li) return;
      e.preventDefault();
      li.setAttribute("data-done", li.getAttribute("data-done") === "1" ? "0" : "1");
      emit();
    });
    el.addEventListener("focus", function () { try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) {} });

    setMd(opts.md || "");
    return {
      el: el,
      getMd: function () { return last; },
      setMd: setMd,
      sync: function () { emit(); return last; },
      selectionMd: selectionMd,
      exec: exec,
      editLines: editLines,
      state: state,
      focus: function () { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } },
      hasFocus: function () { return document.activeElement === el || !!curRange(); },
      connected: function () { return el.isConnected; }
    };
  }

  window.BibleyMdEditor = { version: "7.5", mdToHtml: mdToHtml, domToMd: domToMd, create: create, withMarkers: withMarkers, clampPos: clampPos, MS: MS, ME: ME };
})();
