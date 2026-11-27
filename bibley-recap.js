/* bibley-recap.js - Bibley 7.4 recaps, built into the reader (window.BibleyRecap).
   One Recap sheet with Day | Week | Month tabs, opened from More (three-dot menu) > Recap, from the
   streak card on Today and in Reading plans, and from Settings > Study & notes > Recap.
   - Day: chapters read, time in Bibley, the streak, reading-plan progress, notes, highlights,
     saved and liked verses, memory verses; browse back day by day.
   - Week: chapters, active days, time, best streak, a day-by-day strip (tap a day to open it),
     most-read books, books finished, study counts and last week for comparison.
   - Month: the same for a month, with a calendar of the days you were in the Word.
   Each can be copied or shared as plain text. Swipe left / right (or the arrow keys) moves between
   days, weeks and months.
   Honest by design: recaps only count what Bibley recorded (chapters marked read, the activity
   days behind the streak, plan days, and the time stamps on notes, highlights, saved, liked and
   memory verses). Days with no records stay empty; nothing is estimated or back-filled.
   New in 7.4, recorded from now on (nothing before it exists, so nothing is shown for it):
     time in Bibley - counted while Bibley is on screen and being used (a tap, scroll or key in the
       last 2 minutes, or read-aloud playing); saved every 2 minutes and when the app is hidden.
     chapters opened - a chapter you stayed with for 30 seconds of that time.
   Stored: localStorage "bibley_daylog_v1" {v:1, d:{"YYYY-MM-DD":{<device id>:{s:seconds, o:[chapter
   keys]}}}} (synced and in backups; one record per device per day, so two phones never overwrite
   each other, the recap adds them up), "bibley_recap_v1" {ws:"auto"|"0"|"1"} (week start; synced)
   and "bibley_recap_device_v1" (this device's id; never synced). ASCII only in this file. */
