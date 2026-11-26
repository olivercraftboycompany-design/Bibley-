"""Ordered custom ranges, saved-plan resume and licensed source-note browser.
Run: uv run --with playwright python tests/plans-canon-regression.py URL
Fresh synthetic storage only. No account/microphone/model access.
"""
import gzip, json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

DATA=json.loads(gzip.decompress((Path(__file__).resolve().parents[1]/'study-data/deuterocanon-notes.json.gz').read_bytes()))
assert len(DATA['books']) == 15
assert sum(len(b['chapters']) for b in DATA['books']) == 213
assert sum(len(c['notes']) for b in DATA['books'] for c in b['chapters']) == 747
assert all(c['url'].startswith('https://ebible.org/eng-web/') for b in DATA['books'] for c in b['chapters'])
assert all(a['url'].startswith('https://ebible.org/eng-web/') for b in DATA['books'] for c in b['chapters'] for n in c['notes'] for a in n['links'])
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    for width in [390,1280]:
        context=browser.new_context(viewport={'width':width,'height':844},service_workers='block')
        page=context.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('dialog',lambda d:d.accept())
        page.add_init_script("""const d=new Date();localStorage.setItem('bibley_today_seen_v1',d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));localStorage.setItem('bibley_seen_version','7.1');""")
        page.goto(sys.argv[1],wait_until='domcontentloaded');page.wait_for_function('!!window.BibleyTools?.open')
        page.locator('.pane[data-pane=a] .verses-text span[data-verse]').first.wait_for(timeout=30000)
        sheet=page.locator('.fx-sheet.open')
        btn=lambda n:sheet.get_by_role('button',name=n,exact=True)
        op=lambda n:page.evaluate('(v)=>BibleyTools.open(v)',n)
        store=lambda:page.evaluate("JSON.parse(localStorage.getItem('bibley_plus_cplan_v1'))")
        op('plan-builder')
        sheet.get_by_label('What to read',exact=True).select_option('custom')
        expect(btn('Start this plan')).to_be_disabled()
        def add(book,first,last):
            sheet.get_by_label('Book',exact=True).select_option(str(book))
            sheet.get_by_label('First chapter',exact=True).select_option(str(first))
            sheet.get_by_label('Last chapter',exact=True).select_option(str(last))
            btn('Add range').click()
        add(42,3,4);add(18,23,23);add(42,4,5)
        expect(sheet.locator('.bp-day-list')).to_contain_text('4 chapters')
        # Reordering and overlapping ranges maintain order without duplicate chapters.
        sheet.get_by_role('button',name='Move up 2',exact=True).click()
        sheet.get_by_label('Days to finish',exact=True).fill('2')
        sheet.get_by_label('Plan name (optional)',exact=True).fill('Search <img src=x onerror=alert(1)>')
        btn('Start this plan').click()
        plan=store()['plans'][0]
        assert plan['days']==[[[18,23],[42,3]],[[42,4],[42,5]]],plan
        assert sheet.locator('img').count()==0
        sheet.locator('.bp-plan-schedule summary').click()
        expect(sheet.locator('.bp-plan-schedule').get_by_role('button',name='John 5',exact=True)).to_be_visible()
        # Any chapter of the schedule is reachable (not just the first chapter/day).
        sheet.get_by_role('button',name='John 5',exact=True).click()
        expect(page.locator('.pane-ref-btn[data-pane=a]')).to_contain_text('John 5')
        op('plans');btn('Mark day done').click();btn('End plan').click()
        assert store()['active'] is None
        sheet.locator('.bp-plan-history summary').click();btn('Resume plan').click()
        assert store()['active']==plan['id'] and store()['plans'][0]['done'].get('0')
        # Survives page reload; resume doesn't reset existing completion dates.
        page.reload(wait_until='domcontentloaded');page.wait_for_function('!!window.BibleyTools?.open');op('plans')
        expect(btn('Open reading')).to_be_visible()
        assert store()['plans'][0]['done'].get('0')
        # Invalid range input doesn't get added, empty ranges cannot start a plan.
        op('plan-builder');sheet.get_by_label('What to read',exact=True).select_option('custom')
        add(42,5,2);expect(btn('Start this plan')).to_be_disabled()
        assert page.evaluate('BibleyTools._test.rangeChapters([[42,5,2],[65,1,100],[99,1,1],[42,1,2],[42,2,3]])')==[[42,1],[42,2],[42,3]]
        # Source notes appear in Explore and never substitute for the active reader text.
        original=page.locator('.pane[data-pane=a] .verses-text').inner_text()
        sheet.get_by_role('button',name='Close',exact=True).click()
        page.evaluate('BibleyCore.openAi("explore")')
        page.get_by_role('button',name='Deuterocanon study notes',exact=True).click()
        book=sheet.get_by_label('Source book',exact=True);chapter=sheet.get_by_label('Source chapter',exact=True)
        expect(book.locator('option')).to_have_count(15)
        expect(sheet.locator('.bp-canon-content')).to_contain_text('Shalmaneser')
        expect(sheet.get_by_role('link',name='Read source chapter',exact=True)).to_have_attribute('href','https://ebible.org/eng-web/TOB01.htm')
        intro_text=sheet.locator('.bp-canon-content details p').inner_text()
        for b in DATA['books']:
            book.select_option(b['id']);expect(chapter.locator('option')).to_have_count(len(b['chapters']))
            chapter.select_option(str(b['chapters'][-1]['number']))
            expect(sheet.get_by_role('link',name='Read source chapter',exact=True)).to_have_attribute('href',b['chapters'][-1]['url'])
        book.select_option('BAR');expect(chapter.locator('option')).to_have_count(6);chapter.select_option('6')
        book.select_option('DAG');expect(chapter.locator('option')).to_have_count(14)
        assert sheet.locator('.bp-canon-content details').count()==0 # no invented introduction
        # Locale switches do not translate publisher content; reopening updates controls.
        page.evaluate("BibleyLocale.set('es')");op('deuterocanon')
        expect(sheet.get_by_label('Libro fuente',exact=True)).to_be_visible()
        assert sheet.locator('.bp-canon-content details p').inner_text()==intro_text
        page.screenshot(path=f'/tmp/bibley-canon-{width}.png')
        assert page.locator('.pane[data-pane=a] .verses-text').inner_text()==original
        page.evaluate("BibleyLocale.set('en')");op('plan-builder')
        sheet.get_by_label('What to read',exact=True).select_option('custom');add(42,3,4)
        assert sheet.locator('.bp-range-builder').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
        page.screenshot(path=f'/tmp/bibley-custom-plan-{width}.png')
        assert not errors,errors
        context.close()
    browser.close()
print('PASS: ordered/deduplicated custom ranges, invalid-range checks, full day/chapter navigation, saved-plan resume/reload, 15 WEB source units/213 chapters/747 notes, source links, Spanish controls with unchanged notes/scripture, phone/desktop layouts; zero page errors')
