"""Generate Bibley study data from OpenBible.info TSV and eBible WEB USFM ZIP files."""
import collections, gzip, json, re, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OSIS = 'Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev'.split()
USFM = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split()

def store(folder, book, value):
    path = ROOT / 'study-data' / folder
    path.mkdir(parents=True, exist_ok=True)
    (path / f'{book}.json.gz').write_bytes(gzip.compress(json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0))

def parse_ref(text):
    book, ch, verse = text.split('.')
    return [OSIS.index(book) + 1, int(ch), int(verse)]

xref = collections.defaultdict(list)
with zipfile.ZipFile(sys.argv[1]) as archive:
    for row in archive.read('cross_references.txt').decode('utf-8-sig').splitlines()[1:]:
        a, b, votes = row.split('\t')[:3]
        start, *end = b.split('-')
        dest = parse_ref(start)
        if end:
            last = parse_ref(end[0]);
            if last[0] != dest[0]: continue
            dest += last[1:]
        xref[tuple(parse_ref(a))].append((int(votes), dest))
refs = collections.defaultdict(lambda: collections.defaultdict(dict))
for (book, ch, v), linked in sorted(xref.items()):
    ordered = sorted(linked, key=lambda x: (-x[0], x[1]))
    refs[book][ch][v] = list(dict.fromkeys(tuple(r) for _, r in ordered))[:24]
assert len(refs) == 66
for book, data in refs.items(): store('linked', book, data)

chapter_or_verse = re.compile(r'(?m)^\\([cv])\s+(\d+)(?:[-a-z\d]*)\s*')
markers = re.compile(r'\\\+?w (.*?)\\\+?w\*|\\\+?wj(\*)?\s*', re.S)
with zipfile.ZipFile(sys.argv[2]) as archive:
    for book, code in enumerate(USFM, 1):
        name, = [p for p in archive.namelist() if p.endswith(f'-{code}engwebp.usfm')]
        text = archive.read(name).decode('utf-8-sig')
        text = re.sub(r'\\(?:f|x|fe) .*?\\(?:f|x|fe)\*', '', text, flags=re.S)
        chunks = list(chapter_or_verse.finditer(text))
        data = collections.defaultdict(dict)
        ch = 0
        red = False
        for i, match in enumerate(chunks):
            number = int(match[2]); verse = text[match.end():chunks[i+1].start() if i+1 < len(chunks) else len(text)]
            if match[1] == 'c':
                ch = number
                red = False
                continue
            words, speech = [], []
            at = 0
            def add_speech(raw):
                # Remove line-level headings, then strip inline markup.
                raw = re.sub(r'(?m)^\\(?:s\d*|r|d|cl|sp)\b[^\n]*', '', raw)
                speech.append(re.sub(r'\\\+?[a-z]+\d*\*?\s*', '', raw))
            for m in markers.finditer(verse):
                if red: add_speech(verse[at:m.start()])
                at = m.end()
                if m[1] is None:
                    red = not m[2]
                    if not red: speech.append(' | ')
                    continue
                word, _, attr = m[1].partition('|')
                codes = list(dict.fromkeys(a+str(int(b)) for a,b in re.findall(r'([HG])0*(\d+)', attr)))
                if codes: words.append([word, codes])
                if red: speech.append(word)
            if red: add_speech(verse[at:])
            speech = [' '.join(s.split()) for s in ''.join(speech).split(' | ') if re.search(r'\w', s)]
            if words or speech: data[ch][number] = [words, speech]
        assert data, code
        store('web-words', book, data)
print(f'{len(xref):,} source verses; {len(refs)} cross-reference books; {len(USFM)} WEB tagged books')
