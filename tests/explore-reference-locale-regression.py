"""Spanish labels and source-content boundaries in Explore reference tools.
Run: uv run --with playwright python tests/explore-reference-locale-regression.py URL
"""
import sys
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    for width in (390,1280):
        ctx=browser.new_context(viewport={'width':width,'height':900},service_workers='block')
        page=ctx.new_page(); errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.add_init_script("""const d=new Date();localStorage.setItem('bibley_today_seen_v1',`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);localStorage.setItem('bibley_seen_version','7.1');localStorage.setItem('bibley_ui_locale_v1','es');""")
        page.route('https://bible.helloao.org/api/c/**',lambda route: route.fulfill(status=200,content_type='application/json',body='''{"book":{"introduction":"Source book introduction"},"chapter":{"introduction":"Source chapter introduction","content":[{"number":1,"content":["Source commentary sentence."]}]}}'''))
        page.goto(sys.argv[1],wait_until='domcontentloaded')
        page.wait_for_function('!!window.BibleyTools && !!window.BibleyLocale && !!window.BibleyCore')
        page.locator('.pane[data-pane=a] .verses-text span[data-verse]').first.wait_for(timeout=30000)
        page.evaluate("BibleyTools.open('dictionary')")
        expect(page.locator('.bp-content')).to_contain_text('Easton’s Illustrated Bible Dictionary, tercera edición (1897), de dominio público.')
        page.evaluate("BibleyTools.open('commentary')")
        expect(page.locator('.bp-content')).to_contain_text('Encabezados: Berean Standard Bible.')
        expect(page.locator('.bp-content')).to_contain_text('Cargando comentario de Matthew Henry…')
        expect(page.locator('.bp-content')).to_contain_text('Introducción del libro')
        expect(page.locator('.bp-content')).to_contain_text('Introducción del capítulo')
        expect(page.locator('.bp-content')).to_contain_text('Versículo 1')
        expect(page.locator('.bp-content')).to_contain_text('Source commentary sentence.')
        assert 'Source book introduction' in page.locator('.bp-content').text_content()
        page.evaluate("BibleyTools.open('maps')")
        expect(page.locator('.bp-content')).to_contain_text('Ubicaciones posibles de OpenBible.info')
        page.locator('.bp-content input').fill('Jerusalem')
        page.locator('.bp-content button',has_text='Jerusalem').first.click()
        expect(page.locator('.bp-content')).to_contain_text('Aparece en')
        assert page.locator('.bp-content button').filter(has_text='Mapa:').count() > 0
        page.evaluate("BibleyLocale.set('en')")
        assert not errors,errors
        ctx.close()
    browser.close()
print('Explore reference Spanish labels and source-content boundaries passed (phone + desktop)')
