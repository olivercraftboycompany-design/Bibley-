# Strong’s lexicons

These Hebrew and Greek lexicons are from [Open Scriptures/strongs, 0acd2f251c2d35ff8db2dece4e0593979d3ac223](https://github.com/openscriptures/strongs/tree/0acd2f251c2d35ff8db2dece4e0593979d3ac223), derived from James Strong’s dictionaries. See the original credit notices next to the files. The data is CC BY-SA (as stated in the original file headers). The JavaScript object literals were extracted as JSON and compressed for faster download; entries were not edited. These lookup files do not identify the original word behind a particular translated verse.

## Linked verses and original-language tags

- [OpenBible.info cross-references](https://www.openbible.info/labs/cross-references/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), source TSV release dated 2026-11-23. The bundled files convert references to numeric book/chapter/verse indices, sort by source vote count, and retain up to 24 per source verse. Berean cross-references remain available where originally bundled. Verse numbering can differ by translation; links are not editorial endorsements.
- [World English Bible USFM](https://ebible.org/engwebp/), public domain. The generated files retain publisher-supplied Strong’s tags and words-of-Jesus markers. Red-letter rendering is restricted to matching passages in the WEB version, preserving the reader’s text. Original Words pairs tagged English words or phrases with dictionary lemmas and transliterations; it is not the original-language verse in source order, nor a full interlinear.

## Study library

- Easton’s *Illustrated Bible Dictionary*, third edition (1897), public domain, extracted from the [consolidated JSON transcription](https://github.com/garydavenport73/eastons-bible-dictionary-json). Multi-sense entries are preserved; repeat definitions are removed.
- [OpenBible.info Bible Geocoding Data](https://github.com/openbibleinfo/Bible-Geocoding-Data/tree/7eb18a5ee62f27b9b93bd6689ea272d76dd23b8f), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The compact subset uses point coordinates sourced from Wikidata and Wikipedia, not OpenStreetMap geometries or images; candidates are ranked by the published association score. Map display and map attribution are provided separately by OpenStreetMap.
- [Theographic Bible Metadata](https://github.com/robertrouse/theographic-bible-metadata/tree/6108f0fda9046a1b7592596c623ac4dd1fb2a00c), Robert Rouse, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The timeline and profiles are compact extracts distributed under the same license. Events and people are joined to KJV verse references and presented with the source’s estimated dates (traditional Jones chronology for the Old Testament and Gospels, Atwood for Acts). Date years are displayed in BC/AD rather than astronomical year notation. This is one traditional chronology, not a consensus historical chronology. Where included, character descriptions come from historical Easton entries.
- Matthew Henry and Jamieson, Fausset & Brown are public-domain historical commentaries retrieved by chapter from the [Free Use Bible API](https://bible.helloao.org/docs/). Book outlines reuse the bundled public-domain Berean Standard Bible headings.

The reproducible data transforms are in [`scripts/`](../scripts/).
