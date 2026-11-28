# Bibley theology retrieval bridge

## Bibley 7.9: three collections, each switchable

`bibley-theology.js` now searches up to three collections, only the ones switched on in Settings > Historic Writings (`bibley_historic_prefs_v1`: `ai`, `classic`, `fathers`, `summa`; with `ai` off, search returns `[]` and nothing is fetched):

- `classic` - Augustine's Confessions (Pusey) and Calvin's Institutes (Allen, vol. 1): `corpus-000..007.json` below, unchanged.
- `fathers` - 11 works of the Church Fathers (Ante-Nicene / Nicene & Post-Nicene Fathers translations, 1885-1900): `../hw-fathers-1..3.json`.
- `summa` - 116 complete Questions of Thomas Aquinas's Summa Theologiae (1920 English Dominican translation): `../hw-summa-1..4.json`.

The Church Fathers and Summa bundles are shared with the Historic Writings reading library (`bibley-historic.js`); `../hw-index.json` is their catalog (works, credits, source URLs, section titles). In the browser each paragraph becomes one `bibley.source.v1` record (kind `historical_theology`, author, work, edition, section, source URL), with `hw_key`/`hw_sec` so an AI card can open the passage in the library. `corpus.index.json` keeps `shards` = classic only, for older app versions, and lists every collection under `groups`. `sources.json` lists every work with translator, edition and source.

All text is verbatim public-domain translation fetched from New Advent (newadvent.org/fathers, newadvent.org/summa) on 2026-11-27; nothing is summarized. New Advent omits the Summa's short question prologues, so those are not included.

Local implementation packet. Not deployed and not a tested answer-generating feature.

## What is included

- `theology-bridge.mjs`: adapter from the two-work lexical search to Bibley's frozen `bibley.source.v1` evidence contract.
- `retrieval.mjs`: existing lexical search, unchanged.
- `source-connector-v1.mjs` and contract JSON: existing frozen message framing, metadata, context budgeting and mechanical citation audit.
- `corpus.json`, `sources.json`, `source/`: existing corpus and original downloaded texts, unchanged.
- `test-bridge.mjs` and `test-results.json`: 14 local safety/integrity checks.

Run with Node: `node test-bridge.mjs`.

## Behavior

The adapter validates the source schema, rejects duplicate IDs, and explicitly migrates the older corpus kind `theology-commentary` to the frozen enum value `historical_theology`. It preserves the original corpus files.

It validates the question and actual alternating conversation history, even if search returns no matches. A missing match returns `no_lexical_evidence`, with no generation messages. An oversized question/history returns `context_limit`. When all whole source records are omitted by the budget, the adapter returns `no_evidence_fits`, with no generation messages. Only `prepared_not_generated` may advance to a model call, and that status does not mean an answer has been generated or verified.

The caller must supply an actual runtime-tokenizer `measureMessages(messages)` function that includes the deployed chat template and its special tokens, plus that runtime's context limit. The connector caps context at 4,096 and reserves 420 output tokens. Test counts are deliberately fictional branch fixtures, not real tokenizer measurements.

Matched records preserve author, work, edition, section, kind, text and source URL. The citation audit checks supplied IDs and quoted substrings only. It cannot verify whether a source supports a claim or whether the answer is trustworthy.

## Integrity result

All 2,384 record text hashes, decoded-source hashes and source slices match. The offsets are Python Unicode-codepoint coordinates into UTF-8-sig decoded text after universal-newline normalization. A JavaScript consumer must remove a leading BOM, normalize CRLF to LF and use codepoints, not UTF-16 indexes. These corpus texts pass with the explicit normalization in the test. Chunk IDs and paragraph labels are local identifiers, not original verse or paragraph numbers.

## Current application gap

Audit target: Bibley- commit `0fa3167fae29f7a616789d52dc95917905aaa077`, "Localize study reference explanations".

At that commit, `bibley-local-ai.js` still retrieves KJV references/topic hits, builds KJV messages, calls its current Qwen/Gemma runtime and returns verse chips. This bridge is not wired into that flow. A separate Library page does not make documents available to the model at answer time.

Before enabling theology answers:

1. Connect the loaded CPU/WebGPU runtime to actual prompt-token measurement, including the native chat template. Do not use the test counter.
2. Route selected theology questions through this adapter and pass its exact prepared messages to the existing model runtime. Preserve the KJV answer path rather than replacing it silently. Decide how mixed Bible/theology questions and unsupported topics should route.
3. Display theology source labels separately from Scripture chips, with author, work, edition, section and source link. Do not turn commentary into Bible quotations.
4. Test generated answers for source relevance, unsupported claims, citation correctness, source-instruction resistance, context carryover and safe abstention. Inspect real browser behavior on the supported runtimes/devices.

## Scope and limits

Only Augustine's Confessions, Pusey translation, and Calvin's Institutes, Allen translation, volume 1 of 2, are indexed. This is neither a Google-like web search nor a broad theology library. Lexical search can miss paraphrases and rank irrelevant passages. Existing same-author/same-screen probes are development checks, not an independent retrieval-quality benchmark.

The historical works contain positions and archaic language that must be attributed to their authors, not presented as all Christians' beliefs. Corpus expansion, retrieval-quality evaluation, runtime integration and generated-answer evaluation remain separate work.

The source files and metadata include the original distribution notices and rights evidence. They are preserved here; this packet makes no new blanket jurisdiction-wide licensing claim.

No model was loaded, no training or paid compute was run, and no live repository was changed while preparing this packet.
