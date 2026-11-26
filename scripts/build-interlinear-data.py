"""Extract the six TAHOT/TAGNT TSVs: python scripts/build-interlinear-data.py DIR."""
import collections
import gzip
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'study-data' / 'interlinear'
BOOKS = 'Gen Exo Lev Num Deu Jos Jdg Rut 1Sa 2Sa 1Ki 2Ki 1Ch 2Ch Ezr Neh Est Job Psa Pro Ecc Sng Isa Jer Lam Ezk Dan Hos Jol Amo Oba Jon Mic Nam Hab Zep Hag Zec Mal Mat Mrk Luk Jhn Act Rom 1Co 2Co Gal Eph Php Col 1Th 2Th 1Ti 2Ti Tit Phm Heb Jas 1Pe 2Pe 1Jn 2Jn 3Jn Jud Rev'.split()
REF = re.compile(r'^(\w+)\.(\d+)\.(\d+)[^#]*#[^=]+=(.*)$')
books = collections.defaultdict(lambda: collections.defaultdict(lambda: collections.defaultdict(list)))
files = sorted(p for p in Path(sys.argv[1]).glob('*.txt') if p.name.startswith(('TAHOT ', 'TAGNT ')))
assert len(files) == 6, len(files)
for path in files:
    hebrew = path.name.startswith('TAHOT ')
    for line in path.open(encoding='utf-8-sig'):
        cols = line.rstrip('\n').split('\t')
        if len(cols) < 6 or not (m := REF.fullmatch(cols[0])) or m[1] not in BOOKS:
            continue
        if hebrew:
            if not m[4].startswith(('L', 'Q')):
                continue
            word, translit, gloss, tags, morph = cols[1:6]
            tags = re.findall(r'\{(H\d+)', tags) or re.findall(r'H\d+', tags)
            tags = ['H'+str(int(t[1:])) for t in tags if 0 < int(t[1:]) < 9000]
        else:
            if 'NA28' not in cols[5].split('+'):
                continue
            word, sep, translit = cols[1].rpartition(' (')
            if not sep:
                word, translit = cols[1], ''
            translit = translit.rstrip(')')
            gloss = cols[2]
            tag, _, morph = cols[3].partition('=')
            tags = ['G'+str(int(tag[1:]))] if re.fullmatch(r'G\d+', tag) else []
        if word.strip() and gloss.strip():
            books[BOOKS.index(m[1])+1][int(m[2])][int(m[3])].append([word, translit, gloss.strip(), tags, morph])
assert len(books) == 66, sorted(set(range(1,67)) - books.keys())
ROOT.mkdir(parents=True, exist_ok=True)
for book, chapters in sorted(books.items()):
    (ROOT / f'{book}.json.gz').write_bytes(gzip.compress(json.dumps(chapters, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0))
print(f'{len(books)} books, {sum(len(verses) for chapters in books.values() for verses in chapters.values()):,} source verses')
