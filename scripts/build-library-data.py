"""Compact public-domain Easton definitions and CC-BY place data for the Study panel."""
import gzip, json, sys
from pathlib import Path
root = Path(__file__).resolve().parents[1] / 'study-data'

def store(name, data):
    (root / f'{name}.json.gz').write_bytes(gzip.compress(json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0))

dictionary = json.loads(Path(sys.argv[1]).read_text())
store('eastons', {word: list(dict.fromkeys(v['definition'] for v in vals if isinstance(v.get('definition'), str))) for word, vals in dictionary.items()})
geo = Path(sys.argv[2])
with (geo / 'modern.jsonl').open() as f:
    modern = {v['id']: v for row in f if (v := json.loads(row)).get('coordinates_source', {}).get('type') in {'wikidata', 'wikipedia_article'} and v.get('lonlat')}
with (geo / 'ancient.jsonl').open() as f:
    places = []
    for row in f:
        place = json.loads(row)
        links = [(val, modern[key]) for key, val in place.get('modern_associations', {}).items() if key in modern and isinstance(val.get('score'), (float,int)) and val['score'] > 0]
        if not links: continue
        candidates = []
        for link, loc in sorted(links, key=lambda p:-p[0]['score'])[:5]:
            lon, lat = map(float, loc['lonlat'].split(','));
            if not (-180 <= lon <= 180 and -90 <= lat <= 90): continue
            candidates.append([link['name'],round(lat,5),round(lon,5)])
        if candidates: places.append([place['friendly_id'],place['url_slug'],[v['readable'] for v in place.get('verses',[])][:12],candidates])
    store('places', sorted(places, key=lambda x:x[0].casefold()))
print(len(dictionary), 'dictionary headwords;', len(places), 'ancient places with Wikimedia-sourced possible locations')
