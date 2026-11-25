/* bibley-recap.js - Bibley 7.2: Your Year in Bibley (window.BibleyRecap).
   A swipeable story of your reading year, built entirely on this device from what Bibley already stores
   (and what Cloud Sync merges into the same keys). No network calls.
   Reads (existing keys): "bibley_read_v1" (chapters marked read + the day), "bibley_activity_v1" (active days),
   "bible_highlights_v2", "bible_bookmarks_v2", "bibley_notes_v1", "bibley_vbm_v1", "bibley_likes_v1",
   "bibley_memorize_v1", "bibley_nb_v1_notes" (Study Notebook), "bibley_plan_v1", "bibley_wisdom_days_v1",
   and chat counts from the chats IndexedDB (BibleyCore.chatDB, still on this device).
   NEW key "bibley_recap_v1" {v, d: {"YYYY-MM-DD": [[chapterKey, version, verseCount], ...]}}: a light reading log
   written going forward (a chapter counts once you stay on it ~12 s), so the recap can show verses read,
   translations and per-day chapters even for chapters you never tick "Mark chapter read". Starts with "bibley_",
   so Cloud Sync carries it; three calendar years kept. Stats it can't know yet are simply left out.
   Open: Settings > Study, Settings > Study & notes, the More menu, and a Today card from Dec 1 to Jan 15. */
