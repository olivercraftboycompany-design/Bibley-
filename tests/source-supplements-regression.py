"""Separate ULT development source and exact publisher-linked deuterocanon passages.
Run: uv run --with playwright python tests/source-supplements-regression.py URL
"""
import gzip,json,sys
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
def data(path): return json.loads(gzip.decompress((ROOT/path).read_bytes()))
files=list((ROOT/'study-data/ult-development').glob('*.json.gz'))
assert len(files)==5
assert sum(len(c) for f in files for c in data(f.relative_to(ROOT)).values())==5693
notes=data('study-data/deuterocanon-notes.json.gz')
links=[a for b in notes['books'] for c in b['chapters'] for n in c['notes'] for a in n['links']]
assert len(links)==132
assert all(a['url'].startswith('https://ebible.org/eng-web/') for a in links)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 for width in [390,1280]:
  ctx=browser.new_context(viewport={'width':width,'height':844},service_workers='block');page=ctx.new_page();errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("const d=new Date();localStorage.setItem('bibley_today_seen_v1',d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));localStorage.setItem('bibley_seen_version','7.1');")
  page.goto(sys.argv[1],wait_until='domcontentloaded');page.wait_for_function('!!window.BibleyTools?.openAlignedWords')
  reader=page.locator('.pane[data-pane=a] .verses-text');reader.locator('[data-verse]').first.wait_for(timeout=30000)
  original=reader.inner_text();pane=page.evaluate('JSON.stringify(BibleyCore.panes.a)');sheet=page.locator('.fx-sheet.open')
  for b in [12,13,22,23,25]:
   page.evaluate('(b)=>BibleyTools.openAlignedWords(b,1,1)',b)
   expect(sheet).to_contain_text('This book is not supplied')
   expect(sheet.get_by_role('list',name='Aligned word groups')).to_have_count(0)
   sheet.get_by_role('button',name='Open separate ULT development source',exact=True).click()
   expect(sheet.get_by_role('list',name='Aligned word groups').get_by_role('listitem').first).to_be_visible()
   expect(sheet).to_contain_text('Not the v92 release')
   expect(sheet.locator('.bp-source-reference')).to_contain_text('ULT development 452a08b')
   expect(sheet.get_by_role('link',name='The original work by unfoldingWord is available here')).to_have_attribute('href','https://git.door43.org/unfoldingWord/en_ult/src/commit/452a08b0aba28cbfb95eec1fe7eb1925ca246f0f')
   d=data(f'study-data/ult-development/{b+1}.json.gz');c=list(d)[-1];v=list(d[c])[-1]
   sheet.get_by_label('Source chapter',exact=True).select_option(c);sheet.get_by_label('Source verse',exact=True).select_option(v)
   expect(sheet.get_by_role('list',name='Aligned word groups')).to_have_count(1)
  assert sheet.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
  page.screenshot(path=f'/tmp/bibley-development-{width}.png')
  for b,c,v in [(9,23,8),(15,2,13)]:
   page.evaluate('([b,c,v])=>BibleyTools.openAlignedWords(b,c,v)',[b,c,v]);expect(sheet).to_contain_text('No verified alignment is available')
   expect(sheet.get_by_role('list',name='Aligned word groups')).to_have_count(0)
  page.evaluate('BibleyFX.ui.closeSheet();BibleyCore.openAi("explore")')
  page.get_by_role('button',name='Deuterocanon linked passages',exact=True).click()
  expect(sheet.get_by_label('Source book',exact=True)).to_be_visible()
  expect(sheet).to_contain_text('not a complete reference network')
  # Check every source chapter's rendered link list against the bundled publisher extraction.
  actual=page.evaluate('''()=>{
   const root=document.querySelector('.fx-sheet.open'),[book,ch]=root.querySelectorAll('select');const all=[];
   for(const option of book.options){book.value=option.value;book.dispatchEvent(new Event('change'));
    for(const c of [...ch.options]){ch.value=c.value;ch.dispatchEvent(new Event('change'));all.push([book.value,+ch.value,[...root.querySelectorAll('.bp-canon-content .bp-chips a')].map(a=>({label:a.textContent,url:a.href}))]);}}
   return all;
  }''')
  expected=[[b['id'],c['number'],[a for n in c['notes'] for a in n['links']]] for b in notes['books'] for c in b['chapters']]
  assert actual==expected
  sheet.get_by_label('Source book',exact=True).select_option('TOB');sheet.get_by_label('Source chapter',exact=True).select_option('2')
  expect(sheet).to_contain_text('Publisher cross-reference')
  expect(sheet.get_by_role('link',name='Amos 8:10',exact=True)).to_have_attribute('href','https://ebible.org/eng-web/AMO08.htm#V10')
  sheet.get_by_label('Source chapter',exact=True).select_option('1');expect(sheet).to_contain_text('Link within publisher footnote')
  page.screenshot(path=f'/tmp/bibley-publisher-links-{width}.png')
  sheet.get_by_label('Source book',exact=True).select_option('MAN');expect(sheet).to_contain_text('No publisher-linked passages')
  assert page.evaluate('JSON.stringify(BibleyCore.panes.a)')==pane and reader.inner_text()==original
  page.evaluate('BibleyLocale.set("es");BibleyTools.openAlignedWords(22,1,1)')
  sheet.get_by_role('button',name='Abrir la fuente de desarrollo ULT por separado',exact=True).click()
  expect(sheet).to_contain_text('No es la edición v92')
  page.evaluate('BibleyTools.open("deuterorefs")');expect(sheet.get_by_label('Libro fuente',exact=True)).to_be_visible()
  expect(sheet).to_contain_text('Enlace dentro de una nota del editor')
  assert not errors,errors
  ctx.close()
 browser.close()
print('PASS: separate five-book development source (5693 verses), malformed-verse exclusion, 132 exact publisher links across all 213 source chapters, source context/categories, unchanged reader, Spanish, phone/desktop')
