"""Extract timeline and people fields from the CC BY-SA Theographic Bible Metadata exports."""
import gzip, json, sys
from pathlib import Path
src = Path(sys.argv[1]); dest = Path(__file__).resolve().parents[1] / 'study-data'

def load(name): return json.loads((src / f'{name}.json').read_text())
verses = {row['id']:row['fields'].get('verseID') for row in load('verses')}

def refs(record): return list(dict.fromkeys(verses[key] for key in record.get('verses', []) if verses.get(key)))[:16]

def save(name, val): (dest / f'{name}.json.gz').write_bytes(gzip.compress(json.dumps(val, ensure_ascii=False, separators=(',',':')).encode(), mtime=0))
people = {}
for row in load('people'):
    f = row['fields']; name = f.get('displayTitle') or f.get('name')
    if not name: continue
    people[row['id']] = [name, f.get('surname',''), f.get('dictionaryText','').strip(), refs(f)]
events = []
for n in load('events'):
    f = n['fields']; title, date = f.get('title'), f.get('startDate')
    if title and date: events.append([f.get('sortKey',0),title,date,refs(f),[people[k][0] for k in f.get('participants',[]) if k in people]])
save('timeline', [x[1:] for x in sorted(events,key=lambda v:v[0])])
save('people', sorted(people.values(),key=lambda v:v[0].casefold()))
print(len(events), 'events;', len(people), 'people')
