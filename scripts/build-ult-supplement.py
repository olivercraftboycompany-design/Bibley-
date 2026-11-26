"""Extract five books missing from v92, from a separately labelled development snapshot.
Usage: python scripts/build-ult-supplement.py /path/to/pinned/source
Fetch files from https://git.door43.org/unfoldingWord/en_ult/raw/commit/REV/FILENAME
Never repair malformed groups or merge development words into v92.
"""
import collections, gzip, hashlib, importlib.util, json, re, sys
from pathlib import Path
REV='452a08b0aba28cbfb95eec1fe7eb1925ca246f0f'
EXPECTED_SHA256={'13-1CH.usfm': 'fb397467389d9f6c0901ce98c5c455a67d524a89b02cfdb4e187d39ec093ee8d', '14-2CH.usfm': '20418e823603c1d7e8112dfb722149dce955ecbae8f62fc48dbf730eddb0c179', '23-ISA.usfm': '7e283eeb341e4c1b76e55c7a70571062da878a9fbe31af84c86bce1dd76eac5c', '24-JER.usfm': '5480178af3125755d583270c74d4b40559b4f66ae93259b436b39dbe397642ea', '26-EZK.usfm': '35bebbdf313673bee5fe1a186d6c5099eddb8b8130f25259330bfcfe3cc506f8', 'LICENSE.md': '34370c3e4a41234b80e0f420ae07dfc8f6bd2c2998a4777213a1a6d66552be4a', 'manifest.yaml': '26903545d30bd936a1280e298de1ecf0b14160b81423d7c5379e0c3564fbf335'}
CHECK_UNAVAILABLE=[('10-2SA.usfm', '23', '8', '0b4f378a4b402424e90d83f89adae7936b3ee3dac0ac7d96f2d261d120f6c34e'), ('16-NEH.usfm', '2', '13', '7ddd87ed7f9e7fc2942f8b311f35d8b2a5be57e5f7d3250356313573d5cf5441')]
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('extract',ROOT/'scripts/build-ult-alignments.py')
extract=importlib.util.module_from_spec(spec);spec.loader.exec_module(extract)
source=Path(sys.argv[1]);out=ROOT/'study-data/ult-development';out.mkdir(exist_ok=True)
stats={'revision':REV,'source':'https://git.door43.org/unfoldingWord/en_ult/src/commit/'+REV,'edition':'ULT development snapshot, 26 November 2026','license':'CC BY-SA 4.0','books':0,'verses':0,'sha256':{},'unavailable':[]}
for b,code in enumerate(extract.BOOKS,1):
 if code not in ['1CH','2CH','ISA','JER','EZK']:continue
 path,=source.glob('*-'+code+'.usfm');raw=path.read_bytes();text=raw.decode('utf-8-sig');stats['sha256'][path.name]=hashlib.sha256(raw).hexdigest();assert stats['sha256'][path.name]==EXPECTED_SHA256[path.name], path.name
 data=collections.defaultdict(dict);ch=None
 parts=list(re.finditer(r'\\(c|v)\s+(\d+[a-z]?(?:-\d+[a-z]?)?)\b',text))
 for i,m in enumerate(parts):
  if m[1]=='c':ch=m[2];continue
  fragment=text[m.end():parts[i+1].start() if i+1<len(parts) else len(text)]
  try:groups=extract.parse_verse(fragment)
  except (ValueError,AssertionError) as e:stats['unavailable'].append([code,ch,m[2],str(e)]);continue
  if groups and any(g[1] for g in groups):data[ch][m[2]]=groups;stats['verses']+=1
 (out/f'{b}.json.gz').write_bytes(gzip.compress(json.dumps(data,ensure_ascii=False,separators=(',',':')).encode(),mtime=0));stats['books']+=1
# Preserve reproducible evidence for the two checked but still malformed references.
stats['checked_unavailable']=[]
for filename,chapter,verse,expected in CHECK_UNAVAILABLE:
 raw=(source/filename).read_bytes();assert hashlib.sha256(raw).hexdigest()==expected, filename
 text=raw.decode('utf-8-sig');current=None;parts=list(re.finditer(r'\\(c|v)\s+(\d+[a-z]?(?:-\d+[a-z]?)?)\b',text));found=False
 for i,m in enumerate(parts):
  if m[1]=='c':current=m[2];continue
  if (current,m[2])!=(chapter,verse):continue
  found=True;fragment=text[m.end():parts[i+1].start() if i+1<len(parts) else len(text)]
  try:extract.parse_verse(fragment)
  except (ValueError,AssertionError) as e:stats['checked_unavailable'].append({'file':filename,'chapter':chapter,'verse':verse,'reason':str(e),'sha256':expected})
  else:raise AssertionError('Source now parses; review it before changing coverage')
 assert found, (filename,chapter,verse)
for name in ['LICENSE.md','manifest.yaml']:
 raw=(source/name).read_bytes();stats['sha256'][name]=hashlib.sha256(raw).hexdigest();assert stats['sha256'][name]==EXPECTED_SHA256[name], name
 (out/('source-'+name)).write_bytes(raw)
assert stats['books']==5 and stats['verses']==5693 and not stats['unavailable']
(out/'provenance.json').write_text(json.dumps(stats,indent=2)+'\n');print(stats)
