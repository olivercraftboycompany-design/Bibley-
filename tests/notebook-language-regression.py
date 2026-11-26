"""New-note scaffolding, grammar review and account-error data boundaries.
Uses synthetic storage and AI/account stubs. Does not submit real personal data.
uv run --with playwright python tests/notebook-language-regression.py URL
"""
import sys
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    for width in [390,1280]:
        ctx=browser.new_context(viewport={'width':width,'height':900},service_workers='block')
        page=ctx.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.add_init_script("""const d=new Date();localStorage.setItem('bibley_today_seen_v1',d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));localStorage.setItem('bibley_seen_version','7.1');""")
        page.goto(sys.argv[1],wait_until='domcontentloaded')
        page.wait_for_function('!!window.BibleyStudyNB && !!window.BibleyLocale && !!window.BibleySettings && !!window.BibleySync')
        # Every new template keeps the exact verse and reference, even when they look like labels.
        verse={'ref':'John 3:16','text':'Saved, Original, Scripture <script>not executable</script>'}
        for locale in ['es','en']:
            page.evaluate('(l)=>BibleyLocale.set(l)',locale)
            data=page.evaluate('v=>BibleyStudyNB.TEMPLATES.map(t=>({id:t.id,body:BibleyStudyNB._test.templateBody(t.id,v)}))',verse)
            assert len(data)==9
            assert all(verse['text'] in x['body'] for x in data if x['id'] not in ['blank','word'])
            soap=next(x['body'] for x in data if x['id']=='soap')
            assert ('## Escritura' if locale=='es' else '## Scripture') in soap
            assert '[[Q' not in soap
        # Create a real new Spanish note from SOAP; saved content does not change on locale switch.
        page.evaluate("BibleyLocale.set('es');BibleyStudyNB.newFromVerse({ref:'John 3:16',text:'For God so loved the world'})")
        root=page.locator('.snbx')
        root.locator('[data-t=soap]').click()
        expect(root.locator('.snb-tin')).to_have_value('Estudio SOAP · John 3:16')
        body=root.locator('.snb-ta').input_value()
        assert body.startswith('## Escritura\n') and 'For God so loved the world' in body and '## Oración' in body
        body+='\nMi reflexión'
        root.locator('.snb-ta').fill(body)
        expect(root.locator('.snbx-saved')).to_have_text('Guardado',timeout=5000)
        page.evaluate("BibleyStudyNB.close();BibleyLocale.set('en');BibleyStudyNB.open({})")
        root.locator('.snb-card').first.click()
        expect(root.locator('.snb-ta')).to_have_value(body)
        expect(root.locator('.snb-tin')).to_have_value('Estudio SOAP · John 3:16')
        # Review generated changes in Spanish. The AI stub changes only the typo, not the protected quote.
        page.evaluate("BibleyStudyNB.close();BibleyLocale.set('es');BibleyStudyNB.open({})")
        root.locator('.snb-card').first.click()
        before='i beleive.\n> "For God so loved the world" — John 3:16'
        root.locator('.snb-ta').fill(before)
        expect(root.locator('.snbx-saved')).to_have_text('Guardado',timeout=5000)
        page.evaluate("""()=>{window.grammarInputs=[];BibleyAI.raw=async(sys,user)=>{grammarInputs.push({sys,user});return '<corrected>\\n'+user.split('<text>\\n')[1].split('\\n</text>')[0].replace('i beleive.','I believe.')+'\\n</corrected>'}}""")
        root.locator('[data-a=grammar]').click()
        expect(root.locator('[data-g=ok]')).to_have_text('Aplicar cambios')
        expect(root.locator('.snbx-gsum')).to_contain_text('cambios sugeridos')
        expect(root.locator('.snbx-gsum')).to_contain_text('Las citas bíblicas se conservan sin cambios')
        expect(root.locator('.snb-ta')).to_have_value(before)
        inp=page.evaluate('grammarInputs[0]')
        assert 'For God so loved' not in inp['user'] and '[[Q1]]' in inp['user']
        assert 'never translate' in inp['sys']
        root.locator('[data-g=no]').click()
        expect(root.locator('.snb-ta')).to_have_value(before)
        # Accepting the exact same result is the only thing that writes it.
        root.locator('[data-a=grammar]').click()
        root.locator('[data-g=ok]').click()
        expect(root.locator('.snb-ta')).to_have_value(before.replace('i beleive.','I believe.'))
        # A no-change response is not a claim that the AI has proven the grammar perfect.
        root.locator('[data-a=grammar]').click()
        expect(root.locator('.snbx-gok b')).to_have_text('No se sugieren cambios gramaticales')
        root.locator('[data-g=x]').click()
        # Unknown provider text is verbatim and escaped, with no fabricated offline diagnosis.
        page.evaluate("()=>{BibleyAI.raw=async()=>{throw new Error('Provider offline <img src=x onerror=alert(1)>')}}")
        root.locator('[data-a=grammar]').click()
        expect(root.locator('.snbx-gerr')).to_have_text('No se pudo revisar la gramática: Provider offline <img src=x onerror=alert(1)>')
        assert root.locator('.snbx-gerr img').count()==0
        root.locator('[data-g=x]').click()
        ctx.set_offline(True)
        root.locator('[data-a=grammar]').click()
        expect(root.locator('.snbx-gerr')).to_contain_text('No tienes conexión.')
        ctx.set_offline(False)
        page.screenshot(path=f'/tmp/bibley-grammar-es-{width}.png')
        page.evaluate('BibleyStudyNB.close()')
        # The real transport classifies browser-offline separately from failed service requests.
        page.route('https://bibley.sites.tab.bot/**',lambda route:route.abort('failed'))
        result=page.evaluate("async()=>{try{await BibleySync.login('synthetic_locale_test','synthetic-test-password')}catch(e){return {message:e.message,offline:e.offline}}}")
        assert result=={'message':"Couldn't reach the account service. Please try again.",'offline':False},result
        ctx.set_offline(True)
        result=page.evaluate("async()=>{try{await BibleySync.login('synthetic_locale_test','synthetic-test-password')}catch(e){return {message:e.message,offline:e.offline}}}")
        assert result['offline'] is True and result['message'].startswith("You're offline."),result
        ctx.set_offline(False)
        page.unroute('https://bibley.sites.tab.bot/**')
        page.route('https://bibley.sites.tab.bot/**',lambda route:route.fulfill(status=200,content_type='text/plain',body='not json'))
        result=page.evaluate("async()=>{try{await BibleySync.login('synthetic_locale_test','synthetic-test-password')}catch(e){return e.message}}")
        assert result=='The account service returned an invalid response. Please try again.',result
        # No real account write: replace sync API with controlled errors and inspect visible form.
        page.evaluate("""()=>{window.BibleySync={status:()=>({signedIn:false,state:'signedout'}),login:async()=>{throw new Error('Server error 503')}};BibleySettings.open('account')}""")
        acct=page.locator('.bs-root')
        acct.locator('input[name=username]').fill('synthetic_locale_test')
        acct.locator('input[name=password]').fill('synthetic-test-password')
        acct.locator('.bs-acct-go').click()
        expect(acct.locator('.bs-acct-err')).to_have_text('Error del servidor 503')
        page.evaluate("()=>{BibleySync.login=async()=>{throw new Error('Unrecognized <b>provider</b> status')}}")
        acct.locator('.bs-acct-go').click()
        expect(acct.locator('.bs-acct-err')).to_have_text('Unrecognized <b>provider</b> status')
        assert acct.locator('.bs-acct-err b').count()==0
        page.evaluate('BibleySettings.close()')
        # Classic pages are still editable in Spanish without translating saved personal content.
        data={'v':1,'pages':[{'id':'p_test','name':'Saved','created':1},{'id':'p_empty','name':'Notes','created':1}],
              'notes':[{'id':'n_test','pageId':'p_test','kind':'free','title':'Page','thoughts':'Your thoughts: Saved, Note, Prayer','summary':'','created':1,'updated':1}],
              'legacyPage':{},'lastPage':'p_test','viewPage':'p_test'}
        page.evaluate("d=>localStorage.setItem('bibley_notebook_v1',JSON.stringify(d))",data)
        page.evaluate('BibleyNotes.openClassic()')
        sheet=page.locator('.fx-sheet.open')
        expect(sheet.locator('.nb-pageof')).to_have_text('Página 1 de 2')
        expect(sheet.locator('.nb-pagename')).to_have_text('Saved')
        expect(sheet.locator('.nb-card-ref')).to_have_text('Page')
        expect(sheet.locator('.nb-card-tag')).to_have_text('Mi nota')
        sheet.locator('.nb-card').click()
        expect(sheet.locator('.nb-title')).to_have_value('Page')
        expect(sheet.locator('.nb-mine')).to_have_value(data['notes'][0]['thoughts'])
        expect(sheet.locator('[data-a=done]')).to_have_text('Guardar')
        expect(sheet.locator('[data-a=del]')).to_have_text('Eliminar')
        sheet.locator('[data-a=back]').click()
        sheet.locator('[data-a=next]').click()
        expect(sheet.locator('.nb-empty')).to_contain_text('Abre Estudio')
        page.screenshot(path=f'/tmp/bibley-classic-es-{width}.png')
        page.evaluate('BibleyLocale.set("en");BibleyNotes.openClassic("p_test")')
        expect(sheet.locator('.nb-pageof')).to_have_text('Page 1 of 2')
        after=page.evaluate('BibleyNotes._test.load()')
        assert after['pages']==data['pages'] and after['notes']==data['notes']
        assert not errors,errors
        print('PASS notebook language',width,flush=True)
        ctx.close()
    browser.close()
