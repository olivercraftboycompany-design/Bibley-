"""Search scope, pagination, failures and translation-correct jumps on phone/desktop.
Run: uv run --with playwright python tests/edition-search-regression.py URL [--real]
--real additionally checks one actual bolls.life search in Chromium.
"""
import re
import sys
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright, expect

base = sys.argv[1]
with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox'])
    for width in (390, 1280):
        context = browser.new_context(viewport={'width': width, 'height': 844}, service_workers='block')
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.add_init_script('''(() => { const d = new Date(); localStorage.setItem('bibley_today_seen_v1', `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`); localStorage.setItem('bibley_seen_version', '7.1'); localStorage.setItem('bible_version_a_v1', 'web'); })()''')
        captured = []
        def mock(route):
            parsed = urlparse(route.request.url)
            query = parse_qs(parsed.query)
            captured.append((parsed.path, query))
            def row(verse, book=43, chapter=11):
                return dict(translation='NKJV', book=book, chapter=chapter, verse=verse, text='<mark>Jesus</mark> <i>wept</i>.')
            if query['search'] == ['Service error']:
                route.fulfill(status=503)
            elif query['page'] == ['1']:
                rows = [row(v) for v in range(1, 29)] + [row(1, 67), row(1, 43, 99)]
                route.fulfill(json={'results': rows, 'total': 31})
            else:
                route.fulfill(json={'results': [row(28), row(35)], 'total': 31})
        page.route('https://bolls.life/v2/find/**', mock)
        page.route('https://bolls.life/get-text/NKJV/43/11/', lambda route: route.fulfill(json=[{'verse': 35, 'text': 'Jesus wept.'}]))
        page.goto(base, wait_until='domcontentloaded')
        page.wait_for_function('!!window.BibleyTools?.open')
        page.evaluate('BibleyTools.open("search")')
        sheet = page.locator('.bp-content')
        ver = sheet.get_by_label('Translation filter')
        scope = sheet.get_by_label('Testament filter')
        book = sheet.get_by_label('Book filter')
        inp = sheet.locator('input')
        expect(ver).to_have_value('web')
        ver.select_option('nkjv')
        expect(sheet.locator('.bp-search-source')).to_contain_text('sends your query to bolls.life')
        scope.select_option('nt')
        expect(book.locator('option[value="0"]')).to_have_count(0)
        book.select_option('42')
        inp.fill('Jesus wept'); inp.press('Enter')
        expect(sheet.locator('.bp-vrow')).to_have_count(28)
        assert captured[-1] == ('/v2/find/NKJV', {'search': ['Jesus wept'], 'match_whole': ['true'], 'page': ['1'], 'limit': ['30'], 'book': ['43']})
        expect(sheet.locator('.bp-vrow mark').first).to_have_text('Jesus wept')
        sheet.get_by_role('button', name='Load more results').click()
        expect(sheet.locator('.bp-vrow')).to_have_count(29)
        expect(sheet.get_by_role('button', name='Load more results')).to_have_count(0)
        expect(sheet.locator('.bp-vrow').last).to_contain_text('John 11:35')
        sheet.locator('.bp-vrow').last.click()
        page.wait_for_function('BibleyCore.panes.a.version === "nkjv" && BibleyCore.panes.a.bookIdx === 42 && BibleyCore.panes.a.chapter === 11')
        expect(page.locator('.pane[data-pane=a] .verses-text [data-verse="35"]')).to_contain_text('Jesus wept.')
        page.evaluate('BibleyTools.open("search")')
        expect(ver).to_have_value('nkjv')
        inp.fill('Service error'); inp.press('Enter')
        expect(sheet.get_by_text('Online search is unavailable.', exact=False)).to_be_visible()
        ver.select_option('kjv')
        expect(sheet.get_by_text('Online search is unavailable.', exact=False)).to_have_count(0)
        scope.select_option('nt'); book.select_option('42')
        input_before = len(captured)
        inp.fill('Jesus wept'); inp.press('Enter')
        expect(sheet.locator('.bp-vrow').first).to_contain_text('John 11:35', timeout=30000)
        assert len(captured) == input_before
        sheet.locator('.bp-vrow').first.click()
        page.wait_for_function('BibleyCore.panes.a.version === "kjv"')
        assert not errors, errors
        context.close()
    if '--real' in sys.argv:
        context = browser.new_context(service_workers='block')
        page = context.new_page()
        page.goto(base, wait_until='domcontentloaded')
        page.wait_for_function('!!window.BibleyTools?.open')
        result = page.evaluate('BibleyCore.searchBollsVerses("nkjv", "Jesus wept", 43, 1, 30)')
        assert any(row['b'] == 42 and row['c'] == 11 and row['v'] == 35 for row in result['rows']), result
        context.close()
    browser.close()
print('PASS: phone and desktop edition filters, paging, translation-correct jumps, error recovery, and bundled search' + ('; real online search' if '--real' in sys.argv else ''))