(() => {
  "use strict";
  if (window.BibleyRecap) return;
  const C = window.BibleyCore, FX = window.BibleyFX;
  if (!C || !FX) { console.warn("Bibley recap: reader bridge missing"); return; }
  const { BOOKS } = C;
  const K = {
    LOG: "bibley_recap_v1", READ: "bibley_read_v1", ACT: "bibley_activity_v1", HL: "bible_highlights_v2", BM: "bible_bookmarks_v2",
    NOTES: "bibley_notes_v1", VBM: "bibley_vbm_v1", LIKES: "bibley_likes_v1", MEM: "bibley_memorize_v1", SNB: "bibley_nb_v1_notes",
    PLAN: "bibley_plan_v1", WIS: "bibley_wisdom_days_v1"
  };
  const TOTAL_CH = BOOKS.reduce((n, b) => n + b[2], 0);
  const DWELL = 12000;          // ms on a chapter before it counts as read
  const KEEP_YEARS = 3;
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const dayStr = (d = new Date()) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const addDays = (s, n) => { const [y, m, d] = s.split("-").map(Number); return dayStr(new Date(y, m - 1, d + n)); };
  const tsDay = t => { if (t == null || t === "") return null; const d = new Date(typeof t === "number" ? t : Date.parse(t)); return isNaN(d) ? null : dayStr(d); };
  const isDay = s => typeof s === "string" && /^\d{4}-\d\d-\d\d$/.test(s);
  const fmt = n => Number(n || 0).toLocaleString();
  const plural = (n, one, many) => fmt(n) + " " + (n === 1 ? one : (many || one + "s"));
  const vname = id => { try { return C.versionName(id); } catch { return String(id || "").toUpperCase(); } };
  const bookOfCh = ck => { const i = String(ck).lastIndexOf("-"); if (i < 1) return -1; const nm = ck.slice(0, i); return BOOKS.findIndex(b => b[0] === nm); };
  const bookLabel = b => BOOKS[b][1] === "Psalm" ? "Psalms" : BOOKS[b][1];
  const toast = m => { try { FX.ui.toast(m); } catch {} };
  const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

  /* ================= tracking (new, going forward) ================= */
  const readLog = () => { const l = load(K.LOG, null); return l && typeof l === "object" && l.d && typeof l.d === "object" ? l : { v: 1, d: {} }; };
  function logChapter(b, c, version, count) {
    if (!BOOKS[b] || !c) return;
    const ck = BOOKS[b][0] + "-" + c, day = dayStr(), log = readLog();
    const list = Array.isArray(log.d[day]) ? log.d[day] : [];
    const i = list.findIndex(e => Array.isArray(e) && e[0] === ck && e[1] === (version || ""));
    if (i >= 0) { if (count && !(list[i][2] >= count)) { list[i][2] = count; } else return; }
    else list.push([ck, version || "", count || 0]);
    log.d[day] = list;
    const minY = new Date().getFullYear() - KEEP_YEARS + 1;
    Object.keys(log.d).forEach(k => { if (!isDay(k) || +k.slice(0, 4) < minY) delete log.d[k]; });
    log.v = 1; save(K.LOG, log);
  }
  let pending = null, timer = 0;
  function arm() {
    clearTimeout(timer); if (!pending) return;
    const left = Math.max(0, DWELL - pending.ms);
    timer = setTimeout(() => {
      if (!pending) return;
      if (document.hidden) { return; }   // resumes on visibilitychange
      const p = pending; pending = null;
      const done = n => logChapter(p.bookIdx, p.chapter, p.version, n || 0);
      if (p.count) done(p.count);
      else { try { Promise.resolve(C.chapterVerses(p.version, p.bookIdx, p.chapter)).then(v => done(Array.isArray(v) ? v.length : 0), () => done(0)); } catch { done(0); } }
    }, left);
    pending.since = Date.now();
  }
  function track(k, info) {
    if (k !== "a" || !info || info.bookIdx == null) return;
    if (pending && pending.bookIdx === info.bookIdx && pending.chapter === info.chapter && pending.version === info.version) { if (info.count) pending.count = info.count; return; }
    pending = { bookIdx: info.bookIdx, chapter: info.chapter, version: info.version || (C.panes.a && C.panes.a.version) || "", count: info.count || 0, ms: 0 };
    if (!document.hidden) arm();
  }
  document.addEventListener("visibilitychange", () => {
    if (!pending) return;
    if (document.hidden) { clearTimeout(timer); pending.ms += Date.now() - (pending.since || Date.now()); }
    else arm();
  });
  const origOnChapter = FX.onChapter;
  FX.onChapter = function (k, info) { const r = origOnChapter.apply(this, arguments); try { track(k, info); } catch {} return r; };
  try { const a = C.panes.a; if (a && a.bookIdx != null) track("a", { bookIdx: a.bookIdx, chapter: a.chapter, version: a.version }); } catch {}

  /* ================= the numbers ================= */
  const vid = o => o && o.bookIdx != null && BOOKS[o.bookIdx] ? BOOKS[o.bookIdx][0] + "-" + o.chapter + "-" + (o.verseNum || "") : null;
  const objVals = o => o && typeof o === "object" ? (Array.isArray(o) ? o : Object.keys(o).map(k => Object.assign({ _k: k }, o[k]))) : [];

  function yearsWithData() {
    const ys = new Set();
    const addD = d => { if (isDay(d)) ys.add(+d.slice(0, 4)); };
    Object.keys(readLog().d).forEach(addD);
    Object.values(load(K.READ, {})).forEach(addD);
    (load(K.ACT, []) || []).forEach(addD);
    objVals(load(K.HL, {})).forEach(h => addD(tsDay(h.added)));
    ys.add(new Date().getFullYear());
    return [...ys].filter(y => y > 2000).sort((a, b) => b - a).slice(0, 6);
  }
  function defaultYear() { const d = new Date(); return d.getMonth() === 0 && d.getDate() <= 15 ? d.getFullYear() - 1 : d.getFullYear(); }

  async function chatCount(year) {
    const db = C.chatDB; if (!db || typeof db.listConversations !== "function") return null;
    try {
      const list = await Promise.race([db.listConversations(), new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 1500))]);
      return (list || []).filter(c => { const d = tsDay(c.createdAt || c.updatedAt); return d && +d.slice(0, 4) === year; }).length;
    } catch { return null; }
  }

  async function compute(year) {
    const Y = String(year), inY = d => isDay(d) && d.slice(0, 4) === Y, tsY = t => inY(tsDay(t));
    const days = new Set(), chapters = new Map(), reads = new Set(), versions = {}, monthReads = Array(12).fill(0), monthDays = Array(12).fill(0);
    const addRead = (day, ck, verses) => {
      const cur = chapters.get(ck); if (!cur) chapters.set(ck, { day, verses: verses || 0 }); else if (verses > cur.verses) cur.verses = verses;
      const rk = day + "|" + ck; if (!reads.has(rk)) { reads.add(rk); monthReads[+day.slice(5, 7) - 1]++; }
      days.add(day);
    };
    // new reading log (from 7.2)
    const log = readLog(); let tracked = false;
    Object.keys(log.d).filter(inY).forEach(day => {
      const seen = new Set();
      (log.d[day] || []).forEach(e => {
        if (!Array.isArray(e) || bookOfCh(e[0]) < 0) return; tracked = true;
        addRead(day, e[0], +e[2] || 0);
        const vk = e[0] + "|" + e[1]; if (e[1] && !seen.has(vk)) { seen.add(vk); versions[e[1]] = (versions[e[1]] || 0) + 1; }
      });
    });
    const firstTracked = Object.keys(log.d).filter(inY).sort()[0] || null;
    // chapters marked read (existing)
    const rm = load(K.READ, {}); Object.keys(rm).forEach(ck => { if (inY(rm[ck]) && bookOfCh(ck) >= 0) addRead(rm[ck], ck, 0); });
    // active days + plan days + Daily Wisdom days (existing)
    (load(K.ACT, []) || []).forEach(d => { if (inY(d)) days.add(d); });
    (load(K.WIS, []) || []).forEach(d => { if (inY(d)) days.add(d); });
    const plan = load(K.PLAN, null); let planDays = 0;
    if (plan && plan.done) Object.values(plan.done).forEach(d => { if (inY(d)) { planDays++; days.add(d); } });
    // study items
    const hl = objVals(load(K.HL, {})).filter(h => tsY(h.added));
    const notesL = objVals(load(K.NOTES, {})).filter(n => tsY(n.added || n.updated));
    const snb = (Array.isArray(load(K.SNB, [])) ? load(K.SNB, []) : []).filter(n => n && tsY(n.created || n.updated));
    const vbm = objVals(load(K.VBM, {})).filter(v => tsY(v.added));
    const bm = (Array.isArray(load(K.BM, [])) ? load(K.BM, []) : []).filter(b => tsY(b.added));
    const likes = objVals(load(K.LIKES, {})).filter(v => tsY(v.added));
    const memAll = load(K.MEM, {}); const mem = objVals(memAll && memAll.verses).filter(v => tsY(v.added));
    [hl.map(x => x.added), notesL.map(x => x.added || x.updated), snb.map(x => x.created || x.updated), vbm.map(x => x.added), bm.map(x => x.added), likes.map(x => x.added), mem.map(x => x.added)]
      .forEach(arr => arr.forEach(t => { const d = tsDay(t); if (inY(d)) days.add(d); }));
    // streak (within the year)
    const sorted = [...days].sort(); let longest = 0, run = 0, prev = null, bestEnd = null;
    sorted.forEach(d => { run = prev && addDays(prev, 1) === d ? run + 1 : 1; if (run > longest) { longest = run; bestEnd = d; } prev = d; });
    sorted.forEach(d => monthDays[+d.slice(5, 7) - 1]++);
    // books
    const perBook = {}; chapters.forEach((_, ck) => { const b = bookOfCh(ck); perBook[b] = (perBook[b] || 0) + 1; });
    const books = Object.keys(perBook).map(b => ({ b: +b, n: perBook[b], name: bookLabel(+b), pct: Math.round(perBook[b] / BOOKS[+b][2] * 100) }))
      .sort((x, y) => y.n - x.n || y.pct - x.pct).slice(0, 3);
    const booksFinished = Object.keys(perBook).filter(b => perBook[b] >= BOOKS[+b][2]).length;
    let verses = 0; chapters.forEach(c => { verses += c.verses || 0; });
    // translation: reading log first, then the versions on verses you saved this year
    let topVer = null, verSrc = "read";
    const vk = Object.keys(versions).sort((a, b) => versions[b] - versions[a]);
    if (vk.length) topVer = vk[0];
    else { const vc = {}; notesL.concat(vbm, likes, mem).forEach(x => { if (x.version) vc[x.version] = (vc[x.version] || 0) + 1; }); const k2 = Object.keys(vc).sort((a, b) => vc[b] - vc[a]); if (k2.length) { topVer = k2[0]; verSrc = "saved"; } }
    // busiest month: most chapters read, else most active days
    const byReads = monthReads.some(Boolean), mArr = byReads ? monthReads : monthDays;
    const busiest = mArr.some(Boolean) ? mArr.indexOf(Math.max(...mArr)) : -1;
    // favourite highlighted verse: the highlight you also noted, bookmarked, liked or memorized; ties go to the oldest
    const score = {}; const bump = (o, n) => { const id = o && (vid(o) || o._k); if (id) score[id] = (score[id] || 0) + n; };
    objVals(load(K.NOTES, {})).forEach(n => bump(n, 2)); objVals(load(K.VBM, {})).forEach(v => bump(v, 1));
    objVals(load(K.LIKES, {})).forEach(v => bump(v, 1)); objVals(memAll && memAll.verses).forEach(v => bump(v, 2));
    let fav = null;
    hl.filter(h => h.text).forEach(h => { const s = 1 + (score[vid(h) || h._k] || 0); if (!fav || s > fav.s || (s === fav.s && (h.added || 0) < (fav.h.added || 0))) fav = { s, h }; });
    const colors = {}; hl.forEach(h => { if (h.color) colors[h.color] = (colors[h.color] || 0) + 1; });
    const topColor = Object.keys(colors).sort((a, b) => colors[b] - colors[a])[0] || null;
    const chats = await chatCount(year);
    let planName = null; try { const p = FX.plan && FX.plan(); if (p && planDays) planName = p.name; } catch {}
    return {
      year, days: days.size, longest, bestEnd, chapters: chapters.size, reads: reads.size, pctBible: chapters.size ? Math.max(1, Math.round(chapters.size / TOTAL_CH * 1000) / 10) : 0,
      verses, tracked, firstTracked, books, booksFinished, topVer, verSrc, monthReads, monthDays, byReads, busiest,
      highlights: hl.length, notes: notesL.length + snb.length, bookmarks: bm.length + vbm.length, likes: likes.length, memory: mem.length, chats,
      topColor, fav: fav ? { text: fav.h.text, ref: fav.h.ref || (BOOKS[fav.h.bookIdx] ? bookLabel(fav.h.bookIdx) + " " + fav.h.chapter + ":" + fav.h.verseNum : ""), color: fav.h.color } : null,
      planDays, planName,
      empty: !days.size && !chapters.size && !hl.length && !notesL.length && !snb.length && !vbm.length && !bm.length
    };
  }

  /* ================= cards ================= */
  const IC = (p, w) => '<svg viewBox="0 0 24 24" width="' + (w || 22) + '" height="' + (w || 22) + '" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + p + "</svg>";
  const I = {
    close: IC('<path d="M6 6l12 12M18 6L6 18"/>'), share: IC('<path d="M12 15V3.5M7.5 8L12 3.5 16.5 8"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5"/>'),
    book: IC('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 18.5V5.5"/>', 18), flame: IC('<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.6 3-5.6 3.6-9.3 2.4 1.3 3.4 3.6 3.4 5.4 1-.7 1.7-2 1.8-3.3 2 1.6 4.2 4.1 4.2 7.2 0 3.6-2.6 6.2-6.5 6.2z"/>', 18),
    star: IC('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>', 18), down: IC('<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>', 18),
    spark: IC('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>', 18)
  };
  const COLOR_NAMES = { yellow: "Yellow", green: "Green", blue: "Blue", pink: "Pink", purple: "Purple" };
  const COLOR_HEX = { yellow: "#e8c766", green: "#7fbf8e", blue: "#79a7d9", pink: "#e597b2", purple: "#b394dc" };

  function cardsFor(s) {
    const out = [];
    const yr = s.year;
    out.push({ k: "intro", html: `<div class="br-eb">Bibley · ${yr}</div><div class="br-big br-year">${yr}</div><h2 class="br-h">Your Year in Bibley</h2><p class="br-p">${s.empty ? "Your story this year is just getting started." : "A look back at the time you spent in the Word."}</p><div class="br-hint">Tap to continue</div>` });
    if (s.empty) {
      out.push({ k: "empty", html: `<div class="br-eb">Getting started</div><h2 class="br-h">Every chapter counts</h2><p class="br-p">Read a chapter, tap <b>Mark chapter read</b>, highlight a verse or start a reading plan, and your ${yr} recap fills in here.</p>` });
      out.push(closing(s)); return out;
    }
    if (s.chapters) {
      const vline = s.verses ? `<div class="br-sub"><b>${fmt(s.verses)}</b> verses${s.firstTracked && s.firstTracked.slice(5) !== "01-01" ? " read since Bibley started counting them" : ""}</div>` : "";
      out.push({ k: "chapters", html: `<div class="br-eb">${I.book}Chapters</div><div class="br-big" data-count="${s.chapters}">${fmt(s.chapters)}</div><h2 class="br-h">${s.chapters === 1 ? "chapter" : "different chapters"} read</h2>${vline}<div class="br-meter"><i style="width:${Math.min(100, s.pctBible)}%"></i></div><p class="br-p">That's <b>${s.pctBible}%</b> of the whole Bible${s.booksFinished ? ` and <b>${plural(s.booksFinished, "book")}</b> read cover to cover` : ""}.</p>` });
    }
    if (s.days) {
      out.push({ k: "days", html: `<div class="br-eb">${I.flame}Time in the Word</div><div class="br-big" data-count="${s.days}">${fmt(s.days)}</div><h2 class="br-h">${s.days === 1 ? "day" : "days"} with Bibley</h2>${s.longest > 1 ? `<div class="br-pill">${I.flame}<span>Longest streak: <b>${plural(s.longest, "day")}</b> in a row</span></div>` : ""}<p class="br-p">${s.days >= 200 ? "Faithful, day after day." : s.days >= 50 ? "A habit taking root." : "Every day you showed up mattered."}</p>` });
    }
    if (s.books.length) {
      const max = s.books[0].n;
      out.push({ k: "books", html: `<div class="br-eb">${I.star}Most-read books</div><h2 class="br-h">${esc(s.books[0].name)} led your year</h2><ol class="br-books">${s.books.map((b, i) => `<li><span class="br-rank">${i + 1}</span><span class="br-bn">${esc(b.name)}<small>${plural(b.n, "chapter")} · ${b.pct}% of the book</small></span><span class="br-bar"><i style="width:${Math.max(6, Math.round(b.n / max * 100))}%"></i></span></li>`).join("")}</ol>` });
    }
    if (s.topVer) {
      out.push({ k: "version", html: `<div class="br-eb">${I.book}Your translation</div><div class="br-big br-mid">${esc(vname(s.topVer))}</div><h2 class="br-h">${s.verSrc === "read" ? "was the translation you read most" : "was on the verses you saved most"}</h2>` });
    }
    if (s.busiest >= 0) {
      const arr = s.byReads ? s.monthReads : s.monthDays, max = Math.max(...arr) || 1;
      out.push({ k: "month", html: `<div class="br-eb">${I.spark}Busiest month</div><div class="br-big br-mid">${MONTHS[s.busiest]}</div><h2 class="br-h">${s.byReads ? plural(arr[s.busiest], "chapter") + " read" : plural(arr[s.busiest], "day") + " in the Word"}</h2><div class="br-months" role="img" aria-label="Month by month">${arr.map((n, i) => `<span class="${i === s.busiest ? "on" : ""}"><i style="height:${Math.max(4, Math.round(n / max * 100))}%"></i><b>${MONTHS[i][0]}</b></span>`).join("")}</div>` });
    }
    const study = [[s.highlights, "highlight"], [s.notes, "note"], [s.bookmarks, "bookmark"], [s.memory, "memory verse"], [s.likes, "liked verse"], [s.chats, "AI chat"]].filter(x => x[0]);
    if (study.length) {
      out.push({ k: "study", html: `<div class="br-eb">${I.star}Your study</div><h2 class="br-h">What you kept from ${s.year}</h2><div class="br-grid">${study.map(([n, l]) => `<div class="br-tile"><b>${fmt(n)}</b><span>${esc(n === 1 ? l : l + "s")}</span></div>`).join("")}</div>${s.topColor ? `<p class="br-p"><span class="br-dot" style="background:${COLOR_HEX[s.topColor] || "#c9a867"}"></span>Favourite highlight colour: <b>${esc(COLOR_NAMES[s.topColor] || s.topColor)}</b></p>` : ""}` });
    }
    if (s.fav) {
      out.push({ k: "fav", html: `<div class="br-eb">${I.star}A verse you held onto</div><blockquote class="br-quote" style="--hl:${COLOR_HEX[s.fav.color] || "#c9a867"}">\u201c${esc(String(s.fav.text).trim().slice(0, 320))}${String(s.fav.text).length > 320 ? "\u2026" : ""}\u201d</blockquote><div class="br-ref">${esc(s.fav.ref)}</div>` });
    }
    if (s.planDays) {
      out.push({ k: "plan", html: `<div class="br-eb">${I.flame}Reading plans</div><div class="br-big" data-count="${s.planDays}">${fmt(s.planDays)}</div><h2 class="br-h">plan ${s.planDays === 1 ? "day" : "days"} completed</h2>${s.planName ? `<p class="br-p">${esc(s.planName)}</p>` : ""}` });
    }
    out.push(closing(s));
    return out;
  }
  function closing(s) {
    const bits = [s.chapters ? plural(s.chapters, "chapter") : "", s.days ? plural(s.days, "day") : "", s.highlights ? plural(s.highlights, "highlight") : ""].filter(Boolean);
    return { k: "close", html: `<div class="br-eb">${s.year} · Thank you</div><h2 class="br-h br-h-lg">${s.empty ? "Here's to the year ahead" : "What a year"}</h2>${bits.length ? `<p class="br-p br-sum">${bits.map(esc).join(" · ")}</p>` : ""}<blockquote class="br-quote br-q-sm">\u201cThy word is a lamp unto my feet, and a light unto my path.\u201d</blockquote><div class="br-ref">Psalm 119:105 · KJV</div><div class="br-actions"><button type="button" class="fx-btn primary" data-br="share">${I.share}<span>Share my year</span></button><button type="button" class="fx-btn" data-br="save">${I.down}<span>Save image</span></button></div><button type="button" class="br-again" data-br="again">Watch again</button>` };
  }

  /* ================= share image (canvas, on device) ================= */
  function themeKey() { const r = document.documentElement; return r.classList.contains("theme-light") || r.classList.contains("theme-sepia") ? "paper" : "night"; }
  const PAL = { night: { bg: ["#1b2440", "#0b1020"], ink: "#efe7d4", dim: "#efe7d4aa", gold: "#d8b673", tile: "#ffffff12" }, paper: { bg: ["#f7efdc", "#e6d6b2"], ink: "#3b2f22", dim: "#3b2f22b0", gold: "#8a6420", tile: "#8a64201a" } };
  async function drawShare(s) {
    const W = 1080, H = 1920, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d"), P = PAL[themeKey()];
    try { if (document.fonts) await Promise.race([Promise.all([document.fonts.load("600 80px Fraunces"), document.fonts.load("400 40px 'Source Serif 4'")]), new Promise(r => setTimeout(r, 1200))]); } catch {}
    const g = x.createLinearGradient(0, 0, W * .4, H); g.addColorStop(0, P.bg[0]); g.addColorStop(1, P.bg[1]); x.fillStyle = g; x.fillRect(0, 0, W, H);
    const rg = x.createRadialGradient(W * .8, H * .12, 10, W * .8, H * .12, 700); rg.addColorStop(0, P.gold + "55"); rg.addColorStop(1, P.gold + "00"); x.fillStyle = rg; x.fillRect(0, 0, W, H);
    x.textAlign = "center"; x.fillStyle = P.gold; x.font = "600 40px Fraunces, Georgia, serif"; x.fillText("BIBLEY", W / 2, 170);
    x.font = "600 230px Fraunces, Georgia, serif"; x.fillText(String(s.year), W / 2, 430);
    x.fillStyle = P.ink; x.font = "500 72px Fraunces, Georgia, serif"; x.fillText("My Year in Bibley", W / 2, 540);
    const tiles = [[s.chapters, "chapters read"], [s.days, "days in the Word"], [s.longest, "day best streak"], [s.highlights, "highlights"], [s.notes, "notes"], [s.verses, "verses read"]].filter(t => t[0]).slice(0, 4);
    const tw = 440, th = 230, gx = 40, top = 640;
    tiles.forEach((t, i) => {
      const cx = W / 2 + (i % 2 ? gx / 2 : -tw - gx / 2), cy = top + Math.floor(i / 2) * (th + 40);
      x.fillStyle = P.tile; roundRect(x, cx, cy, tw, th, 36); x.fill();
      x.fillStyle = P.gold; x.font = "600 104px Fraunces, Georgia, serif"; x.fillText(fmt(t[0]), cx + tw / 2, cy + 128);
      x.fillStyle = P.dim; x.font = "400 38px 'Source Serif 4', Georgia, serif"; x.fillText(t[1], cx + tw / 2, cy + 190);
    });
    let y = top + Math.ceil(tiles.length / 2) * (th + 40) + 70;
    x.fillStyle = P.ink; x.font = "400 44px 'Source Serif 4', Georgia, serif";
    if (s.books.length) { x.fillText("Most read: " + s.books.map(b => b.name).join(" \u00b7 "), W / 2, y); y += 70; }
    if (s.topVer) { x.fillText("Translation: " + vname(s.topVer), W / 2, y); y += 70; }
    if (s.fav) {
      y += 40; x.fillStyle = P.ink; x.font = "italic 400 46px 'Source Serif 4', Georgia, serif";
      const lines = wrap(x, "\u201c" + String(s.fav.text).trim() + "\u201d", W - 200).slice(0, 5);
      lines.forEach(l => { x.fillText(l, W / 2, y); y += 64; });
      x.fillStyle = P.gold; x.font = "600 40px Fraunces, Georgia, serif"; x.fillText(s.fav.ref, W / 2, y + 10);
    }
    x.fillStyle = P.dim; x.font = "400 34px 'Source Serif 4', Georgia, serif"; x.fillText("Read, study and pray \u00b7 Bibley", W / 2, H - 110);
    return new Promise(r => cv.toBlob(b => r(b), "image/png"));
  }
  function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  function wrap(x, text, maxW) { const ws = text.split(/\s+/), out = []; let line = ""; ws.forEach(w => { const t = line ? line + " " + w : w; if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }); if (line) out.push(line); return out; }
  async function shareImage(s, mode) {
    const blob = await drawShare(s); if (!blob) { toast("Couldn't make the image"); return; }
    const name = "bibley-" + s.year + "-recap.png";
    if (mode === "share") {
      try {
        const file = new File([blob], name, { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "My " + s.year + " in Bibley" }); return; }
      } catch (e) { if (e && e.name === "AbortError") return; }
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); toast("Image saved");
  }

  /* ================= the story ================= */
  let root = null, idx = 0, cards = [], stats = null, auto = 0, paused = false, pushed = false, curYear = defaultYear();
  const AUTO_MS = 7000;
  function build() {
    root = document.createElement("div"); root.className = "br-ov"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Your Year in Bibley");
    root.innerHTML = `<div class="br-stage"><div class="br-top"><div class="br-prog"></div><div class="br-bar-row"><div class="br-years"></div><button type="button" class="br-x" data-br="close" aria-label="Close">${I.close}</button></div></div><div class="br-card" aria-live="polite"></div><button type="button" class="br-nav br-prev" aria-label="Previous"></button><button type="button" class="br-nav br-next" aria-label="Next"></button></div>`;
    document.body.appendChild(root);
    root.querySelector(".br-prev").onclick = () => go(idx - 1);
    root.querySelector(".br-next").onclick = () => go(idx + 1);
    root.addEventListener("click", e => {
      const b = e.target.closest("[data-br]"); if (!b) return;
      const a = b.dataset.br;
      if (a === "close") close();
      if (a === "share" || a === "save") { stopAuto(); shareImage(stats, a); }
      if (a === "again") go(0);
      if (a === "year") { const y = +b.dataset.y; if (y !== curYear) load2(y); }
    });
    // hold to pause, swipe to move
    let sx = 0, sy = 0, st = 0;
    const stage = root.querySelector(".br-stage");
    stage.addEventListener("pointerdown", e => { sx = e.clientX; sy = e.clientY; st = Date.now(); paused = true; root.classList.add("br-paused"); });
    const up = e => { paused = false; root.classList.remove("br-paused"); const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Date.now() - st < 700 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { e.preventDefault(); suppress = true; setTimeout(() => suppress = false, 50); go(idx + (dx < 0 ? 1 : -1)); }
      else if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.5 && Date.now() - st < 700) close(); };
    let suppress = false;
    stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", () => { paused = false; root.classList.remove("br-paused"); });
    stage.addEventListener("click", e => { if (suppress) { e.stopPropagation(); e.preventDefault(); } }, true);
    document.addEventListener("keydown", e => { if (!root || !root.classList.contains("open")) return; if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); go(idx + 1); } if (e.key === "ArrowLeft") go(idx - 1); if (e.key === "Escape") close(); });
    window.addEventListener("popstate", () => { if (root && root.classList.contains("open") && !(history.state && history.state.brRecap)) { pushed = false; close(true); } });
  }
  function stopAuto() { clearTimeout(auto); auto = 0; if (root) root.classList.add("br-manual"); }
  function startAuto() {
    clearTimeout(auto); if (reduced() || idx >= cards.length - 1 || (root && root.classList.contains("br-manual"))) return;
    const t0 = Date.now(); let held = 0, hs = 0;
    const tick = () => { if (!root || !root.classList.contains("open")) return;
      if (paused) { if (!hs) hs = Date.now(); auto = setTimeout(tick, 120); return; }
      if (hs) { held += Date.now() - hs; hs = 0; }
      if (Date.now() - t0 - held >= AUTO_MS) go(idx + 1, true); else auto = setTimeout(tick, 120); };
    auto = setTimeout(tick, 120);
  }
  function render() {
    const prog = root.querySelector(".br-prog");
    prog.innerHTML = cards.map((_, i) => `<span class="${i < idx ? "done" : i === idx ? "on" : ""}"><i></i></span>`).join("");
    prog.style.setProperty("--br-ms", AUTO_MS + "ms");
    const el = root.querySelector(".br-card"), c = cards[idx];
    el.className = "br-card br-c-" + c.k; el.innerHTML = c.html;
    el.classList.remove("br-in"); void el.offsetWidth; el.classList.add("br-in");
    root.dataset.card = c.k;
    root.querySelector(".br-prev").hidden = idx === 0; root.querySelector(".br-next").hidden = idx >= cards.length - 1;
    if (!reduced()) el.querySelectorAll("[data-count]").forEach(n => countUp(n, +n.dataset.count));
  }
  function countUp(n, to) { if (!(to > 1)) return; const t0 = performance.now(), D = 900; const f = t => { const p = Math.min(1, (t - t0) / D); n.textContent = fmt(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1 && n.isConnected) requestAnimationFrame(f); }; requestAnimationFrame(f); }
  function go(i, fromAuto) {
    if (!cards.length) return; if (i < 0) i = 0; if (i > cards.length - 1) i = cards.length - 1;
    if (!fromAuto) stopAuto();
    idx = i; render(); if (fromAuto) startAuto();
  }
  function yearsRow() {
    const ys = yearsWithData(); if (ys.indexOf(curYear) < 0) ys.push(curYear); ys.sort((a, b) => b - a);
    root.querySelector(".br-years").innerHTML = ys.length > 1 ? ys.map(y => `<button type="button" class="br-yr${y === curYear ? " on" : ""}" data-br="year" data-y="${y}">${y}</button>`).join("") : "";
  }
  async function load2(year) {
    curYear = year; root.classList.remove("br-manual"); root.querySelector(".br-card").innerHTML = '<div class="br-loading">Gathering your year\u2026</div>'; yearsRow();
    try { stats = await compute(year); } catch (e) { console.warn("Bibley recap", e); stats = { year, empty: true, books: [] }; }
    if (curYear !== year) return;
    cards = cardsFor(stats); idx = 0; render(); startAuto();
  }
  function open(year) {
    if (!root) build();
    try { FX.clearSelection(); } catch {}
    root.classList.add("open"); document.documentElement.classList.add("br-noscroll");
    if (!pushed) { try { history.pushState({ brRecap: 1 }, ""); pushed = true; } catch {} }
    load2(year || defaultYear());
    setTimeout(() => { const x = root.querySelector(".br-x"); if (x) try { x.focus({ preventScroll: true }); } catch {} }, 50);
  }
  function close(fromPop) {
    if (!root || !root.classList.contains("open")) return;
    clearTimeout(auto); root.classList.remove("open"); document.documentElement.classList.remove("br-noscroll");
    if (pushed && !fromPop) { pushed = false; try { history.back(); } catch {} }
  }
  // From inside a sheet or Settings: let them close (and pop their history entry) first.
  function openFromSheet(year) { let wait = 0; try { if (document.querySelector(".fx-sheet.open, .fx-sheet.show")) { FX.ui.closeSheet(); wait = 120; } } catch {} setTimeout(() => open(year), wait); }

  /* ================= Today card (Dec 1 - Jan 15) ================= */
  function season(d = new Date()) { return d.getMonth() === 11 || (d.getMonth() === 0 && d.getDate() <= 15); }
  function hasAny(year) {
    const Y = String(year), inY = d => isDay(d) && d.slice(0, 4) === Y;
    return Object.keys(readLog().d).some(inY) || Object.values(load(K.READ, {})).some(inY) || (load(K.ACT, []) || []).some(inY);
  }
  function renderToday(slot) {
    if (!slot) return;
    const y = defaultYear();
    if (!(season() || /[?&]recap=1/.test(location.search)) || !hasAny(y)) { slot.hidden = true; slot.innerHTML = ""; return; }
    slot.hidden = false;
    slot.innerHTML = `<button type="button" class="br-today" data-a="recap"><span class="br-today-ic">${I.spark}</span><span class="br-today-t"><small>Your year, wrapped</small><b>Your ${y} in Bibley</b></span><span class="br-today-go">\u2192</span></button>`;
    slot.querySelector("button").onclick = () => openFromSheet(y);
  }
  // Today is drawn by bibley-features.js; add the card to it whenever it opens.
  function watchToday() {
    const fill = () => { const sh = document.querySelector('.fx-sheet[data-view="today"] .fx-sheet-body'); if (!sh || sh.querySelector(".br-today-slot")) return;
      if (!sh.children.length) return; const slot = document.createElement("div"); slot.className = "br-today-slot"; const after = sh.querySelector(".fx-votd"); if (after && after.nextSibling) sh.insertBefore(slot, after.nextSibling); else sh.appendChild(slot); renderToday(slot); };
    const mo = new MutationObserver(() => fill());
    const hook = () => { const sh = document.querySelector(".fx-sheet"); if (!sh) return false; mo.observe(sh, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-view"] }); fill(); return true; };
    if (!hook()) { const t = setInterval(() => { if (hook()) clearInterval(t); }, 500); setTimeout(() => clearInterval(t), 30000); }
  }
  watchToday();

  window.BibleyRecap = { open, openFromSheet, close, compute, renderToday, defaultYear, key: K.LOG, icon: I.spark,
    _test: { logChapter, readLog, cardsFor, drawShare, yearsWithData, season } };
})();
