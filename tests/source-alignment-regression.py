"""ULT explicit alignment groups and complete linked-list pagination.
Run: uv run --with playwright python tests/source-alignment-regression.py URL
"""
import gzip, importlib.util, json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('extract',ROOT/'scripts/build-ult-alignments.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
# Nested many-to-many and repeated source occurrence identities remain explicit.
fixture=r'\zaln-s |x-content="α" x-occurrence="1"\*\zaln-s |x-content="β" x-occurrence="2"\*\w one|x-occurrence="1"\w* \w two|x-occurrence="1"\w*\zaln-e\*\zaln-e\* \w added|x-occurrence="1"\w*'
g=mod.parse_verse(fixture)
assert g[0][0]==['one','two'] and [x[0] for x in g[0][1]]==['α','β'] and g[1]==[['added'],[]]
# A partially nested group must not transfer the inner source to later English words.
partial=mod.parse_verse(r'\zaln-s |x-content="α"\*\zaln-s |x-content="β"\*\w first|x-occurrence="1"\w*\zaln-e\* \w later|x-occurrence="1"\w*\zaln-e\*')
assert [x[0] for x in partial[0][1]]==['α','β'] and [x[0] for x in partial[1][1]]==['α']
try: mod.parse_verse(r'\zaln-e\*')
except ValueError: pass
else: raise AssertionError('Invalid grouping accepted')
files=list((ROOT/'study-data/ult-aligned').glob('*.json.gz'));assert len(files)==61
count=0
for f in files:
 d=json.loads(gzip.decompress(f.read_bytes()));count+=sum(len(c) for c in d.values())
assert count==25408
john=json.loads(gzip.decompress((ROOT/'study-data/ult-aligned/43.json.gz').read_bytes()))
assert any(g[0]==['God'] and len(g[1])==2 and [x[0] for x in g[1]]==['τὸν','Θεόν'] for g in john['1']['1'])
refs=json.loads(gzip.decompress((ROOT/'study-data/linked/43.json.gz').read_bytes()))
assert len(refs['1']['1'])>24
assert sum(len(v) for f in (ROOT/'study-data/linked').glob('*.json.gz') for c in json.loads(gzip.decompress(f.read_bytes())).values() for v in c.values())==344781
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 for width in [390,1280]:
  context=browser.new_context(viewport={'width':width,'height':844},service_workers='block');page=context.new_page();errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("""const d=new Date();localStorage.setItem('bibley_today_seen_v1',d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));localStorage.setItem('bibley_seen_version','7.1');""")
  page.goto(sys.argv[1],wait_until='domcontentloaded');page.wait_for_function('!!BibleyTools.openAlignedWords')
  page.locator('.pane[data-pane=a] [data-verse]').first.wait_for(timeout=30000)
  original=page.locator('.pane[data-pane=a] .verses-text').inner_text()
  pane=page.evaluate('JSON.stringify(BibleyCore.panes.a)')
  sheet=page.locator('.fx-sheet.open')
  page.evaluate('BibleyTools.openVerseWords(42,1,1)')
  sheet.get_by_role('button',name='Aligned English words · ULT',exact=True).click()
  groups=sheet.get_by_role('list',name='Aligned word groups')
  expect(groups.get_by_role('listitem').first).to_contain_text('In')
  expect(groups.get_by_role('listitem').first).to_contain_text('ἐν')
  expect(sheet.locator('.bp-aligned-source').filter(has_text='Θεόν').first).to_contain_text('G23160')
  sheet.get_by_label('Source chapter',exact=True).select_option('3');sheet.get_by_label('Source verse',exact=True).select_option('16')
  expect(sheet.locator('.bp-source-reference')).to_have_text('ULT v92 · John 3:16')
  assert page.evaluate('JSON.stringify(BibleyCore.panes.a)')==pane
  assert page.locator('.pane[data-pane=a] .verses-text').inner_text()==original
  assert sheet.evaluate('(el)=>el.scrollWidth<=el.clientWidth+1')
  page.screenshot(path=f'/tmp/bibley-alignment-{width}.png',full_page=False)
  sheet.get_by_role('button',name='← Back',exact=True).click()
  expect(sheet.locator('.fx-sheet-title')).to_have_text('Original words · John 1:1')
  page.evaluate('BibleyTools.openAlignedWords(0,1,1)')
  expect(sheet.get_by_role('list',name='Aligned word groups').get_by_role('listitem').first).to_contain_text('beginning')
  expect(sheet.locator('[lang=he]').first).to_be_visible()
  page.evaluate('BibleyTools.openAlignedWords(18,1,1)')
  expect(sheet.locator('.bp-source-reference')).to_have_text('ULT v92 · Psalm 1:1')
  expect(sheet.get_by_role('list',name='Aligned word groups')).to_contain_text('happinesses')
  # Absent book and excluded malformed verse never silently substitute another source/reference.
  page.evaluate('BibleyTools.openAlignedWords(12,1,1)')
  expect(sheet).to_contain_text('This book is not supplied')
  expect(sheet.get_by_role('list',name='Aligned word groups')).to_have_count(0)
  page.evaluate('BibleyTools.openAlignedWords(9,23,8)')
  expect(sheet).to_contain_text('No verified alignment is available')
  expect(sheet.get_by_label('Source verse',exact=True)).to_have_value('8')
  # Full linked list is progressively accessible, without repeating labels.
  page.evaluate('BibleyTools.openReferences(42,1,1)')
  more=sheet.get_by_role('button',name='Show more linked passages',exact=False)
  expect(more).to_be_visible()
  before=sheet.locator('.bp-chip').count()
  for _ in range(50):
   if not more.is_visible(): break
   more.click()
  else: raise AssertionError("Linked-passage pagination did not end")
  assert sheet.locator('.bp-chip').count()>before
  labels=sheet.locator('.bp-chip').all_text_contents();assert len(labels)==len(set(labels))
  page.evaluate('BibleyLocale.set("es"); BibleyTools.openAlignedWords(42,1,1)')
  expect(sheet.get_by_role('list',name='Grupos de palabras alineadas').get_by_role('listitem').first).to_contain_text('In')
  expect(sheet.get_by_label('Capítulo de la fuente',exact=True)).to_be_visible()
  expect(sheet).to_contain_text('Solo edición fuente ULT v92')
  assert not errors,errors
  context.close()
 browser.close()
print('source-alignment and full-reference regression passed on phone and desktop')