(() => {
  "use strict";
  if (window.BibleyRecap) return;
  const C = window.BibleyCore;
  if (!C) { console.warn("Bibley recap: reader bridge missing"); return; }
  const { BOOKS } = C;
  const K = {
    READ: "bibley_read_v1", ACT: "bibley_activity_v1", PLAN: "bibley_plan_v1", NOTES: "bibley_notes_v1", HL: "bible_highlights_v2",
    VBM: "bibley_vbm_v1", LIKES: "bibley_likes_v1", MEM: "bibley_memorize_v1", SNB: "bibley_nb_v1_notes", NB: "bibley_notebook_v1",
    LOG: "bibley_daylog_v1", PREF: "bibley_recap_v1", DEV: "bibley_recap_device_v1"
  };
  const PLAN_NAMES = { gospels30: "Gospels in 30 days", pp31: "Psalms & Proverbs in 31 days", nt90: "New Testament in 90 days", year365: "Bible in a year" };
  const FX = () => window.BibleyFX || null;
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const dayStr = (d = new Date()) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const toDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const t = toDate(s); t.setDate(t.getDate() + n); return dayStr(t); };
  const isDay = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const tsDay = t => { const n = typeof t === "number" ? t : Date.parse(t); return isFinite(n) && n > 0 ? dayStr(new Date(n)) : null; };
  const monthOf = s => s.slice(0, 7);
  const monthStart = m => m + "-01";
  const monthEnd = m => { const [y, mo] = m.split("-").map(Number); return m + "-" + pad(new Date(y, mo, 0).getDate()); };
  const shiftMonth = (m, n) => { const [y, mo] = m.split("-").map(Number); const d = new Date(y, mo - 1 + n, 1); return d.getFullYear() + "-" + pad(d.getMonth() + 1); };
  const chKey = (b, c) => BOOKS[b][0] + "-" + c;
  const bookName = b => BOOKS[b][1] === "Psalm" ? "Psalms" : BOOKS[b][1];
  const refOf = (b, c) => BOOKS[b][1] + " " + c;
  function parseCh(k) { const i = String(k).lastIndexOf("-"); if (i < 1) return null; const code = k.slice(0, i), c = +k.slice(i + 1); const b = BOOKS.findIndex(x => x[0] === code); return b >= 0 && c >= 1 && c <= BOOKS[b][2] ? [b, c] : null; }
  const toast = (m, ms) => { const f = FX(); if (f && f.ui && f.ui.toast) f.ui.toast(m, ms); };
  const sv = d => '<svg class="ui-ic" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>";
  const IC = {
    recap: sv('<path d="M4 20h16"/><rect x="5.5" y="11" width="3" height="6" rx="1"/><rect x="10.5" y="6.5" width="3" height="10.5" rx="1"/><rect x="15.5" y="13" width="3" height="4" rx="1"/>'),
    prev: sv('<path d="M14.5 6l-6 6 6 6"/>'), next: sv('<path d="M9.5 6l6 6-6 6"/>'),
    copy: sv('<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>'),
    share: sv('<path d="M12 15V4M8 7.5L12 3.5l4 4"/><path d="M6 11.5H5a1 1 0 0 0-1 1V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6.5a1 1 0 0 0-1-1h-1"/>'),
    flame: sv('<path d="M12 21c-3.6 0-6.5-2.6-6.5-6.2 0-3.4 2.6-5.3 3.8-8.3.4 2 1.6 3.3 2.9 3.8-.2-2.8 1-5.4 3.1-6.8-.1 3.5 3.2 5.9 3.2 10.6C18.5 18.1 15.6 21 12 21z"/>'),
    book: sv('<path d="M12 6.5c-1.8-1.3-4.2-2-7.5-2v13c3.3 0 5.7.7 7.5 2 1.8-1.3 4.2-2 7.5-2v-13c-3.3 0-5.7.7-7.5 2z"/><path d="M12 6.5v13"/>'),
    note: sv('<path d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M14.5 3.5V7.5h4M9 12h6M9 15.5h6"/>'),
    hl: sv('<path d="M14.5 4.5l5 5-8.5 8.5H6v-5z"/><path d="M4 20.5h8"/>'),
    mark: sv('<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/>'),
    heart: sv('<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/>'),
    brain: sv('<path d="M12 5.5v13M12 5.5a3 3 0 0 0-5.6 1.3A3 3 0 0 0 5 12a3 3 0 0 0 1.6 4.9A3 3 0 0 0 12 18.5M12 5.5a3 3 0 0 1 5.6 1.3A3 3 0 0 1 19 12a3 3 0 0 1-1.6 4.9A3 3 0 0 1 12 18.5"/>'),
    plan: sv('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4M8.5 14l2 2 4-4"/>'),
    clock: sv('<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>'),
    check: sv('<path d="M5 12.5l4.5 4.5L19 7.5"/>')
  };

  /* =====================================================================
     Words (English, plus Spanish when the page language is Spanish)
     ===================================================================== */
  const ES = {
    "Recap": "Resumen", "Day": "D\u00eda", "Week": "Semana", "Month": "Mes", "Today": "Hoy", "Yesterday": "Ayer", "This week": "Esta semana", "Last week": "La semana pasada",
    "so far": "hasta ahora", "Previous": "Anterior", "Next": "Siguiente", "Chapters read": "Cap\u00edtulos le\u00eddos", "Time in Bibley": "Tiempo en Bibley", "Study marks": "Marcas de estudio",
    "Active days": "D\u00edas activos", "Best streak": "Mejor racha", "Read": "Le\u00eddo", "Also spent time in": "Tambi\u00e9n pasaste tiempo en", "Reading plan": "Plan de lectura",
    "Notes": "Notas", "Highlights": "Resaltados", "Saved verses": "Vers\u00edculos guardados", "Liked verses": "Vers\u00edculos que te gustaron", "Memory verses": "Vers\u00edculos para memorizar",
    "Most read": "Lo m\u00e1s le\u00eddo", "Finished": "Terminaste", "Copy": "Copiar", "Share": "Compartir", "Recap copied": "Resumen copiado", "Couldn't copy": "No se pudo copiar",
    "Day by day": "D\u00eda a d\u00eda", "Your month": "Tu mes", "Study": "Estudio", "Continue reading": "Seguir leyendo",
    "Nothing recorded for today yet": "Todav\u00eda no hay nada registrado hoy", "Nothing recorded for this day": "No hay nada registrado este d\u00eda",
    "Nothing recorded this week": "No hay nada registrado esta semana", "Nothing recorded this month": "No hay nada registrado este mes",
    "Mark a chapter read, highlight a verse or write a note and it shows up here.": "Marca un cap\u00edtulo como le\u00eddo, resalta un vers\u00edculo o escribe una nota y aparecer\u00e1 aqu\u00ed.",
    "Recaps count what Bibley recorded on your devices: chapters marked read, your streak days, plan days and when notes, highlights and verses were saved. Time in Bibley is recorded from version 7.4 on.": "Los res\u00famenes cuentan lo que Bibley registr\u00f3 en tus dispositivos: cap\u00edtulos marcados como le\u00eddos, d\u00edas de racha, d\u00edas del plan y cu\u00e1ndo guardaste notas, resaltados y vers\u00edculos. El tiempo en Bibley se registra desde la versi\u00f3n 7.4.",
    "{n} chapter": "{n} cap\u00edtulo", "{n} chapters": "{n} cap\u00edtulos", "{n} day": "{n} d\u00eda", "{n} days": "{n} d\u00edas",
    "{n} note": "{n} nota", "{n} notes": "{n} notas", "{n} highlight": "{n} resaltado", "{n} highlights": "{n} resaltados",
    "{n} saved verse": "{n} vers\u00edculo guardado", "{n} saved verses": "{n} vers\u00edculos guardados", "{n} liked verse": "{n} vers\u00edculo que te gust\u00f3", "{n} liked verses": "{n} vers\u00edculos que te gustaron",
    "{n} memory verse added": "{n} vers\u00edculo para memorizar a\u00f1adido", "{n} memory verses added": "{n} vers\u00edculos para memorizar a\u00f1adidos",
    "{n} plan day completed": "{n} d\u00eda del plan completado", "{n} plan days completed": "{n} d\u00edas del plan completados",
    "{n} chapter opened": "{n} cap\u00edtulo abierto", "{n} chapters opened": "{n} cap\u00edtulos abiertos",
    "{a} of {b}": "{a} de {b}", "{n}-day streak": "Racha de {n} d\u00edas", "You read today": "Hoy le\u00edste", "Read today to keep it going": "Lee hoy para mantenerla",
    "Day {n} completed": "D\u00eda {n} completado", "Day {a} of {b}": "D\u00eda {a} de {b}", "Last week: {s}": "La semana pasada: {s}", "Last month: {s}": "El mes pasado: {s}",
    "Week of {s}": "Semana del {s}", "This week so far": "Esta semana hasta ahora", "Your recap": "Tu resumen", "See your recap": "Ver tu resumen",
    "This week": "Esta semana", "No streak yet": "A\u00fan sin racha", "Mark a chapter read to start one": "Marca un cap\u00edtulo como le\u00eddo para empezar una", "active": "activo", "Bibley recap": "Resumen de Bibley",
    "Practised today": "Practicado hoy", "Notebook": "Cuaderno", "Note": "Nota", "{n} min": "{n} min", "{h} h {m} min": "{h} h {m} min", "{h} h": "{h} h", "less than a minute": "menos de un minuto",
    "Open {s}": "Abrir {s}", "Tap a day to see it.": "Toca un d\u00eda para verlo.", "Previous day": "D\u00eda anterior", "Next day": "D\u00eda siguiente",
    "Previous week": "Semana anterior", "Next week": "Semana siguiente", "Previous month": "Mes anterior", "Next month": "Mes siguiente", "Recap periods": "Periodos del resumen"
  };
  const isEs = () => /^es\b/i.test(document.documentElement.lang || "");
  const T = (s, vars) => { let out = (isEs() && ES[s]) || s; if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => vars[k] != null ? vars[k] : m); return out; };
  const P = (n, one, many) => T(n === 1 ? one : many, { n });
  const locale = () => isEs() ? "es" : undefined;
  const fmt = (d, o) => { try { return new Intl.DateTimeFormat(locale(), o).format(d); } catch (e) { return d.toDateString(); } };
  function dur(sec) {
    const m = Math.round((sec || 0) / 60);
    if (m < 1) return sec > 0 ? T("less than a minute") : T("{n} min", { n: 0 });
    if (m < 60) return T("{n} min", { n: m });
    const hh = Math.floor(m / 60), mm = m % 60;
    return mm ? T("{h} h {m} min", { h: hh, m: mm }) : T("{h} h", { h: hh });
  }
  const durShort = sec => { const m = Math.round((sec || 0) / 60); if (m < 60) return m + "m"; const hh = Math.floor(m / 60), mm = m % 60; return hh + "h" + (mm ? " " + mm + "m" : ""); };

  /* =====================================================================
     Preferences: week start
     ===================================================================== */
  const prefs = () => Object.assign({ ws: "auto" }, load(K.PREF, {}));
  function localeWeekStart() {
    try { const L = new Intl.Locale(navigator.language || "en-US"); const wi = (typeof L.getWeekInfo === "function" ? L.getWeekInfo() : L.weekInfo); if (wi && wi.firstDay) return wi.firstDay % 7; } catch (e) {}
    return 1;
  }
  const weekStartDay = () => { const p = prefs().ws; return p === "0" ? 0 : p === "1" ? 1 : localeWeekStart(); };
  const weekOf = day => { const ws = weekStartDay(); const dow = toDate(day).getDay(); return addDays(day, -((dow - ws + 7) % 7)); };
  function setWeekStart(v) { const p = load(K.PREF, {}); p.ws = v === "0" || v === "1" ? v : "auto"; save(K.PREF, p); if (isOpen()) { state.week = weekOf(state.week); draw(); } }

  /* =====================================================================
     Recording (time in Bibley, chapters opened) - new in 7.4
     ===================================================================== */
  const ACTIVE_MS = 120000, FLUSH_S = 120, OPENED_S = 30;
  const devId = (() => {
    let id = null; try { id = localStorage.getItem(K.DEV); } catch (e) {}
    if (!id || !/^[a-z0-9]{4,24}$/.test(id)) { id = "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); try { localStorage.setItem(K.DEV, id); } catch (e) {} }
    return id;
  })();
  const readLog = () => { const l = load(K.LOG, null); return l && typeof l === "object" && l.d && typeof l.d === "object" && !Array.isArray(l.d) ? l : { v: 1, d: {} }; };
  function writeDev(day, fn) {
    const l = readLog(); l.v = 1;
    const dd = l.d[day] && typeof l.d[day] === "object" ? l.d[day] : (l.d[day] = {});
    const rec = dd[devId] && typeof dd[devId] === "object" ? dd[devId] : (dd[devId] = { s: 0, o: [] });
    if (!Array.isArray(rec.o)) rec.o = [];
    fn(rec);
    const days = Object.keys(l.d).filter(isDay).sort();
    if (days.length > 800) days.slice(0, days.length - 800).forEach(d => delete l.d[d]);
    save(K.LOG, l);
  }
  let lastAct = Date.now(), lastTick = Date.now(), pend = 0, pendDay = dayStr(), curCh = null, curChS = 0, curChLogged = false;
  const poke = () => { lastAct = Date.now(); };
  ["pointerdown", "keydown", "wheel", "touchstart", "scroll"].forEach(ev => window.addEventListener(ev, poke, { capture: true, passive: true }));
  function flush() {
    if (pend < 1) { pend = 0; return; }
    const s = Math.round(pend); pend = 0;
    writeDev(pendDay, r => { r.s = Math.max(0, Math.round(+r.s || 0)) + s; });
  }
  function tick() {
    const now = Date.now(), dt = Math.min(10, Math.max(0, (now - lastTick) / 1000)); lastTick = now;
    const today = dayStr(); if (today !== pendDay) { flush(); pendDay = today; }
    let speaking = false; try { speaking = !!(window.speechSynthesis && speechSynthesis.speaking && !speechSynthesis.paused); } catch (e) {}
    if (document.visibilityState === "visible" && (now - lastAct < ACTIVE_MS || speaking)) {
      pend += dt;
      if (curCh) { curChS += dt; if (!curChLogged && curChS >= OPENED_S) { curChLogged = true; const k = curCh; writeDev(today, r => { if (!r.o.includes(k)) r.o.push(k); }); } }
    }
    if (pend >= FLUSH_S) flush();
  }
  setInterval(tick, 5000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { tick(); flush(); } else { lastTick = Date.now(); poke(); } });
  window.addEventListener("pagehide", () => { tick(); flush(); });
  document.addEventListener("bibley:chapter", e => {
    const d = e.detail || {}; if (d.pane !== "a" || !BOOKS[d.bookIdx]) return;
    const vs = C.paneVerses ? C.paneVerses("a") : null; if (!vs || !vs.length) return;   // an error or offline page is not a chapter you read
    const k = chKey(d.bookIdx, d.chapter); if (k !== curCh) { curCh = k; curChS = 0; curChLogged = false; }
  });
  // Merge a backup's day log into this device's (per day, per device; the larger time wins, opened chapters are unioned).
  function importLog(data) {
    if (!data || typeof data !== "object" || !data.d || typeof data.d !== "object") return false;
    flush();
    const l = readLog(); l.v = 1;
    Object.keys(data.d).filter(isDay).forEach(day => {
      const src = data.d[day]; if (!src || typeof src !== "object") return;
      const dd = l.d[day] && typeof l.d[day] === "object" ? l.d[day] : (l.d[day] = {});
      Object.keys(src).forEach(dev => {
        const a = src[dev]; if (!a || typeof a !== "object") return;
        const b = dd[dev] && typeof dd[dev] === "object" ? dd[dev] : { s: 0, o: [] };
        dd[dev] = { s: Math.max(+a.s || 0, +b.s || 0), o: [...new Set([].concat(Array.isArray(b.o) ? b.o : [], Array.isArray(a.o) ? a.o : []))] };
      });
    });
    return save(K.LOG, l);
  }

  /* =====================================================================
     Reading the records
     ===================================================================== */
  function buildIndex() {
    const days = new Map();
    const D = day => { let x = days.get(day); if (!x) { x = { read: [], opened: new Set(), secs: 0, notes: [], hls: [], saved: [], likes: [], memAdded: [], memPr: [], plan: [], act: false }; days.set(day, x); } return x; };
    const obj = k => { const v = load(k, {}); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; };
    const readMap = obj(K.READ);
    Object.keys(readMap).forEach(k => { const day = readMap[k], ch = parseCh(k); if (isDay(day) && ch) D(day).read.push(ch); });
    const act = load(K.ACT, []); (Array.isArray(act) ? act : []).forEach(d => { if (isDay(d)) D(d).act = true; });
    const plan = load(K.PLAN, null);
    if (plan && plan.done && typeof plan.done === "object") Object.keys(plan.done).forEach(i => { const d = plan.done[i]; if (isDay(d)) D(d).plan.push(+i + 1); });
    const log = readLog();
    Object.keys(log.d).filter(isDay).forEach(day => {
      const dd = log.d[day]; if (!dd || typeof dd !== "object") return;
      Object.keys(dd).forEach(dev => { const r = dd[dev]; if (!r || typeof r !== "object") return; const x = D(day); x.secs += Math.max(0, +r.s || 0); (Array.isArray(r.o) ? r.o : []).forEach(k => { if (parseCh(k)) x.opened.add(k); }); });
    });
    // verses that point at a place in the Bible: {ref, bookIdx, chapter, verseNum}
    const at = (o, extra) => Object.assign({ ref: o.ref || (BOOKS[o.bookIdx] ? refOf(o.bookIdx, o.chapter) + (o.verseNum ? ":" + o.verseNum : "") : ""), b: BOOKS[o.bookIdx] ? o.bookIdx : null, c: o.chapter, v: o.verseNum, verses: o.verses }, extra || {});
    const notes = obj(K.NOTES); Object.keys(notes).forEach(k => { const n = notes[k]; if (!n || !n.text) return; const d = tsDay(n.added || n.updated); if (d) D(d).notes.push(at(n, { kind: "verse", t: n.added || n.updated })); });
    const snb = load(K.SNB, []); (Array.isArray(snb) ? snb : []).forEach(n => { if (!n || !n.id) return; const d = tsDay(n.created); if (d) D(d).notes.push({ kind: "nb", ref: String(n.title || "").trim() || T("Note"), t: n.created }); });
    const nb = load(K.NB, null); (nb && Array.isArray(nb.notes) ? nb.notes : []).forEach(n => { if (!n || !n.id) return; const d = tsDay(n.created); if (d) D(d).notes.push(BOOKS[n.bookIdx] ? at(n, { kind: "page", t: n.created }) : { kind: "page", ref: String(n.title || n.ref || "").trim() || T("Note"), t: n.created }); });
    const hls = obj(K.HL); Object.keys(hls).forEach(k => { const x = hls[k]; if (!x) return; const d = tsDay(x.added); if (d) D(d).hls.push(at(x, { color: x.color, t: x.added })); });
    const vb = obj(K.VBM); Object.keys(vb).forEach(k => { const x = vb[k]; if (!x) return; const d = tsDay(x.added); if (d) D(d).saved.push(at(x, { t: x.added })); });
    const lk = obj(K.LIKES); Object.keys(lk).forEach(k => { const x = lk[k]; if (!x) return; const d = tsDay(x.added); if (d) D(d).likes.push(at(x, { t: x.added })); });
    const mem = load(K.MEM, null), mv = mem && mem.verses && typeof mem.verses === "object" ? mem.verses : {};
    Object.keys(mv).forEach(k => { const x = mv[k]; if (!x) return; const a = tsDay(x.added), p = tsDay(x.practiced); if (a) D(a).memAdded.push(at(x, { t: x.added })); if (p) D(p).memPr.push(at(x, { t: x.practiced })); });
    days.forEach(x => ["notes", "hls", "saved", "likes", "memAdded", "memPr"].forEach(f => x[f].sort((a, b) => (a.t || 0) - (b.t || 0))));
    const keys = [...days.keys()].sort();
    return { days, readMap, first: keys[0] || null, planId: plan && PLAN_NAMES[plan.id] ? plan.id : null };
  }
  const isActive = x => !!x && (x.act || x.read.length > 0 || x.secs >= 60 || x.opened.size > 0 || x.notes.length + x.hls.length + x.saved.length + x.likes.length + x.memAdded.length + x.memPr.length + x.plan.length > 0);
  function currentStreak(idx) {
    const today = dayStr(), has = d => { const x = idx.days.get(d); return !!(x && x.act); };
    let d = has(today) ? today : addDays(today, -1), n = 0;
    while (has(d)) { n++; d = addDays(d, -1); }
    return { n, today: has(today) };
  }
  // Everything recorded from `from` to `to` (inclusive; days after today are left out).
  function aggregate(idx, from, to) {
    const today = dayStr(), last = to < today ? to : today;
    const out = { from, to, list: [], read: [], opened: new Set(), secs: 0, notes: [], hls: [], saved: [], likes: [], memAdded: [], memPr: [], plan: [], active: 0, best: 0, total: 0 };
    let run = 0;
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const x = idx.days.get(d), future = d > last, on = !future && isActive(x);
      out.list.push({ day: d, x: x || null, future, active: on, n: x ? x.read.length : 0, secs: x ? x.secs : 0 });
      if (future) continue;
      out.total++;
      if (on) out.active++;
      if (x && x.act) { run++; out.best = Math.max(out.best, run); } else run = 0;
      if (!x) continue;
      x.read.forEach(ch => out.read.push(ch.concat([d])));
      x.opened.forEach(k => out.opened.add(k)); out.secs += x.secs;
      ["notes", "hls", "saved", "likes", "memAdded", "memPr", "plan"].forEach(f => { out[f] = out[f].concat(x[f]); });
    }
    const readSet = new Set(out.read.map(r => chKey(r[0], r[1])));
    out.openedOnly = [...out.opened].filter(k => !readSet.has(k)).map(parseCh).filter(Boolean);
    const counts = {}; out.read.forEach(([b]) => { counts[b] = (counts[b] || 0) + 1; });
    out.top = Object.keys(counts).map(Number).sort((a, b) => counts[b] - counts[a] || a - b).map(b => [b, counts[b]]);
    // books finished: every chapter marked read, and the last one of them marked in this period
    out.finished = [];
    const books = [...new Set(out.read.map(r => r[0]))].sort((a, b) => a - b);
    books.forEach(b => {
      let lastDay = "";
      for (let c = 1; c <= BOOKS[b][2]; c++) { const d = idx.readMap[chKey(b, c)]; if (!isDay(d)) { lastDay = null; break; } if (d > lastDay) lastDay = d; }
      if (lastDay && lastDay >= from && lastDay <= last) out.finished.push(b);
    });
    out.marks = out.notes.length + out.hls.length + out.saved.length + out.likes.length + out.memAdded.length;
    out.any = out.active > 0;
    return out;
  }
  function summarize(chs) {   // [[b,c],...] -> "John 1-3 - Psalms 23"
    const s = chs.slice().sort((x, y) => x[0] - y[0] || x[1] - y[1]), parts = []; let i = 0;
    while (i < s.length) { const b = s[i][0]; let j = i; while (j + 1 < s.length && s[j + 1][0] === b && s[j + 1][1] === s[j][1] + 1) j++;
      parts.push(bookName(b).replace(/^Psalms$/, s[i][1] === s[j][1] ? "Psalm" : "Psalms") + " " + s[i][1] + (j > i ? "\u2013" + s[j][1] : "")); i = j + 1; }
    return parts.join(" \u00b7 ");
  }

  /* =====================================================================
     The Recap sheet
     ===================================================================== */
  const state = { tab: "day", day: dayStr(), week: weekOf(dayStr()), month: monthOf(dayStr()) };
  let root = null, idxCache = null;
  const isOpen = () => { const f = FX(); return !!(root && root.isConnected && f && f.ui && f.ui.isOpen && f.ui.isOpen("recap")); };
  const h = html => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  function open(opts) {
    const f = FX(); if (!f || !f.ui) return;
    flush();
    const today = dayStr();
    state.day = today; state.week = weekOf(today); state.month = monthOf(today);
    if (opts && opts.tab) state.tab = opts.tab;
    if (opts && isDay(opts.day)) { state.day = opts.day; state.week = weekOf(opts.day); state.month = monthOf(opts.day); }
    f.ui.openSheet("recap", T("Recap"), body => {
      root = h('<div class="rc"><div class="fx-seg rc-tabs" role="tablist" aria-label="' + esc(T("Recap periods")) + '">' +
        [["day", "Day"], ["week", "Week"], ["month", "Month"]].map(([k, l]) => '<button type="button" role="tab" data-tab="' + k + '">' + esc(T(l)) + "</button>").join("") + "</div>" +
        '<div class="rc-nav"><button type="button" class="rc-arrow" data-nav="-1">' + IC.prev + '</button><div class="rc-label" aria-live="polite"><b></b><small></small></div><button type="button" class="rc-arrow" data-nav="1">' + IC.next + "</button></div>" +
        '<div class="rc-view"></div>' +
        '<div class="rc-actions"><button type="button" class="fx-btn" data-a="copy">' + IC.copy + "<span>" + esc(T("Copy")) + "</span></button>" +
        (navigator.share ? '<button type="button" class="fx-btn" data-a="share">' + IC.share + "<span>" + esc(T("Share")) + "</span></button>" : "") + "</div>" +
        '<p class="fx-muted rc-foot">' + esc(T("Recaps count what Bibley recorded on your devices: chapters marked read, your streak days, plan days and when notes, highlights and verses were saved. Time in Bibley is recorded from version 7.4 on.")) + "</p></div>");
      body.append(root);
      root.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { state.tab = b.dataset.tab; draw(); });
      root.querySelectorAll("[data-nav]").forEach(b => b.onclick = () => move(+b.dataset.nav));
      root.querySelector('[data-a="copy"]').onclick = async () => { const ok = await copy(recapText()); toast(ok ? T("Recap copied") : T("Couldn't copy")); };
      const sh = root.querySelector('[data-a="share"]');
      if (sh) sh.onclick = async () => { try { await navigator.share({ title: T("Bibley recap"), text: recapText() }); } catch (e) { if (e && e.name !== "AbortError") { const ok = await copy(recapText()); toast(ok ? T("Recap copied") : T("Couldn't copy")); } } };
      wireSwipe(root.querySelector(".rc-view"));
      draw();
    });
  }
  async function copy(t) {
    const f = FX(); if (f && f.ui && f.ui.copyText) return f.ui.copyText(t);
    try { await navigator.clipboard.writeText(t); return true; } catch (e) { return false; }
  }
  // the period being shown: [from, to]
  function period() {
    if (state.tab === "day") return [state.day, state.day];
    if (state.tab === "week") return [state.week, addDays(state.week, 6)];
    return [monthStart(state.month), monthEnd(state.month)];
  }
  function canMove(dir, idx) {
    const [from, to] = period(), today = dayStr();
    if (dir > 0) return to < today;
    return !!idx.first && from > idx.first;
  }
  function move(dir) {
    if (!root) return;
    const idx = idxCache || buildIndex();
    if (!canMove(dir, idx)) return;
    if (state.tab === "day") state.day = addDays(state.day, dir);
    else if (state.tab === "week") state.week = addDays(state.week, 7 * dir);
    else state.month = shiftMonth(state.month, dir);
    draw(dir);
  }
  function showDay(day) { state.tab = "day"; state.day = day; state.week = weekOf(day); state.month = monthOf(day); draw(); }
  function wireSwipe(el) {
    let sx = 0, sy = 0, st = 0, ok = false;
    el.addEventListener("touchstart", e => { if (e.touches.length !== 1) { ok = false; return; } const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); ok = true; }, { passive: true });
    el.addEventListener("touchend", e => {
      if (!ok) return; ok = false; const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Date.now() - st > 700 || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      move(dx < 0 ? 1 : -1);
    }, { passive: true });
  }
  document.addEventListener("keydown", e => {
    if (!isOpen() || e.altKey || e.ctrlKey || e.metaKey) return;
    const tg = e.target; if (tg && tg.closest && tg.closest("input,textarea,select,[contenteditable]")) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); } else if (e.key === "ArrowRight") { e.preventDefault(); move(1); }
  });

  function labels() {
    const today = dayStr();
    if (state.tab === "day") {
      const d = toDate(state.day);
      const main = state.day === today ? T("Today") : state.day === addDays(today, -1) ? T("Yesterday") : fmt(d, { weekday: "long" });
      return [main, fmt(d, { weekday: state.day === today || state.day === addDays(today, -1) ? "long" : undefined, month: "long", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" })];
    }
    if (state.tab === "week") {
      const end = addDays(state.week, 6), cur = weekOf(today);
      const main = state.week === cur ? T("This week") : state.week === addDays(cur, -7) ? T("Last week") : rangeLabel(state.week, end, false);
      return [main, rangeLabel(state.week, end, true) + (state.week === cur ? " \u00b7 " + T("so far") : "")];
    }
    const [y, m] = state.month.split("-").map(Number);
    return [fmt(new Date(y, m - 1, 1), { month: "long", year: "numeric" }), state.month === monthOf(today) ? T("so far") : ""];
  }
  function rangeLabel(a, b, withYear) {
    const da = toDate(a), db = toDate(b);
    try { const f = new Intl.DateTimeFormat(locale(), { month: "short", day: "numeric", year: withYear ? "numeric" : undefined }); if (f.formatRange) return f.formatRange(da, db); } catch (e) {}
    return fmt(da, { month: "short", day: "numeric" }) + " \u2013 " + fmt(db, { month: "short", day: "numeric", year: withYear ? "numeric" : undefined });
  }

  function draw(dir) {
    if (!root) return;
    const idx = idxCache = buildIndex();
    root.querySelectorAll("[data-tab]").forEach(b => { const on = b.dataset.tab === state.tab; b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
    const [main, sub] = labels();
    root.querySelector(".rc-label b").textContent = main;
    root.querySelector(".rc-label small").textContent = sub;
    const pv = root.querySelector('[data-nav="-1"]'), nx = root.querySelector('[data-nav="1"]');
    pv.disabled = !canMove(-1, idx); nx.disabled = !canMove(1, idx);
    const names = { day: ["Previous day", "Next day"], week: ["Previous week", "Next week"], month: ["Previous month", "Next month"] }[state.tab];
    pv.setAttribute("aria-label", T(names[0])); nx.setAttribute("aria-label", T(names[1]));
    const view = root.querySelector(".rc-view");
    view.innerHTML = "";
    const [from, to] = period();
    const a = aggregate(idx, from, to);
    view.append(state.tab === "day" ? dayView(idx, a) : state.tab === "week" ? weekView(idx, a) : monthView(idx, a));
    view.classList.remove("rc-in-l", "rc-in-r");
    if (dir) { void view.offsetWidth; view.classList.add(dir > 0 ? "rc-in-r" : "rc-in-l"); }
    wireView(view);
  }
  // taps inside a view: open a verse or chapter, or a day from the strip / calendar
  function wireView(view) {
    view.querySelectorAll("[data-day]").forEach(b => b.onclick = () => showDay(b.dataset.day));
    view.querySelectorAll("[data-b]").forEach(b => b.onclick = () => {
      const f = FX(), bi = +b.dataset.b, c = +b.dataset.c, v = b.dataset.v ? +b.dataset.v : null;
      if (!BOOKS[bi]) return;
      if (f && f.jumpToVerse) f.jumpToVerse(bi, c, v); else { f && f.ui && f.ui.closeSheet(); C.goTo(bi, c); }
    });
    const cont = view.querySelector('[data-a="continue"]'); if (cont) cont.onclick = () => { const f = FX(); if (f && f.ui) f.ui.closeSheet(); };
  }

  /* ---------- pieces ---------- */
  const stat = (n, label, sub) => '<div class="rc-stat"><b>' + esc(n) + "</b><span>" + esc(label) + "</span>" + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</div>";
  const chip = (b, c, done, v) => '<button type="button" class="fx-chip' + (done ? " done" : "") + '" data-b="' + b + '" data-c="' + c + '"' + (v ? ' data-v="' + v + '"' : "") + ' aria-label="' + esc(T("Open {s}", { s: refOf(b, c) })) + '">' + esc(refOf(b, c)) + "</button>";
  function refLink(x) {
    const dot = x.color ? '<i class="rc-dot hl-' + esc(String(x.color).replace(/[^a-z]/g, "")) + '"></i>' : "";
    if (x.b != null && BOOKS[x.b]) return '<button type="button" class="rc-ref" data-b="' + x.b + '" data-c="' + x.c + '"' + (x.v ? ' data-v="' + x.v + '"' : "") + ">" + dot + esc(x.ref) + "</button>";
    return '<span class="rc-ref plain">' + dot + esc(x.ref) + "</span>";
  }
  function listRow(icon, title, items, extra) {
    if (!items.length && !extra) return "";
    const shown = items.slice(0, 8), more = items.length - shown.length;
    return '<div class="rc-row"><span class="rc-ic">' + icon + '</span><div class="rc-rt"><b>' + esc(title) + (items.length ? ' <em>' + items.length + "</em>" : "") + "</b>" +
      (shown.length ? '<div class="rc-refs">' + shown.map(refLink).join("") + (more > 0 ? '<span class="rc-more">+' + more + "</span>" : "") + "</div>" : "") + (extra ? '<div class="fx-muted">' + extra + "</div>" : "") + "</div></div>";
  }
  function empty(title) {
    const today = state.tab === "day" ? state.day === dayStr() : period()[1] >= dayStr();
    return '<div class="rc-empty"><span class="rc-empty-ic">' + IC.book + "</span><b>" + esc(T(title)) + "</b><p class=\"fx-muted\">" + esc(T("Mark a chapter read, highlight a verse or write a note and it shows up here.")) + "</p>" +
      (today ? '<button type="button" class="fx-btn small" data-a="continue">' + IC.book + "<span>" + esc(T("Continue reading")) + "</span></button>" : "") + "</div>";
  }
  function studyCounts(a) {
    const bits = [];
    if (a.notes.length) bits.push(P(a.notes.length, "{n} note", "{n} notes"));
    if (a.hls.length) bits.push(P(a.hls.length, "{n} highlight", "{n} highlights"));
    if (a.saved.length) bits.push(P(a.saved.length, "{n} saved verse", "{n} saved verses"));
    if (a.likes.length) bits.push(P(a.likes.length, "{n} liked verse", "{n} liked verses"));
    if (a.memAdded.length) bits.push(P(a.memAdded.length, "{n} memory verse added", "{n} memory verses added"));
    if (a.plan.length) bits.push(P(a.plan.length, "{n} plan day completed", "{n} plan days completed"));
    if (a.openedOnly.length) bits.push(P(a.openedOnly.length, "{n} chapter opened", "{n} chapters opened"));
    return bits;
  }
  function topBooks(a, max) {
    if (!a.top.length) return "";
    const top = a.top.slice(0, max), hi = top[0][1];
    return '<div class="fx-card rc-card"><div class="fx-eyebrow">' + esc(T("Most read")) + '</div><div class="rc-books">' +
      top.map(([b, n]) => '<div class="rc-book"><span class="rc-bn">' + esc(bookName(b)) + '</span><span class="rc-bar"><i style="width:' + Math.max(8, Math.round(n / hi * 100)) + '%"></i></span><span class="rc-bc">' + n + "</span></div>").join("") + "</div>" +
      (a.finished.length ? '<p class="rc-fin">' + IC.check + "<span>" + esc(T("Finished")) + ": " + esc(a.finished.map(bookName).join(", ")) + "</span></p>" : "") + "</div>";
  }
  function studyCard(a) {
    const bits = studyCounts(a);
    if (!bits.length) return "";
    return '<div class="fx-card rc-card"><div class="fx-eyebrow">' + esc(T("Study")) + '</div><div class="rc-tags">' + bits.map(b => "<span>" + esc(b) + "</span>").join("") + "</div></div>";
  }
  function compareLine(idx, a, prevFrom, prevTo, key) {
    const p = aggregate(idx, prevFrom, prevTo); if (!p.any) return "";
    const s = P(p.read.length, "{n} chapter", "{n} chapters") + " \u00b7 " + T("{a} of {b}", { a: p.active, b: p.total }) + " " + T("Active days").toLowerCase();
    return '<p class="fx-muted rc-cmp">' + esc(T(key, { s })) + "</p>";
  }

  /* ---------- Day ---------- */
  function dayView(idx, a) {
    const el = h('<div class="rc-day"></div>');
    const isToday = state.day === dayStr(), x = a.list[0].x;
    if (!a.any) { el.innerHTML = empty(isToday ? "Nothing recorded for today yet" : "Nothing recorded for this day") + (isToday ? streakLine(idx) : ""); return el; }
    let html = '<div class="rc-stats">' + stat(a.read.length, T("Chapters read")) + stat(dur(a.secs), T("Time in Bibley")) + stat(a.marks, T("Study marks")) + "</div>";
    if (isToday) html += streakLine(idx);
    if (a.read.length || a.openedOnly.length) {
      html += '<div class="fx-card gold rc-card">';
      if (a.read.length) html += '<div class="fx-eyebrow">' + esc(T("Read")) + '</div><div class="rc-sum">' + esc(summarize(a.read)) + '</div><div class="fx-chips">' + a.read.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]).map(([b, c]) => chip(b, c, true)).join("") + "</div>";
      if (a.openedOnly.length) html += '<div class="fx-eyebrow rc-also">' + esc(T("Also spent time in")) + '</div><div class="fx-chips">' + a.openedOnly.slice(0, 12).map(([b, c]) => chip(b, c, false)).join("") + "</div>";
      html += "</div>";
    }
    const planBits = [];
    if (a.plan.length) planBits.push(a.plan.sort((p, q) => p - q).map(n => T("Day {n} completed", { n })).join(" \u00b7 "));
    const pl = isToday && FX() && FX().plan ? FX().plan() : null;
    if (planBits.length || pl) {
      html += '<div class="fx-card rc-card"><div class="fx-eyebrow">' + esc(T("Reading plan")) + (pl ? " \u00b7 " + esc(pl.name) : idx.planId ? " \u00b7 " + esc(PLAN_NAMES[idx.planId]) : "") + "</div>" +
        (planBits.length ? '<p class="rc-p">' + IC.check + "<span>" + esc(planBits[0]) + "</span></p>" : "") +
        (pl ? '<div class="fx-bar"><i style="width:' + pl.pct + '%"></i></div><div class="fx-muted">' + esc(T("Day {a} of {b}", { a: pl.day, b: pl.total })) + " \u00b7 " + pl.pct + "%</div>" : "") + "</div>";
    }
    const rows = listRow(IC.note, T("Notes"), a.notes) + listRow(IC.hl, T("Highlights"), a.hls) + listRow(IC.mark, T("Saved verses"), a.saved) + listRow(IC.heart, T("Liked verses"), a.likes) +
      listRow(IC.brain, T("Memory verses"), a.memAdded, a.memPr.length ? esc(T("Practised today") + ": " + a.memPr.map(m => m.ref).join(", ")) : "");
    if (rows) html += '<div class="fx-card rc-card rc-list">' + rows + "</div>";
    el.innerHTML = html;
    return el;
  }
  function streakLine(idx) {
    const s = currentStreak(idx);
    return '<div class="rc-streak' + (s.n ? "" : " off") + '"><span class="rc-fl">' + IC.flame + "</span><span><b>" + esc(s.n ? T("{n}-day streak", { n: s.n }) : T("No streak yet")) + "</b><small>" + esc(s.n ? (s.today ? T("You read today") : T("Read today to keep it going")) : T("Mark a chapter read to start one")) + "</small></span></div>";
  }

  /* ---------- Week ---------- */
  function weekView(idx, a) {
    const el = h('<div class="rc-week"></div>');
    let html = '<div class="rc-stats four">' + stat(a.read.length, T("Chapters read")) + stat(T("{a} of {b}", { a: a.active, b: a.total || 7 }), T("Active days")) + stat(dur(a.secs), T("Time in Bibley")) + stat(P(a.best, "{n} day", "{n} days"), T("Best streak")) + "</div>";
    html += '<div class="fx-card rc-card"><div class="fx-eyebrow">' + esc(T("Day by day")) + "</div>" + strip(a) + "</div>";
    if (!a.any) { html += empty("Nothing recorded this week"); el.innerHTML = html; return el; }
    html += topBooks(a, 3) + studyCard(a) + compareLine(idx, a, addDays(state.week, -7), addDays(state.week, -1), "Last week: {s}");
    el.innerHTML = html;
    return el;
  }
  function strip(a) {
    const hi = Math.max(1, ...a.list.map(d => d.n)), today = dayStr();
    return '<div class="rc-strip" role="list">' + a.list.map(d => {
      const dt = toDate(d.day), lvl = d.n ? Math.max(18, Math.round(d.n / hi * 100)) : d.active ? 10 : 0;
      const tip = fmt(dt, { weekday: "long", month: "short", day: "numeric" }) + ": " + P(d.n, "{n} chapter", "{n} chapters") + (d.secs >= 60 ? ", " + dur(d.secs) : "");
      return '<button type="button" role="listitem" class="rc-sd' + (d.active ? " on" : "") + (d.day === today ? " today" : "") + '"' + (d.future ? " disabled" : ' data-day="' + d.day + '"') + ' aria-label="' + esc(tip) + '" title="' + esc(tip) + '">' +
        '<span class="rc-sw">' + esc(fmt(dt, { weekday: "narrow" })) + '</span><span class="rc-sb"><i style="height:' + lvl + '%"></i></span><span class="rc-sn">' + (d.n ? d.n : d.active ? IC.check : "") + "</span>" +
        '<span class="rc-sdt">' + dt.getDate() + "</span></button>";
    }).join("") + "</div>";
  }

  /* ---------- Month ---------- */
  function monthView(idx, a) {
    const el = h('<div class="rc-month"></div>');
    let html = '<div class="rc-stats four">' + stat(a.read.length, T("Chapters read")) + stat(T("{a} of {b}", { a: a.active, b: a.total }), T("Active days")) + stat(P(a.best, "{n} day", "{n} days"), T("Best streak")) + stat(dur(a.secs), T("Time in Bibley")) + "</div>";
    html += '<div class="fx-card rc-card"><div class="fx-eyebrow">' + esc(T("Your month")) + "</div>" + calendar(a) + "</div>";
    if (!a.any) { html += empty("Nothing recorded this month"); el.innerHTML = html; return el; }
    html += topBooks(a, 5) + studyCard(a) + compareLine(idx, a, monthStart(shiftMonth(state.month, -1)), monthEnd(shiftMonth(state.month, -1)), "Last month: {s}");
    el.innerHTML = html;
    return el;
  }
  function calendar(a) {
    const ws = weekStartDay(), first = toDate(a.from), lead = (first.getDay() - ws + 7) % 7, today = dayStr();
    const hdr = []; for (let i = 0; i < 7; i++) { const d = new Date(2023, 0, 1 + ((ws + i) % 7)); hdr.push('<span class="rc-ch">' + esc(fmt(d, { weekday: "narrow" })) + "</span>"); }   // 2023-01-01 was a Sunday
    const cells = []; for (let i = 0; i < lead; i++) cells.push('<span class="rc-cd pad"></span>');
    a.list.forEach(d => {
      const lv = d.n >= 4 ? 4 : d.n >= 2 ? 3 : d.n === 1 ? 2 : d.active ? 1 : 0;
      const tip = fmt(toDate(d.day), { weekday: "long", month: "long", day: "numeric" }) + ": " + P(d.n, "{n} chapter", "{n} chapters") + (d.secs >= 60 ? ", " + dur(d.secs) : "");
      cells.push('<button type="button" class="rc-cd l' + lv + (d.day === today ? " today" : "") + '"' + (d.future ? " disabled" : ' data-day="' + d.day + '"') + ' aria-label="' + esc(tip) + '" title="' + esc(tip) + '"><span>' + toDate(d.day).getDate() + "</span></button>");
    });
    return '<div class="rc-cal"><div class="rc-cal-h">' + hdr.join("") + '</div><div class="rc-cal-g">' + cells.join("") + "</div></div>" +
      '<p class="fx-muted rc-hint">' + esc(T("Tap a day to see it.")) + "</p>";
  }

  /* ---------- copy / share text ---------- */
  function recapText() {
    const idx = idxCache || buildIndex(), [from, to] = period(), a = aggregate(idx, from, to), [main, sub] = labels();
    const L = [];
    const title = state.tab === "day" ? (state.day === dayStr() || state.day === addDays(dayStr(), -1) ? sub : fmt(toDate(state.day), { weekday: "long", month: "long", day: "numeric", year: "numeric" })) :
      state.tab === "week" ? T("Week of {s}", { s: rangeLabel(from, to, true) }) : main;
    L.push(T("Bibley recap") + " \u00b7 " + title + (state.tab !== "day" && to >= dayStr() ? " (" + T("so far") + ")" : ""));
    if (!a.any) { L.push(state.tab === "day" ? T("Nothing recorded for this day") : state.tab === "week" ? T("Nothing recorded this week") : T("Nothing recorded this month")); return L.join("\n"); }
    L.push("");
    const nums = [P(a.read.length, "{n} chapter", "{n} chapters") + " " + T("Read").toLowerCase()];
    if (state.tab !== "day") nums.push(T("{a} of {b}", { a: a.active, b: a.total }) + " " + T("Active days").toLowerCase());
    if (a.secs >= 60) nums.push(dur(a.secs) + " " + (isEs() ? "en Bibley" : "in Bibley"));
    L.push(nums.join(" \u00b7 "));
    if (state.tab === "day" && a.read.length) L.push(T("Read") + ": " + summarize(a.read));
    if (state.tab === "day" && state.day === dayStr()) { const s = currentStreak(idx); if (s.n) L.push(T("{n}-day streak", { n: s.n })); }
    if (state.tab !== "day" && a.best) L.push(T("Best streak") + ": " + P(a.best, "{n} day", "{n} days"));
    if (state.tab !== "day" && a.top.length) L.push(T("Most read") + ": " + a.top.slice(0, state.tab === "week" ? 3 : 5).map(([b, n]) => bookName(b) + " (" + n + ")").join(", "));
    if (a.finished.length) L.push(T("Finished") + ": " + a.finished.map(bookName).join(", "));
    const bits = studyCounts(a); if (bits.length) L.push(bits.join(" \u00b7 "));
    if (state.tab === "week") L.push("", a.list.map(d => fmt(toDate(d.day), { weekday: "short" }) + " " + (d.future ? "\u00b7" : d.n ? String(d.n) : d.active ? "\u2713" : "\u2013")).join("  "));
    return L.join("\n");
  }

  /* =====================================================================
     Entry points: Today / Plans streak card
     ===================================================================== */
  // The streak card on Today: this week as seven dots and a button into the recap.
  function renderToday(slot) {
    if (!slot) return;
    const idx = buildIndex(), today = dayStr(), ws = weekOf(today), a = aggregate(idx, ws, addDays(ws, 6));
    slot.className = "rc-today";
    slot.innerHTML = '<div class="rc-tw" aria-hidden="true">' + a.list.map(d => '<span class="rc-twd' + (d.active ? " on" : "") + (d.day === today ? " today" : "") + (d.future ? " fut" : "") + '"><i></i><small>' + esc(fmt(toDate(d.day), { weekday: "narrow" })) + "</small></span>").join("") + "</div>" +
      '<button type="button" class="fx-btn small rc-open" data-a="recap">' + IC.recap + "<span>" + esc(T("Your recap")) + "</span></button>";
    slot.querySelector('[data-a="recap"]').onclick = () => open({ tab: "week" });
  }

  window.BibleyRecap = {
    open, icon: IC.recap, renderToday, importLog, setWeekStart,
    weekStart: () => prefs().ws, weekStartResolved: weekStartDay,
    keys: { log: K.LOG, pref: K.PREF, device: K.DEV },
    _test: { buildIndex, aggregate, recapText, flush, tick, state: () => Object.assign({}, state), weekOf, poke, devId: () => devId, summarize }
  };
})();
