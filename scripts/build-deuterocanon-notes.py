"""Extract WEB Classic publisher introductions/notes, without aligning other editions.
Usage: uv run --with beautifulsoup4 python scripts/build-deuterocanon-notes.py ZIP
ZIP: https://ebible.org/Scriptures/eng-web_html.zip (public domain)
"""
import gzip, hashlib, json, re, sys, zipfile
from pathlib import Path
from urllib.parse import urljoin
from bs4 import BeautifulSoup

BASE = 'https://ebible.org/eng-web/'
CODES = 'TOB JDT ESG DAG WIS SIR BAR 1MA 2MA 1ES MAN PS2 3MA 2ES 4MA'.split()
root = Path(__file__).resolve().parents[1]
archive = Path(sys.argv[1])
books = []
with zipfile.ZipFile(archive) as z:
    names = {Path(n).name: n for n in z.namelist()}
    index = BeautifulSoup(z.read(names['index.htm']).decode('utf-8-sig'), 'html.parser')
    for code in CODES:
        first = code + '01.htm'
        title = index.find('a', href=first).get_text(' ', strip=True)
        chapters, intro = [], []
        pages = sorted((n for n in names if re.fullmatch(code + r'\d+\.htm', n) and int(n[3:-4]) > 0), key=lambda n: int(n[3:-4]))
        for name in pages:
            soup = BeautifulSoup(z.read(names[name]).decode('utf-8-sig'), 'html.parser')
            if not intro:
                intro = [p.get_text(' ', strip=True) for p in soup.select('.ip')]
            notes = []
            for p in soup.select('.footnote p.f, .footnote p.x'):
                ref = p.select_one('.notebackref')
                if not ref: continue
                match = re.fullmatch(r'(\d+):(\d+[a-z]?(?:[-–]\d+)?)', ref.get_text(strip=True))
                if not match and ref.get_text(strip=True) != '^': raise ValueError((code, name, ref.get_text()))
                links = [{'label': a.get_text(' ', strip=True), 'url': urljoin(BASE + name, a['href'])} for a in p.select('a[href]') if a is not ref and not a['href'].startswith('#')]
                for el in p.select('.notemark, .notebackref'): el.decompose()
                text = p.get_text(' ', strip=True)
                if text: notes.append({'verse': match[2] if match else None, 'text': text, 'links': links})
            chapters.append({'number': int(name[3:-4]), 'notes': notes, 'url': BASE + name})
        assert chapters, code
        books.append({'id': code, 'title': title, 'intro': intro, 'chapters': chapters})
result = {'source': 'World English Bible Classic — Ecumenical Edition', 'url': BASE, 'license': 'Public domain', 'archive_sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'books': books}
out = root / 'study-data/deuterocanon-notes.json.gz'
out.write_bytes(gzip.compress(json.dumps(result, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0))
print(len(books), 'books;', sum(len(b['chapters']) for b in books), 'chapters;', sum(len(c['notes']) for b in books for c in b['chapters']), 'notes;', out.stat().st_size, 'bytes')
