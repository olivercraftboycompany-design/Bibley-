"""Regression checks for locale boundaries, printable exports and short custom plans.
Run: uv run --with playwright python tests/local-tools-regression.py URL
Only fresh, synthetic browser data is used.
"""
import sys
from datetime import datetime, timedelta
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':390,'height':844}, timezone_id='America/Chicago', service_workers='block')
    page=context.new_page(); errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('dialog',lambda d:d.accept())
    page.add_init_script("""const d=new Date();localStorage.setItem('bibley_today_seen_v1',d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));localStorage.setItem('bibley_seen_version','7.1');""")
    page.set_default_timeout(10000)
    page.goto(sys.argv[1],wait_until='domcontentloaded')
    page.wait_for_function('!!window.BibleyTools?.open')
    page.locator('.pane[data-pane=a] .verses-text span[data-verse]').first.wait_for(timeout=30000)
    sheet=page.locator('.fx-sheet.open')
    button=lambda name:sheet.get_by_role('button',name=name,exact=True)
    open_tool=lambda name:page.evaluate('(v)=>BibleyTools.open(v)',name)
    # A one-chapter book requested over thirty days never makes empty days.
    open_tool('plan-builder')
    sheet.get_by_label('What to read',exact=True).select_option('64-64') # Jude
    sheet.locator('input[type=number]').fill('30')
    expect(sheet.locator('.bp-day-list')).to_contain_text('1 chapters over 1 days')
    button('Start this plan').click()
    plan=page.evaluate("JSON.parse(localStorage.getItem('bibley_plus_cplan_v1')||'null')")
    assert len(plan['plans'][0]['days'])==1
    assert page.evaluate('BibleyTools._test.splitDays([[64,1]],30)')==[[[64,1]]]
    expect(button('Open reading')).to_be_visible(); button('Open reading').click()
    expect(page.locator('.pane-ref-btn[data-pane=a]')).to_contain_text('Jude')
    # A failed review is scheduled tomorrow, not immediately today.
    page.evaluate("localStorage.setItem('bibley_memorize_v1',JSON.stringify({v:1,verses:{'John-3-16':{ref:'John 3:16',text:'For God so loved the world'}}}))")
    open_tool('memory'); sheet.locator('.bp-menu-item').filter(has_text='Flashcard').click(); sheet.locator('.bp-flash-inner').click(); sheet.locator('.bp-grade-row button').first.click()
    srs=page.evaluate("JSON.parse(localStorage.getItem('bibley_plus_srs_v1'))")
    assert srs['cards']['John-3-16']['due']==page.evaluate("(()=>{let d=new Date();d.setDate(d.getDate()+1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})()")
    # Spanish flows keep user data and Bible text untouched, including words identical to UI labels.
    original=page.locator('.pane[data-pane=a] .verses-text').inner_text()
    page.evaluate("BibleyLocale.set('es')")
    open_tool('plan-builder');expect(button('Empezar este plan')).to_be_visible()
    open_tool('memory');expect(sheet.locator('.bp-menu-item').filter(has_text='Primeras letras')).to_be_visible();expect(sheet.get_by_text('programados',exact=True)).to_be_visible()
    open_tool('journal')
    sheet.get_by_placeholder('Elige un PIN o frase de acceso',exact=False).fill('test-private-phrase')
    sheet.get_by_placeholder('Repítelo',exact=True).fill('test-private-phrase')
    button('Crear diario protegido').click();expect(button('Desbloquear')).to_be_visible(timeout=10000)
    sheet.get_by_placeholder('PIN o frase de acceso',exact=True).fill('test-private-phrase');button('Desbloquear').click()
    sheet.locator('textarea').fill('Search <script>window.BAD=true</script> & My Bible')
    button('Guardar entrada').click();expect(button('Imprimir diario / Guardar PDF')).to_be_visible(timeout=10000)
    with context.expect_page() as created:
        button('Imprimir diario / Guardar PDF').click()
    popup=created.value
    expect(popup.locator('pre')).to_contain_text('Search <script>window.BAD=true</script> & My Bible')
    assert popup.evaluate('window.BAD') is None
    assert popup.evaluate('window.opener') is None
    assert popup.locator('script,img,iframe').count()==0
    pdf=popup.pdf(format='A4');assert pdf.startswith(b'%PDF-') and len(pdf)>1000
    popup.evaluate('window.print=()=>{window.printRequested=true}')
    popup.get_by_role('button',name='Imprimir / Guardar PDF',exact=True).click()
    assert popup.evaluate('window.printRequested') is True
    popup.close()
    page.screenshot(path='/tmp/bibley-local-tools-es.png',full_page=False)
    ciphertext=page.evaluate("localStorage.getItem('bibley_plus_journal_v1')")
    assert 'test-private-phrase' not in ciphertext and 'window.BAD' not in ciphertext
    button('Bloquear ahora').click();expect(button('Desbloquear')).to_be_visible()
    assert page.locator('.pane[data-pane=a] .verses-text').inner_text()==original
    # All retained trash entries, including the 31st and the oldest, can be recovered.
    page.evaluate("""()=>{let a=[];for(let i=0;i<40;i++)a.push({id:'test'+i,kind:'note',label:'Search',deletedAt:Date.now(),payload:{key:'bibley_notes_v1',id:'test'+i,data:{text:'Close'}}});localStorage.setItem('bibley_plus_trash_v1',JSON.stringify(a))}""")
    open_tool('tools');expect(button('Restaurar')).to_have_count(40)
    expect(sheet.locator('.tr-label').first).to_have_text('Search')
    button('Restaurar').last.click()
    assert page.evaluate("JSON.parse(localStorage.getItem('bibley_notes_v1')).test39.text")=='Close'
    # PDF study export is an explicit same-device printable view with escaped content.
    with context.expect_page() as created:
        sheet.locator('.bp-menu-item').filter(has_text='Imprimir / Guardar PDF').click()
    popup=created.value;expect(popup.locator('pre')).to_contain_text('Close');popup.close()
    # Returning to English is immediate for shell controls and future screens.
    page.evaluate("BibleyLocale.set('en')")
    open_tool('plan-builder');expect(button('Start this plan')).to_be_visible()
    open_tool('tools');expect(sheet.locator('.bp-menu-item').filter(has_text='Print / Save PDF')).to_be_visible()
    assert not errors,errors
    page.screenshot(path='/tmp/bibley-local-tools-en.png',full_page=False)
    print('PASS: short-book plans, tomorrow SRS scheduling, Spanish journal/memory/plans, unchanged private/Bible text, safe journal and study PDF previews, all 40 trash entries, English restore; zero page errors')
    browser.close()
