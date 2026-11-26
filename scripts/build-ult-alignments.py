"""Extract explicit ULT v92 USFM alignment groups, never infer word mappings.
Usage: python scripts/build-ult-alignments.py /path/to/en_ult
Source: https://git.door43.org/unfoldingWord/en_ult at e26603a14749fc3c2c908c2aa08b4367658ccf6c
Derived data: CC BY-SA 4.0; retains source codes without converting extended IDs.
"""
import collections, gzip, hashlib, json, re, sys
from pathlib import Path
BOOKS = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split()
ATTR = re.compile(r'([\w-]+)="([^"]*)"')
TOKEN = re.compile(r'\\zaln-s\s+\|([^\\]*?)\\\*|\\zaln-e\\\*|\\w\s+([^|\\]*)(?:\|[^\\]*)?\\w\*')

def parse_verse(text):
    text = re.sub(r'\\(f|fe|x)\s.*?\\\1\*', '', text, flags=re.S)
    # Source editorial headings are not part of the aligned translation.
    text = re.sub(r'(?m)^\\(?:s\d*|r|sp|cl)\b[^\n]*', '', text)
    groups, stack, used, last_ids = [], [], set(), None
    for token in TOKEN.finditer(text):
        if token[1] is not None:
            a = dict(ATTR.findall(token[1])); source = [a.get('x-content',''),a.get('x-lemma',''),a.get('x-strong',''),a.get('x-morph',''),a.get('x-occurrence',''),a.get('x-occurrences','')]
            if not source[0]: raise ValueError('Missing original word')
            stack.append(source)
        elif token[2] is not None:
            if not token[2].strip(): continue
            ids=tuple(id(source) for source in stack)
            if groups and ids==last_ids:
                groups[-1][0].append(token[2])
            else:
                groups.append([[token[2]],list(stack)])
            used.update(ids); last_ids=ids
        else:
            if not stack: raise ValueError('Unbalanced alignment end')
            source=stack.pop()
            if id(source) not in used:
                groups.append([[],[source]]); last_ids=None
    if stack: raise ValueError('Unbalanced alignment start')
    # Each tokenized English word must be preserved once, including unaligned words.
    assert sum(len(g[0]) for g in groups) == len(re.findall(r'\\w\s', text))
    return groups

if __name__ == '__main__':
    source = Path(sys.argv[1]); out = Path(__file__).resolve().parents[1]/'study-data/ult-aligned'; out.mkdir(exist_ok=True)
    stats = {'books':0,'verses':0,'groups':0,'aligned_groups':0,'unavailable':[],'sha256':{},'missing_books':[]}
    for b, code in enumerate(BOOKS,1):
        paths=list(source.glob('*-'+code+'.usfm'))
        if not paths:
            stats['missing_books'].append(code); continue
        path, = paths; raw=path.read_bytes(); text=raw.decode('utf-8-sig')
        stats['sha256'][path.name]=hashlib.sha256(raw).hexdigest()
        data=collections.defaultdict(dict); ch=None
        parts=list(re.finditer(r'\\(c|v)\s+(\d+[a-z]?(?:-\d+[a-z]?)?)\b',text))
        for i,m in enumerate(parts):
            if m[1]=='c': ch=m[2];continue
            verse=m[2]; fragment=text[m.end():parts[i+1].start() if i+1<len(parts) else len(text)]
            try: groups=parse_verse(fragment)
            except (ValueError,AssertionError) as e:
                stats['unavailable'].append([code,ch,verse,str(e)]);continue
            if groups:
                data[ch][verse]=groups; stats['verses']+=1; stats['groups']+=len(groups); stats['aligned_groups']+=sum(bool(g[1]) for g in groups)
        (out/f'{b}.json.gz').write_bytes(gzip.compress(json.dumps(data,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)); stats['books']+=1
    assert stats['books']==61 and stats['missing_books']==['1CH','2CH','ISA','JER','EZK']
    (out/'provenance.json').write_text(json.dumps(stats,indent=2)+'\n')
    print({k:v for k,v in stats.items() if k!='sha256'})
