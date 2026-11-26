"""Help/privacy/account localization with synthetic state and no account requests.
uv run --with playwright python tests/help-locale-regression.py URL
"""
import sys
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':844},service_workers='block')
    page=ctx.new_page();errors=[];account_requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_init_script("const d=new Date();localStorage.setItem('bibley_today_seen_v1',d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));localStorage.setItem('bibley_seen_version','7.1')")
    page.route('**/api/**',lambda route:(account_requests.append(route.request.url),route.abort()))
    page.goto(sys.argv[1],wait_until='domcontentloaded')
    page.wait_for_function('!!window.BibleySettings && !!window.BibleyLocale')
    page.locator('.pane[data-pane=a] .verses-text span[data-verse]').first.wait_for(timeout=30000)
    scripture=page.locator('.pane[data-pane=a] .verses-text span[data-verse]').all_text_contents()
    root=page.locator('.bs-root')
    def settings(name):page.evaluate('(n)=>BibleySettings.open(n)',name)
    settings('tips');expect(root.locator('.bs-tip')).to_have_count(35)
    english=root.locator('.bs-tip p').all_text_contents()
    page.evaluate("BibleyLocale.set('es')")
    expect(root.locator('.bs-tcount')).to_have_text('35 consejos')
    spanish=root.locator('.bs-tip p').all_text_contents()
    assert len(spanish)==35 and all(a!=b for a,b in zip(english,spanish))
    expect(root.locator('.bs-tchip[data-cat=acct]')).to_have_text('Cuentas y sincronización')
    search=root.get_by_placeholder('Buscar consejos y funciones')
    search.fill('comparar traducciones')
    expect(root.locator('.bs-tip')).to_have_count(1)
    expect(root.locator('.bs-tip')).to_contain_text('letras rojas')
    expect(root.locator('.bs-tip-go')).to_have_text('Abrir Lectura')
    search.fill('sincronizacion')
    assert root.locator('.bs-tip').count()>0
    search.fill('zzzz-no-result');expect(root.locator('.bs-empty')).to_contain_text('No hay consejos que coincidan')
    root.get_by_role('button',name='Borrar búsqueda',exact=True).click()
    root.locator('[data-cat=acct]').click();expect(root.locator('.bs-tip')).to_have_count(3)
    settings('privacy')
    expect(root.locator('.bs-prose p')).to_have_count(6)
    expect(root.locator('.bs-prose')).to_contain_text('no están cifradas')
    expect(root.locator('.bs-prose')).to_contain_text('IA en la nube envía ese contexto al servicio')
    # Mock only in-memory account UI; do not register, sign in or change live data.
    page.evaluate("""()=>{
      window.__syncState={signedIn:true,user:{username:'Reading',display_name:'Search'},state:'ok',auto:true,keys:12,lastSync:Date.now()};
      window.__syncListeners=[];
      BibleySync.status=()=>({...__syncState});
      BibleySync.on=f=>{__syncListeners.push(f);return()=>{}};
      BibleySync.me=()=>Promise.resolve();
      window.__paintSync=patch=>{Object.assign(__syncState,patch);__syncListeners.forEach(f=>f({...__syncState}))};
    }""")
    settings('account')
    expect(root.locator('[data-locale-user]')).to_have_text('Search@Reading')
    expect(root.locator('.acct-st')).to_contain_text('12 elementos sincronizados')
    expect(root.locator('.acct-st')).to_contain_text('ahora mismo')
    expect(root.get_by_role('button',name='Sincronizar ahora',exact=True)).to_be_visible()
    page.evaluate("__paintSync({state:'offline'})")
    expect(root.locator('.acct-st')).to_have_text('Sin conexión · se sincronizará al volver a conectarte')
    page.evaluate("__paintSync({state:'syncing'})")
    expect(root.locator('.acct-st')).to_have_text('Sincronizando…')
    expect(root.locator('.bs-acb')).to_have_text('Sincronizando…')
    page.evaluate("__paintSync({state:'error',error:'<test> Search & Reading'})")
    expect(root.locator('.acct-st')).to_have_text('No se pudo sincronizar: <test> Search & Reading')
    assert root.locator('.acct-st test').count()==0
    root.locator('[data-act=pw]').click()
    expect(root.locator('label').filter(has=page.locator('input[name=cur]'))).to_contain_text('Contraseña actual')
    root.locator('input[name=cur]').fill('test-only-not-a-real-password')
    page.evaluate("BibleyLocale.set('en')")
    assert root.locator('input[name=cur]').input_value()=='test-only-not-a-real-password'
    root.locator('input[name=cur]').blur()
    settings('privacy');expect(root.locator('.bs-prose')).to_contain_text('exports are not encrypted')
    settings('tips');expect(root.locator('.bs-tchip[data-cat=acct]')).to_have_text('Accounts & Sync')
    page.evaluate("BibleyLocale.set('es')")
    settings('account');expect(root.locator('[data-locale-user]')).to_have_text('Search@Reading')
    assert page.locator('.pane[data-pane=a] .verses-text span[data-verse]').all_text_contents()==scripture
    assert not account_requests,account_requests
    assert not errors,errors
    settings('privacy');page.screenshot(path='/tmp/bibley-privacy-es.png')
    print('PASS: all 35 help articles translated, Spanish/accent-insensitive tips search and categories, six privacy blocks, sync status updates, escaped errors, unchanged account identity/password/scripture, locale round-trip, zero account requests/page errors')
    browser.close()
