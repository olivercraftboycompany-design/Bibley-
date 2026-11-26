# Strong’s lexicons

These Hebrew and Greek lexicons are from [Open Scriptures/strongs, 0acd2f251c2d35ff8db2dece4e0593979d3ac223](https://github.com/openscriptures/strongs/tree/0acd2f251c2d35ff8db2dece4e0593979d3ac223), derived from James Strong’s dictionaries. See the original credit notices next to the files. The data is CC BY-SA (as stated in the original file headers). The JavaScript object literals were extracted as JSON and compressed for faster download; entries were not edited. These lookup files do not identify the original word behind a particular translated verse.

## Linked verses and original-language tags

- [OpenBible.info cross-references](https://www.openbible.info/labs/cross-references/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), source TSV release dated 2026-11-23. The bundled files convert references to numeric book/chapter/verse indices, sort by source vote count, and retain the complete per-verse list (displayed 24 at a time). Berean cross-references remain available where originally bundled. Verse numbering can differ by translation; links are not editorial endorsements.
- [World English Bible USFM](https://ebible.org/engwebp/), public domain. The generated files retain publisher-supplied Strong’s tags and words-of-Jesus markers. Red-letter rendering is restricted to matching passages in the WEB version, preserving the reader’s text. Original Words pairs tagged English words or phrases with dictionary lemmas and transliterations; it is not the original-language verse in source order, nor a full interlinear.

## Study library

- Easton’s *Illustrated Bible Dictionary*, third edition (1897), public domain, extracted from the [consolidated JSON transcription](https://github.com/garydavenport73/eastons-bible-dictionary-json). Multi-sense entries are preserved; repeat definitions are removed.
- [OpenBible.info Bible Geocoding Data](https://github.com/openbibleinfo/Bible-Geocoding-Data/tree/7eb18a5ee62f27b9b93bd6689ea272d76dd23b8f), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The compact subset uses point coordinates sourced from Wikidata and Wikipedia, not OpenStreetMap geometries or images; candidates are ranked by the published association score. Map display and map attribution are provided separately by OpenStreetMap.
- [Theographic Bible Metadata](https://github.com/robertrouse/theographic-bible-metadata/tree/6108f0fda9046a1b7592596c623ac4dd1fb2a00c), Robert Rouse, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The timeline and profiles are compact extracts distributed under the same license. Events and people are joined to KJV verse references and presented with the source’s estimated dates (traditional Jones chronology for the Old Testament and Gospels, Atwood for Acts). Date years are displayed in BC/AD rather than astronomical year notation. This is one traditional chronology, not a consensus historical chronology. Where included, character descriptions come from historical Easton entries.
- Matthew Henry and Jamieson, Fausset & Brown are public-domain historical commentaries retrieved by chapter from the [Free Use Bible API](https://bible.helloao.org/docs/). Book outlines reuse the bundled public-domain Berean Standard Bible headings.

The reproducible data transforms are in [`scripts/`](../scripts/).

## Source-order Greek, Hebrew and Aramaic

Interlinear words, transliterations, English glosses and morphology are adapted from [STEPBible TAHOT and TAGNT, revision 5de0a47](https://github.com/STEPBible/STEPBible-Data/tree/5de0a47f35f0fc13dfe1430d104e5db8a4285f9c/Translators%20Amalgamated%20OT%2BNT), by STEPBible/Tyndale House under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The generator saves the main Hebrew/Aramaic rows (L/Q) and rows tagged NA28 for Greek, retains English-reference numbering and source order, and simplifies extended Strong’s codes to base Strong’s where present. Glosses are study aids, not an English translation or an alignment to the active Bible. Variant texts and additional canon books are not included.

## Deuterocanon source-edition notes

`deuterocanon-notes.json.gz` contains publisher introductions where supplied (14 book units) and 747 footnotes across 213 source chapters in 15 book units from the [World English Bible Classic, Ecumenical Edition](https://ebible.org/eng-web/). The [publisher's FAQ](https://ebible.org/eng-web/webfaq.htm) confirms that the text is dedicated to the public domain and distinguishes editions. The source archive was retrieved on 26 November 2026 from [the publisher's downloadable HTML](https://ebible.org/Scriptures/eng-web_html.zip); its computed SHA-256 is retained in the generated data for reproducibility.

The units are Tobit, Judith, Greek Esther, Greek Daniel, Wisdom, Sirach, Baruch, 1–4 Maccabees, 1–2 Esdras, Prayer of Manasses and Psalm 151. The publisher places the Letter of Jeremiah in Baruch 6 and the additions to Daniel within Greek Daniel. The unit count is not a claim about the book count of any church's canon. Greek Daniel has no publisher book introduction in this source, so none is invented. Empty chapter note lists remain visibly empty; no commentary, cross-reference or word alignment is generated to fill them.

[`build-deuterocanon-notes.py`](../scripts/build-deuterocanon-notes.py) extracts plain text, source verse labels and source-edition links, removes note marker glyphs, and preserves the publisher's note wording. Related links point to the publisher's WEB Classic pages, not to assumed positions in Bibley's selected translation. Source prose is English; interface controls support Spanish. This resource does not extend the 66-book interlinear or OpenBible cross-reference dataset, and it does not change scripture or unlock the separate Lost Books library.

## Explicit English-source word alignment

`ult-aligned/` is a derived, punctuation-free word-group view of the [ULT v92 release, 17 November 2026](https://git.door43.org/unfoldingWord/en_ult/src/tag/v92), revision `e26603a14749fc3c2c908c2aa08b4367658ccf6c`. The original work by unfoldingWord is available from [unfoldingword.org/ult](https://www.unfoldingword.org/ult). Copyright © 2026 by unfoldingWord. This derived data is distributed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); the source license is preserved in [ULT-LICENSE.md](ULT-LICENSE.md). The derived display is not an official unfoldingWord product or an endorsement.

The extractor retains explicit `zaln-s`/`zaln-e` groups, including nested many-to-many alignments, tokenized English words, original surface forms, lemmas, extended source Strong’s codes, morphology and occurrence identifiers. It preserves English group order, not original-language sentence order, and omits punctuation and notes. Codes are retained verbatim, not converted into base Strong’s numbers. The source translation's words are shown separately from the selected reader translation; no mapping to WEB, KJV, Catholic/Orthodox editions or other versions is inferred. Source chapter/verse labels (including bridges and suffixes) remain unchanged; browsing this study source never changes the reader.

This release contains 61 book files; 1–2 Chronicles, Isaiah, Jeremiah and Ezekiel are absent. The extracted view covers 25,408 source verses, not a claim of complete Bible coverage. Two malformed alignment verses (2 Samuel 23:8 and Nehemiah 2:13) are excluded rather than repaired by inference. Missing references remain unavailable. Source-edition Psalm numbering and titles can differ from the active reader. Neither deuterocanonical books nor variant original texts are added by this resource.

The reproducible [extractor](../scripts/build-ult-alignments.py) records per-file SHA-256 hashes and extraction counts in [`ult-aligned/provenance.json`](ult-aligned/provenance.json), alongside the original release manifest. Attribution and ShareAlike apply to these derived data files; they do not relicense unrelated app code or data.

### Full linked-passage coverage

The OpenBible transform now retains all 344,781 unique source-to-target suggestions across 29,364 source verses rather than truncating each verse at 24 (previously 323,813 suggestions). The interface reveals them 24 at a time in the same descending source-vote order. These remain community-voted suggestions, including low-ranked entries, not guaranteed interpretive relationships. Coverage is still the 66-book Protestant dataset; no deuterocanonical references or versification mappings are invented.


## Separate development-source supplement

The five books absent from ULT v92 are available only after choosing **Open separate ULT development source**. This loads a separately labelled development snapshot at [452a08b0aba28cbfb95eec1fe7eb1925ca246f0f, 26 November 2026](https://git.door43.org/unfoldingWord/en_ult/src/commit/452a08b0aba28cbfb95eec1fe7eb1925ca246f0f), not additional v92 release data. The 5,693 verses cover 1–2 Chronicles, Isaiah, Jeremiah and Ezekiel. No development words are inserted into v92 or the reader translation. The same strict alignment parser accepts all five books; original source codes, chapter/verse labels and many-to-many groups remain unchanged. Development material can change upstream; this snapshot is pinned and not represented as a finished release.

The derived punctuation-free groups are CC BY-SA 4.0, copyright © 2026 by unfoldingWord, with the required attribution: The original work by unfoldingWord is available from [unfoldingword.org/ult](https://www.unfoldingword.org/ult). This is not an official product or endorsement. [`ult-development/source-LICENSE.md`](ult-development/source-LICENSE.md), the original manifest, per-file computed SHA-256 hashes and exact revision accompany the data. [`build-ult-supplement.py`](../scripts/build-ult-supplement.py) reproduces it using the original parser.

The same two v92 malformed verses (2 Samuel 23:8 and Nehemiah 2:13) are still malformed in that development snapshot. They remain unavailable rather than repairing alignment markers by inference. A corrected publisher source is needed for those references. The supplement does not add deuterocanon word alignment or solve cross-edition versification.

## Deuterocanon publisher-linked passages

Study → Explore → Deuterocanon linked passages exposes the 132 exact links already supplied within the public-domain WEB Classic notes, independently of the reader. These come from 101 notes in 10 source book units: 23 notes marked by the publisher as cross-references, and 78 footnotes containing passage links. The browser labels those categories separately and preserves note context; the source introductions remain available. This is a small publisher-curated set, not complete coverage or a new algorithmic cross-reference graph. Books and chapters without links say so explicitly. Links always open the publisher's WEB Classic reference, never an inferred matching verse in another edition. The extractor now checks every target page and fragment against the same publisher archive before bundling.
