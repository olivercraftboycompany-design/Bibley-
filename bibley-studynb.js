/* bibley-studynb.js - Bibley 5.7 Study Notebook (app 1.7).
   Notebooks with colour tags, rich study notes (bold, italic, headings, bullets, checklists),
   linked verse references (auto-detected, tap to open in the reader), tags, pins, study templates,
   highlights and bookmarks in one place, search, sort, filter, export.
   New data lives ONLY under new keys:
     bibley_nb_v1_notebooks  [{id,name,color,created}]
     bibley_nb_v1_notes      [{id,nb,title,body,tags,pinned,tpl,created,updated,from}]
     bibley_nb_v1_meta       {sort, converted:{srcId:{to,at}}, pins:{srcId:1}}
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

  /* ---------- light formatting: **bold**, *italic*, # heading, - bullet, - [ ] checklist ---------- */
  function inline(t) {
    // t is plain text; returns HTML with refs linked and bold/italic applied
    const refs = findRefs(t); let html = "", at = 0;
    const fmt = x => esc(x).replace(/\*\*([^*\n]+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\w)/g, "$1<i>$2</i>").replace(/(^|[^\w])_([^_\n]+?)_(?!\w)/g, "$1<i>$2</i>");
    refs.forEach(r => { html += fmt(t.slice(at, r.i)); html += `<button type="button" class="snb-ref" data-ref="${r.b},${r.c},${r.v || 0},${r.ve || 0}">${esc(r.raw)}</button>`; at = r.i + r.len; });
    return html + fmt(t.slice(at));
  }
  function render(body) {
    const lines = String(body || "").split("\n"); let out = "", list = null;
    const TAG = { cl: '<ul class="snb-cl">', ul: "<ul>", ol: "<ol>" }, END = { cl: "</ul>", ul: "</ul>", ol: "</ol>" };
    const open = k => { if (list !== k) { close(); out += TAG[k]; list = k; } };
    const close = () => { if (list) { out += END[list]; list = null; } };
    lines.forEach((ln, i) => {
      let m;
      if ((m = ln.match(/^\s*[-*]\s\[( |x|X)\]\s?(.*)$/))) { open("cl");
        out += `<li class="${m[1] !== " " ? "done" : ""}"><button type="button" class="snb-cb" data-line="${i}" aria-label="Toggle item">${m[1] !== " " ? sv('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 14) : ""}</button><span>${inline(m[2])}</span></li>`; return; }
      if ((m = ln.match(/^\s*(?:[-*\u2022])\s+(.*)$/))) { open("ul"); out += `<li>${inline(m[1])}</li>`; return; }
      if ((m = ln.match(/^\s*(\d+)[.)]\s+(.*)$/))) { open("ol"); out += `<li>${inline(m[2])}</li>`; return; }
      close();
      if ((m = ln.match(/^(#{1,3})\s+(.*)$/))) { out += `<h${m[1].length + 2}>${inline(m[2])}</h${m[1].length + 2}>`; return; }
      if (!ln.trim()) { out += '<div class="snb-gap"></div>'; return; }
      out += `<p>${inline(ln)}</p>`;
    });
    close();
    return out;
  }
  const plain = body => String(body || "").replace(/\*\*([^*\n]+?)\*\*/g, "$1").replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\w)/g, "$1$2").replace(/(^|[^\w])_([^_\n]+?)_(?!\w)/g, "$1$2").replace(/^#{1,3}\s+/gm, "").replace(/^\s*[-*]\s\[( )\]\s?/gm, "\u2610 ").replace(/^\s*[-*]\s\[[xX]\]\s?/gm, "\u2611 ").replace(/^\s*[-*]\s+/gm, "\u2022 ");
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
  const TPL = [
    { id: "blank", name: "Blank", ic: I.t_blank, d: "A clean page", body: () => "" },
    { id: "soap", name: "SOAP", ic: I.t_soap, d: "Scripture, Observation, Application, Prayer", body: v => `## Scripture\n${v ? v.ref + (v.text ? "\n" + v.text : "") : ""}\n\n## Observation\n\n\n## Application\n\n\n## Prayer\n` },
    { id: "sermon", name: "Sermon notes", ic: I.t_sermon, d: "Speaker, passage, main points", body: v => `## Sermon\nSpeaker: \nDate: ${today()}\nPassage: ${v ? v.ref : ""}\n\n## Main points\n- \n\n## Key verses\n\n\n## Takeaways\n- [ ] ` },
    { id: "char", name: "Character study", ic: I.t_char, d: "A person in Scripture", body: v => `## Who\n\n\n## Key passages\n${v ? v.ref : ""}\n\n## Strengths\n- \n\n## Struggles\n- \n\n## What God did through them\n\n\n## Lessons for me\n` },
    { id: "word", name: "Word study", ic: I.t_word, d: "One word, its meaning and uses", body: v => `## Word\n\n\n## Original language\nHebrew or Greek: \n\n## Where it appears\n${v ? v.ref : ""}\n\n## Meaning in context\n\n\n## Takeaway\n` },
    { id: "prayer", name: "Prayer journal", ic: I.t_prayer, d: "Praise, confess, thanks, requests", body: v => `## ${today()}\n${v ? v.ref + "\n" : ""}\n## Praise\n\n\n## Confess\n\n\n## Thanks\n\n\n## Asking for\n- [ ] \n\n## Answered\n` }
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
  const st = { tab: "notes", nb: "all", tag: null, q: "", hl: "all" };
  const sortMode = () => meta().sort || "recent";
  function filtered() {
    let items = allItems(); const q = st.q.trim().toLowerCase();
    if (st.nb !== "all") items = items.filter(i => i.nb === st.nb);
    if (st.tag) items = items.filter(i => i.tags.includes(st.tag));
    if (q) { const qr = findRefs(st.q.replace(/^./, c => c.toUpperCase()));
      items = items.filter(i => (i.title + "\n" + i.body + "\n" + (i.verseText || "") + "\n" + i.tags.join(" ") + "\n" + i.refs.map(refLabel).join(" ")).toLowerCase().includes(q) || (qr.length && i.refs.some(r => r.b === qr[0].b && (r.c === qr[0].c)))); }
    const s = sortMode();
    const bk = i => i.refs.length ? i.refs[0].b * 1e6 + i.refs[0].c * 1e3 + (i.refs[0].v || 0) : 9e9;
    items.sort((a, b) => (b.pinned - a.pinned) || (s === "title" ? (a.title || "").localeCompare(b.title || "") : s === "book" ? bk(a) - bk(b) || (b.updated - a.updated) : (b.updated || 0) - (a.updated || 0)));
    return items;
  }

  /* ---------- main sheet ---------- */
  function open(opts) {
    ensureDefault(); opts = opts || {};
    if (opts.nb) { st.nb = opts.nb; st.tab = "notes"; }
    if (opts.tab) st.tab = opts.tab;
    openSheet("snb", "Study Notebook", home);
  }
  const reopen = () => openSheet("snb", "Study Notebook", home);
  function home(body) {
    const box = h(`<div class="snb">
      <div class="snb-search">${I.search}<input type="search" class="snb-q" placeholder="Search notes, tags, verses" aria-label="Search notebook" value="${esc(st.q)}"></div>
      <div class="snb-tabs" role="tablist">${[["notes", "Notes"], ["books", "Notebooks"], ["hl", "Highlights"], ["saved", "Saved"]].map(([k, l]) => `<button type="button" role="tab" class="snb-tab ${st.tab === k ? "on" : ""}" data-t="${k}">${l}</button>`).join("")}</div>
      <div class="snb-pane"></div></div>`);
    body.append(box);
    const pane = box.querySelector(".snb-pane"), q = box.querySelector(".snb-q");
    const draw = () => { pane.innerHTML = ""; ({ notes: notesPane, books: booksPane, hl: hlPane, saved: savedPane })[st.tab](pane); };
    box.querySelectorAll(".snb-tab").forEach(b => b.onclick = () => { st.tab = b.dataset.t; box.querySelectorAll(".snb-tab").forEach(x => x.classList.toggle("on", x === b)); draw(); });
    let t; q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { st.q = q.value; draw(); }, 160); });
    draw();
  }
  function notesPane(pane) {
    const nbs = books(), vb = virtBooks(), items = allItems();
    const count = id => items.filter(i => i.nb === id).length;
    const chips = [{ id: "all", name: "All notes" }].concat(nbs, vb);
    if (!chips.some(c => c.id === st.nb)) st.nb = "all";
    const tags = [...new Set(items.flatMap(i => i.tags))].sort();
    if (st.tag && !tags.includes(st.tag)) st.tag = null;
    const list = filtered();
    const el = h(`<div>
      <div class="snb-chips">${chips.map(c => `<button type="button" class="snb-chip ${st.nb === c.id ? "on" : ""}" data-nb="${esc(c.id)}">${c.id === "all" ? "" : `<i class="snb-dot" style="background:${colorOf(c.color)}"></i>`}${esc(c.name)}<em>${c.id === "all" ? items.length : count(c.id)}</em></button>`).join("")}</div>
      ${tags.length ? `<div class="snb-chips snb-tags">${tags.map(tg => `<button type="button" class="snb-chip small ${st.tag === tg ? "on" : ""}" data-tag="${esc(tg)}">${I.tag}${esc(tg)}</button>`).join("")}</div>` : ""}
      <div class="snb-bar"><button type="button" class="fx-btn primary small snb-new">${I.plus}New note</button>
        <label class="snb-sort"><span>Sort</span><select aria-label="Sort notes">${[["recent", "Recent"], ["title", "Title"], ["book", "Book order"]].map(([k, l]) => `<option value="${k}" ${sortMode() === k ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
      ${st.nb !== "all" && /^(leg|old:)/.test(st.nb) ? `<p class="snb-note-imp">${(vb.find(v => v.id === st.nb) || {}).sub || ""}. Kept exactly as they were; open one to keep working on it as a study note.</p>` : ""}
      <div class="snb-list">${list.length ? list.map(card).join("") : `<div class="snb-empty">${st.q || st.tag ? "Nothing matches that search." : "No notes here yet.<br>Tap New note to start one, or pick a study template."}</div>`}</div></div>`);
    pane.append(el);
    el.querySelectorAll("[data-nb]").forEach(b => b.onclick = () => { st.nb = b.dataset.nb; reopenPane(pane, notesPane); });
    el.querySelectorAll("[data-tag]").forEach(b => b.onclick = () => { st.tag = st.tag === b.dataset.tag ? null : b.dataset.tag; reopenPane(pane, notesPane); });
    el.querySelector(".snb-new").onclick = () => pickTemplate(null);
    el.querySelector("select").onchange = e => { const m = meta(); m.sort = e.target.value; wr(KM, m); reopenPane(pane, notesPane); };
    wireCards(el, list);
    const on = el.querySelector(".snb-chip.on"); if (on && on.scrollIntoView) try { on.scrollIntoView({ block: "nearest", inline: "center" }); } catch {}
  }
  const reopenPane = (pane, fn) => { pane.innerHTML = ""; fn(pane); };
  function card(it) {
    const nb = books().concat(virtBooks()).find(b => b.id === it.nb);
    return `<article class="snb-card" data-id="${esc(it.id)}" tabindex="0">
      <div class="snb-card-top"><span class="snb-nbl"><i class="snb-dot" style="background:${colorOf(nb && nb.color)}"></i>${esc(nb ? nb.name : "No notebook")}</span>${it.pinned ? `<span class="snb-pinned">${I.pin}</span>` : ""}<span class="snb-date">${esc(fmtDate(it.updated))}</span></div>
      <h3>${esc(it.title || "Untitled")}</h3>
      ${snippet(it.body) ? `<p>${esc(snippet(it.body))}</p>` : (it.verseText ? `<p class="snb-vq">${esc(it.verseText.slice(0, 140))}</p>` : "")}
      ${it.refs.length || it.tags.length ? `<div class="snb-card-refs">${it.refs.slice(0, 3).map(r => `<button type="button" class="snb-ref chip" data-ref="${r.b},${r.c},${r.v || 0},${r.ve || 0}">${esc(refLabel(r))}</button>`).join("")}${it.refs.length > 3 ? `<span class="snb-more">+${it.refs.length - 3}</span>` : ""}${it.tags.slice(0, 3).map(t => `<span class="snb-tg">#${esc(t)}</span>`).join("")}</div>` : ""}
    </article>`;
  }
  function wireRefs(root) { root.querySelectorAll(".snb-ref[data-ref]").forEach(b => b.onclick = e => { e.stopPropagation(); const [bb, c, v, ve] = b.dataset.ref.split(",").map(Number); onLeave(); jump({ b: bb, c, v: v || null, ve: ve || null }); }); }
  function wireCards(root, list) {
    wireRefs(root);
    root.querySelectorAll(".snb-card").forEach(c => { const go = () => { const it = list.find(x => x.id === c.dataset.id); if (it) view(it.id); }; c.onclick = go; c.onkeydown = e => { if (e.key === "Enter") go(); }; });
  }
  let leaveFn = null; const onLeave = () => { if (leaveFn) { const f = leaveFn; leaveFn = null; FX.ui.onClose(null); try { f(); } catch {} } };

  /* ---------- notebooks pane ---------- */
  function booksPane(pane) {
    const nbs = books(), vb = virtBooks(), items = allItems();
    const row = b => `<div class="snb-row" data-nb="${esc(b.id)}"><i class="snb-sq" style="background:${colorOf(b.color)}"></i><div class="t"><b>${esc(b.name)}</b><span>${(c => c + (c === 1 ? " note" : " notes"))(items.filter(i => i.nb === b.id).length)}${b.imported ? " \u00b7 imported" : ""}</span></div>${b.imported ? I.chev : `<button type="button" class="snb-ib" data-m="${esc(b.id)}" aria-label="Notebook options">${I.more}</button>`}</div>`;
    const el = h(`<div>
      <div class="snb-bar"><button type="button" class="fx-btn primary small" data-a="newnb">${I.plus}New notebook</button><button type="button" class="fx-btn small" data-a="all">${I.book}All notes <em class="snb-n">${items.length}</em></button></div>
      <div class="snb-group">${nbs.map(row).join("")}</div>
      ${vb.length ? `<div class="snb-h">From earlier versions</div><div class="snb-group">${vb.map(row).join("")}</div><button type="button" class="snb-link" data-a="classic">Open the classic notebook pages</button>` : ""}
    </div>`);
    pane.append(el);
    el.querySelector('[data-a="newnb"]').onclick = () => editBook(null, pane);
    el.querySelector('[data-a="all"]').onclick = () => { st.nb = "all"; st.tab = "notes"; reopen(); };
    const cl = el.querySelector('[data-a="classic"]'); if (cl) cl.onclick = () => { if (window.BibleyNotes && window.BibleyNotes.openClassic) window.BibleyNotes.openClassic(); };
    el.querySelectorAll(".snb-row").forEach(r => r.onclick = e => { if (e.target.closest(".snb-ib")) return; st.nb = r.dataset.nb; st.tab = "notes"; st.tag = null; reopen(); });
    el.querySelectorAll(".snb-ib").forEach(b => b.onclick = e => { e.stopPropagation(); editBook(b.dataset.m, pane); });
  }
  function editBook(id, pane) {
    const nbs = books(), b = id ? nbs.find(x => x.id === id) : null;
    const items = b ? allItems().filter(i => i.nb === b.id) : [];
    openSheet("snb-book", b ? "Notebook" : "New notebook", body => {
      let color = b ? b.color : COLORS[(nbs.length) % COLORS.length][0];
      const el = h(`<div class="snb snb-form">
        <label class="snb-lbl">Name</label><input class="fx-input snb-bn" maxlength="40" placeholder="e.g. Romans study, Youth group" value="${esc(b ? b.name : "")}">
        <label class="snb-lbl">Colour</label><div class="snb-colors">${COLORS.map(([k, v]) => `<button type="button" class="snb-col ${k === color ? "on" : ""}" data-c="${k}" style="--c:${v}" aria-label="${k}"></button>`).join("")}</div>
        <div class="snb-actions"><button type="button" class="fx-btn primary" data-a="save" style="flex:1">${b ? "Save" : "Create notebook"}</button><button type="button" class="fx-btn" data-a="back">Cancel</button></div>
        ${b ? `<div class="snb-h">This notebook</div><div class="snb-actions">
          <button type="button" class="fx-btn small" data-a="share">${I.share}Share as text</button><button type="button" class="fx-btn small" data-a="copy">${I.copy}Copy all</button>
          <button type="button" class="fx-btn small danger" data-a="del">${I.trash}Delete</button></div>` : ""}
      </div>`);
      body.append(el);
      el.querySelectorAll(".snb-col").forEach(c => c.onclick = () => { color = c.dataset.c; el.querySelectorAll(".snb-col").forEach(x => x.classList.toggle("on", x === c)); });
      const back = () => { st.tab = "books"; reopen(); };
      el.querySelector('[data-a="back"]').onclick = back;
      el.querySelector('[data-a="save"]').onclick = () => {
        const name = el.querySelector(".snb-bn").value.trim(); if (!name) { toast("Give the notebook a name"); return; }
        const all = books(); if (b) { const x = all.find(y => y.id === b.id); x.name = name; x.color = color; } else all.push({ id: uid("nb_"), name, color, created: Date.now() });
        wr(KN, all); toast(b ? "Notebook saved" : "Notebook created"); back();
      };
      if (!b) setTimeout(() => { try { el.querySelector(".snb-bn").focus(); } catch {} }, 250);
      if (b) {
        const txt = () => [b.name.toUpperCase(), ""].concat(items.map(noteText).join("\n\n\u2014\u2014\u2014\n\n")).join("\n");
        el.querySelector('[data-a="share"]').onclick = () => items.length ? shareText(b.name, txt()) : toast("This notebook is empty");
        el.querySelector('[data-a="copy"]').onclick = () => items.length ? copy(txt()) : toast("This notebook is empty");
        el.querySelector('[data-a="del"]').onclick = () => {
          const n = items.filter(i => i.src === "new").length;
          if (!confirm(`Delete the notebook "${b.name}"?` + (n ? ` Its ${n} note${n > 1 ? "s" : ""} will be kept under All notes.` : ""))) return;
          wr(KN, books().filter(x => x.id !== b.id));
          if (n) { const all = own(); all.forEach(x => { if (x.nb === b.id) x.nb = ""; }); wr(KT, all); }
          if (st.nb === b.id) st.nb = "all"; toast("Notebook deleted"); back();
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
      jump({ b: x.bookIdx, c: x.chapter, v: x.verseNum }); });
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
    el.querySelectorAll(".snb-bmk").forEach(a => a.onclick = () => { const x = vl.find(y => y.key === a.dataset.k); if (x) jump({ b: x.bookIdx, c: x.chapter, v: x.verseNum, ve: x.verseEnd || null }); });
    el.querySelectorAll(".snb-row[data-i]").forEach(r => r.onclick = () => { const x = cl[+r.dataset.i]; jump({ b: x.bookIdx, c: x.chapter, v: null }); });
  }

  /* ---------- templates picker ---------- */
  function pickTemplate(verse) {
    openSheet("snb-tpl", "New note", body => {
      const el = h(`<div class="snb">${verse ? `<div class="snb-attach">${I.link}<span>${esc(verse.ref)}</span></div>` : ""}
        <p class="snb-hint">Pick a study template.</p>
        <div class="snb-tpls">${TPL.map(t => `<button type="button" class="snb-tpl" data-t="${t.id}"><span class="ic">${t.ic}</span><b>${esc(t.name)}</b><span>${esc(t.d)}</span></button>`).join("")}</div>
        <button type="button" class="snb-link" data-a="back">${I.back}Back to notebook</button></div>`);
      body.append(el);
      el.querySelectorAll(".snb-tpl").forEach(b => b.onclick = () => {
        const t = tplOf(b.dataset.t), now = Date.now();
        const nb = books().some(x => x.id === st.nb) ? st.nb : (ensureDefault()[0] || {}).id;
        const ttl = t.id === "blank" ? (verse ? verse.ref : "") : t.name + (verse ? " \u00b7 " + verse.ref : " \u00b7 " + new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }));
        edit({ id: null, nb, title: ttl, body: t.body(verse) + (t.id === "blank" && verse ? verse.ref + (verse.text ? "\n" + verse.text : "") + "\n\n" : ""), tags: [], pinned: false, tpl: t.id, created: now, updated: now });
      });
      el.querySelector('[data-a="back"]').onclick = reopen;
    });
  }

  /* ---------- view a note ---------- */
  function find(id) { return allItems().find(x => x.id === id); }
  function view(id) {
    const it = find(id); if (!it) { reopen(); return; }
    const imp = it.src !== "new";
    openSheet("snb-view", "", body => {
      const nb = books().concat(virtBooks()).find(b => b.id === it.nb);
      const el = h(`<div class="snb snb-viewer">
        <div class="snb-vtop"><button type="button" class="snb-ib" data-a="back" aria-label="Back">${I.back}</button><span class="snb-nbl"><i class="snb-dot" style="background:${colorOf(nb && nb.color)}"></i>${esc(nb ? nb.name : "No notebook")}</span>
          <button type="button" class="snb-ib ${it.pinned ? "on" : ""}" data-a="pin" aria-label="${it.pinned ? "Unpin" : "Pin"}" title="${it.pinned ? "Unpin" : "Pin"}">${I.pin}</button></div>
        <h2 class="snb-title">${esc(it.title || "Untitled")}</h2>
        <div class="snb-meta">${it.tpl && it.tpl !== "blank" ? esc(tplOf(it.tpl).name) + " \u00b7 " : ""}Created ${esc(fmtDate(it.created))}${it.updated && it.updated - it.created > 60000 ? " \u00b7 Edited " + esc(fmtDate(it.updated)) : ""}</div>
        ${imp ? `<div class="snb-imp">${I.book}<span>Imported from your earlier notes. The original is kept as it was.</span></div>` : ""}
        ${it.verseText ? `<blockquote class="snb-vq">${esc(it.verseText)}<cite>${it.ref0 ? `<button type="button" class="snb-ref" data-ref="${it.ref0.b},${it.ref0.c},${it.ref0.v || 0},${it.ref0.ve || 0}">${esc(refLabel(it.ref0))}</button>` : ""}${it.version ? " \u00b7 " + esc(vname(it.version)) : ""}</cite></blockquote>` : ""}
        <div class="snb-body">${render(it.body) || '<p class="snb-faint">Empty note</p>'}</div>
        ${it.refs.length ? `<div class="snb-h">Verses in this note</div><div class="snb-card-refs">${it.refs.map(r => `<button type="button" class="snb-ref chip" data-ref="${r.b},${r.c},${r.v || 0},${r.ve || 0}">${esc(refLabel(r))}</button>`).join("")}</div>` : ""}
        ${it.tags.length ? `<div class="snb-card-refs" style="margin-top:8px">${it.tags.map(t => `<button type="button" class="snb-tg" data-tag="${esc(t)}">#${esc(t)}</button>`).join("")}</div>` : ""}
        <div class="snb-actions">
          <button type="button" class="fx-btn primary small" data-a="edit">${I.edit}${imp ? "Edit as study note" : "Edit"}</button>
          <button type="button" class="fx-btn small" data-a="share">${I.share}Share</button>
          <button type="button" class="fx-btn small" data-a="copy">${I.copy}Copy</button>
          ${imp ? "" : `<button type="button" class="fx-btn small danger" data-a="del">${I.trash}Delete</button>`}
        </div></div>`);
      body.append(el);
      wireRefs(el);
      el.querySelectorAll(".snb-cb").forEach(b => b.onclick = () => {
        if (imp) { toast("Tap Edit as study note to tick items"); return; }
        const ln = +b.dataset.line, lines = it.body.split("\n");
        lines[ln] = lines[ln].replace(/\[( |x|X)\]/, m => m === "[ ]" ? "[x]" : "[ ]");
        it.body = lines.join("\n"); it.updated = Date.now(); saveNote(it); view(it.id);
      });
      el.querySelectorAll("[data-tag]").forEach(b => b.onclick = () => { st.tag = b.dataset.tag; st.nb = "all"; st.tab = "notes"; reopen(); });
      el.querySelector('[data-a="back"]').onclick = reopen;
      el.querySelector('[data-a="pin"]').onclick = () => {
        if (imp) { const m = meta(); if (m.pins[it.id]) delete m.pins[it.id]; else m.pins[it.id] = 1; wr(KM, m); }
        else { it.pinned = !it.pinned; saveNote(it); }
        toast(it.pinned ? "Unpinned" : "Pinned to the top"); view(it.id);
      };
      el.querySelector('[data-a="share"]').onclick = () => shareText(it.title || "Note", noteText(it));
      el.querySelector('[data-a="copy"]').onclick = () => copy(noteText(it));
      el.querySelector('[data-a="edit"]').onclick = () => {
        if (!imp) { edit(it); return; }
        const now = Date.now(), nb = books().some(x => x.id === st.nb) ? st.nb : ensureDefault()[0].id;
        const head = it.verseText && it.ref0 ? `${refLabel(it.ref0)}\n${it.verseText}\n\n` : (it.ref0 ? refLabel(it.ref0) + "\n\n" : "");
        edit({ id: null, nb, title: it.title, body: head + it.body, tags: [], pinned: it.pinned, tpl: "blank", created: it.created || now, updated: now, from: it.id });
      };
      const del = el.querySelector('[data-a="del"]');
      if (del) del.onclick = () => { if (!confirm("Delete this note? This can't be undone.")) return; wr(KT, own().filter(x => x.id !== it.id)); toast("Note deleted"); reopen(); };
    });
  }

  /* ---------- editor ---------- */
  function edit(n) {
    n = Object.assign({}, n);
    openSheet("snb-edit", "", body => {
      const nbs = books();
      const el = h(`<div class="snb snb-editor">
        <div class="snb-vtop"><button type="button" class="snb-ib" data-a="back" aria-label="Back">${I.back}</button>
          <select class="snb-nbsel" aria-label="Notebook">${nbs.map(b => `<option value="${esc(b.id)}" ${b.id === n.nb ? "selected" : ""}>${esc(b.name)}</option>`).join("")}<option value="" ${!n.nb ? "selected" : ""}>No notebook</option></select>
          <button type="button" class="snb-ib ${n.pinned ? "on" : ""}" data-a="pin" aria-label="Pin">${I.pin}</button></div>
        <input class="snb-tin" maxlength="100" placeholder="Title" aria-label="Title" value="${esc(n.title || "")}">
        <div class="snb-tools" role="toolbar" aria-label="Formatting">
          <button type="button" data-f="b" aria-label="Bold" title="Bold">${I.bold}</button><button type="button" data-f="i" aria-label="Italic" title="Italic">${I.ital}</button>
          <button type="button" data-f="h" aria-label="Heading" title="Heading">${I.head}</button><button type="button" data-f="ul" aria-label="Bullet list" title="Bullets">${I.list}</button>
          <button type="button" data-f="cl" aria-label="Checklist" title="Checklist">${I.check}</button><span class="sep"></span><button type="button" data-f="ref" class="txt" aria-label="Insert verse reference">${I.link}<span>Verse</span></button></div>
        <textarea class="snb-ta" aria-label="Note" placeholder="Write here. Verse references like John 3:16 become links.">${esc(n.body || "")}</textarea>
        <div class="snb-live"></div>
        <label class="snb-lbl">Tags</label><input class="fx-input snb-tags-in" placeholder="faith, prayer, youth group" value="${esc((n.tags || []).join(", "))}">
        <div class="snb-actions"><button type="button" class="fx-btn primary" data-a="save" style="flex:1">Save</button>${n.id ? `<button type="button" class="fx-btn danger" data-a="del" aria-label="Delete">${I.trash}</button>` : ""}</div>
      </div>`);
      body.append(el);
      const ta = el.querySelector(".snb-ta"), tin = el.querySelector(".snb-tin"), live = el.querySelector(".snb-live"), sel = el.querySelector(".snb-nbsel"), tg = el.querySelector(".snb-tags-in");
      const grow = () => { ta.style.height = "auto"; ta.style.height = Math.max(220, ta.scrollHeight + 4) + "px"; };
      const showRefs = () => { const rs = uniqRefs(findRefs(tin.value + "\n" + ta.value)); live.innerHTML = rs.length ? `<span class="snb-live-l">${I.link}Linked</span>` + rs.slice(0, 8).map(r => `<button type="button" class="snb-ref chip" data-ref="${r.b},${r.c},${r.v || 0},${r.ve || 0}">${esc(refLabel(r))}</button>`).join("") : ""; wireRefs(live); };
      let t; ta.addEventListener("input", () => { grow(); clearTimeout(t); t = setTimeout(showRefs, 250); }); tin.addEventListener("input", () => { clearTimeout(t); t = setTimeout(showRefs, 250); });
      setTimeout(() => { grow(); showRefs(); try { if (!n.id && !n.from) { const p = ta.value.indexOf("\n\n"); (n.tpl === "blank" && !tin.value ? tin : ta).focus(); if (n.tpl !== "blank") { const at = ta.value.indexOf("\n", ta.value.indexOf("## Observation") >= 0 ? ta.value.indexOf("## Observation") : 0) + 1; ta.setSelectionRange(at, at); } } } catch {} }, 260);
      const pin = el.querySelector('[data-a="pin"]'); pin.onclick = () => { n.pinned = !n.pinned; pin.classList.toggle("on", n.pinned); };
      // formatting helpers
      const wrapSel = (a, b) => { const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value, mid = v.slice(s, e) || "text";
        ta.setRangeText(a + mid + b, s, e, "select"); ta.setSelectionRange(s + a.length, s + a.length + mid.length); };
      const prefix = p => { const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value; const ls = v.lastIndexOf("\n", s - 1) + 1; let le = v.indexOf("\n", e); if (le < 0) le = v.length;
        const block = v.slice(ls, le).split("\n").map(l => { const bare = l.replace(/^(#{1,3}\s|[-*]\s\[[ xX]\]\s|[-*\u2022]\s)/, ""); return l.startsWith(p) ? bare : p + bare; }).join("\n");
        ta.setRangeText(block, ls, le, "end"); };
      el.querySelectorAll(".snb-tools [data-f]").forEach(b => { b.addEventListener("mousedown", e => e.preventDefault()); b.onclick = () => { ta.focus();
        const f = b.dataset.f;
        if (f === "b") wrapSel("**", "**"); else if (f === "i") wrapSel("*", "*"); else if (f === "h") prefix("## "); else if (f === "ul") prefix("- "); else if (f === "cl") prefix("- [ ] ");
        else if (f === "ref") { const r = prompt("Verse reference (e.g. John 3:16)"); if (r) { const f2 = findRefs(r.trim().replace(/^./, c => c.toUpperCase())); if (!f2.length) toast("That doesn't look like a reference"); else ta.setRangeText(refLabel(f2[0]) + " ", ta.selectionStart, ta.selectionEnd, "end"); } }
        grow(); showRefs(); }; });
      // continue lists on Enter
      ta.addEventListener("keydown", e => { if (e.key !== "Enter") return; const v = ta.value, s = ta.selectionStart; const ls = v.lastIndexOf("\n", s - 1) + 1; const line = v.slice(ls, s);
        const m = line.match(/^(\s*(?:[-*]\s\[[ xX]\]\s|[-*\u2022]\s))(.*)$/); if (!m) return; e.preventDefault();
        if (!m[2].trim()) { ta.setRangeText("", ls, s, "end"); return; }
        ta.setRangeText("\n" + m[1].replace(/\[[xX]\]/, "[ ]"), s, ta.selectionEnd, "end"); grow(); });
      let gone = false;
      const commit = () => {
        if (gone) return n.id; const title = tin.value.trim(), text = ta.value.replace(/\s+$/, "");
        const tags = [...new Set(tg.value.split(",").map(x => x.trim().replace(/^#/, "").toLowerCase()).filter(Boolean))].slice(0, 12);
        const tplBody = n.id ? null : tplOf(n.tpl).body(null).trim();
        if (!n.id && !title && (!text.trim() || text.trim() === tplBody)) return null;
        const changed = !n.id || title !== n.title || text !== n.body || tags.join() !== (n.tags || []).join() || sel.value !== n.nb || n.pinned !== n._p0;
        if (!changed) return n.id;
        const isNew = !n.id; if (isNew) n.id = uid("sn_");
        Object.assign(n, { title, body: text, tags, nb: sel.value, updated: Date.now() }); if (!n.created) n.created = n.updated;
        if (saveNote(n) && isNew && n.from) { const m = meta(); m.converted[n.from] = { to: n.id, at: Date.now() }; wr(KM, m); }
        n._p0 = n.pinned; return n.id;
      };
      n._p0 = n.pinned;
      leaveFn = () => commit();
      FX.ui.onClose(() => { if (leaveFn) { leaveFn = null; commit(); } });
      const done = () => { leaveFn = null; FX.ui.onClose(null); return commit(); };
      el.querySelector('[data-a="save"]').onclick = () => { const id = done(); if (id) { toast("Saved"); view(id); } else { toast("Nothing to save yet"); } };
      el.querySelector('[data-a="back"]').onclick = () => { const id = done(); if (id) view(id); else reopen(); };
      const del = el.querySelector('[data-a="del"]');
      if (del) del.onclick = () => { if (!confirm("Delete this note? This can't be undone.")) return; gone = true; leaveFn = null; FX.ui.onClose(null); wr(KT, own().filter(x => x.id !== n.id)); toast("Note deleted"); reopen(); };
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
  function newFromVerse(t) { if (!t) return; ensureDefault(); pickTemplate({ ref: t.ref, text: t.text }); }

  window.BibleyStudyNB = { open, newFromVerse, exportData, importData, KEYS: [KN, KT, KM], _test: { findRefs, render, allItems, plain } };
})();
