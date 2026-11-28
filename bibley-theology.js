/* bibley-theology.js - Bibley theology retrieval bridge (local integration, 2026-11-26).
   Loads the tested local bridge packet (theology/theology-bridge.mjs, unchanged from the
   reviewed packet) and exposes it to the classic-script app. Retrieval only: this module
   cannot load a model or generate answers.
   Collections (Bibley 7.9), each one switchable in Settings > Historic Writings ("bibley_historic_prefs_v1"):
   - "classic": Augustine Confessions (Pusey) and Calvin Institutes (Allen), vol. 1 - theology/corpus-*.json
   - "fathers": Church Fathers (ANF / NPNF translations, 1885-1900) - hw-fathers-*.json
   - "summa":   Thomas Aquinas, Summa Theologiae (English Dominican translation, 1920) - hw-summa-*.json
   The Church Fathers and Summa files are the same bundles the Historic Writings library reads (bibley-historic.js);
   hw-index.json lists their works. Only switched-on collections are fetched or searched, and with
   "Use Historic Writings in AI" off, search() returns [] without fetching anything. See theology/README.md. */
(function () {
  "use strict";
  var K_PREFS = "bibley_historic_prefs_v1";
  var DEF = { lib: true, ai: true, fathers: true, summa: true, classic: true };
  var GROUPS = ["classic", "fathers", "summa"];
  var bridges = {}, parts = {}, contractP = null, modP = null, indexP = null;
  function base() { return location.hostname === "appassets.androidplatform.net" ? "https://olivercraftboycompany-design.github.io/Bibley-/" : ""; }
  function prefs() { var p = {}; try { p = JSON.parse(localStorage.getItem(K_PREFS) || "{}") || {}; } catch (e) {} var o = {}; for (var k in DEF) o[k] = p[k] === false ? false : (p[k] === true ? true : DEF[k]); return o; }
  function enabledGroups() { var p = prefs(); if (!p.ai) return []; return GROUPS.filter(function (g) { return p[g]; }); }
  async function getJSON(u) { var r = await fetch(base() + u); if (!r.ok) throw new Error("theology-" + u + "-" + r.status); return r.json(); }
  function hwIndex() { if (!indexP) { indexP = getJSON("hw-index.json"); indexP.catch(function () { indexP = null; }); } return indexP; }
  // records for one collection, each in the bibley.source.v1 shape (id, author, work, edition, section, kind, text, source_url)
  function groupDocs(g) {
    if (parts[g]) return parts[g];
    parts[g] = (async function () {
      if (g === "classic") {
        var ix = await fetch(base() + "theology/corpus.index.json");
        if (ix.ok) {
          var meta = await ix.json(), out = [];
          for (var si = 0; si < meta.shards.length; si++) out = out.concat(await getJSON("theology/" + meta.shards[si]));
          return out.map(function (d) { d.group = "classic"; return d; });
        }
        return (await getJSON("theology/corpus.json")).map(function (d) { d.group = "classic"; return d; });
      }
      var idx = await hwIndex(), grp = (idx.groups || []).filter(function (x) { return x.id === g; })[0] || {};
      var works = idx.works.filter(function (w) { return w.g === g; }), files = [];
      works.forEach(function (w) { if (files.indexOf(w.f) < 0) files.push(w.f); });
      var data = await Promise.all(files.map(function (f) { return getJSON(f); })), docs = [];
      works.forEach(function (w) {
        var secs = null; data.forEach(function (d) { if (d.works && d.works[w.k]) secs = d.works[w.k]; });
        if (!secs) return;
        var author = w.a || grp.a || null, work = g === "summa" ? "Summa Theologiae" : w.t;
        var edition = g === "summa" ? "English Dominican Province translation, 1920" : (w.e || "public-domain translation");
        secs.forEach(function (s, si) {
          var sec = g === "summa" ? w.t.split(":")[0] + ", " + String(s[0]).replace(/^Article (\d+)\.\s*/, "Art. $1: ") : s[0];
          (s[1] || []).forEach(function (p, pi) {
            if (!p || p.length < 40) return;
            docs.push({ id: w.k + ":" + si + "." + pi, author: author, work: work, edition: edition || "public-domain translation", section: sec, kind: "historical_theology",
              text: p, source_url: w.u + (g === "summa" && /^Article (\d+)/.test(s[0]) ? "#article" + s[0].match(/^Article (\d+)/)[1] : ""), source_key: w.k, group: g, hw_key: w.k, hw_sec: si });
          });
        });
      });
      return docs;
    })();
    parts[g].catch(function () { delete parts[g]; });
    return parts[g];
  }
  function deps() {
    if (!contractP) { contractP = getJSON("theology/bibley-source-v1.contract.json"); contractP.catch(function () { contractP = null; }); }
    if (!modP) { modP = import(new URL(base() + "theology/theology-bridge.mjs", document.baseURI).href); modP.catch(function () { modP = null; }); }
    return Promise.all([contractP, modP]);
  }
  // one bridge per set of switched-on collections (a collection that fails to load is left out, the rest still answer)
  function load(groups) {
    groups = groups || enabledGroups();
    var key = groups.join("+");
    if (!groups.length) return Promise.reject(new Error("historic-writings-off"));
    if (bridges[key]) return bridges[key];
    bridges[key] = (async function () {
      var d = await deps(), lists = await Promise.all(groups.map(function (g) { return groupDocs(g).catch(function () { return []; }); }));
      var docs = Array.prototype.concat.apply([], lists);
      if (!docs.length) throw new Error("theology-corpus-unavailable");
      return new d[1].TheologyBridge({ documents: docs, contract: d[0] });
    })();
    bridges[key].catch(function () { delete bridges[key]; });
    return bridges[key];
  }
  window.addEventListener("bibley:historic-prefs", function () { /* next search picks the new set; loaded collections stay cached */ });
  var api = {
    load: function () { return load(); },
    prefs: prefs,
    groups: enabledGroups,
    // Lexical search only. Returns matched records with full metadata, or []. Never calls a model.
    // opts.groups limits the collections searched (still only switched-on ones).
    search: async function (q, opts) {
      var g = enabledGroups();
      if (opts && opts.groups) g = g.filter(function (x) { return opts.groups.indexOf(x) >= 0; });
      if (!g.length) return [];
      var b = await load(g), k = (opts && opts.k) || 3, source = (opts && opts.source) || null;
      if (source) return b.search.search(q, { k: k, source: source });
      var raw = b.search.search(q, { k: k * 6 }), out = [], seen = {};
      var add = function (h) { if (h && !seen[h.id] && out.length < k) { seen[h.id] = 1; out.push(h); } };
      // a word of the question in a work's title ("incarnation" -> Athanasius, On the Incarnation): that work's best passage first
      try {
        if (g.indexOf("fathers") >= 0 || g.indexOf("summa") >= 0) {
          var ix = await hwIndex(), words = (String(q).toLowerCase().match(/[a-z]{5,}/g) || []);
          ix.works.forEach(function (w) { if (g.indexOf(w.g) < 0 || w.g === "summa") return; var tl = w.t.toLowerCase(); if (words.some(function (x) { return tl.indexOf(x) >= 0; })) add(b.search.search(q, { k: 1, source: w.k })[0]); });
        }
      } catch (e) {}
      // then the best passage from each switched-on collection, so one large collection can't crowd the others out, then by score
      g.forEach(function (grp) { for (var i = 0; i < raw.length; i++) if ((raw[i].group || "classic") === grp) { add(raw[i]); break; } });
      raw.forEach(add);
      return out.sort(function (a, c) { return c.score - a.score; });
    },
    // Full frozen-contract preparation. REQUIRES a real runtime tokenizer measureMessages and
    // contextLimit; without them the connector rejects by design. Returns the bridge's status
    // object; only 'prepared_not_generated' may ever advance to a model call.
    prepare: async function (q, opts) {
      if (!enabledGroups().length) return { status: "no_lexical_evidence", model_called: false, messages: null, evidence: [], omitted_evidence_ids: [], reason: "Historic Writings are turned off in Settings." };
      var b = await load();
      return b.prepare(q, opts || {});
    },
    inspectAnswer: async function (raw, prepared) {
      var b = await load();
      return b.inspectAnswer(raw, prepared);
    },
    get scope() {
      var n = { classic: "Augustine Confessions (Pusey); Calvin Institutes (Allen), volume 1 of 2", fathers: "Church Fathers (ANF/NPNF translations)", summa: "Thomas Aquinas, Summa Theologiae (1920 English Dominican translation)" };
      return enabledGroups().map(function (g) { return n[g]; }).join("; ") || "Historic Writings are turned off";
    }
  };
  window.BibleyTheology = api;
})();
