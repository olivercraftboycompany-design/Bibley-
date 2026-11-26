"""Run with: uv run --with playwright python tests/section-tools-smoke.py URL"""
import re
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':390,'height':844}, timezone_id='America/Chicago')
    issues = []
    page.on('pageerror', lambda error: issues.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.add_init_script("""const d=new Date(); localStorage.setItem('bibley_today_seen_v1',d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')); localStorage.setItem('bibley_seen_version','7.1');""")
    page.set_default_timeout(8000)
    page.goto(sys.argv[1], wait_until='domcontentloaded')
    page.wait_for_function('typeof window.BibleyTools?.open === "function"')
    page.locator('.pane[data-pane=a] .verses-text span[data-verse]').first.wait_for(timeout=30000)
    sheet = page.locator('.fx-sheet.open')
    button = lambda name: sheet.get_by_role('button', name=name, exact=True)
    close = lambda: button('Close').click()
    # Actual Today and record-backed recap navigation.
    page.evaluate('''() => {
      const n = new Date(), ds = (d) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      const today=ds(n), lastMonth=ds(new Date(n.getFullYear(), n.getMonth()-1, 15));
      let book = BibleyCore.BOOKS[0][0];
      localStorage.setItem('bibley_read_v1', JSON.stringify({[book+'-1']:today,[book+'-2']:lastMonth}));
      localStorage.setItem('bibley_activity_v1',JSON.stringify([lastMonth,today]));
    }''')
    page.locator('.fx-dock button[data-a=today]').click(); button('Daily recap').click()
    expect(sheet.get_by_text('Genesis 1',exact=True)).to_be_visible()
    expect(button('Next ›')).to_be_disabled()
    button('‹ Prev').click(); expect(sheet.get_by_text('Nothing recorded for this day.',exact=False)).to_be_visible()
    button('← Back').click(); button('Monthly recap').click()
    expect(sheet.get_by_text('Genesis (1)',exact=True)).to_be_visible()
    button('‹ Prev').click(); expect(sheet.get_by_text('Genesis (1)',exact=True)).to_be_visible(); close()
    assert page.locator('.bp-overlay,.bp-fab').count() == 0
    # My Bible links to a working encrypted journal, with no plaintext stored.
    page.locator('.fx-dock button[data-a=mb]').click(); button('Reflection journal').click()
    sheet.get_by_placeholder('Choose a PIN or passphrase',exact=False).fill('demo-local-passphrase')
    sheet.get_by_placeholder('Repeat it',exact=True).fill('demo-local-passphrase')
    button('Create locked journal').click(); expect(button('Unlock')).to_be_visible(timeout=10000)
    sheet.get_by_placeholder('PIN or passphrase',exact=True).fill('demo-local-passphrase'); button('Unlock').click()
    sheet.locator('textarea').fill('test entry is private'); button('Save entry').click()
    expect(sheet.get_by_text('test entry is private')).to_be_visible()
    payload = page.evaluate("localStorage.getItem('bibley_plus_journal_v1')")
    assert 'test entry is private' not in payload and 'demo-local-passphrase' not in payload
    close(); expect(page.get_by_text('test entry is private')).to_have_count(0)
    # Note delete/restore/export path uses the actual current data hooks.
    page.evaluate('''() => { const v={key:'Genesis-1-1',bookIdx:0,chapter:1,verseNum:1,text:'Beginning',version:'bsb'}; BibleyFX.voice.setNote(v,'=CSV inert'); BibleyFX.voice.setNote(v,''); }''')
    page.locator('.fx-dock button[data-a=mb]').click(); button('Exports & trash').click()
    expect(sheet.get_by_text('Trash (1)',exact=True)).to_be_visible(); button('Restore').click()
    assert page.evaluate("JSON.parse(localStorage.getItem('bibley_notes_v1'))['Genesis-1-1'].text") == '=CSV inert'
    with page.expect_download() as download:
        sheet.get_by_role('button',name='Export CSV',exact=False).click()
    assert "'=CSV inert" in Path(download.value.path()).read_text(); close()
    # Plans and prayer links are native; a guided prayer and custom plan can be saved.
    page.locator('.fx-dock button[data-a=today]').click(); button('Prayer list').click()
    expect(sheet.get_by_text('Guided prayers',exact=True)).to_be_visible(); close()
    page.locator('.fx-dock button[data-a=plans]').click(); button('Custom & seasonal plans').click()
    expect(sheet.get_by_text('Build a custom plan',exact=False).first).to_be_visible(); close()
    # Test navigation from the Books drawer and the actual bundled full-Bible resource.
    page.locator('#openNavBtn').click(); page.get_by_role('button',name='Filters & history').click()
    sheet.locator('select').nth(0).select_option('ot'); sheet.locator('select').nth(1).select_option('0')
    sheet.get_by_placeholder('Search the whole Bible...').fill('beginning'); button('Search').click()
    expect(sheet.get_by_role('button',name='Genesis 1:1',exact=False).first).to_be_visible(timeout=30000)
    expect(sheet.get_by_text('Recent searches')).to_be_visible(); close()
    page.evaluate('BibleyCore.goTo(0,1)')
    page.locator('.pane[data-pane=a] .verses-text span[data-verse="1"]').click()
    page.get_by_role('button',name='Linked verses').click(); expect(sheet.get_by_text('beginning',exact=True).first).to_be_visible()
    expect(sheet.get_by_role('button',name='John 1:1–3')).to_be_visible(); close()
    page.evaluate('BibleyCore.openAi("explore")')
    page.get_by_role('button',name='Strong’s word study').click()
    sheet.locator('input').fill('G26'); button('Look up').click()
    expect(sheet.get_by_text('ἀγάπη',exact=True)).to_be_visible(timeout=15000)
    sheet.locator('input').fill('H1'); button('Look up').click()
    expect(sheet.get_by_text('אָב',exact=True)).to_be_visible(timeout=15000); close()
    # Compare identical passage in distinct translations, then a deliberately mismatched chapter.
    page.evaluate("document.querySelector('#compareBtn').click()")
    page.locator('.pane[data-pane=b] .verses-text span[data-verse]').first.wait_for(timeout=30000)
    page.get_by_role('button',name='Diff',exact=True).click()
    expect(page.locator('.bp-diff-badge')).to_have_text(re.compile(r'\d+% different'))
    page.evaluate("BibleyCore.goNext('b')")
    expect(page.locator('.bp-diff-badge')).to_have_text('Match chapters to compare')
    page.evaluate("document.querySelector('#compareBtn').click()")
    page.evaluate("BibleyCore.goNext('a')")
    old = page.locator('.pane-ref-btn[data-pane=a]').inner_text()
    page.locator('#bnMoreBtn').click(); page.get_by_role('menuitem',name='Back in reading history').click()
    expect(page.locator('.pane-ref-btn[data-pane=a]')).not_to_have_text(old)
    page.locator('#bnMoreBtn').click(); page.get_by_role('menuitem',name='Forward in reading history').click()
    expect(page.locator('.pane-ref-btn[data-pane=a]')).to_have_text(old)
    assert not issues, issues
    browser.close()
    print('PASS: mobile recaps, journal encryption/lock, note restore and CSV, prayer/plan entry, filtered search, bundled verse links, Strong’s lookup, comparison, and chapter history')
