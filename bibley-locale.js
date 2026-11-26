/* Opt-in Spanish interface labels. Scripture and untranslated content retain their source language. */
(() => {
  'use strict';
  const key = 'bibley_ui_locale_v1';
  const entries = {
    "New prayer":"Nueva oración",
    "What are you praying for?":"¿Por qué estás orando?",
    "Details (optional)":"Detalles (opcional)",
    "Add prayer":"Añadir oración",
    "Give the prayer a short title":"Ponle un título breve a la oración",
    "Prayer added":"Oración añadida",
    "Private: your prayers live on this device and in your Bibley account when signed in. They are never public.":"Privado: tus oraciones se guardan en este dispositivo y en tu cuenta de Bibley al iniciar sesión. No son públicas.",
    "Active":"Activas",
    "Answered":"Respondidas",
    "Save as a prayer request":"Guardar como petición de oración",
    "Added to your prayer list":"Añadida a tu lista de oraciones",
    "Added":"Añadida",
    "answered":"respondida",
    "Mark answered":"Marcar como respondida",
    "Marked as answered ✨":"Marcada como respondida",
    "Make active again":"Volver a marcar como activa",
    "Delete":"Eliminar",
    "Delete this prayer? (goes to Trash for 30 days)":"¿Eliminar esta oración? (irá a la papelera durante 30 días)",
    "Strong’s number, original word, or transliteration":"Número de Strong, palabra original o transliteración",
    "e.g. G26, agape, H1":"p. ej., G26, agape, H1",
    "Looking up…":"Buscando…",
    "No matching Strong’s entries.":"No se encontraron entradas de Strong.",
    "Showing 30 matches. Type more of the word to narrow the results.":"Se muestran 30 coincidencias. Escribe más letras para acotar la búsqueda.",
    "Couldn’t load the dictionary in this browser. Try again online.":"No se pudo cargar el diccionario en este navegador. Vuelve a intentarlo con conexión.",
    "Cross-references":"Referencias cruzadas",
    "Loading cross-references…":"Cargando referencias cruzadas…",
    "Related passages · OpenBible.info":"Pasajes relacionados · OpenBible.info",
    "No linked passages are listed for this verse.":"No hay pasajes relacionados con este versículo.",
    "Related passages":"Pasajes relacionados",
    "Couldn’t load linked passages. Try again online.":"No se pudieron cargar los pasajes relacionados. Vuelve a intentarlo con conexión.",
    "World English Bible tags":"Etiquetas de la World English Bible",
    "Loading tagged words…":"Cargando palabras etiquetadas…",
    "No tagged words are available for this verse.":"No hay palabras etiquetadas para este versículo.",
    "Couldn’t load tagged words. Try again online.":"No se pudieron cargar las palabras etiquetadas. Vuelve a intentarlo con conexión.",
    "Greek interlinear":"Interlineal griego",
    "Hebrew interlinear":"Interlineal hebreo",
    "Loading interlinear…":"Cargando el interlineal…",
    "No source words for this verse number.":"No hay palabras originales disponibles para este número de versículo.",
    "Couldn’t load the interlinear. Try again online.":"No se pudo cargar el interlineal. Vuelve a intentarlo con conexión.",
    "Commentaries & book outline":"Comentarios y bosquejo del libro",
    "Commentary source":"Fuente del comentario",
    "Book outline · chapter headings":"Bosquejo del libro · encabezados de capítulos",
    "Loading chapter headings…":"Cargando encabezados de capítulos…",
    "This book is not covered by the bundled outline and commentary sources.":"Las fuentes incluidas no ofrecen bosquejos ni comentarios para este libro.",
    "No headings are available for this book.":"No hay encabezados disponibles para este libro.",
    "Couldn’t load headings online.":"No se pudieron cargar los encabezados.",
    "This source has no entry for this chapter.":"Esta fuente no tiene una entrada para este capítulo.",
    "No commentary text is listed for this chapter.":"No hay comentario para este capítulo.",
    "Couldn’t load this commentary. Try again online.":"No se pudo cargar el comentario. Vuelve a intentarlo con conexión.",
    "Easton’s Bible dictionary":"Diccionario bíblico de Easton",
    "Search people, places or terms":"Buscar personas, lugares o términos",
    "e.g. Nicodemus, Zion, covenant":"p. ej., Nicodemus, Zion, covenant",
    "Loading the dictionary…":"Cargando el diccionario…",
    "Search by a person, place or topic.":"Busca una persona, un lugar o un tema.",
    "No matching entries.":"No se encontraron entradas.",
    "Couldn’t load the dictionary. Try again online.":"No se pudo cargar el diccionario. Vuelve a intentarlo con conexión.",
    "Find a Bible place":"Buscar un lugar bíblico",
    "e.g. Jerusalem":"p. ej., Jerusalem",
    "Loading places…":"Cargando lugares…",
    "No mapped places match.":"No se encontraron lugares en el mapa.",
    "Couldn’t load places. Try again online.":"No se pudieron cargar los lugares. Vuelve a intentarlo con conexión.",
    "Bible character profiles":"Perfiles de personajes bíblicos",
    "Search events or participants":"Buscar acontecimientos o participantes",
    "Search Bible characters":"Buscar personajes bíblicos",
    "e.g. Exodus":"p. ej., Exodus",
    "e.g. Aaron":"p. ej., Aaron",
    "Previous":"Anterior",
    "Loading study data…":"Cargando datos de estudio…",
    "No matches found.":"No se encontraron coincidencias.",
    "Couldn’t load the study data. Try again online.":"No se pudieron cargar los datos de estudio. Vuelve a intentarlo con conexión.",
    "Bibley recap":"Resumen de Bibley",
    "Reading plan days completed":"Días del plan de lectura completados",
    "Notes written":"Notas escritas",
    "Prayers answered":"Oraciones respondidas",
    "Memory verses reviewed":"Versículos de memoria repasados",
    "Journaled: yes":"Entrada en el diario: sí",
    "Current streak":"Racha actual",
    "‹ Prev":"‹ Anterior",
    "Next ›":"Siguiente ›",
    "← Back":"← Atrás",
    "Read":"Lectura",
    "Reading plan":"Plan de lectura",
    "Highlights":"Resaltados",
    "Verses saved":"Versículos guardados",
    "Prayers added":"Oraciones añadidas",
    "Prayer answered":"Oración respondida",
    "Memory review":"Repaso de memoria",
    "Journal":"Diario",
    "Entry written":"Entrada escrita",
    "chapters":"capítulos",
    "current streak":"racha actual",
    "study marks":"marcas de estudio",
    "Copy recap as text":"Copiar resumen como texto",
    "Recap copied":"Resumen copiado",
    "Couldn't copy":"No se pudo copiar",
    "Most read":"Más leídos",
    "chapters read":"capítulos leídos",
    "days active":"días activos",
    "best streak":"mejor racha",
    "notes":"notas",
    "highlights":"resaltados",
    "verses saved":"versículos guardados",
    "prayers added":"oraciones añadidas",
    "prayers answered":"oraciones respondidas",
    "memory reviews":"repasos de memoria",
    "(so far)":"(hasta ahora)",
    "Nothing recorded for this day.":"No hay actividad registrada para este día.",
    "Nothing recorded for today yet.":"Todavía no hay actividad registrada hoy.",
    "Reading, notes, highlights, saved verses, prayers, memory practice and journal entries show up here as you do them.":"Aquí verás tus lecturas, notas, resaltados, versículos guardados, oraciones, repasos y entradas del diario a medida que los hagas.",
    "Based on records available on this device. Deleted items and unavailable history aren’t counted.":"Solo se incluyen los datos disponibles en este dispositivo. No se cuentan los elementos eliminados o no disponibles.",
    "Nothing recorded for this month. Counts start from activity recorded on this device.":"No hay actividad registrada este mes. El recuento empieza con la actividad disponible en este dispositivo.",
    "Prayer list":"Lista de oraciones",
    "Guided prayers":"Oraciones guiadas",
    "Reflection journal":"Diario de reflexión",
    "Exports & trash":"Exportaciones y papelera",
    "Custom & seasonal plans":"Planes personalizados y de temporada",
    "Filters & history":"Filtros e historial",
    "Linked verses":"Versículos relacionados",
    "Original words":"Palabras originales",
    "Hebrew & Greek interlinear":"Interlineal hebreo y griego",
    "Interlinear words":"Palabras del interlineal",
    "Flashcards":"Tarjetas de memoria",
    "Search":"Buscar",
    "Search the whole Bible...":"Buscar en toda la Biblia…",
    "Recent searches":"Búsquedas recientes",
    "Look up":"Consultar",
    "All books":"Todos los libros",
    "Unlock":"Desbloquear",
    "Save entry":"Guardar entrada",
    "Restore":"Restaurar",
    "Chapter history":"Historial de capítulos",
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
  const text = original => locale === 'es' ? (Object.hasOwn(entries, original) ? entries[original] : original) : original;
  const apply = () => {
    // Only trusted, fixed labels in the app shell; never touch any user or Bible text.
    const roots = '#openNavBtn,#openAiBtn,#closeNavBtn,#bnSearchBtn,#bnMoreBtn,#closeAiBtn,.tts-btn,.prev-btn,.next-btn,.ai-tab,.fx-dock button,.bn-tabs button,#drawer .drawer-head .title,.bn-sback,#ssWholeBibleBtn,.bp-red-toggle,.chapter-heading .right button,.bs-title,.bs-gl,.bs-t,.bs-search input,.bn-menu [role=menuitem] span,#bookSearch,#scriptureSearch,.ai-action-btn[data-act],.bp-native-actions button,.fx-sheet .fx-sheet-title,.fx-sheet .fx-close,.fx-sheet .bp-section-back';
    document.querySelectorAll(roots).forEach(el => {
      const nodes = el.matches('.fx-dock button') ? [...(el.querySelector('span')?.childNodes || [])] : [...el.childNodes];
      for (const n of nodes) if (n.nodeType === 3) {
        const value = n.nodeValue.trim(), en = originals.get(n) || value;
        if (Object.hasOwn(entries, en) && (value === en || value === entries[en])) {
          originals.set(n,en); const changed = n.nodeValue.replace(value, text(en));
          if (n.nodeValue !== changed) n.nodeValue = changed;
          if (locale === 'es') el.lang = 'es'; else el.removeAttribute('lang');
        }
      }
      const attrs = originalAttrs.get(el) || {};
      for (const attr of ['aria-label','title','placeholder']) {
        const value = el.getAttribute(attr); if (!value) continue;
        const en = attrs[attr] || value;
        if (Object.hasOwn(entries, en) && (value === en || value === entries[en])) {
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
