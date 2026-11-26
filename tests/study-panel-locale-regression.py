"""Core study-panel labels and language-switch data boundaries, phone and desktop.
Synthetic AI results verify UI behavior only, not model quality or provider availability.
Run: uv run --with playwright python tests/study-panel-locale-regression.py URL
"""
import sys
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox'])
    for width in (390,1280):
        ctx=browser.new_context(viewport={'width':width,'height':900},service_workers='block')
        page=ctx.new_page(); errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.add_init_script("""const d=new Date();localStorage.setItem('bibley_today_seen_v1',`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);localStorage.setItem('bibley_seen_version','7.1');localStorage.setItem('bibley_ui_locale_v1','es');""")
        page.goto(sys.argv[1],wait_until='domcontentloaded')
        page.wait_for_function('!!window.BibleyCore && !!window.BibleyLocale && !!window.BibleyAI')
        page.locator('.pane[data-pane=a] .verses-text span[data-verse]').first.wait_for(timeout=30000)
        scripture=page.locator('.pane[data-pane=a] .verses-text').inner_text()
        page.evaluate('''() => {window.studyCalls=[];BibleyAI.generate=async(sys,user)=>{
          studyCalls.push({sys,user});
          if(sys.includes('single valid JSON object'))return JSON.stringify({title:'Outline',bigIdea:'Application',points:[{heading:'Audience',text:'Length',subpoints:['Key Points']}],illustration:'Structure',questions:['Clear']});
          if(sys.includes('OVERVIEW:'))return 'OVERVIEW: Application\\nKEY POINTS:\\n- Outline\\nSTRUCTURE: Structure';
          return 'MEANING: Outline\\nCONTEXT: Application\\nAPPLICATION: Structure';
        };Object.defineProperty(navigator.clipboard,'writeText',{value:async t=>window.copiedStudy=t});}''')
        expect(page.locator('.ai-head h2')).to_contain_text('Estudio Asistente')
        expect(page.locator('.model-badge')).to_have_text('IA gratuita — sin registro ni clave')
        page.evaluate('BibleyCore.openAi("chapter")')
        expect(page.locator('#chSummaryCard h3')).to_have_text('Resumen del capítulo')
        expect(page.locator('#genChapterSummary')).to_have_text('Resumir este capítulo')
        assert page.evaluate('studyCalls.length')==0
        page.locator('#genChapterSummary').click()
        expect(page.locator('#chSummaryCard p')).to_have_text('Application')
        expect(page.locator('#chKeyPointsCard h3')).to_have_text('Puntos clave')
        expect(page.locator('#chStructureCard h3')).to_have_text('Estructura')
        page.evaluate("BibleyLocale.set('en')")
        expect(page.locator('#regenChapterSummary')).to_have_text('↻ Regenerate')
        expect(page.locator('#chSummaryCard p')).to_have_text('Application')
        page.evaluate("BibleyLocale.set('es')")
        page.locator('.ai-tab[data-tab=outline]').click()
        expect(page.locator('.outline-field-label').first).to_have_text('Público')
        expect(page.locator('[data-audience=kids]')).to_have_text('Lección para niños')
        page.locator('[data-audience=kids]').click()
        page.locator('[data-length=short]').click()
        page.locator('#outlineGenerateBtn').click()
        expect(page.locator('#outlineResult .outline-title-card h3')).to_have_text('Outline')
        expect(page.locator('#outlineResult .outline-meta')).to_contain_text('Lección para niños · Breve (~10 min)')
        expect(page.locator('#outlineResult .ai-card').nth(1).locator('h3')).to_have_text('Idea principal')
        expect(page.locator('#outlineResult .ai-card').nth(1).locator('p')).to_have_text('Application')
        expect(page.locator('.outline-illustration b')).to_have_text('Idea para una ilustración:')
        page.locator('#outlineCopyBtn').click()
        page.wait_for_function('!!window.copiedStudy')
        copied=page.evaluate('copiedStudy')
        assert copied.startswith('Outline\nGenesis 1\n') and 'Audience — Length' in copied
        page.evaluate("BibleyLocale.set('en')")
        expect(page.locator('[data-audience=kids].active')).to_have_text("Children's lesson")
        expect(page.locator('#outlineResult .outline-title-card h3')).to_have_text('Outline')
        expect(page.locator('#outlineResult .ai-card').nth(1).locator('p')).to_have_text('Application')
        assert page.evaluate('studyCalls.length')==2
        assert 'children roughly ages 6-11' in page.evaluate('studyCalls[1].sys')
        assert '3 main points' in page.evaluate('studyCalls[1].sys')
        page.evaluate("BibleyLocale.set('es');BibleyCore.openAi('verse')")
        expect(page.locator('#aiContent .ai-empty p')).to_have_text('Toca un versículo para ver su resumen y resaltarlo.')
        # UI-like saved scripture/snippets must never be translated on locale change.
        page.evaluate('''() => {localStorage.setItem('bible_highlights_v2',JSON.stringify({'Genesis-1-1':{ref:'Genesis 1:1',text:'Application',color:'yellow',added:Date.now()}}));BibleyCore.openAi('marks')}''')
        expect(page.locator('.mark-item .snippet')).to_have_text('Application')
        expect(page.locator('.remove-hl')).to_have_text('Quitar')
        expect(page.locator('#clearAllMarks')).to_have_text('Quitar todas las marcas')
        page.evaluate('window.confirm = message => (window.confirmText=message, false)')
        page.locator('#clearAllMarks').click()
        assert page.evaluate('confirmText')=='¿Quitar todos los marcadores y resaltados?'
        before=page.evaluate("localStorage.getItem('bible_highlights_v2')")
        page.evaluate("BibleyLocale.set('en')")
        expect(page.locator('.remove-hl')).to_have_text('Remove')
        assert page.evaluate("localStorage.getItem('bible_highlights_v2')")==before
        assert page.locator('.pane[data-pane=a] .verses-text').inner_text()==scripture
        page.evaluate("BibleyLocale.set('es');BibleyCore.openAi('outline')")
        page.screenshot(path=f'/tmp/bibley-study-es-{width}.png')
        assert not errors,errors
        ctx.close()
    browser.close()
print('Core study-panel locale and content boundaries passed (phone + desktop)')
