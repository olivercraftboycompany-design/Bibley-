"""Notebook controls localization and user/Scripture data boundaries.
uv run --with playwright python tests/notebook-locale-regression.py URL
"""
import sys
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    for width in [390,1280]:
        ctx=browser.new_context(viewport={'width':width,'height':900},service_workers='block')
        page=ctx.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.add_init_script("""const d=new Date();localStorage.setItem('bibley_today_seen_v1',d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));localStorage.setItem('bibley_seen_version','7.1');
        localStorage.setItem('bibley_nb_v1_notebooks',JSON.stringify([{id:'test_nb',name:'Pinned',color:'gold',created:1}]));
        localStorage.setItem('bibley_nb_v1_notes',JSON.stringify([{id:'test_note',nb:'test_nb',title:'Saved',body:'## Note\\nTitle, Paper, Pinned and Preview.\\nJohn 3:16\\n> For God so loved the world',tags:['paper'],tpl:'blank',pinned:false,created:1,updated:1}]));""")
        page.goto(sys.argv[1],wait_until='domcontentloaded')
        page.wait_for_function('!!window.BibleyStudyNB && !!window.BibleyLocale')
        original=page.evaluate('BibleyStudyNB.exportData()')
        page.evaluate("BibleyLocale.set('es');BibleyStudyNB.open({})")
        root=page.locator('.snbx')
        expect(root).to_have_attribute('aria-label','Cuaderno de estudio')
        expect(root.locator('.snb-q')).to_have_attribute('placeholder','Buscar notas, etiquetas y versículos')
        expect(root.locator('.snb-card h3')).to_have_text('Saved')
        expect(root.locator('.snb-card .snb-nbl')).to_contain_text('Pinned')
        root.locator('.snb-card').click()
        expect(root.locator('.snb-ta')).to_have_value(original['notes'][0]['body'])
        expect(root.locator('.snb-tin')).to_have_value('Saved')
        expect(root.locator('.snb-tags-in')).to_have_value('paper')
        expect(root.locator('[data-f=b]')).to_have_attribute('aria-label','Negrita')
        expect(root.locator('[data-mode=preview]').first).to_have_text('Vista previa')
        expect(root.locator('.snbx-saved')).to_have_text('Guardado')
        expect(root.locator('.snbx-wc')).to_contain_text('palabras')
        mode='.snbx-mseg' if width<840 else '.snbx-hseg'
        root.locator(mode+' [data-mode=preview]').click()
        expect(root.locator('.snbx-pv').get_by_role('heading',name='Note',exact=True)).to_have_text('Note')
        expect(root.locator('.snbx-pv')).to_contain_text('Title, Paper, Pinned and Preview.')
        expect(root.locator('.snbx-pv blockquote')).to_contain_text('For God so loved the world')
        if width==390: page.screenshot(path='/tmp/bibley-notebook-es.png')
        root.locator(mode+' [data-mode=write]').click()
        root.locator('.snbx-ed [data-a=more]').click()
        expect(root.locator('[data-m=nbmd]')).to_have_text('Exportar cuaderno como Markdown')
        root.locator('[data-a=mx]').click()
        # Edit and autosave in Spanish, then reopen in English with exact content retained.
        changed=original['notes'][0]['body']+'\nMi nota: Saved, Preview, Paper'
        root.locator('.snb-ta').fill(changed)
        expect(root.locator('.snbx-saved')).to_have_text('Guardado',timeout=5000)
        page.evaluate("BibleyStudyNB.close();BibleyLocale.set('en');BibleyStudyNB.open({})")
        expect(root).to_have_attribute('aria-label','Study Notebook')
        root.locator('.snb-card').click()
        expect(root.locator('.snb-ta')).to_have_value(changed)
        root.locator('.snbx-ed [data-a=back]').evaluate('(el)=>el.click()')
        # New templates show translated metadata, without replacing existing saved prompts/content.
        page.evaluate("BibleyStudyNB.close();BibleyLocale.set('es');BibleyStudyNB.open({})")
        root.locator('.snbx-list [data-a=new]' if width<840 else '.snbx-list .snb-new').click()
        expect(root.locator('[data-t=soap] b')).to_have_text('Estudio SOAP')
        expect(root.locator('[data-t=blank] b')).to_have_text('En blanco')
        root.locator('[data-a=mx]').click()
        page.evaluate('BibleyStudyNB.close()')
        after=page.evaluate('BibleyStudyNB.exportData()')
        assert after['notebooks']==original['notebooks']
        assert after['notes'][0]['body']==changed and after['notes'][0]['title']=='Saved'
        assert after['notes'][0]['tags']==['paper']
        assert not errors,errors
        print('PASS notebook',width)
        ctx.close()
    browser.close()
