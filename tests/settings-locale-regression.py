"""Spanish settings, unchanged stored values/content, and locale round-trip regression.
uv run --with playwright python tests/settings-locale-regression.py URL
Fresh synthetic browser storage only; never calls the account backend.
"""
import sys
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':844},service_workers='block')
    page=ctx.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_init_script("const d=new Date();localStorage.setItem('bibley_today_seen_v1',d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));localStorage.setItem('bibley_seen_version','7.1')")
    page.goto(sys.argv[1],wait_until='domcontentloaded')
    page.wait_for_function('!!window.BibleySettings && !!window.BibleyLocale')
    page.locator('.pane[data-pane=a] .verses-text span[data-verse]').first.wait_for(timeout=30000)
    scripture=page.locator('.pane[data-pane=a] .verses-text span[data-verse]').all_text_contents()
    def settings(name):
        page.evaluate('(n)=>BibleySettings.open(n)',name)
    root=page.locator('.bs-root')
    settings('language')
    root.locator('select').select_option('es')
    expect(root.locator('.bs-fl')).to_have_text('Idioma de la interfaz')
    expect(root.locator('.bs-empty')).to_contain_text('Cambia la interfaz')
    settings('home')
    search=root.get_by_placeholder('Buscar ajustes')
    search.fill('apariencia')
    expect(root.locator('.bs-hit').first).to_contain_text('Apariencia')
    root.locator('.bs-hit').first.click()
    expect(root.locator('.bs-title')).to_have_text('Apariencia')
    expect(root.locator('[data-theme=dark]')).to_have_text('Oscuro')
    expect(root.locator('.bs-fl').first).to_have_text('Tema')
    expect(root.locator('[data-v=wide]')).to_have_text('Ancho')
    root.locator('[data-v=wide]').click()
    assert page.evaluate("BibleySettings._test.S().width")=='wide'
    settings('home'); search=root.get_by_placeholder('Buscar ajustes'); search.fill('numeros')
    expect(root.locator('.bs-hit').first).to_contain_text('Números de versículo')
    search.fill('zzzz-no-match');expect(root.locator('.bs-empty')).to_contain_text('No se encontraron ajustes')
    settings('modes')
    expect(root.locator('[data-mode=night]')).to_contain_text('Noche')
    expect(root.locator('[data-edit=focus]')).to_have_attribute('aria-label','Personalizar Lectura sin distracciones')
    root.locator('[data-edit=night]').click()
    expect(root.locator('.bs-mode-hero b')).to_have_text('Modo nocturno')
    settings('reading')
    expect(root.locator('[data-v=verse]')).to_have_text('Un versículo por línea')
    root.locator('[data-v=verse]').click()
    assert page.evaluate('BibleySettings._test.S().layout')=='verse'
    expect(root.locator('.bs-pv-t')).to_contain_text('For God so loved the world')
    settings('layout')
    expect(root.get_by_text('Barra inferior',exact=True)).to_be_visible()
    expect(root.locator('[data-mv]').first).to_have_attribute('aria-label','Mover arriba')
    settings('audio')
    expect(root.locator('.bs-fl')).to_have_text('Velocidad de lectura en voz alta')
    root.locator('[data-v="1.15"]').click()
    assert page.evaluate('BibleySettings.ttsRate()')==1.15
    settings('account')
    expect(root.get_by_role('button',name='Crear cuenta',exact=True)).to_be_visible()
    expect(root.locator('label').filter(has=page.locator('input[name=username]'))).to_contain_text('Nombre de usuario')
    root.locator('input[name=username]').fill('Search')
    root.locator('input[name=password]').fill('test-only-not-a-real-password')
    page.evaluate("BibleyLocale.set('en')")
    assert root.locator('input[name=username]').input_value()=='Search'
    assert root.locator('input[name=password]').input_value()=='test-only-not-a-real-password'
    expect(root.get_by_role('button',name='Create Account',exact=True)).to_be_visible()
    # Fixed-label looking personal text remains unchanged, including existing matching selectors.
    page.evaluate("""()=>{const e=document.createElement('div');e.id='locale-boundary-test';e.innerHTML='<div class="bs-hrow"><span class="bs-t">Reading<small>Search</small></span></div><div class="bs-mline"><span class="bs-t">Close</span></div><div class="bs-title" data-locale-user>Settings</div>';document.body.append(e);BibleyLocale.set('es')}""")
    expect(page.locator('#locale-boundary-test')).to_have_text('ReadingSearchCloseSettings')
    assert page.locator('.pane[data-pane=a] .verses-text span[data-verse]').all_text_contents()==scripture
    settings('appearance');page.screenshot(path='/tmp/bibley-settings-es.png')
    page.evaluate("BibleyLocale.set('en')")
    expect(root.locator('.bs-title')).to_have_text('Appearance')
    expect(root.locator('[data-v=wide]')).to_have_text('Wide')
    # Spanish preference survives reload and keeps setting values stable.
    page.evaluate("BibleyLocale.set('es')")
    page.reload(wait_until='domcontentloaded');page.wait_for_function('!!window.BibleySettings')
    settings('reading');expect(root.locator('[data-v=verse]')).to_have_text('Un versículo por línea')
    assert page.evaluate('BibleySettings._test.S().layout')=='verse'
    assert not errors,errors
    print('PASS: Spanish settings search and captions, stable enum values, no account submission, unmodified credentials and personal/Bible text, English round-trip and Spanish reload; zero page errors')
    browser.close()
