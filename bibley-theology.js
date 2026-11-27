/* bibley-theology.js - Bibley theology retrieval bridge (local integration, 2026-11-26).
   Loads the tested local bridge packet (theology/theology-bridge.mjs, unchanged from the
   reviewed packet) and exposes it to the classic-script app. Retrieval only: this module
   cannot load a model or generate answers. Corpus: Augustine Confessions (Pusey) and
   Calvin Institutes (Allen), volume 1 of 2 - public-domain source texts, see theology/README.md. */
(function () {
  "use strict";
  var P = null;
  function base() { return location.hostname === "appassets.androidplatform.net" ? "https://olivercraftboycompany-design.github.io/Bibley-/" : ""; }
  function load() {
    if (P) return P;
    P = (async function () {
      var b = base();
      var docs = null;
      // Published form: sharded corpus (each part small enough to review/serve); local packet form: one corpus.json.
      var ix = await fetch(b + "theology/corpus.index.json");
      if (ix.ok) {
        var meta = await ix.json(), parts = [];
        for (var si = 0; si < meta.shards.length; si++) {
          var sf = await fetch(b + "theology/" + meta.shards[si]);
          if (!sf.ok) throw new Error("theology-corpus-shard-" + sf.status);
          parts.push(await sf.json());
        }
        docs = Array.prototype.concat.apply([], parts);
      } else {
        var cf = await fetch(b + "theology/corpus.json");
        if (!cf.ok) throw new Error("theology-corpus-" + cf.status);
        docs = await cf.json();
      }
      var kf = await fetch(b + "theology/bibley-source-v1.contract.json");
      if (!kf.ok) throw new Error("theology-contract-" + kf.status);
      var contract = await kf.json();
      var mod = await import(new URL(b + "theology/theology-bridge.mjs", document.baseURI).href);
      return new mod.TheologyBridge({ documents: docs, contract: contract });
    })();
    P.catch(function () { P = null; });
    return P;
  }
  var api = {
    load: load,
    // Lexical search only. Returns matched records with full metadata, or []. Never calls a model.
    search: async function (q, opts) {
      var b = await load();
      return b.search.search(q, { k: (opts && opts.k) || 3, source: (opts && opts.source) || null });
    },
    // Full frozen-contract preparation. REQUIRES a real runtime tokenizer measureMessages and
    // contextLimit; without them the connector rejects by design. Returns the bridge's status
    // object; only 'prepared_not_generated' may ever advance to a model call.
    prepare: async function (q, opts) {
      var b = await load();
      return b.prepare(q, opts || {});
    },
    inspectAnswer: async function (raw, prepared) {
      var b = await load();
      return b.inspectAnswer(raw, prepared);
    },
    scope: "Augustine Confessions (Pusey); Calvin Institutes (Allen), volume 1 of 2"
  };
  window.BibleyTheology = api;
})();
