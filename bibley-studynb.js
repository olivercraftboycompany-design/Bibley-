/* bibley-studynb.js - Bibley 7.0 Study Notebook: a full-page study workspace (was a bottom sheet, 5.7).
   Desktop/tablet (>= 840px): sidebar (All Notes, Pinned, Highlights & Bookmarks, notebooks, tags, paper)
   + notes list + editor. Phone: stacked full-screen views (notebooks -> notes -> editor) with back buttons.
   Editor: H1/H2, bold, italic, quote, callout, bullets, numbers, checklists, divider, undo/redo,
   Write / Split / Preview, Insert Verse (KJV by reference or keyword), verse preview popovers,
   word / character count + read time, autosave, paper styles, focus mode, dictation, .md/.txt export, print.
   New data lives ONLY under new keys (unchanged since 5.7; 7.0 adds optional meta fields paper + mode):
     bibley_nb_v1_notebooks  [{id,name,color,created}]
     bibley_nb_v1_notes      [{id,nb,title,body,tags,pinned,tpl,created,updated,from}]
     bibley_nb_v1_meta       {sort, converted:{srcId:{to,at}}, pins:{srcId:1}, paper, mode}
   Older notes are READ ONLY from their own keys and shown as imported notebooks:
     bibley_notes_v1 (verse notes from the reader), bibley_notebook_v1 (the paged notebook),
     bible_highlights_v2, bible_bookmarks_v2, bibley_vbm_v1. Those keys are never written here. */
