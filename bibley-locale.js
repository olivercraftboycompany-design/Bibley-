/* Opt-in Spanish navigation. Scripture and untranslated content retain their source language. */
(() => {
  'use strict';
  const key = 'bibley_ui_locale_v1';
  const entries = {
    'Books':'Libros','Study':'Estudio','Search verses':'Buscar versículos','More':'Más','Close':'Cerrar','Back':'Atrás','Back to books':'Volver a los libros',
    'Search books':'Buscar libros','Search verse text':'Buscar texto bíblico','Search whole Bible':'Buscar en toda la Biblia','Old Testament':'Antiguo Testamento','New Testament':'Nuevo Testamento','Lost':'Libros perdidos',
    'Chapter':'Capítulo','Verse':'Versículo','Explore':'Explorar','Outline':'Bosquejo','Compare':'Comparar','Chatbot':'Chat','Marks':'Marcadores','Settings':'Configuración',
    'Today':'Hoy','Scroll':'Explorar versículos','Scroll verses':'Explorar versículos','My Bible':'Mi Biblia','Plans':'Planes','Reading plans':'Planes de lectura','Reading plans and streak':'Planes de lectura y racha',
    'Notes':'Notas','Notes notebook':'Cuaderno de notas','Prev':'Anterior','Next':'Siguiente','Look & feel':'Apariencia','Search settings':'Buscar ajustes','Account':'Cuenta','Help':'Ayuda','Device':'Dispositivo','Your data':'Tus datos',
    'Account & Cloud Sync':'Cuenta y sincronización','Appearance':'Apariencia','Reading':'Lectura','Modes':'Modos','Home & navigation':'Inicio y navegación','Notifications & device':'Notificaciones y dispositivo',
    'Study & notes':'Estudio y notas','Audio':'Audio','Tips':'Consejos','Chat history':'Historial del chat','Data & backup':'Datos y copia de seguridad','Privacy':'Privacidad',
    'About Bibley':'Acerca de Bibley','Language / Idioma':'Idioma / Language','Navigation language':'Idioma de navegación',
    'Print this chapter':'Imprimir este capítulo','Back in reading history':'Atrás en el historial de lectura','Forward in reading history':'Adelante en el historial de lectura',
    'Liked verses':'Versículos favoritos','Remove chapter bookmark':'Quitar marcador del capítulo','Bookmark this chapter':'Marcar este capítulo','Read this chapter aloud':'Leer este capítulo en voz alta',
    'Stop comparing':'Dejar de comparar','Compare translations':'Comparar traducciones','Exit fullscreen':'Salir de pantalla completa','Fullscreen':'Pantalla completa','Focus mode':'Modo de lectura',
    'Red letters':'Letras rojas','Bookmark':'Marcar','Bookmarked':'Marcado','Daily recap':'Resumen diario','Monthly recap':'Resumen mensual',
    'Strong’s word study':'Estudio de palabras de Strong','Commentaries & outline':'Comentarios y bosquejo','Bible dictionary':'Diccionario bíblico','Bible places map':'Mapa de lugares bíblicos','Bible timeline':'Cronología bíblica','Character profiles':'Perfiles de personajes'
  };
  let locale = 'en';
  try { if (localStorage.getItem(key) === 'es') locale = 'es'; } catch {}
  const text = original => locale === 'es' ? entries[original] || original : original;
  const apply = () => {
    // Only trusted, fixed labels in the app shell; never touch any user or Bible text.
    const roots = '#openNavBtn,#openAiBtn,#closeNavBtn,#bnSearchBtn,#bnMoreBtn,#closeAiBtn,.tts-btn,.prev-btn,.next-btn,.ai-tab,.fx-dock button,.bn-tabs button,#drawer .drawer-head .title,.bn-sback,#ssWholeBibleBtn,.bp-red-toggle,.chapter-heading .right button,.bs-title,.bs-gl,.bs-t,.bs-search input,.bn-menu [role=menuitem] span,#bookSearch,#scriptureSearch,.ai-action-btn[data-act],.bp-native-actions button';
    document.querySelectorAll(roots).forEach(el => {
      const nodes = el.matches('.fx-dock button') ? [...(el.querySelector('span')?.childNodes || [])] : [...el.childNodes];
      for (const n of nodes) if (n.nodeType === 3) {
        const value = n.nodeValue.trim(), en = originals.get(n) || value;
        if (entries[en] && (value === en || value === entries[en])) {
          originals.set(n,en); const changed = n.nodeValue.replace(value, text(en));
          if (n.nodeValue !== changed) n.nodeValue = changed;
          if (locale === 'es') el.lang = 'es'; else el.removeAttribute('lang');
        }
      }
      const attrs = originalAttrs.get(el) || {};
      for (const attr of ['aria-label','title','placeholder']) {
        const value = el.getAttribute(attr); if (!value) continue;
        const en = attrs[attr] || value;
        if (entries[en] && (value === en || value === entries[en])) {
          attrs[attr]=en; if (value !== text(en)) el.setAttribute(attr,text(en));
          if (locale === 'es') el.lang = 'es'; else el.removeAttribute('lang');
        }
      }
      originalAttrs.set(el,attrs);
    });
  };
  const originals = new WeakMap(), originalAttrs = new WeakMap();
  window.BibleyLocale = {get: () => locale, set(value) {
    locale = value === 'es' ? 'es' : 'en'; try { localStorage.setItem(key, locale); } catch {}
    apply();
  }, text};
  const init = () => {
    apply();
    let scheduled = false;
    new MutationObserver(records => {
      if (locale !== 'es' || scheduled || !records.some(r => r.target instanceof Element && !r.target.closest('.verses-text'))) return;
      scheduled = true; requestAnimationFrame(() => { scheduled = false; apply(); });
    }).observe(document.body,{subtree:true,childList:true});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
