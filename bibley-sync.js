/* bibley-sync.js - Bibley 6.8 Accounts & Cloud Sync (window.BibleySync).
   Sign in with a username + password and Bibley keeps your study data in the cloud (the site's own
   SQLite database at bibley.sites.tab.bot/api), so a new phone, tablet or computer gets it all back.
   What syncs: every Bibley setting and study item kept in localStorage (keys starting "bible_" or
   "bibley_": highlights, notes, bookmarks, Study Notebook, reading plans, streak, chapters read,
   memory verses, liked verses, Wisdom, settings, AI depth / engine, what Bibley remembers ...),
   except caches, device-only state and secrets (see SKIP). Chats stay in this browser's IndexedDB.
   Stored: "bibley_account_v1" {token, user, auto} (never synced) and "bibley_sync_meta_v1"
   (sync bookkeeping: a hash + cloud time per key, and when each key last changed on this device).
   Merge: signing in on a device that already has notes/highlights merges both sides (lists and
   collections are unioned, settings take the newest side), so signing in never wipes local data.
   Offline: a failed request changes nothing; the next sync (focus, coming online, 5 s timer) retries. */
(() => {
  "use strict";
  if (window.BibleySync) return;
  const K_ACC = "bibley_account_v1", K_META = "bibley_sync_meta_v1";
  const HOME = "https://bibley.sites.tab.bot";
  const API = location.origin === HOME ? "" : HOME;   // the github.io copy syncs to the same database
  const SKIP = new Set([K_ACC, K_META, "bible_search_index_v1", "bible_esv_api_key_v1", "bible_chat_history_v1", "bible_chat_summary_v1",
    "bibley_ai6_cache_v1", "bibley_ai_pause_v1", "bibley_ai_last_v1", "bibley_scroll_prefetch", "bibley_seen_version",
    "bibley_install_dismissed_v1", "bibley_apk_pill_dismissed", "bibley_push_v1", "bibley_focus_v1", "bibley_page_anim", "bibley_today_seen_v1", "bibley_recap_device_v1"]);
  const RELOAD_KEYS = /^(bibley_prefs_v1|bibley_settings_v2|bibley_flags_v1|bibley_nb_v1_|bibley_notebook_v1|bibley_ai_engine_v1|bibley_device_v1|bible_version_)/;
  const MAX_VALUE = 900 * 1024;
  const isSyncKey = k => typeof k === "string" && /^bibley?_/.test(k) && !SKIP.has(k) && k.indexOf("bibley_lostbooks_") !== 0 && /^[A-Za-z0-9_.:-]{1,80}$/.test(k);

  const LS = window.localStorage;
  const P = Storage.prototype, rawSet = P.setItem, rawRemove = P.removeItem, rawGet = P.getItem;
  const get = k => { try { return rawGet.call(LS, k); } catch { return null; } };
  const put = (k, v) => { try { if (v == null) rawRemove.call(LS, k); else rawSet.call(LS, k, v); return true; } catch { return false; } };
  const readJ = (k, d) => { try { const v = JSON.parse(get(k)); return v == null ? d : v; } catch { return d; } };
  const hash = s => { if (s == null) return "-"; let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + "." + s.length; };

  let acc = readJ(K_ACC, null);
  if (acc && (!acc.token || !acc.user)) acc = null;
  const meta = Object.assign({ keys: {}, lt: {}, user: null, last: 0 }, readJ(K_META, {}));
  meta.keys = meta.keys || {}; meta.lt = meta.lt || {};
  let metaT = 0;
  const saveMeta = now => { clearTimeout(metaT); const w = () => put(K_META, JSON.stringify(meta)); if (now) w(); else metaT = setTimeout(w, 400); };
  const saveAcc = () => { if (acc) put(K_ACC, JSON.stringify(acc)); else put(K_ACC, null); };

  // the whole of localStorage was wiped under this running page (clear(), "clear site data"): that is a
  // sign-out on this device, never a mass delete to push to the cloud
  function alive() {
    if (!acc) return false;
    if (get(K_ACC)) return true;
    acc = null; meta.user = null; meta.keys = {}; set({ state: "signedout", error: "" }); return false;
  }
  /* ---------- status + listeners ---------- */
  const st = { state: acc ? "idle" : "signedout", error: "", lastSync: meta.last || 0, keys: 0 };
  const subs = new Set();
  const emit = () => { const s = status(); subs.forEach(f => { try { f(s); } catch {} }); try { window.dispatchEvent(new CustomEvent("bibley-sync-status", { detail: s })); } catch {} };
  const set = patch => { Object.assign(st, patch); emit(); };
  function status() {
    return { signedIn: !!acc, user: acc ? acc.user : null, auto: !!(acc && acc.auto !== false), state: st.state, error: st.error,
      lastSync: st.lastSync || meta.last || 0, keys: st.keys || Object.keys(meta.keys).filter(k => meta.keys[k].h !== "-").length, online: navigator.onLine !== false };
  }

  /* ---------- watch local writes (every module writes through localStorage) ---------- */
  let pushT = 0;
  const touched = k => { if (!isSyncKey(k)) return; meta.lt[k] = Date.now(); saveMeta(); if (alive() && acc.auto !== false) { clearTimeout(pushT); pushT = setTimeout(() => sync({ reason: "write" }), 2500); } };
  P.setItem = function (k, v) { const r = rawSet.apply(this, arguments); if (this === LS) touched(String(k)); return r; };
  P.removeItem = function (k) { const r = rawRemove.apply(this, arguments); if (this === LS) touched(String(k)); return r; };
  // a write that slipped past the hook (another tab, a clear()) is caught by the 5 s diff
  function localKeys() { const out = []; try { for (let i = 0; i < LS.length; i++) { const k = LS.key(i); if (isSyncKey(k)) out.push(k); } } catch {} return out; }
  function dirtyKeys() {
    const ks = new Set(localKeys().concat(Object.keys(meta.keys)).filter(isSyncKey)), out = [];
    ks.forEach(k => { const m = meta.keys[k], h = hash(get(k)); if (!m ? h !== "-" : m.h !== h) out.push(k); });
    return out;
  }

  /* ---------- network ---------- */
  async function call(path, opts) {
    opts = opts || {};
    const headers = { "Content-Type": "application/json" };
    if (opts.auth !== false && acc) headers.Authorization = "Bearer " + acc.token;
    let r;
    try { r = await fetch(API + path, { method: opts.method || "GET", headers, body: opts.body ? JSON.stringify(opts.body) : undefined, keepalive: !!opts.keepalive, cache: "no-store" }); }
    catch (e) { const err = new Error("You're offline. Bibley will sync when you're back online."); err.offline = true; throw err; }
    let j = null; try { j = await r.json(); } catch {}
    if (!r.ok || !j || j.ok === false) { const err = new Error((j && j.error) || ("Server error " + r.status)); err.status = r.status; throw err; }
    return j;
  }

  /* ---------- merge (only when both this device and the cloud changed a key) ---------- */
  const isObj = x => x && typeof x === "object" && !Array.isArray(x);
  const TS = ["updated", "updated_at", "updatedAt", "t", "ts", "time", "created", "at"];
  const stamp = o => { if (!isObj(o)) return null; for (const f of TS) { const v = o[f]; if (typeof v === "number") return v; if (typeof v === "string" && !isNaN(Date.parse(v))) return Date.parse(v); } return null; };
  const ident = o => isObj(o) ? (o.id != null ? "id:" + o.id : o.key != null ? "k:" + o.key : o.bookIdx != null ? "v:" + o.bookIdx + "/" + o.chapter + "/" + (o.verseNum || "") : null) : null;
  function mergeArr(a, b, aNewer) {
    // a = this device, b = cloud
    const out = b.slice(), seen = new Map();
    out.forEach((x, i) => { const id = ident(x) || JSON.stringify(x); seen.set(id, i); });
    a.forEach(x => {
      const id = ident(x) || JSON.stringify(x);
      if (!seen.has(id)) { seen.set(id, out.length); out.push(x); return; }
      const i = seen.get(id), y = out[i]; const sx = stamp(x), sy = stamp(y);
      if (sx != null && sy != null ? sx > sy : aNewer) out[i] = x;
    });
    return out;
  }
  function mergeVal(a, b, aNewer, top) {
    if (Array.isArray(a) && Array.isArray(b)) {
      const prim = a.concat(b).every(x => x === null || typeof x !== "object");
      if (prim && !top) return aNewer ? a : b;   // an ordered list inside a setting (bottom bar order...): newest side
      return mergeArr(a, b, aNewer);
    }
    if (isObj(a) && isObj(b)) {
      const sa = stamp(a), sb = stamp(b);
      if (!top && sa != null && sb != null) return sa >= sb ? a : b;  // one record (a note, a highlight): newest copy
      const out = Object.assign({}, b);
      for (const k of Object.keys(a)) out[k] = k in b ? mergeVal(a[k], b[k], aNewer, false) : a[k];
      return out;
    }
    return aNewer ? a : b;
  }
  function mergeRaw(k, local, cloud, localT, cloudT) {
    if (local == null) return cloud; if (cloud == null) return local;
    if (local === cloud) return local;
    const aNewer = (localT || 0) >= (cloudT || 0);
    let a, b; try { a = JSON.parse(local); b = JSON.parse(cloud); } catch { return aNewer ? local : cloud; }
    if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return aNewer ? local : cloud;
    try { return JSON.stringify(mergeVal(a, b, aNewer, true)); } catch { return aNewer ? local : cloud; }
  }

  /* ---------- the sync ---------- */
  let running = null, again = false;
  function sync(opts) {
    if (!alive()) return Promise.resolve(status());
    if (running) { again = true; return running; }
    running = doSync(opts || {}).finally(() => { running = null; if (again) { again = false; setTimeout(() => sync({ reason: "again" }), 300); } });
    return running;
  }
  async function doSync(opts) {
    const me = acc; set({ state: "syncing", error: "" });
    try {
      const first = meta.user !== me.user.id;          // first sign-in on this device (or another account): merge everything
      if (first) { meta.keys = {}; }
      const pull = await call("/api/sync");
      if (acc !== me) return status();
      const cloud = pull.items || {}, now = Date.now(), applied = [], push = {};
      const ks = new Set(localKeys().concat(Object.keys(meta.keys), Object.keys(cloud)).filter(isSyncKey));
      ks.forEach(k => {
        const L = get(k), hL = hash(L), m = meta.keys[k], c = cloud[k];
        const cv = c ? (c.value == null ? null : typeof c.value === "string" ? c.value : JSON.stringify(c.value)) : undefined;
        const localChanged = m ? m.h !== hL : L != null;
        const cloudChanged = !!c && (!m || c.updated_at > m.u);
        if (!localChanged && !cloudChanged) return;
        if (!localChanged && cloudChanged) {                // only the cloud moved: take it
          if (hash(cv) !== hL) { put(k, cv); applied.push(k); }
          meta.keys[k] = { h: hash(cv), u: c.updated_at }; return;
        }
        let out = L;
        if (cloudChanged && cv !== undefined) {             // both moved: merge
          out = mergeRaw(k, L, cv, meta.lt[k] || (first ? 0 : now), c.updated_at);
          if (out !== L) { put(k, out); applied.push(k); }
          if (out === cv) { meta.keys[k] = { h: hash(cv), u: c.updated_at }; return; }
        }
        if (out != null && out.length > MAX_VALUE) return;  // too big for the cloud: stays on this device only
        push[k] = { value: out == null ? null : out, updated_at: Math.max(now, (c && c.updated_at || 0) + 1) };
      });
      if (Object.keys(push).length) {
        const keys = Object.keys(push);
        for (let i = 0; i < keys.length; i += 40) {
          const part = {}; keys.slice(i, i + 40).forEach(k => part[k] = push[k]);
          const r = await call("/api/sync", { method: "POST", body: { items: part } });
          if (acc !== me) return status();
          const items = r.items || {};
          Object.keys(part).forEach(k => { const it = items[k]; if (it) meta.keys[k] = { h: hash(part[k].value), u: it.updated_at }; });
        }
      }
      meta.user = me.user.id; meta.last = Date.now(); saveMeta(true);
      set({ state: "ok", lastSync: meta.last, keys: Object.keys(meta.keys).filter(k => meta.keys[k].h !== "-").length });
      if (applied.length) refreshUI(applied, opts);
      return status();
    } catch (e) {
      if (e.status === 401 && acc === me) { acc = null; saveAcc(); set({ state: "signedout", error: "Signed out: " + e.message }); return status(); }
      set({ state: e.offline ? "offline" : "error", error: e.message });
      if (opts.throws) throw e;
      return status();
    }
  }
  // the app reads most data straight from localStorage, so a re-render shows it; right after signing in,
  // when settings or the notebook (kept in memory by their modules) came down too, the page reloads once
  function refreshUI(keys, opts) {
    try { const C = window.BibleyCore; if (C) { C.rerender && C.rerender(); C.refreshLists && C.refreshLists(); } } catch {}
    try { window.BibleyFX && window.BibleyFX.prefs && window.BibleyFX.prefs.apply(); } catch {}
    try { window.BibleySettings && window.BibleySettings.apply && window.BibleySettings.apply(); } catch {}
    try { window.dispatchEvent(new CustomEvent("bibley-sync-pulled", { detail: { keys } })); } catch {}
    const needReload = keys.some(k => RELOAD_KEYS.test(k));
    if (opts && opts.reload && needReload) { try { sessionStorage.setItem("bibley_sync_reloaded", "1"); } catch {} setTimeout(() => location.reload(), 900); }
  }

  /* ---------- account ---------- */
  async function signIn(path, body) {
    const r = await call(path, { method: "POST", auth: false, body });
    acc = { token: r.token, user: r.user, auto: true, since: Date.now() }; saveAcc();
    meta.user = null; saveMeta(true);                   // first sync on this device = full merge
    set({ state: "idle", error: "" });
    await sync({ reason: "signin", reload: true, throws: false });
    return status();
  }
  const register = (username, password, display_name) => signIn("/api/auth/register", { username: String(username || "").trim(), password, display_name });
  const login = (username, password) => signIn("/api/auth/login", { username: String(username || "").trim(), password });
  async function logout() {
    const had = acc; if (!had) return status();
    try { await sync({ reason: "signout" }); } catch {}
    try { await call("/api/auth/logout", { method: "POST" }); } catch {}
    acc = null; saveAcc(); meta.user = null; meta.keys = {}; saveMeta(true);   // local data stays on this device
    set({ state: "signedout", error: "" }); return status();
  }
  async function me() {
    const r = await call("/api/auth/me");
    if (acc) { acc.user = r.user; saveAcc(); }
    set({ keys: r.synced_keys }); return r;
  }
  const changePassword = (current_password, new_password) => call("/api/auth/password", { method: "POST", body: { current_password, new_password } });
  async function deleteAccount(password) {
    await call("/api/auth/account", { method: "DELETE", body: { password } });
    acc = null; saveAcc(); meta.user = null; meta.keys = {}; saveMeta(true);
    set({ state: "signedout", error: "" }); return true;
  }
  function setAuto(on) { if (!acc) return; acc.auto = !!on; saveAcc(); emit(); if (on) sync({ reason: "auto" }); }

  /* ---------- when to sync ---------- */
  const auto = () => !!acc && acc.auto !== false;
  const kick = reason => { if (auto()) sync({ reason }); };
  window.addEventListener("focus", () => kick("focus"));
  window.addEventListener("online", () => kick("online"));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") kick("visible"); else flush(); });
  window.addEventListener("pagehide", flush);
  window.addEventListener("beforeunload", flush);
  setInterval(() => { if (auto() && alive() && !running && navigator.onLine !== false && dirtyKeys().length) sync({ reason: "timer" }); }, 5000);
  // leaving the page: send what changed with a keepalive request (no pull, newest-wins on the server)
  function flush() {
    if (!auto() || !alive()) return;
    const d = dirtyKeys(); if (!d.length) return;
    const items = {}, now = Date.now(); let size = 0;
    d.forEach(k => { const v = get(k); if (v && v.length > MAX_VALUE) return; size += (v || "").length; if (size < 60000) items[k] = { value: v, updated_at: now }; });
    if (!Object.keys(items).length) return;
    try { fetch(API + "/api/sync", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json", Authorization: "Bearer " + acc.token }, body: JSON.stringify({ items }) }); } catch {}
  }
  if (acc && auto()) setTimeout(() => sync({ reason: "load" }), 1200);
  try { if (sessionStorage.getItem("bibley_sync_reloaded")) { sessionStorage.removeItem("bibley_sync_reloaded"); setTimeout(() => { if (typeof window.bibleyToast === "function") window.bibleyToast("Synced from your Bibley account \u2713"); }, 1500); } } catch {}

  window.BibleySync = { api: API, status, on: f => { subs.add(f); return () => subs.delete(f); }, isSignedIn: () => !!acc, account: () => acc ? acc.user : null,
    register, login, logout, me, changePassword, deleteAccount, sync: o => sync(Object.assign({ reason: "manual", throws: true }, o || {})), setAuto,
    _test: { isSyncKey, localKeys, dirtyKeys, mergeRaw, hash, meta: () => meta } };
})();