(() => {
  "use strict";
  const FX = window.BibleyFX, C = window.BibleyCore;
  if (!FX || !C || !FX.ui) { console.warn("Study Notebook: features missing"); return; }
  const { openSheet, closeSheet, toast, copyText, h, esc, vname } = FX.ui;
  const BOOKS = C.BOOKS;
  const KN = "bibley_nb_v1_notebooks", KT = "bibley_nb_v1_notes", KM = "bibley_nb_v1_meta";
  const OLD = { NOTES: "bibley_notes_v1", NB: "bibley_notebook_v1", HL: "bible_highlights_v2", BM: "bible_bookmarks_v2", VBM: "bibley_vbm_v1" };
  const rd = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
  const wr = (k, v) => { if (!/^bibley_nb_v1_/.test(k)) return false; try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { toast("Couldn't save: storage is full"); return false; } };
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const COLORS = [["gold", "#c9a867"], ["sage", "#8fa58a"], ["sky", "#7fa3b8"], ["slate", "#8590a8"], ["clay", "#b98a6e"], ["rose", "#b88a96"], ["lavender", "#9c90b8"]];
  const colorOf = c => (COLORS.find(x => x[0] === c) || COLORS[0])[1];
  const HLC = { yellow: "#e9cf7a", green: "#9fcfae", blue: "#9dbde6", pink: "#e3a9c3", purple: "#b9addf" };

  /* ---------- icons (line, 24 grid) ---------- */
  const sv = (p, s) => `<svg class="ui-ic" viewBox="0 0 24 24" width="${s || 18}" height="${s || 18}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const I = {
    plus: sv('<path d="M12 5v14M5 12h14"/>'),
    search: sv('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
    back: sv('<path d="M15 5l-7 7 7 7"/>'),
    chev: sv('<path d="M9 5l7 7-7 7"/>', 16),
    pin: sv('<path d="M9 4h6l-1 6 3 3H7l3-3-1-6zM12 13v7"/>'),
    tag: sv('<path d="M3 12V4h8l9 9-8 8-9-9z"/><circle cx="7.5" cy="8" r="1.3"/>', 14),
    share: sv('<path d="M12 4v11M8 8l4-4 4 4M5 13v6h14v-6"/>'),
    copy: sv('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
    trash: sv('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    edit: sv('<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/>'),
    book: sv('<path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4zM5 18a2 2 0 0 1 2-2h11"/>'),
    marker: sv('<path d="M15 4l5 5-9 9H6v-5l9-9zM4 21h8"/>'),
    bm: sv('<path d="M7 4h10v16l-5-4-5 4V4z"/>'),
    more: sv('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'),
    bold: sv('<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>'),
    ital: sv('<path d="M10 5h8M6 19h8M14 5l-4 14"/>'),
    head: sv('<path d="M6 5v14M16 5v14M6 12h10"/>'),
    list: sv('<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="4.5" cy="7" r=".9"/><circle cx="4.5" cy="12" r=".9"/><circle cx="4.5" cy="17" r=".9"/>'),
    check: sv('<rect x="3.5" y="4.5" width="6" height="6" rx="1.2"/><path d="M5 7.6l1.3 1.3 2-2.4M13 7.5h8M13 16.5h8"/><rect x="3.5" y="13.5" width="6" height="6" rx="1.2"/>'),
    link: sv('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    t_blank: sv('<path d="M7 3h7l5 5v13H7zM14 3v5h5"/>', 22),
    t_soap: sv('<path d="M4 6h16M4 10.5h16M4 15h10M4 19.5h7"/>', 22),
    t_sermon: sv('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/>', 22),
    t_char: sv('<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/>', 22),
    t_word: sv('<path d="M4 18l4.5-12L13 18M5.6 14h5.8M15.5 11.5c.6-1 1.6-1.5 2.7-1.5 1.6 0 2.3 1 2.3 2.4V18M20.5 14.5c-3 0-5 .6-5 2.1 0 .9.7 1.5 1.8 1.5 1.8 0 3.2-1.4 3.2-3.6"/>', 22),
    t_prayer: sv('<path d="M12 21s-7-4.4-7-10.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 16.6 12 21 12 21z"/>', 22)
  };
  const SB = sv('<path d="M7 4h10v16l-5-4-5 4V4z"/><path d="M10 9h4"/>');

  Object.assign(I, {
    x: sv('<path d="M6 6l12 12M18 6L6 18"/>'),
    menu: sv('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    undo: sv('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
    redo: sv('<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>'),
    quote: sv('<path d="M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6"/>'),
    callout: sv('<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M8 10h8M8 14h5"/>'),
    ol: sv('<path d="M10 7h10M10 12h10M10 17h10M4 6l1.5-1V9M3.6 14.2c.3-.6 2.4-.8 2.4.4 0 .9-2.4 1.6-2.4 2.9H6"/>'),
    hr: sv('<path d="M4 12h16M8 7h8M8 17h8" opacity=".9"/>'),
    mic: sv('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
    focus: sv('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    dl: sv('<path d="M12 4v11M8 11l4 4 4-4M5 19h14"/>'),
    print: sv('<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z"/>'),
    paper: sv('<path d="M6 3h9l4 4v14H6zM9 11h7M9 15h7"/>'),
    t_verse: sv('<path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4zM9 9h6M9 13h4"/>', 22),
    t_chap: sv('<path d="M4 5h7v15H4zM13 5h7v15h-7zM6 9h3M15 9h3M15 13h3"/>', 22),
    t_devo: sv('<path d="M12 3v4M5.6 6.6l2.8 2.8M3 13h4M17 13h4M15.6 9.4l2.8-2.8M7 18h10M9 21h6M8 13a4 4 0 0 1 8 0"/>', 22)
  });

  /* ---------- verse references ---------- */
  const norm = s => String(s).toLowerCase().replace(/^(iii|ii|i)\s+/, m => ({ "iii ": "3", "ii ": "2", "i ": "1" }[m.replace(/\s+/, " ")] || m)).replace(/^(1st|2nd|3rd)/, m => m[0]).replace(/[.\s]/g, "");
  const ALIAS = {};
  BOOKS.forEach((b, i) => { ALIAS[norm(b[0])] = i; ALIAS[norm(b[1])] = i; });
  const idxOf = name => BOOKS.findIndex(b => b[0] === name);
  [["ps,pss,psa,psalms,psalm", "Psalms"], ["jn,jhn,joh", "John"], ["mt,mat,matt", "Matthew"], ["mk,mrk,mar", "Mark"], ["lk,luk", "Luke"], ["rm,ro", "Romans"],
   ["phil,php,phl", "Philippians"], ["phm,philem,phlm", "Philemon"], ["jas,jm", "James"], ["dt,deu", "Deuteronomy"], ["ex,exo", "Exodus"], ["gn,ge", "Genesis"],
   ["lv,le", "Leviticus"], ["nm,nb", "Numbers"], ["jdg,jdgs", "Judges"], ["rth,ru", "Ruth"], ["ezk,eze", "Ezekiel"], ["dn", "Daniel"], ["jl", "Joel"], ["ob", "Obadiah"],
   ["jnh", "Jonah"], ["zep", "Zephaniah"], ["zec", "Zechariah"], ["re,rv,revelations", "Revelation"], ["sos,song,songofsongs,canticles,sng", "Song of Solomon"], ["qoh,ecc", "Ecclesiastes"],
   ["pr,prv,prov", "Proverbs"], ["1jn,1jo,1jhn", "1 John"], ["2jn,2jo", "2 John"], ["3jn,3jo", "3 John"], ["1pe,1pt", "1 Peter"], ["2pe,2pt", "2 Peter"], ["1th,1thes", "1 Thessalonians"],
   ["2th,2thes", "2 Thessalonians"], ["1ti", "1 Timothy"], ["2ti", "2 Timothy"], ["1co", "1 Corinthians"], ["2co", "2 Corinthians"], ["1sa,1sm", "1 Samuel"], ["2sa,2sm", "2 Samuel"],
   ["1ki,1kgs", "1 Kings"], ["2ki,2kgs", "2 Kings"], ["1ch,1chr", "1 Chronicles"], ["2ch,2chr", "2 Chronicles"], ["est", "Esther"], ["jb", "Job"], ["ac", "Acts"], ["hb", "Hebrews"], ["tit", "Titus"]
  ].forEach(([ks, n]) => { const i = idxOf(n); if (i >= 0) ks.split(",").forEach(k => { ALIAS[k] = i; }); });
  const FULL = BOOKS.map(b => norm(b[0]));
  function bookFrom(name) {
    const k = norm(name); if (!k) return -1;
    if (ALIAS[k] != null) return ALIAS[k];
    if (k.replace(/^\d/, "").length < 3) return -1;
    const hits = FULL.map((f, i) => f.startsWith(k) ? i : -1).filter(i => i >= 0);
    return hits.length === 1 ? hits[0] : -1;
  }
  const RX = /((?:[1-3]|I{1,3})\s?)?([A-Z][a-zA-Z]*\.?)((?:\s+of\s+[A-Z][a-z]+)?)\s?(\d{1,3})(?:\s?:\s?(\d{1,3})(?:\s?[-\u2013]\s?(\d{1,3}))?)?(?![\d:])/g;
  // Finds verse references in plain text: "John 3:16", "Rom 8:28-30", "1 Cor 13", "Psalm 23".
  function findRefs(text) {
    const out = []; const s = String(text || ""); RX.lastIndex = 0; let m;
    while ((m = RX.exec(s))) {
      const start = m.index;
      if (start > 0 && /[A-Za-z0-9]/.test(s[start - 1])) continue;
      const name = (m[1] || "") + m[2] + (m[3] || "");
      const b = bookFrom(name.replace(/\s+of\s+/i, " of "));
      const c = +m[4], v = m[5] ? +m[5] : null, ve = m[6] ? +m[6] : null;
      if (b < 0 || c < 1 || c > BOOKS[b][2] || (!v && !/[A-Z]/.test(m[2][0]))) continue;
      if (!v && m[2].replace(".", "").length < 3 && !m[1]) continue; // "Ps 3" ok, but bare 2-letter + chapter only is too loose
      out.push({ i: start, len: m[0].length, raw: m[0], b, c, v, ve: ve && ve > v ? ve : null, label: BOOKS[b][1] + " " + c + (v ? ":" + v + (ve && ve > v ? "\u2013" + ve : "") : "") });
    }
    return out;
  }
  const refKey = r => r.b + "." + r.c + "." + (r.v || 0) + "." + (r.ve || 0);
  function uniqRefs(list) { const seen = new Set(); return list.filter(r => { const k = refKey(r); if (seen.has(k)) return false; seen.add(k); return true; }); }
  function jump(r) {
    const verses = r.v && r.ve ? Array.from({ length: Math.min(r.ve - r.v + 1, 60) }, (_, i) => r.v + i) : null;
    FX.jumpToVerse(r.b, r.c, r.v || null, verses);
  }

    /* ---------- formatting: # / ## headings, **bold**, *italic*, > quote, > [!NOTE] callout, lists, - [ ] checklist, --- ---------- */
  function inline(t) {
    // t is plain text; returns HTML with refs linked and bold/italic applied
    const refs = findRefs(t); let html = "", at = 0;
    const fmt = x => esc(x).replace(/\*\*([^*\n]+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\w)/g, "$1<i>$2</i>").replace(/(^|[^\w])_([^_\n]+?)_(?!\w)/g, "$1<i>$2</i>");
    refs.forEach(r => { html += fmt(t.slice(at, r.i)); html += `<button type="button" class="snb-ref" data-ref="${r.b},${r.c},${r.v || 0},${r.ve || 0}">${esc(r.raw)}</button>`; at = r.i + r.len; });
    return html + fmt(t.slice(at));
  }
  const CALL = { NOTE: "Note", TIP: "Insight", PRAYER: "Prayer", KEY: "Key truth", WARNING: "Caution", QUESTION: "Question" };
  function render(body) {
    const lines = String(body || "").split("\n"); let out = "", list = null, bq = null;
    const TAG = { cl: '<ul class="snb-cl">', ul: "<ul>", ol: "<ol>" }, END = { cl: "</ul>", ul: "</ul>", ol: "</ol>" };
    const open = k => { if (list !== k) { close(); out += TAG[k]; list = k; } };
    const close = () => { if (list) { out += END[list]; list = null; } };
    const flush = () => { if (!bq) return; const m = bq[0].match(/^\[!(\w+)\]\s*(.*)$/); const rows = bq.slice(); if (m) rows[0] = m[2];
      const inner = rows.map(x => x.trim() ? inline(x) : "").join("<br>").replace(/^(<br>)+|(<br>)+$/g, "");
      out += m ? `<div class="snb-callout" data-k="${esc(m[1].toLowerCase())}"><b>${esc(CALL[m[1].toUpperCase()] || m[1])}</b><div>${inner}</div></div>` : `<blockquote class="snb-bq">${inner}</blockquote>`; bq = null; };
    lines.forEach((ln, i) => {
      let m;
      if ((m = ln.match(/^\s*>\s?(.*)$/))) { close(); (bq || (bq = [])).push(m[1]); return; }
      flush();
      if ((m = ln.match(/^\s*[-*]\s\[( |x|X)\]\s?(.*)$/))) { open("cl");
        out += `<li class="${m[1] !== " " ? "done" : ""}"><button type="button" class="snb-cb" data-line="${i}" aria-label="Toggle item" aria-pressed="${m[1] !== " "}">${m[1] !== " " ? sv('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 14) : ""}</button><span>${inline(m[2])}</span></li>`; return; }
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(ln)) { close(); out += "<hr>"; return; }
      if ((m = ln.match(/^\s*(?:[-*\u2022])\s+(.*)$/))) { open("ul"); out += `<li>${inline(m[1])}</li>`; return; }
      if ((m = ln.match(/^\s*(\d+)[.)]\s+(.*)$/))) { open("ol"); out += `<li>${inline(m[2])}</li>`; return; }
      close();
      if ((m = ln.match(/^(#{1,3})\s+(.*)$/))) { const n = m[1].length; out += `<h${n + 1} class="snb-h${n}">${inline(m[2])}</h${n + 1}>`; return; }
      if (!ln.trim()) { out += '<div class="snb-gap"></div>'; return; }
      out += `<p>${inline(ln)}</p>`;
    });
    flush(); close();
    return out;
  }
  const plain = body => String(body || "").replace(/\*\*([^*\n]+?)\*\*/g, "$1").replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\w)/g, "$1$2").replace(/(^|[^\w])_([^_\n]+?)_(?!\w)/g, "$1$2").replace(/^#{1,3}\s+/gm, "").replace(/^\s*>\s?\[!(\w+)\]\s*/gm, (x, k) => (CALL[k.toUpperCase()] || k) + ": ").replace(/^\s*>\s?/gm, "").replace(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/gm, "\u2014\u2014\u2014").replace(/^\s*[-*]\s\[( )\]\s?/gm, "\u2610 ").replace(/^\s*[-*]\s\[[xX]\]\s?/gm, "\u2611 ").replace(/^\s*[-*]\s+/gm, "\u2022 ");
  const snippet = body => plain(body).replace(/\s+/g, " ").trim().slice(0, 140);

/* ---------- data ---------- */
  const books = () => { const a = rd(KN, []); return Array.isArray(a) ? a.filter(x => x && x.id) : []; };
  const own = () => { const a = rd(KT, []); return Array.isArray(a) ? a.filter(x => x && x.id) : []; };
  const meta = () => { const m = rd(KM, {}); const o = m && typeof m === "object" && !Array.isArray(m) ? m : {}; o.converted = o.converted || {}; o.pins = o.pins || {}; return o; };
  function ensureDefault() { const b = books(); if (!b.length) { b.push({ id: "nb_main", name: "My Study", color: "gold", created: Date.now() }); wr(KN, b); } return b; }
  function oldPages() { const d = rd(OLD.NB, null); if (!d || typeof d !== "object") return { pages: [], notes: [] };
    return { pages: Array.isArray(d.pages) ? d.pages.filter(p => p && p.id) : [], notes: Array.isArray(d.notes) ? d.notes.filter(n => n && n.id) : [] }; }
  // Imported (read-only) notes from earlier versions, as notebook items.
  function imported() {
    const out = [], m = meta();
    const conv = (id, upd) => { const c = m.converted[id]; return c && (!upd || upd <= c.at); };
    const leg = rd(OLD.NOTES, {});
    if (leg && typeof leg === "object") Object.keys(leg).forEach(k => { const n = leg[k]; if (!n || !n.text) return; const id = "leg:" + k; if (conv(id, n.updated)) return;
      const r = BOOKS[n.bookIdx] ? { b: n.bookIdx, c: n.chapter, v: n.verseNum || null, ve: n.verseEnd || null } : null;
      out.push({ id, src: "leg", nb: "leg", title: n.ref || "Verse note", body: n.text, verseText: n.verseText || "", version: n.version, tags: [], pinned: !!m.pins[id], created: n.added || n.updated || 0, updated: n.updated || n.added || 0, ref0: r }); });
    const op = oldPages(); const pids = new Set(op.pages.map(p => p.id)); const first = op.pages[0] ? op.pages[0].id : "main";
    op.notes.forEach(n => { const id = "old:" + n.id; if (conv(id, n.updated)) return;
      const parts = []; if (n.summary) parts.push((n.kind === "chapter" ? "## AI chapter summary\n" : "## AI summary\n") + n.summary); if (n.thoughts) parts.push((n.kind === "free" ? "" : "## My thoughts\n") + n.thoughts);
      const r = BOOKS[n.bookIdx] && n.chapter ? { b: n.bookIdx, c: n.chapter, v: n.verseNum || null, ve: null } : null;
      out.push({ id, src: "old", nb: "old:" + (pids.has(n.pageId) ? n.pageId : first), title: n.title || n.ref || "Note", body: parts.join("\n\n"), verseText: n.verseText || "", version: n.version, tags: [], pinned: !!m.pins[id], created: n.created || 0, updated: n.updated || n.created || 0, ref0: r }); });
    return out;
  }
  function allItems() {
    const mine = own().map(n => Object.assign({ src: "new" }, n, { tags: Array.isArray(n.tags) ? n.tags : [] }));
    return mine.concat(imported()).map(it => { const rs = uniqRefs((it.ref0 ? [it.ref0] : []).concat(findRefs(it.title + "\n" + it.body))); it.refs = rs; return it; });
  }
  function virtBooks() {
    const v = [], items = imported();
    if (items.some(i => i.nb === "leg") || Object.keys(rd(OLD.NOTES, {}) || {}).length) v.push({ id: "leg", name: "Verse notes", color: "slate", imported: true, sub: "Notes you wrote on verses in the reader" });
    oldPages().pages.forEach(p => { if (items.some(i => i.nb === "old:" + p.id)) v.push({ id: "old:" + p.id, name: p.name || "Notes", color: "slate", imported: true, sub: "From your earlier notebook pages" }); });
    return v;
  }
  const bookName = id => { const b = books().concat(virtBooks()).find(x => x.id === id); return b ? b.name : "No notebook"; };
  function saveNote(n) { const all = own(); const i = all.findIndex(x => x.id === n.id); const clean = { id: n.id, nb: n.nb, title: n.title, body: n.body, tags: n.tags || [], pinned: !!n.pinned, tpl: n.tpl || "blank", created: n.created, updated: n.updated };
    if (n.from) clean.from = n.from; if (i >= 0) all[i] = clean; else all.unshift(clean); return wr(KT, all); }

    /* ---------- templates ---------- */
  const today = () => new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const vq = v => v ? (v.text ? `> "${v.text}" \u2014 ${v.ref}` : v.ref) : "";
  const TPL = [
    { id: "blank", name: "Blank", ic: I.t_blank, d: "A clean page", body: () => "" },
    { id: "soap", name: "SOAP Study", ic: I.t_soap, d: "Scripture, Observation, Application, Prayer", body: v => `## Scripture\n${vq(v)}\n\n## Observation\n\n\n## Application\n\n\n## Prayer\n` },
    { id: "sermon", name: "Sermon Notes", ic: I.t_sermon, d: "Speaker, passage, main points", body: v => `# Sermon\nSpeaker: \nDate: ${today()}\nPassage: ${v ? v.ref : ""}\n\n## Main points\n1. \n\n## Key verses\n${vq(v)}\n\n## Takeaways\n- [ ] ` },
    { id: "verse", name: "Verse Breakdown", ic: I.t_verse, d: "One verse, phrase by phrase", body: v => `## The verse\n${vq(v)}\n\n## Key words & phrases\n- \n\n## Context (before & after)\n\n\n## Cross-references\n- \n\n> [!KEY] What it means\n\n\n## Living it out\n- [ ] ` },
    { id: "prayer", name: "Prayer Journal", ic: I.t_prayer, d: "Praise, confess, thanks, requests", body: v => `# ${today()}\n${v ? vq(v) + "\n" : ""}\n## Praise\n\n\n## Confess\n\n\n## Thanks\n\n\n## Asking for\n- [ ] \n\n## Answered\n` },
    { id: "char", name: "Character Study", ic: I.t_char, d: "A person in Scripture", body: v => `# Who\n\n\n## Key passages\n${vq(v)}\n\n## Strengths\n- \n\n## Struggles\n- \n\n## What God did through them\n\n\n## Lessons for me\n` },
    { id: "chapter", name: "Chapter Summary", ic: I.t_chap, d: "Big idea, outline, key verse", body: v => `# Chapter: ${v ? v.ref.replace(/:\d+.*$/, "") : ""}\n\n## Big idea\n\n\n## Outline\n1. \n\n## Key verse\n${vq(v)}\n\n## Questions\n- \n\n---\n## One thing to remember\n` },
    { id: "devo", name: "Devotional Reflection", ic: I.t_devo, d: "Read, reflect, respond", body: v => `# Devotional \u00b7 ${today()}\n\n## Read\n${vq(v)}\n\n## Reflect\n\n\n> [!PRAYER] Respond in prayer\n\n\n## Carry it today\n- [ ] ` },
    { id: "word", name: "Word Study", ic: I.t_word, d: "One word, its meaning and uses", body: v => `## Word\n\n\n## Original language\nHebrew or Greek: \n\n## Where it appears\n${v ? v.ref : ""}\n\n## Meaning in context\n\n\n## Takeaway\n` }
  ];
  const tplOf = id => TPL.find(t => t.id === id) || TPL[0];

/* ---------- share / copy ---------- */
  function noteText(it) {
    const lines = [it.title || "Untitled", bookName(it.nb) + " \u00b7 " + fmtDate(it.updated)];
    if (it.verseText && it.ref0) lines.push("", `"${it.verseText}" (${refLabel(it.ref0)}${it.version ? ", " + vname(it.version) : ""})`);
    lines.push("", plain(it.body).trim());
    if (it.tags && it.tags.length) lines.push("", it.tags.map(t => "#" + t).join(" "));
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  async function shareText(title, text) {
    try { if (window.AndroidApp && typeof AndroidApp.share === "function") { AndroidApp.share(title, text, ""); return; } } catch {}
    if (navigator.share) { try { await navigator.share({ title, text }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
    toast(await copyText(text) ? "Copied (sharing isn't available here)" : "Couldn't share");
  }
  async function copy(text) { toast(await copyText(text) ? "Copied" : "Couldn't copy"); }
  const refLabel = r => BOOKS[r.b][1] + " " + r.c + (r.v ? ":" + r.v + (r.ve ? "\u2013" + r.ve : "") : "");
  function fmtDate(t) { if (!t) return ""; const d = new Date(t), now = new Date(); const sameY = d.getFullYear() === now.getFullYear();
    if (d.toDateString() === now.toDateString()) return "Today " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return d.toLocaleDateString(undefined, sameY ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" }); }

  /* ---------- state ---------- */
  const st = { tab: "notes", nb: "all", tag: null, q: "", hl: "all", hlTab: "hl" };
  const sortMode = () => meta().sort || "recent";
  function filtered() {
    let items = allItems(); const q = st.q.trim().toLowerCase();
    if (st.nb === "pinned") items = items.filter(i => i.pinned); else if (st.nb !== "all") items = items.filter(i => i.nb === st.nb);
    if (st.tag) items = items.filter(i => i.tags.includes(st.tag));
    if (q) { const qr = findRefs(st.q.replace(/^./, c => c.toUpperCase()));
      items = items.filter(i => (i.title + "\n" + i.body + "\n" + (i.verseText || "") + "\n" + i.tags.join(" ") + "\n" + i.refs.map(refLabel).join(" ")).toLowerCase().includes(q) || (qr.length && i.refs.some(r => r.b === qr[0].b && (r.c === qr[0].c)))); }
    const s = sortMode();
    const bk = i => i.refs.length ? i.refs[0].b * 1e6 + i.refs[0].c * 1e3 + (i.refs[0].v || 0) : 9e9;
    items.sort((a, b) => (b.pinned - a.pinned) || (s === "title" ? (a.title || "").localeCompare(b.title || "") : s === "book" ? bk(a) - bk(b) || (b.updated - a.updated) : (b.updated || 0) - (a.updated || 0)));
    return items;
  }

    /* ---------- 7.0 full-page workspace ---------- */
  let root = null, cur = null, popEl = null, rec = null, vvOff = null;
  const mq = window.matchMedia ? window.matchMedia("(min-width: 840px)") : { matches: false };
  const wide = () => mq.matches;
  const setMeta = p => { const m = meta(); Object.assign(m, p); wr(KM, m); };
  const PAPERS = [["clean", "Clean"], ["parchment", "Warm Parchment"], ["lined", "Lined Paper"]];
  const paper = () => PAPERS.some(p => p[0] === meta().paper) ? meta().paper : "clean";
  const MODES = [["write", "Write"], ["split", "Split"], ["preview", "Preview"]];
  const mode = () => MODES.some(p => p[0] === meta().mode) ? meta().mode : (wide() ? "split" : "write");
  const LAI = () => window.BibleyLocalAI;
  const $ = (sel, el) => (el || root).querySelector(sel);
  const refData = r => `${r.b},${r.c},${r.v || 0},${r.ve || 0}`;
  const refBtn = r => `<button type="button" class="snb-ref chip" data-ref="${refData(r)}">${esc(refLabel(r))}</button>`;
  const hlCount = () => { const hl = C.getHighlights ? C.getHighlights() : rd(OLD.HL, {}); const cb = rd(OLD.BM, []);
    return Object.keys(hl || {}).length + Object.keys(rd(OLD.VBM, {}) || {}).length + (Array.isArray(cb) ? cb.length : 0); };

  function open(opts) {
    ensureDefault(); opts = opts || {};
    if (opts.nb) { st.nb = opts.nb; st.tab = "notes"; }
    if (opts.tab) st.tab = opts.tab;
    try { closeSheet(); } catch {}
    build(); drawSide(); drawList();
    if (cur) { drawEditor(); setView("ed"); return; }
    const first = st.tab === "notes" && filtered()[0];
    if (wide() && first) openNote(first.id, true); else { drawEmpty(); setView(opts.side ? "side" : "list"); }
  }
  function build() {
    if (root && root.isConnected) return;
    root = h(`<div class="snbx snb" role="dialog" aria-modal="true" aria-label="Study Notebook" data-view="list">
      <aside class="snbx-side" aria-label="Notebooks"></aside><section class="snbx-list" aria-label="Notes"></section><section class="snbx-ed" aria-label="Editor"></section>
      <div class="snbx-modal" hidden></div></div>`);
    document.body.appendChild(root); document.documentElement.classList.add("snbx-on");
    root.dataset.paper = paper();
    document.addEventListener("keydown", onKey, true);
    root.addEventListener("click", e => {
      const b = e.target.closest(".snb-ref[data-ref]"); if (b) { e.preventDefault(); e.stopPropagation(); const [bb, c, v, ve] = b.dataset.ref.split(",").map(Number); showPop(b, { b: bb, c, v: v || null, ve: ve || null }); return; }
      if (popEl && !e.target.closest(".snbx-pop")) closePop();
    }, true);
    // keep the editor above the on-screen keyboard
    const vv = window.visualViewport;
    if (vv) { vvOff = () => { if (!root) return; root.style.height = vv.height + "px"; root.style.top = vv.offsetTop + "px"; }; vv.addEventListener("resize", vvOff); vv.addEventListener("scroll", vvOff); vvOff(); }
    if (mq.addEventListener) mq.addEventListener("change", onMq);
  }
  function onKey(e) {
    if (e.key !== "Escape" || !root) return; e.stopPropagation();
    if (popEl) closePop(); else if (!$(".snbx-modal").hidden) closeModal(); else if ($(".snbx-ins")) $(".snbx-ins").remove(); else if (root.classList.contains("focus")) toggleFocus(false); else close();
  }
  const onMq = () => { if (root) { drawList(); if (cur) drawEditor(); else drawEmpty(); } };
  function close() {
    commit(); stopDictation(); closePop();
    if (window.visualViewport && vvOff) { window.visualViewport.removeEventListener("resize", vvOff); window.visualViewport.removeEventListener("scroll", vvOff); }
    if (mq.removeEventListener) mq.removeEventListener("change", onMq); document.removeEventListener("keydown", onKey, true);
    if (root) root.remove(); root = null; cur = null; document.documentElement.classList.remove("snbx-on");
  }
  const isOpen = () => !!(root && root.isConnected);
  function setView(v) { if (root) root.dataset.view = v; }
  const jumpRef = r => { close(); jump(r); };
  const reopenPane = (pane, fn) => { pane.innerHTML = ""; fn(pane); };

  /* sidebar */
  function drawSide() {
    const side = $(".snbx-side"), nbs = books(), vb = virtBooks(), items = allItems();
    const count = id => items.filter(i => i.nb === id).length;
    const tags = [...new Set(items.flatMap(i => i.tags))].sort();
    const on = (tab, nb) => st.tab === tab && (tab === "hl" || st.nb === nb) ? " on" : "";
    const nav = (nb, ic, label, n, tab) => `<button type="button" class="snbx-nav${on(tab || "notes", nb)}" data-nb="${esc(nb)}" data-tab="${tab || "notes"}">${ic}<span>${esc(label)}</span><em>${n}</em></button>`;
    const row = b => `<div class="snbx-nbrow"><button type="button" class="snbx-nav${on("notes", b.id)}" data-nb="${esc(b.id)}" data-tab="notes"><i class="snb-dot" style="background:${colorOf(b.color)}"></i><span>${esc(b.name)}</span><em>${count(b.id)}</em></button>${b.imported ? "" : `<button type="button" class="snb-ib sm" data-edit="${esc(b.id)}" aria-label="Notebook options">${I.more}</button>`}</div>`;
    side.innerHTML = `<div class="snbx-sh"><div class="snbx-brand">${I.book}<b>Study Notebook</b></div><button type="button" class="snb-ib" data-a="close" aria-label="Close notebook">${I.x}</button></div>
      <div class="snbx-scroll">
        ${nav("all", I.book, "All Notes", items.length)}${nav("pinned", I.pin, "Pinned", items.filter(i => i.pinned).length)}${nav("hl", I.marker, "Highlights & Bookmarks", hlCount(), "hl")}
        <div class="snbx-sec"><span>Notebooks</span><button type="button" class="snb-ib sm" data-a="newnb" aria-label="New notebook" title="New notebook">${I.plus}</button></div>
        ${nbs.map(row).join("")}
        ${vb.length ? `<div class="snbx-sec"><span>From earlier versions</span></div>${vb.map(row).join("")}<button type="button" class="snb-link" data-a="classic">Open the classic notebook pages</button>` : ""}
        ${tags.length ? `<div class="snbx-sec"><span>Tags</span></div><div class="snbx-tags">${tags.map(t => `<button type="button" class="snb-chip small${st.tag === t ? " on" : ""}" data-tag="${esc(t)}">${I.tag}${esc(t)}</button>`).join("")}</div>` : ""}
      </div>
      <div class="snbx-sfoot"><span>${I.paper}Paper</span><div class="snbx-seg sm" role="radiogroup" aria-label="Paper style">${PAPERS.map(([k, l]) => `<button type="button" role="radio" aria-checked="${paper() === k}" class="${paper() === k ? "on" : ""}" data-paper="${k}">${esc(l.replace("Warm ", "").replace(" Paper", ""))}</button>`).join("")}</div></div>`;
    side.querySelectorAll(".snbx-nav").forEach(b => b.onclick = () => { st.tab = b.dataset.tab; if (st.tab === "notes") { st.nb = b.dataset.nb; } drawSide(); drawList(); setView("list"); });
    side.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => editBook(b.dataset.edit));
    side.querySelectorAll("[data-tag]").forEach(b => b.onclick = () => { st.tag = st.tag === b.dataset.tag ? null : b.dataset.tag; st.tab = "notes"; drawSide(); drawList(); setView("list"); });
    side.querySelectorAll("[data-paper]").forEach(b => b.onclick = () => setPaper(b.dataset.paper));
    side.querySelector('[data-a="close"]').onclick = close;
    side.querySelector('[data-a="newnb"]').onclick = () => editBook(null);
    const cl = side.querySelector('[data-a="classic"]'); if (cl) cl.onclick = () => { close(); if (window.BibleyNotes && window.BibleyNotes.openClassic) window.BibleyNotes.openClassic(); };
  }
  function setPaper(p) { setMeta({ paper: p }); if (root) root.dataset.paper = p; drawSide(); toast("Paper: " + PAPERS.find(x => x[0] === p)[1]); }

  /* notes list */
  function listTitle() { if (st.tab === "hl") return "Highlights & Bookmarks"; if (st.nb === "all") return st.tag ? "#" + st.tag : "All Notes"; if (st.nb === "pinned") return "Pinned"; return bookName(st.nb); }
  function drawList() {
    const pane = $(".snbx-list");
    pane.innerHTML = `<div class="snbx-lh"><button type="button" class="snb-ib snbx-mob" data-a="side" aria-label="Notebooks">${I.menu}</button><h2>${esc(listTitle())}</h2><button type="button" class="snb-ib snbx-mob" data-a="close" aria-label="Close notebook">${I.x}</button></div>
      <div class="snb-search">${I.search}<input type="search" class="snb-q" placeholder="Search notes, tags, verses" aria-label="Search notebook" value="${esc(st.q)}"></div>
      ${st.tab === "hl" ? `<div class="snbx-seg" role="tablist">${[["hl", "Highlights"], ["saved", "Bookmarks"]].map(([k, l]) => `<button type="button" class="${st.hlTab === k ? "on" : ""}" data-hl="${k}">${l}</button>`).join("")}</div>`
        : `<div class="snb-bar"><button type="button" class="fx-btn primary small snb-new">${I.plus}New note</button><label class="snb-sort"><span>Sort</span><select aria-label="Sort notes">${[["recent", "Recent"], ["title", "Title"], ["book", "Book order"]].map(([k, l]) => `<option value="${k}" ${sortMode() === k ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>`}
      <div class="snbx-items"></div>`;
    pane.querySelector('[data-a="side"]').onclick = () => setView("side");
    pane.querySelector('[data-a="close"]').onclick = close;
    const q = pane.querySelector(".snb-q"); let t; q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { st.q = q.value; drawItems(); }, 160); });
    const nw = pane.querySelector(".snb-new"); if (nw) nw.onclick = () => pickTemplate(null);
    const so = pane.querySelector("select"); if (so) so.onchange = e => { setMeta({ sort: e.target.value }); drawItems(); };
    pane.querySelectorAll("[data-hl]").forEach(b => b.onclick = () => { st.hlTab = b.dataset.hl; drawList(); });
    drawItems();
  }
  function drawItems() {
    const box = $(".snbx-items"); if (!box) return; box.innerHTML = "";
    if (st.tab === "hl") { (st.hlTab === "saved" ? savedPane : hlPane)(box); return; }
    const list = filtered();
    box.innerHTML = list.length ? list.map(card).join("") : `<div class="snb-empty">${st.q || st.tag ? "Nothing matches that search." : st.nb === "pinned" ? "No pinned notes yet." : "No notes here yet.<br>Tap New note to start one, or pick a study template."}</div>`;
    box.querySelectorAll(".snb-card").forEach(c => { c.classList.toggle("on", !!(cur && cur.n.id === c.dataset.id)); const go = () => openNote(c.dataset.id); c.onclick = go; c.onkeydown = e => { if (e.key === "Enter") go(); }; });
  }
  function card(it) {
    const nb = books().concat(virtBooks()).find(b => b.id === it.nb);
    return `<article class="snb-card" data-id="${esc(it.id)}" tabindex="0">
      <div class="snb-card-top"><span class="snb-nbl"><i class="snb-dot" style="background:${colorOf(nb && nb.color)}"></i>${esc(nb ? nb.name : "No notebook")}</span>${it.pinned ? `<span class="snb-pinned">${I.pin}</span>` : ""}<span class="snb-date">${esc(fmtDate(it.updated))}</span></div>
      <h3>${esc(it.title || "Untitled")}</h3>
      ${snippet(it.body) ? `<p>${esc(snippet(it.body))}</p>` : (it.verseText ? `<p class="snb-vq">${esc(it.verseText.slice(0, 140))}</p>` : "")}
      ${it.refs.length || it.tags.length ? `<div class="snb-card-refs">${it.refs.slice(0, 3).map(r => `<button type="button" class="snb-ref chip" data-ref="${r.b},${r.c},${r.v || 0},${r.ve || 0}">${esc(refLabel(r))}</button>`).join("")}${it.refs.length > 3 ? `<span class="snb-more">+${it.refs.length - 3}</span>` : ""}${it.tags.slice(0, 3).map(t => `<span class="snb-tg">#${esc(t)}</span>`).join("")}</div>` : ""}
    </article>`;
  }

  /* editor */
  function drawEmpty() {
    const ed = $(".snbx-ed"); if (!ed) return;
    ed.innerHTML = `<div class="snbx-empty">${I.edit}<b>Pick a note or start a new one</b><span>Templates for SOAP, sermons, prayer and more. Insert any verse straight from the King James Bible.</span><button type="button" class="fx-btn primary small">${I.plus}New note</button></div>`;
    ed.querySelector("button").onclick = () => pickTemplate(null);
  }
  function openNote(id, quiet) {
    commit();
    const it = allItems().find(x => x.id === id); if (!it) { drawEmpty(); return; }
    cur = { n: Object.assign({}, it, { tags: it.tags.slice() }), imp: it.src !== "new", hist: [], hi: -1, saved: true };
    cur.n._p0 = cur.n.pinned;
    drawEditor(); drawItems(); if (!quiet || !wide()) setView("ed");
  }
  function openNew(n) {
    commit();
    cur = { n: Object.assign({ tags: [] }, n), imp: false, hist: [], hi: -1, saved: true, fresh: true }; cur.n._p0 = cur.n.pinned;
    drawEditor(); drawItems(); setView("ed");
    setTimeout(() => { const ta = $(".snb-ta"), tin = $(".snb-tin"); if (!ta) return; try {
      if (n.tpl === "blank" && !tin.value) tin.focus(); else { ta.focus(); const v = ta.value, k = ["## Observation", "## Key words", "## Main points", "## Reflect", "## Big idea", "## Praise", "## Strengths", "## Meaning"].map(x => v.indexOf(x)).filter(x => x >= 0)[0];
        const at = k >= 0 ? v.indexOf("\n", k) + 1 : v.length; ta.setSelectionRange(at, at); }
    } catch {} }, 60);
  }
  function drawEditor() {
    const ed = $(".snbx-ed"), c = cur, n = c.n, imp = c.imp, nbs = books(), md = imp ? "preview" : mode();
    const nb = books().concat(virtBooks()).find(b => b.id === n.nb);
    const tb = (f, ic, l, txt) => `<button type="button" data-f="${f}" aria-label="${l}" title="${l}"${txt ? ' class="txt"' : ""}>${ic}${txt ? `<span>${txt}</span>` : ""}</button>`;
    ed.innerHTML = `<div class="snbx-eh">
        <button type="button" class="snb-ib snbx-mob" data-a="back" aria-label="Back to notes">${I.back}</button>
        ${imp ? `<span class="snb-nbl"><i class="snb-dot" style="background:${colorOf(nb && nb.color)}"></i>${esc(nb ? nb.name : "Imported")}</span>` : ""}
        <span class="snbx-grow"></span>
        ${imp ? "" : `<div class="snbx-seg sm" role="tablist" aria-label="Editor view">${MODES.map(([k, l]) => `<button type="button" role="tab" class="${md === k ? "on" : ""}" data-mode="${k}">${l}</button>`).join("")}</div>`}
        <button type="button" class="snb-ib ${n.pinned ? "on" : ""}" data-a="pin" aria-label="Pin" title="Pin">${I.pin}</button>
        <button type="button" class="snb-ib" data-a="focus" aria-label="Focus mode" title="Focus mode">${I.focus}</button>
        <button type="button" class="snb-ib" data-a="more" aria-label="More: export, print, delete" title="Export, print, more">${I.more}</button></div>
      ${imp ? "" : `<div class="snbx-tools" role="toolbar" aria-label="Formatting">${tb("undo", I.undo, "Undo")}${tb("redo", I.redo, "Redo")}<span class="sep"></span>${tb("h1", "", "Heading 1", "H1")}${tb("h2", "", "Heading 2", "H2")}${tb("b", I.bold, "Bold")}${tb("i", I.ital, "Italic")}<span class="sep"></span>${tb("quote", I.quote, "Blockquote")}${tb("callout", I.callout, "Callout box")}${tb("ul", I.list, "Bullet list")}${tb("ol", I.ol, "Numbered list")}${tb("cl", I.check, "Checklist")}${tb("hr", I.hr, "Divider")}<span class="sep"></span>${tb("verse", I.book, "Insert Verse", "Verse")}${tb("mic", I.mic, "Dictate")}</div>`}
      <div class="snbx-paper"><div class="snbx-page">
        ${imp ? `<h1 class="snbx-tv">${esc(n.title || "Untitled")}</h1><div class="snb-imp">${I.book}<span>Imported from your earlier notes. The original is kept as it was.</span><button type="button" class="fx-btn small primary" data-a="convert">${I.edit}Edit as study note</button></div>
          ${n.verseText ? `<blockquote class="snb-vq">${esc(n.verseText)}<cite>${n.ref0 ? refBtn(n.ref0) : ""}${n.version ? " \u00b7 " + esc(vname(n.version)) : ""}</cite></blockquote>` : ""}`
          : `<input class="snb-tin" maxlength="100" placeholder="Title" aria-label="Title" value="${esc(n.title || "")}">`}
        <div class="snbx-meta">${imp ? "" : `<select class="snb-nbsel" aria-label="Notebook">${nbs.map(b => `<option value="${esc(b.id)}" ${b.id === n.nb ? "selected" : ""}>${esc(b.name)}</option>`).join("")}<option value="" ${!n.nb ? "selected" : ""}>No notebook</option></select>`}<span>${n.tpl && n.tpl !== "blank" ? esc(tplOf(n.tpl).name) + " \u00b7 " : ""}${n.created ? "Created " + esc(fmtDate(n.created)) : "New note"}</span></div>
        <div class="snbx-work" data-mode="${md}">${imp ? "" : `<textarea class="snb-ta" aria-label="Note" placeholder="Write here. Verse references like John 3:16 become links. Tap Verse to insert scripture.">${esc(n.body || "")}</textarea>`}<div class="snbx-pv snb-body" aria-label="Preview"></div></div>
        <div class="snb-live"></div>
        ${imp ? "" : `<label class="snb-lbl">Tags</label><input class="fx-input snb-tags-in" placeholder="faith, prayer, youth group" value="${esc((n.tags || []).join(", "))}">`}
      </div></div>
      <div class="snbx-foot"><span class="snbx-wc"></span><span class="snbx-saved" aria-live="polite">${imp ? "Read only" : c.fresh && !n.id ? "Not saved yet" : "Saved"}</span></div>`;
    const ta = $(".snb-ta", ed), tin = $(".snb-tin", ed);
    $('[data-a="back"]', ed).onclick = () => { commit(); cur = null; drawItems(); drawEmpty(); setView("list"); };
    $('[data-a="pin"]', ed).onclick = e => { if (imp) { const m = meta(); if (m.pins[n.id]) delete m.pins[n.id]; else m.pins[n.id] = 1; wr(KM, m); n.pinned = !!m.pins[n.id]; } else { n.pinned = !n.pinned; dirty(); }
      e.currentTarget.classList.toggle("on", n.pinned); toast(n.pinned ? "Pinned to the top" : "Unpinned"); drawSide(); drawItems(); };
    $('[data-a="focus"]', ed).onclick = () => toggleFocus();
    $('[data-a="more"]', ed).onclick = moreMenu;
    if (imp) { $('[data-a="convert"]', ed).onclick = () => {
      const now = Date.now(), nbid = books().some(x => x.id === st.nb) ? st.nb : ensureDefault()[0].id;
      const head = n.verseText && n.ref0 ? `> "${n.verseText}" \u2014 ${refLabel(n.ref0)}\n\n` : (n.ref0 ? refLabel(n.ref0) + "\n\n" : "");
      openNew({ id: null, nb: nbid, title: n.title, body: head + n.body, tags: [], pinned: n.pinned, tpl: "blank", created: n.created || now, updated: now, from: n.id }); }; }
    ed.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { setMeta({ mode: b.dataset.mode }); $(".snbx-work", ed).dataset.mode = b.dataset.mode; ed.querySelectorAll("[data-mode]").forEach(x => x.classList.toggle("on", x === b)); preview(); grow(); });
    if (!imp) {
      $(".snb-nbsel", ed).onchange = dirty; $(".snb-tags-in", ed).addEventListener("input", dirty);
      let lt; tin.addEventListener("input", () => { dirty(); clearTimeout(lt); lt = setTimeout(linked, 250); });
      let st2; ta.addEventListener("input", () => { clearTimeout(st2); st2 = setTimeout(snap, 400); dirty(); refresh(); });
      ta.addEventListener("keydown", keys);
      ed.querySelectorAll(".snbx-tools [data-f]").forEach(b => { b.addEventListener("mousedown", e => e.preventDefault()); b.onclick = () => tool(b.dataset.f, b); });
      snap();
    }
    $(".snbx-pv", ed).addEventListener("click", e => { const cb = e.target.closest(".snb-cb"); if (!cb) return; e.preventDefault(); if (imp) { toast("Tap Edit as study note to tick items"); return; } toggleLine(+cb.dataset.line); });
    refresh(true);
  }
  let rt;
  function grow() { const ta = root && $(".snb-ta"); if (!ta || !ta.offsetParent) return; const y = $(".snbx-paper").scrollTop; ta.style.height = "auto"; ta.style.height = Math.max(ta.scrollHeight + 4, Math.round(innerHeight * 0.46)) + "px"; $(".snbx-paper").scrollTop = y; }
  function refresh(now) { clearTimeout(rt); grow(); const go = () => { preview(); counts(); linked(); }; if (now) go(); else rt = setTimeout(go, 140); }
  const bodyNow = () => { const ta = root && $(".snb-ta"); return ta ? ta.value : (cur ? cur.n.body || "" : ""); };
  function preview() { const pv = root && $(".snbx-pv"); if (!pv || !cur) return; const w = $(".snbx-work"); if (w && w.dataset.mode === "write") return; pv.innerHTML = render(bodyNow()) || '<p class="snb-faint">Nothing written yet</p>'; }
  function counts() { const el = root && $(".snbx-wc"); if (!el) return; const t = bodyNow(), w = (t.match(/[A-Za-z0-9\u00c0-\u024f']+/g) || []).length;
    el.textContent = `${w} word${w === 1 ? "" : "s"} \u00b7 ${t.length} character${t.length === 1 ? "" : "s"} \u00b7 ${Math.max(1, Math.ceil(w / 200))} min read`; }
  function linked() { const live = root && $(".snb-live"); if (!live || !cur) return; const tin = $(".snb-tin"); const rs = uniqRefs((cur.n.ref0 ? [cur.n.ref0] : []).concat(findRefs((tin ? tin.value : cur.n.title || "") + "\n" + bodyNow())));
    live.innerHTML = rs.length ? `<span class="snb-live-l">${I.link}Linked verses</span>` + rs.slice(0, 12).map(refBtn).join("") : ""; }
  function savedLabel(t) { const el = root && $(".snbx-saved"); if (el) el.textContent = t; }
  let saveT;
  function dirty() { if (!cur || cur.imp) return; cur.saved = false; savedLabel("Saving\u2026"); clearTimeout(saveT); saveT = setTimeout(() => { const id = commit(); savedLabel(id ? "Saved" : "Not saved yet"); if (id) { drawSide(); drawItems(); } }, 650); }
  function commit() {
    clearTimeout(saveT);
    if (!cur || cur.imp || cur.gone || !root) return cur && cur.n.id;
    const n = cur.n, ta = $(".snb-ta"), tin = $(".snb-tin"), sel = $(".snb-nbsel"), tg = $(".snb-tags-in"); if (!ta) return n.id;
    const title = tin.value.trim(), text = ta.value.replace(/\s+$/, "");
    const tags = [...new Set(tg.value.split(",").map(x => x.trim().replace(/^#/, "").toLowerCase()).filter(Boolean))].slice(0, 12);
    const tplBody = n.id ? null : tplOf(n.tpl).body(null).trim();
    if (!n.id && !title && (!text.trim() || text.trim() === tplBody)) return null;
    const changed = !n.id || title !== n.title || text !== n.body || tags.join() !== (n.tags || []).join() || sel.value !== n.nb || n.pinned !== n._p0;
    if (!changed) { cur.saved = true; return n.id; }
    const isNew = !n.id; if (isNew) n.id = uid("sn_");
    Object.assign(n, { title, body: text, tags, nb: sel.value, updated: Date.now() }); if (!n.created) n.created = n.updated;
    if (saveNote(n) && isNew && n.from) { const m = meta(); m.converted[n.from] = { to: n.id, at: Date.now() }; wr(KM, m); }
    n._p0 = n.pinned; cur.saved = true; return n.id;
  }
  /* undo / redo */
  function snap() { const ta = root && $(".snb-ta"); if (!ta || !cur) return; const c = cur, v = ta.value; if (c.hist[c.hi] && c.hist[c.hi].v === v) return;
    c.hist = c.hist.slice(0, c.hi + 1); c.hist.push({ v, s: ta.selectionStart }); if (c.hist.length > 200) c.hist.shift(); c.hi = c.hist.length - 1; }
  function step(d) { const ta = $(".snb-ta"); snap(); const c = cur, j = c.hi + d; if (j < 0 || j >= c.hist.length) { toast(d < 0 ? "Nothing to undo" : "Nothing to redo"); return; }
    c.hi = j; ta.value = c.hist[j].v; const p = Math.min(c.hist[j].s, ta.value.length); ta.setSelectionRange(p, p); dirty(); refresh(); }
  function keys(e) {
    const ta = e.target, mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey && e.key.toLowerCase() === "z") { e.preventDefault(); step(e.shiftKey ? 1 : -1); return; }
    if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); step(1); return; }
    if (mod && e.key.toLowerCase() === "b") { e.preventDefault(); tool("b"); return; }
    if (mod && e.key.toLowerCase() === "i") { e.preventDefault(); tool("i"); return; }
    if (e.key !== "Enter" || e.shiftKey) return;
    const v = ta.value, s = ta.selectionStart, ls = v.lastIndexOf("\n", s - 1) + 1, line = v.slice(ls, s);
    const m = line.match(/^(\s*(?:[-*]\s\[[ xX]\]\s|[-*\u2022]\s|(\d+)[.)]\s|>\s?))(.*)$/); if (!m) return; e.preventDefault(); snap();
    if (!m[3].trim()) ta.setRangeText("", ls, s, "end");
    else ta.setRangeText("\n" + (m[2] ? (+m[2] + 1) + ". " : m[1].replace(/\[[xX]\]/, "[ ]").replace(/^>\s?\[!\w+\]\s*/, "> ")), s, ta.selectionEnd, "end");
    snap(); dirty(); refresh();
  }
  /* toolbar */
  function insertAt(text, block) {
    const ta = $(".snb-ta"); if (!ta) return; snap();
    const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
    let t = text; if (block) { const b4 = v.slice(0, s).replace(/[ \t]+$/, ""); t = (!b4 ? "" : b4.endsWith("\n\n") ? "" : b4.endsWith("\n") ? "\n" : "\n\n") + t + (v.slice(e).startsWith("\n") ? "\n" : "\n\n"); }
    ta.setRangeText(t, s, e, "end"); ta.focus(); snap(); dirty(); refresh();
  }
  function tool(f, btn) {
    const ta = $(".snb-ta"); if (!ta) return;
    if (f === "undo") return step(-1); if (f === "redo") return step(1);
    if (f === "verse") return insertVerse();
    if (f === "mic") return dictate(btn);
    ta.focus(); snap();
    const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
    const wrapSel = (a, b) => { const mid = v.slice(s, e) || "text"; ta.setRangeText(a + mid + b, s, e, "select"); ta.setSelectionRange(s + a.length, s + a.length + mid.length); };
    const prefix = (p, num) => { const ls = v.lastIndexOf("\n", s - 1) + 1; let le = v.indexOf("\n", e); if (le < 0) le = v.length;
      const rows = v.slice(ls, le).split("\n"), has = rows.every(l => num ? /^\s*\d+[.)]\s/.test(l) : l.startsWith(p));
      const block = rows.map((l, i) => { const bare = l.replace(/^(#{1,3}\s|[-*]\s\[[ xX]\]\s|[-*\u2022]\s|\d+[.)]\s|>\s?(\[!\w+\]\s*)?)/, ""); return has ? bare : (num ? (i + 1) + ". " : (p === "> [!NOTE] " && i ? "> " : p)) + bare; }).join("\n");
      ta.setRangeText(block, ls, le, "end"); };
    if (f === "b") wrapSel("**", "**"); else if (f === "i") wrapSel("*", "*");
    else if (f === "h1") prefix("# "); else if (f === "h2") prefix("## ");
    else if (f === "quote") prefix("> "); else if (f === "callout") prefix("> [!NOTE] ");
    else if (f === "ul") prefix("- "); else if (f === "ol") prefix("", true); else if (f === "cl") prefix("- [ ] ");
    else if (f === "hr") { insertAt("---", true); return; }
    snap(); dirty(); refresh();
  }
  function toggleLine(ln) {
    const ta = $(".snb-ta"); if (!ta) return; snap(); const lines = ta.value.split("\n"); if (!lines[ln]) return;
    lines[ln] = lines[ln].replace(/\[( |x|X)\]/, m => m === "[ ]" ? "[x]" : "[ ]"); ta.value = lines.join("\n"); snap(); dirty(); refresh(true);
  }
  function toggleFocus(on) { if (!root) return; const v = on == null ? !root.classList.contains("focus") : on; root.classList.toggle("focus", v); if (v) setView("ed"); toast(v ? "Focus mode \u00b7 Esc or the corners button to exit" : "Focus mode off"); }

  /* Insert Verse: a reference ("John 3:16", "Ps 23:1-3", "Rom 8:28") or keywords ("peace", "love one another") */
  const groupVerses = vs => { const g = []; vs.forEach(v => { const l = g[g.length - 1]; if (l && l[0].b === v.b && l[0].c === v.c && l[l.length - 1].v === v.v - 1) l.push(v); else g.push([v]); }); return g; };
  const quoteOf = vs => { const ref = vs.length > 1 ? vs[0].ref + "\u2013" + vs[vs.length - 1].v : vs[0].ref; return `> "${vs.map(v => v.text).join(" ")}" \u2014 ${ref} (KJV)`; };
  async function lookupVerses(q) {
    const L = LAI(); if (!L || !L.ensureKJV) throw new Error("The Bible text isn't available here");
    await L.ensureKJV(); q = String(q || "").trim(); if (!q) return [];
    const d = L.findByReference(q); if (d.length) return groupVerses(d).slice(0, 4);
    if (q.length < 3) return [];
    return L.searchKJV(q, { k: 8 }).map(r => { const v = L.findByReference(r.ref)[0]; return v ? [v] : null; }).filter(Boolean);
  }
  function insertVerse() {
    const ed = $(".snbx-ed"), ta = $(".snb-ta"); if (!ta) return;
    const old = $(".snbx-ins"); if (old) { old.remove(); return; }
    let sel = [ta.selectionStart, ta.selectionEnd];
    if (document.activeElement !== ta && sel[0] === 0 && ta.value) { const k = ta.value.indexOf("## Scripture"), at = k >= 0 ? ta.value.indexOf("\n", k) + 1 : ta.value.length; sel = [at, at]; }
    const box = h(`<div class="snbx-ins" role="dialog" aria-label="Insert verse"><div class="snb-search">${I.book}<input type="search" class="snbx-ins-q" placeholder="John 3:16, Psalm 23:1-3 or a word like peace" aria-label="Verse reference or keywords" enterkeyhint="search"><button type="button" class="snb-ib sm" data-a="x" aria-label="Close">${I.x}</button></div><div class="snbx-ins-res"><p class="snb-hint">Type a reference or keywords. Results come from the King James Bible.</p></div></div>`);
    $(".snbx-tools", ed).after(box);
    const q = $(".snbx-ins-q", box), res = $(".snbx-ins-res", box); let found = [], tk = 0;
    const put = vs => { box.remove(); ta.focus(); ta.setSelectionRange(sel[0], sel[1]); insertAt(quoteOf(vs), true); toast("Inserted " + (vs.length > 1 ? vs[0].ref + "\u2013" + vs[vs.length - 1].v : vs[0].ref)); };
    const run = async () => { const my = ++tk, v = q.value; if (!v.trim()) { res.innerHTML = '<p class="snb-hint">Type a reference or keywords.</p>'; found = []; return; }
      if (!(LAI() && LAI().kjvReady && LAI().kjvReady())) res.innerHTML = '<p class="snb-hint">Opening the King James Bible\u2026</p>';
      try { const g = await lookupVerses(v); if (my !== tk) return; found = g;
        res.innerHTML = g.length ? g.map((vs, i) => `<button type="button" class="snbx-ins-r" data-i="${i}"><b>${esc(vs.length > 1 ? vs[0].ref + "\u2013" + vs[vs.length - 1].v : vs[0].ref)}</b><span>${esc(vs.map(x => x.text).join(" ").slice(0, 220))}</span></button>`).join("") : '<p class="snb-hint">No verses found. Try "John 3:16" or a word like "shepherd".</p>';
        res.querySelectorAll("[data-i]").forEach(b => b.onclick = () => put(found[+b.dataset.i]));
      } catch (e) { if (my === tk) res.innerHTML = `<p class="snb-hint">Couldn't open the Bible text (${esc(String(e && e.message || e).slice(0, 80))}).</p>`; } };
    let t; q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(run, 220); });
    q.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(t); run().then(() => { if (found[0]) put(found[0]); }); } });
    $('[data-a="x"]', box).onclick = () => { box.remove(); ta.focus(); };
    setTimeout(() => q.focus(), 30);
  }

  /* verse preview popover */
  function closePop() { if (popEl) { popEl.remove(); popEl = null; } }
  async function showPop(anchor, r) {
    closePop();
    const canIns = cur && !cur.imp && $(".snb-ta");
    const p = popEl = h(`<div class="snbx-pop" role="dialog" aria-label="${esc(refLabel(r))}"><div class="snbx-pop-h"><b>${esc(refLabel(r))}</b><span>KJV</span><button type="button" class="snb-ib sm" data-a="x" aria-label="Close">${I.x}</button></div>
      <div class="snbx-pop-t">Loading verse\u2026</div><div class="snbx-pop-a"><button type="button" class="fx-btn small primary" data-a="jump">${I.book}Jump to Chapter</button><button type="button" class="fx-btn small" data-a="copy">${I.copy}Copy Verse</button>${canIns ? `<button type="button" class="fx-btn small" data-a="ins">${I.plus}Insert</button>` : ""}</div></div>`);
    root.appendChild(p);
    if (wide()) { const a = anchor.getBoundingClientRect(), W = Math.min(360, innerWidth - 16); p.style.width = W + "px"; p.style.left = Math.max(8, Math.min(a.left, innerWidth - W - 8)) + "px";
      const below = a.bottom + 8; if (below + 220 < innerHeight) p.style.top = below + "px"; else p.style.bottom = (innerHeight - a.top + 8) + "px"; } else p.classList.add("sheet");
    let vs = [];
    $('[data-a="x"]', p).onclick = closePop;
    $('[data-a="jump"]', p).onclick = () => { closePop(); jumpRef(r); };
    $('[data-a="copy"]', p).onclick = () => { if (!vs.length) return; copy(`"${vs.map(v => v.text).join(" ")}" \u2014 ${refLabel(r)} (KJV)`); };
    const ins = $('[data-a="ins"]', p); if (ins) ins.onclick = () => { if (!vs.length) return; closePop(); insertAt(quoteOf(vs), true); };
    try {
      const L = LAI(); if (!L || !L.passage) throw new Error("Bible text isn't available");
      const v1 = r.v || 1, v2 = r.v ? (r.ve || r.v) : 5; vs = await L.passage(r.b, r.c, v1, v2);
      if (popEl !== p) return;
      $(".snbx-pop-t", p).innerHTML = vs.length ? vs.map(v => (vs.length > 1 ? `<sup>${v.v}</sup>` : "") + esc(v.text)).join(" ") + (!r.v ? ' <span class="snb-faint">\u2026</span>' : "") : "That verse isn't in the King James Bible.";
    } catch (e) { if (popEl === p) $(".snbx-pop-t", p).textContent = "Couldn't load the verse (" + String(e && e.message || e).slice(0, 80) + ")."; }
  }

  /* dictation */
  function stopDictation() { if (rec) { try { rec.stop(); } catch {} rec = null; } }
  function dictate(btn) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast("Voice dictation isn't supported in this browser. Try Chrome, Edge or Safari.", 3500); return; }
    if (rec) { stopDictation(); return; }
    try { rec = new SR(); } catch { toast("Couldn't start dictation"); return; }
    rec.lang = navigator.language || "en-US"; rec.continuous = true; rec.interimResults = false;
    rec.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { const t = e.results[i][0].transcript.trim(); const ta = $(".snb-ta"); if (t && ta) { const s = ta.selectionStart; insertAt((s > 0 && !/\s$/.test(ta.value.slice(0, s)) ? " " : "") + t); } } };
    rec.onerror = e => { toast(e.error === "not-allowed" ? "Microphone permission was blocked" : "Dictation stopped (" + e.error + ")"); };
    rec.onend = () => { rec = null; if (btn) btn.classList.remove("rec"); };
    try { rec.start(); if (btn) btn.classList.add("rec"); toast("Listening\u2026 tap the mic again to stop"); } catch { rec = null; toast("Couldn't start dictation"); }
  }

  /* modal */
  function modal(title, html, wire) {
    const m = $(".snbx-modal");
    m.innerHTML = `<div class="snbx-mbox" role="dialog" aria-label="${esc(title)}"><div class="snbx-mh"><b>${esc(title)}</b><button type="button" class="snb-ib" data-a="mx" aria-label="Close">${I.x}</button></div><div class="snbx-mb"></div></div>`;
    m.hidden = false; $(".snbx-mb", m).append(h(html)); $('[data-a="mx"]', m).onclick = closeModal; m.onclick = e => { if (e.target === m) closeModal(); };
    wire($(".snbx-mb", m));
  }
  function closeModal() { const m = root && $(".snbx-modal"); if (m) { m.hidden = true; m.innerHTML = ""; } }

  /* export / print */
  const mdOf = it => { const lines = ["# " + (it.title || "Untitled"), "", "_" + bookName(it.nb) + " \u00b7 " + fmtDate(it.updated || Date.now()) + "_", ""];
    if (it.verseText && it.ref0) lines.push(`> "${it.verseText}" \u2014 ${refLabel(it.ref0)}`, "");
    lines.push(String(it.body || "").trim()); if (it.tags && it.tags.length) lines.push("", it.tags.map(t => "#" + t).join(" ")); return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n"; };
  const fileName = (t, ext) => (String(t || "note").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "note") + "." + ext;
  function download(name, text, type) {
    try { const u = URL.createObjectURL(new Blob([text], { type: (type || "text/plain") + ";charset=utf-8" })); const a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); toast("Saved " + name); }
    catch { copy(text); }
  }
  const curItem = () => { if (!cur) return null; commit(); const n = cur.n; return Object.assign({}, n, { body: bodyNow(), title: ($(".snb-tin") || {}).value || n.title }); };
  function printHtml(title, html) {
    let el = document.getElementById("snbx-print"); if (el) el.remove();
    el = h(`<div id="snbx-print"><h1>${esc(title)}</h1>${html}<p class="snbx-pf">Bibley Study Notebook \u00b7 ${esc(today())}</p></div>`); document.body.appendChild(el);
    document.documentElement.classList.add("snbx-printing");
    const done = () => { document.documentElement.classList.remove("snbx-printing"); el.remove(); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done); setTimeout(() => { try { window.print(); } catch {} setTimeout(done, 1500); }, 60);
  }
  const noteHtml = it => `<div class="snbx-pm">${esc(bookName(it.nb))} \u00b7 ${esc(fmtDate(it.updated || Date.now()))}</div>${it.verseText ? `<blockquote class="snb-bq">${esc(it.verseText)}</blockquote>` : ""}<div class="snb-body">${render(it.body)}</div>`;
  function moreMenu() {
    const it = curItem(); if (!it) return; const listNow = filtered(), lt = listTitle();
    const nbMd = () => ["# " + lt, ""].concat(listNow.map(x => mdOf(x).replace(/^# /, "## "))).join("\n---\n\n");
    const B = (a, ic, l) => `<button type="button" class="snbx-mi" data-m="${a}">${ic}<span>${l}</span></button>`;
    modal("This note", `<div class="snbx-menu">
      <div class="snbx-mt">Export note</div>${B("md", I.dl, "Export as Markdown (.md)")}${B("txt", I.dl, "Export as text (.txt)")}${B("copy", I.copy, "Copy formatted text")}${B("print", I.print, "Print / Save as PDF")}${B("share", I.share, "Share")}
      <div class="snbx-mt">${esc(lt)} \u00b7 ${listNow.length} note${listNow.length === 1 ? "" : "s"}</div>${B("nbmd", I.dl, "Export notebook as Markdown")}${B("nbtxt", I.dl, "Export notebook as text")}${B("nbprint", I.print, "Print notebook")}
      <div class="snbx-mt">Paper</div><div class="snbx-seg">${PAPERS.map(([k, l]) => `<button type="button" class="${paper() === k ? "on" : ""}" data-paper="${k}">${l}</button>`).join("")}</div>
      ${cur.imp ? "" : `<div class="snbx-mt"></div>${B("del", I.trash, "Delete note")}`}</div>`, b => {
      b.querySelectorAll("[data-paper]").forEach(x => x.onclick = () => { setPaper(x.dataset.paper); b.querySelectorAll("[data-paper]").forEach(y => y.classList.toggle("on", y === x)); });
      b.querySelectorAll("[data-m]").forEach(x => x.onclick = () => { const a = x.dataset.m; closeModal();
        if (a === "md") download(fileName(it.title, "md"), mdOf(it), "text/markdown");
        if (a === "txt") download(fileName(it.title, "txt"), noteText(it), "text/plain");
        if (a === "copy") copy(noteText(it));
        if (a === "share") shareText(it.title || "Note", noteText(it));
        if (a === "print") printHtml(it.title || "Untitled", noteHtml(it));
        if (a === "nbmd") listNow.length ? download(fileName(lt, "md"), nbMd(), "text/markdown") : toast("No notes to export");
        if (a === "nbtxt") listNow.length ? download(fileName(lt, "txt"), [lt.toUpperCase(), ""].concat(listNow.map(noteText).join("\n\n\u2014\u2014\u2014\n\n")).join("\n"), "text/plain") : toast("No notes to export");
        if (a === "nbprint") listNow.length ? printHtml(lt, listNow.map(x => `<h2>${esc(x.title || "Untitled")}</h2>` + noteHtml(x)).join("<hr>")) : toast("No notes to print");
        if (a === "del") { if (!confirm("Delete this note? This can't be undone.")) return; cur.gone = true; if (it.id) wr(KT, own().filter(y => y.id !== it.id)); cur = null; toast("Note deleted"); drawSide(); drawItems(); drawEmpty(); setView("list"); }
      }); });
  }

  /* notebooks */
  function editBook(id) {
    const nbs = books(), b = id ? nbs.find(x => x.id === id) : null; if (id && !b) return;
    const items = b ? allItems().filter(i => i.nb === b.id) : [];
    let color = b ? b.color : COLORS[nbs.length % COLORS.length][0];
    modal(b ? "Notebook" : "New notebook", `<div class="snb-form">
        <label class="snb-lbl">Name</label><input class="fx-input snb-bn" maxlength="40" placeholder="e.g. Romans study, Youth group" value="${esc(b ? b.name : "")}">
        <label class="snb-lbl">Colour</label><div class="snb-colors">${COLORS.map(([k, v]) => `<button type="button" class="snb-col ${k === color ? "on" : ""}" data-c="${k}" style="--c:${v}" aria-label="${k}"></button>`).join("")}</div>
        <div class="snb-actions"><button type="button" class="fx-btn primary" data-a="save" style="flex:1">${b ? "Save" : "Create notebook"}</button></div>
        ${b ? `<div class="snb-h">This notebook \u00b7 ${items.length} note${items.length === 1 ? "" : "s"}</div><div class="snb-actions">
          <button type="button" class="fx-btn small" data-a="share">${I.share}Share as text</button><button type="button" class="fx-btn small" data-a="copy">${I.copy}Copy all</button>
          <button type="button" class="fx-btn small danger" data-a="del">${I.trash}Delete</button></div>` : ""}</div>`, el => {
      el.querySelectorAll(".snb-col").forEach(c => c.onclick = () => { color = c.dataset.c; el.querySelectorAll(".snb-col").forEach(x => x.classList.toggle("on", x === c)); });
      const after = () => { closeModal(); drawSide(); drawList(); if (cur) drawEditor(); };
      el.querySelector('[data-a="save"]').onclick = () => {
        const name = el.querySelector(".snb-bn").value.trim(); if (!name) { toast("Give the notebook a name"); return; }
        commit(); const all = books(); if (b) { const x = all.find(y => y.id === b.id); x.name = name; x.color = color; } else { const nid = uid("nb_"); all.push({ id: nid, name, color, created: Date.now() }); st.nb = nid; st.tab = "notes"; }
        wr(KN, all); toast(b ? "Notebook saved" : "Notebook created"); after(); setView("list");
      };
      setTimeout(() => { try { el.querySelector(".snb-bn").focus(); } catch {} }, 60);
      if (b) {
        const txt = () => [b.name.toUpperCase(), ""].concat(items.map(noteText).join("\n\n\u2014\u2014\u2014\n\n")).join("\n");
        el.querySelector('[data-a="share"]').onclick = () => items.length ? shareText(b.name, txt()) : toast("This notebook is empty");
        el.querySelector('[data-a="copy"]').onclick = () => items.length ? copy(txt()) : toast("This notebook is empty");
        el.querySelector('[data-a="del"]').onclick = () => {
          const n = items.filter(i => i.src === "new").length;
          if (!confirm(`Delete the notebook "${b.name}"?` + (n ? ` Its ${n} note${n > 1 ? "s" : ""} will be kept under All notes.` : ""))) return;
          commit(); wr(KN, books().filter(x => x.id !== b.id));
          if (n) { const all = own(); all.forEach(x => { if (x.nb === b.id) x.nb = ""; }); wr(KT, all); }
          if (cur && cur.n.nb === b.id) cur.n.nb = "";
          if (st.nb === b.id) st.nb = "all"; toast("Notebook deleted"); after();
        };
      }
    });
  }

/* ---------- highlights and saved ---------- */
  function hlPane(pane) {
    const all = C.getHighlights ? C.getHighlights() : rd(OLD.HL, {}); const q = st.q.trim().toLowerCase();
    let list = Object.keys(all || {}).map(k => Object.assign({ key: k }, all[k])).filter(x => x && BOOKS[x.bookIdx]);
    if (st.hl !== "all") list = list.filter(x => x.color === st.hl);
    if (q) list = list.filter(x => ((x.text || "") + " " + (x.ref || "")).toLowerCase().includes(q));
    list.sort((a, b) => sortMode() === "recent" ? (b.added || 0) - (a.added || 0) : (a.bookIdx - b.bookIdx) || (a.chapter - b.chapter) || (a.verseNum - b.verseNum));
    const el = h(`<div>
      <div class="snb-chips">${["all"].concat(Object.keys(HLC)).map(c => `<button type="button" class="snb-chip ${st.hl === c ? "on" : ""}" data-c="${c}">${c === "all" ? "All colours" : `<i class="snb-dot lg" style="background:${HLC[c]}"></i>${c[0].toUpperCase() + c.slice(1)}`}</button>`).join("")}</div>
      <p class="snb-hint">Tap a verse in the reader, then pick a colour to highlight it.</p>
      <div class="snb-list">${list.length ? list.map(x => `<article class="snb-hl" data-k="${esc(x.key)}" style="--hc:${HLC[x.color] || HLC.yellow}">
        <div class="snb-hl-top"><b>${esc(x.ref || (BOOKS[x.bookIdx][1] + " " + x.chapter + ":" + x.verseNum))}</b><button type="button" class="snb-ib" data-n="${esc(x.key)}" aria-label="Start a note on this verse" title="New note">${I.edit}</button></div>
        <p>${esc(x.text || "")}</p></article>`).join("") : `<div class="snb-empty">${q ? "No highlights match." : "No highlights yet."}</div>`}</div></div>`);
    pane.append(el);
    el.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { st.hl = b.dataset.c; reopenPane(pane, hlPane); });
    el.querySelectorAll(".snb-hl").forEach(a => a.onclick = e => { const x = list.find(y => y.key === a.dataset.k); if (!x) return;
      if (e.target.closest("[data-n]")) { pickTemplate({ ref: x.ref || refLabel({ b: x.bookIdx, c: x.chapter, v: x.verseNum }), text: x.text }); return; }
      jumpRef({ b: x.bookIdx, c: x.chapter, v: x.verseNum }); });
  }
  function savedPane(pane) {
    const q = st.q.trim().toLowerCase();
    const vb = rd(OLD.VBM, {}) || {}, cb = rd(OLD.BM, []) || [];
    let vl = Object.keys(vb).map(k => Object.assign({ key: k }, vb[k])).filter(x => x && BOOKS[x.bookIdx]);
    let cl = (Array.isArray(cb) ? cb : []).filter(x => x && BOOKS[x.bookIdx]);
    if (q) { vl = vl.filter(x => ((x.text || "") + " " + (x.ref || "")).toLowerCase().includes(q)); cl = cl.filter(x => (BOOKS[x.bookIdx][1] + " " + x.chapter).toLowerCase().includes(q)); }
    vl.sort((a, b) => (b.added || 0) - (a.added || 0));
    const el = h(`<div>
      <div class="snb-h">Bookmarked verses</div>
      <div class="snb-list">${vl.length ? vl.map(x => `<article class="snb-hl snb-bmk" data-k="${esc(x.key)}"><div class="snb-hl-top"><b>${SB}${esc(x.ref || "")}</b><span class="snb-date">${esc(fmtDate(x.added))}</span></div>${x.text ? `<p>${esc(x.text)}</p>` : ""}</article>`).join("") : `<div class="snb-empty sm">No bookmarked verses yet.</div>`}</div>
      <div class="snb-h">Bookmarked chapters</div>
      <div class="snb-group">${cl.length ? cl.map((x, i) => `<div class="snb-row" data-i="${i}">${I.bm}<div class="t"><b>${esc(BOOKS[x.bookIdx][1] + " " + x.chapter)}</b></div>${I.chev}</div>`).join("") : `<div class="snb-empty sm">No bookmarked chapters yet.</div>`}</div></div>`);
    pane.append(el);
    el.querySelectorAll(".snb-bmk").forEach(a => a.onclick = () => { const x = vl.find(y => y.key === a.dataset.k); if (x) jumpRef({ b: x.bookIdx, c: x.chapter, v: x.verseNum, ve: x.verseEnd || null }); });
    el.querySelectorAll(".snb-row[data-i]").forEach(r => r.onclick = () => { const x = cl[+r.dataset.i]; jumpRef({ b: x.bookIdx, c: x.chapter, v: null }); });
  }

    /* ---------- templates picker ---------- */
  function pickTemplate(verse) {
    if (!isOpen()) open({});
    modal("New note", `<div>${verse ? `<div class="snb-attach">${I.link}<span>${esc(verse.ref)}</span></div>` : ""}
        <p class="snb-hint">Pick a study template.</p>
        <div class="snb-tpls">${TPL.map(t => `<button type="button" class="snb-tpl" data-t="${t.id}"><span class="ic">${t.ic}</span><b>${esc(t.name)}</b><span>${esc(t.d)}</span></button>`).join("")}</div></div>`, el => {
      el.querySelectorAll(".snb-tpl").forEach(b => b.onclick = () => {
        const t = tplOf(b.dataset.t), now = Date.now();
        const nb = books().some(x => x.id === st.nb) ? st.nb : (ensureDefault()[0] || {}).id;
        const ttl = t.id === "blank" ? (verse ? verse.ref : "") : t.name + (verse ? " \u00b7 " + verse.ref : " \u00b7 " + new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }));
        closeModal();
        openNew({ id: null, nb, title: ttl, body: t.body(verse) + (t.id === "blank" && verse ? vq(verse) + "\n\n" : ""), tags: [], pinned: false, tpl: t.id, created: now, updated: now });
      });
    });
  }

/* ---------- backup ---------- */
  function exportData() { return { notebooks: books(), notes: own(), meta: meta() }; }
  function importData(src) {
    if (!src || typeof src !== "object") return;
    const nb = books(), ids = new Set(nb.map(x => x.id)); (Array.isArray(src.notebooks) ? src.notebooks : []).forEach(x => { if (x && x.id && !ids.has(x.id)) { nb.push(x); ids.add(x.id); } }); wr(KN, nb);
    const nt = own(), nids = new Set(nt.map(x => x.id)); (Array.isArray(src.notes) ? src.notes : []).forEach(x => { if (x && x.id && !nids.has(x.id)) { nt.push(x); nids.add(x.id); } }); wr(KT, nt);
    if (src.meta && typeof src.meta === "object") { const m = meta(); Object.keys(src.meta.converted || {}).forEach(k => { if (!m.converted[k]) m.converted[k] = src.meta.converted[k]; }); Object.keys(src.meta.pins || {}).forEach(k => { m.pins[k] = 1; }); wr(KM, m); }
  }
  function newFromVerse(t) { if (!t) return; ensureDefault(); open({}); pickTemplate({ ref: t.ref, text: t.text }); }

  window.BibleyStudyNB = { version: "7.0", open, close, isOpen, newFromVerse, exportData, importData, KEYS: [KN, KT, KM], TEMPLATES: TPL.map(t => ({ id: t.id, name: t.name })), _test: { findRefs, render, allItems, plain, lookupVerses, quoteOf, mdOf } };
})();
