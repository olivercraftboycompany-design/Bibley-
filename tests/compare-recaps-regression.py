"""Phone and desktop checks for word comparison, reader races, recap copy and voice locale.
Run: uv run --with playwright python tests/compare-recaps-regression.py URL
Uses fixtures for remote translation failures and speech; no sign-in or microphone.
"""
import sys
from playwright.sync_api import sync_playwright, expect

INIT = r'''(() => {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const set = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  localStorage.setItem('bibley_today_seen_v1', today);
  localStorage.setItem('bibley_seen_version', '7.1');
  set('bibley_read_v1', { 'Genesis-1': today });
  set('bibley_plus_prayers_v1', { items: [{ id: 'fixture', title: 'Private fixture text', added: Date.now()-100, answered: Date.now() }] });
  set('bibley_activity_v1', [today]);
  Object.defineProperty(navigator.clipboard, 'writeText', {value: async text => window.copiedRecap = text});
  window.SpeechRecognition = class {
    start() { window.recognitionLanguage = this.lang; this.onend?.(); }
  };
  const fetchReal = window.fetch.bind(window);
  window.fetch = (url, init) => {
    const reply = rows => new Response(JSON.stringify(rows), {headers: {'Content-Type':'application/json'}});
    if (String(url).startsWith('https://bolls.life/get-text/NKJV/1/1/')) {
      return new Promise(resolve => window.finishFixtureChapter = () => resolve(reply([
        {verse: 1, text: 'Unique fixture wording'}, {verse: 99, text: 'Unpaired fixture verse'}
      ])));
    }
    if (String(url).startsWith('https://bolls.life/get-text/NLT/1/1/')) return Promise.resolve(reply([]));
    if (String(url).startsWith('https://bolls.life/get-text/CSB17/1/1/')) return Promise.resolve(reply([{verse: 99, text: 'Only an unpaired fixture verse'}]));
    return fetchReal(url, init);
  };
})();'''

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox'])
    for width in (390, 1280):
        context = browser.new_context(viewport={'width': width, 'height': 844}, service_workers='block')
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.add_init_script(INIT)
        page.goto(sys.argv[1], wait_until='domcontentloaded')
        page.wait_for_function('!!window.BibleyTools?.open')
        pane_a = page.locator('.pane[data-pane=a]')
        pane_b = page.locator('.pane[data-pane=b]')
        pane_a.locator('.verses-text [data-verse]').first.wait_for(timeout=30000)
        page.evaluate('document.querySelector("#compareBtn").click()')
        pane_b.locator('.verses-text [data-verse]').first.wait_for(timeout=30000)
        pane_b.locator('.bp-diff-toggle').click()
        badge, note = pane_b.locator('.bp-diff-badge'), pane_b.locator('.bp-diff-note')
        selector = pane_b.locator('#versionSelectB')
        expect(note).to_contain_text('Compares matching verse numbers only')
        version = selector.input_value()
        cached = pane_b.locator('.verses-text [data-verse="1"]').inner_text()
        selector.select_option('nkjv')
        expect(note).to_contain_text('Waiting for both translations')
        expect(badge).to_have_count(0)
        selector.select_option(version)
        page.evaluate('finishFixtureChapter()')
        # The late remote result must not replace the cached selection or trigger stale marks.
        expect(pane_b.locator('.verses-text [data-verse="1"]')).to_have_text(cached)
        expect(note).to_contain_text('Compares matching verse numbers only')
        selector.select_option('nkjv')
        expect(note).to_contain_text('Waiting for both translations')
        page.evaluate('finishFixtureChapter()')
        expect(badge).to_have_text('100% different')
        expect(note).to_contain_text('Skipped: 31')
        expect(pane_b.locator('[data-verse="1"] mark.bp-diff').first).to_have_text('Unique')
        expect(pane_b.locator('[data-verse="99"] mark.bp-diff')).to_have_count(0)
        page.evaluate('BibleyLocale.set("es")')
        expect(badge).to_have_text('100% diferente')
        expect(note).to_contain_text('Sin comparar: 31')
        selector.select_option('nlt')
        expect(note).to_contain_text('La comparación de palabras no está disponible')
        expect(badge).to_have_count(0)
        selector.select_option('csb')
        expect(note).to_have_text('No hay versículos con números coincidentes para comparar.')
        expect(pane_a.locator('mark.bp-diff')).to_have_count(0)
        page.evaluate('document.querySelector("#compareBtn").click()')
        expect(note).to_have_count(0)
        page.evaluate('document.querySelector(".bp-drawer-mic").click()')
        assert page.evaluate('recognitionLanguage') == 'es-ES'
        page.evaluate('BibleyTools.open("recap-month")')
        sheet = page.locator('.fx-sheet.open')
        sheet.get_by_role('button', name='Copiar resumen como texto', exact=True).click()
        page.wait_for_function('!!window.copiedRecap')
        copied = page.evaluate('copiedRecap')
        assert 'capítulos leídos: 1' in copied and 'Más leídos: Genesis (1)' in copied, copied
        assert 'Private fixture text' not in copied, copied
        page.evaluate('BibleyLocale.set("en"); BibleyTools.open("recap-month"); window.copiedRecap = null')
        sheet.get_by_role('button', name='‹ Prev', exact=True).click()
        sheet.get_by_role('button', name='Copy recap as text', exact=True).click()
        page.wait_for_function('!!window.copiedRecap')
        copied = page.evaluate('copiedRecap')
        assert 'Nothing recorded for this month.' in copied and 'Most read:' not in copied, copied
        page.evaluate('BibleyTools.open("recap-day"); window.copiedRecap = null')
        sheet.get_by_role('button', name='Copy recap as text', exact=True).click()
        page.wait_for_function('!!window.copiedRecap')
        copied = page.evaluate('copiedRecap')
        assert 'Read: Genesis 1' in copied and 'Private fixture text' not in copied, copied
        assert not errors, errors
        context.close()
        print(f'Passed {width}px: reader loading guards, word comparison, private recaps, speech locale')
    browser.close()
