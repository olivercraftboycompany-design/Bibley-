"""Device/focus localization, persisted settings, source-text and native boundaries.
Native bridge is simulated; this does not verify Android permissions or notification delivery.
uv run --with playwright python tests/device-focus-locale-regression.py URL
"""
import sys
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox'])
    for native in (False, True):
        for width in (390, 1280):
            context = browser.new_context(viewport={'width': width, 'height': 900}, service_workers='block')
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.add_init_script("""(() => {
              const d = new Date(); localStorage.setItem('bibley_today_seen_v1', `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
              localStorage.setItem('bibley_seen_version','7.1');
              localStorage.setItem('bibley_ui_locale_v1','es');
              localStorage.setItem('bibley_device_v1', JSON.stringify({minutes: 45, chime: false, dnd: false}));
              localStorage.setItem('bibley_votd_v1',JSON.stringify({[`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}test`]:{ref:'John 3:16',text:'Custom Notes & Today scripture <safe>',version:'web'}}));
              window.nativeCalls = [];
            })()""")
            if native:
                page.add_init_script("""window.BibleyDeviceNative = {
                  state: () => JSON.stringify({dndAccess:false, quietOn:true,quietStart:1320,quietEnd:420,widgets:{verse:1,quick:0},focus:window.nativeFocus}),
                  takeAction: () => '', setWidgetData: () => {},
                  openDndAccess: () => window.nativeCalls.push('dnd'),
                  pinWidget: kind => {window.nativeCalls.push(kind);return 'requested'},
                  startFocus: (minutes,dnd,chime) => {window.nativeFocus={active:true,startAt:Date.now(),endAt:Date.now()+minutes*60000,minutes,chime,dndApplied:false};return JSON.stringify(window.nativeFocus)}, stopFocus: () => {window.nativeFocus=null}
                };""")
            page.goto(sys.argv[1], wait_until='domcontentloaded')
            page.wait_for_function('!!window.BibleyDevice && !!window.BibleyLocale')
            ref = page.evaluate('BibleyFX._test.votdRef()')
            page.evaluate("""ref => { const values=JSON.parse(localStorage.getItem('bibley_votd_v1')); Object.values(values).forEach(v=>v.ref=ref); localStorage.setItem('bibley_votd_v1',JSON.stringify(values)); }""", ref)
            page.evaluate('BibleyDevice.deviceSheet()')
            sheet=page.locator('.dv-sheet')
            expect(sheet.locator('#dv-focus .dv-ftitle')).to_have_text('No interrumpir mi relación con Dios')
            expect(sheet.locator('#dv-notif .dv-eb')).to_have_text('Notificaciones')
            expect(sheet.locator('[data-k=quietOn]')).to_be_disabled() if not native else expect(sheet.locator('[data-k=quietOn]')).to_be_enabled()
            if native:
                expect(sheet.locator('#dv-widgets')).to_be_visible()
                expect(sheet.locator('[data-votd]')).to_have_text('“Custom Notes & Today scripture <safe>”')
                sheet.locator('[data-pin=verse]').click()
                assert page.evaluate('nativeCalls') == ['verse']
                sheet.locator('[data-a=grant]').click()
                modal=page.locator('.dv-modal-wrap')
                expect(modal.locator('h3')).to_have_text('Permitir que Bibley active No molestar')
                assert page.evaluate('nativeCalls') == ['verse']  # opening explanation grants nothing
                page.evaluate("BibleyLocale.set('en')")
                expect(modal.locator('h3')).to_have_text('Let Bibley turn on Do Not Disturb')
                modal.locator('[data-a=no]').click()
            else:
                expect(sheet.locator('#dv-widgets')).to_have_count(0)
            page.evaluate("BibleyLocale.set('en')")
            expect(sheet.locator('#dv-focus .dv-ftitle')).to_have_text('Do not disturb my relationship with God')
            page.evaluate("BibleyLocale.set('es')")
            sheet.locator('[data-a=focus]').click()
            focus=page.locator('.dv-focus')
            expect(focus).to_be_visible()
            expect(focus.locator('.dv-fx-lab')).to_have_text('Temporizador de oración')
            expect(focus.locator('[data-v]')).to_have_text('“Custom Notes & Today scripture <safe>”')
            expect(focus.locator('[data-vr]')).to_have_text(ref)
            expect(focus.get_by_label('Minutos',exact=True)).to_have_value('45')
            focus.get_by_label('Minutos',exact=True).fill('37')
            page.evaluate("BibleyLocale.set('en')")
            expect(focus.get_by_label('Minutes',exact=True)).to_have_value('37')
            expect(focus.locator('.dv-fx-lab')).to_have_text('Prayer timer')
            page.evaluate("BibleyLocale.set('es')")
            focus.locator('[data-a=start]').click()
            expect(focus.locator('.dv-time-l')).to_have_text('restantes')
            before=page.evaluate('BibleyDevice._test.session().endAt')
            page.evaluate("BibleyLocale.set('en')")
            expect(focus.locator('.dv-time-l')).to_have_text('remaining')
            assert page.evaluate('BibleyDevice._test.session().endAt') == before
            page.evaluate("BibleyLocale.set('es')")
            expect(focus.get_by_label('Ocultar (la sesión continúa)')).to_be_visible()
            page.screenshot(path=f'/tmp/bibley-device-es-{native}-{width}.png',full_page=True)
            focus.locator('[data-a=end]').click()
            expect(focus.locator('h2')).to_have_text('Sesión terminada')
            expect(focus.locator('.dv-fx-vt')).to_contain_text('The Lord bless you, and keep you.')
            page.evaluate("BibleyLocale.set('en')")
            expect(focus.locator('h2')).to_have_text('Session ended')
            if native:
                expect(focus.locator('.dv-done p').first).to_contain_text('Your phone is back to normal.')
            assert page.evaluate("JSON.parse(localStorage.getItem('bibley_device_v1')).minutes") == 37
            assert not errors, errors
            print(f'PASS native={native} width={width}')
            context.close()
    browser.close()
