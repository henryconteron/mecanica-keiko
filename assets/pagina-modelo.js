/* Esquema compartido: únicamente contenido, nunca HTML, scripts o selectores del usuario. */
(() => {
  const sections = [
    ['identidad', 'Identidad y buscadores', 'Nombre, logotipo y títulos de la web. Los cambios de buscadores y redes pueden tardar en reflejarse; sus robots no siempre ejecutan JavaScript.'],
    ['portada', 'Portada', 'La primera impresión. Usa un título breve y una explicación clara de lo que realmente ofrece el taller.'],
    ['servicios', 'Servicios', 'Modifica las tarjetas existentes; no cambies aquí productos ni disponibilidad del taller.'],
    ['repuestos', 'Presentación del catálogo', 'Solo títulos y explicaciones. Las fichas, fotos, precios y existencias se administran en Productos.'],
    ['compatibilidad', 'Ayuda para elegir repuestos', 'Instrucciones que verá el cliente antes de consultar. No sustituyen la verificación técnica de cada producto.'],
    ['contacto', 'Contacto y horarios', 'Estos datos cambian los enlaces de contacto de toda la página. Los horarios también controlan el estado automático del taller.'],
    ['fotos', 'Fotos reales del local y servicios', 'Sube solo fotografías propias o autorizadas. Evita rostros, placas y datos personales. Cada galería admite seis fotos; dejar un espacio vacío no agrega imágenes ficticias. Guarda, revisa y publica cuando esté listo.'],
    ['apariencia', 'Apariencia y pie de página', 'Colores seguros y textos del cierre. Se conserva el diseño adaptable para no romper la web.']
  ];
  const fields = [];
  const add = (section, key, label, selector, extra = {}) => fields.push({ section, key, label, selector, type: 'text', max: 180, ...extra });
  add('identidad', 'nombre', 'Nombre del negocio', '.brand-copy strong', { max: 45, required: true });
  add('identidad', 'subtitulo', 'Texto debajo del nombre', '.brand-copy > span', { max: 65 });
  add('identidad', 'tituloSeo', 'Título de la pestaña / buscador', 'title', { max: 100, required: true });
  add('identidad', 'descripcionSeo', 'Descripción para buscadores', 'meta[name="description"]', { attribute: 'content', max: 250, multiline: true });
  add('identidad', 'tituloSocial', 'Título al compartir el enlace', 'meta[property="og:title"]', { attribute: 'content', max: 100 });
  add('identidad', 'descripcionSocial', 'Descripción al compartir el enlace', 'meta[property="og:description"]', { attribute: 'content', max: 250, multiline: true });
  add('identidad', 'logo', 'Logotipo', '.brand-logo img', { type: 'image', attribute: 'src', help: 'PNG, JPG o WebP. El tamaño del encabezado permanece protegido.' });
  add('identidad', 'imagenSocial', 'Imagen al compartir el enlace', 'meta[property="og:image"]', { type: 'image', attribute: 'content' });
  ['Servicios', 'Repuestos', 'Ubicación', 'Escribir por WhatsApp'].forEach((label, i) => add('identidad', `menu${i}`, `Menú: ${label}`, `.nav-links a:nth-child(${i + 1})`, { max: 35, required: true }));
  add('portada', 'portadaEtiqueta', 'Frase pequeña sobre el título', '.hero-copy .eyebrow', { max: 85 });
  add('portada', 'portadaTitulo', 'Título principal', '.hero-copy h1', { max: 100, required: true });
  add('portada', 'portadaTexto', 'Explicación principal', '.hero-lead', { max: 420, multiline: true });
  add('portada', 'portadaLlamar', 'Texto del botón de llamada', '.hero-actions a:first-child', { max: 65, required: true });
  add('portada', 'portadaCatalogo', 'Texto del botón de repuestos', '.hero-actions a:last-child', { max: 45, required: true });
  add('portada', 'portadaImagen', 'Foto o mascota de portada', '.hero-visual > img', { type: 'image', attribute: 'src' });
  add('portada', 'portadaImagenAlt', 'Descripción de la imagen (accesibilidad)', '.hero-visual > img', { attribute: 'alt', max: 180 });
  for (let i = 0; i < 4; i++) add('portada', `dato${i}`, `Dato rápido ${i + 1}`, `.hero-facts .fact:nth-child(${i + 1})`, { max: 65 });
  for (const [section, id] of [['servicios', 'servicios'], ['repuestos', 'repuestos']]) {
    add(section, `${section}Etiqueta`, 'Frase pequeña de la sección', `#${id} .section-head .eyebrow`, { max: 75 });
    add(section, `${section}Titulo`, 'Título de la sección', `#${id} .section-head h2`, { max: 110, required: true });
    add(section, `${section}Texto`, 'Explicación de la sección', `#${id} .section-head > p:last-child`, { max: 500, multiline: true });
  }
  const serviceIds = ['mecanica-general', 'mecanica-rapida', 'frenos', 'reparacion-motor', 'alineacion-computarizada', 'balanceo'];
  const serviceNames = ['Mecánica general', 'Mecánica rápida', 'Frenos', 'Reparación de motor', 'Alineación computarizada', 'Balanceo'];
  serviceIds.forEach((id, i) => {
    add('servicios', `servicio${i}Nombre`, `${serviceNames[i]}: nombre`, `[data-service-id="${id}"] h3`, { max: 70, required: true });
    add('servicios', `servicio${i}Texto`, `${serviceNames[i]}: explicación`, `[data-service-id="${id}"] .service-body p`, { max: 500, multiline: true });
    add('fotos', `servicio${i}Imagen`, `${serviceNames[i]}: foto 1 / portada`, '', { type: 'image', default: '', help: 'Opcional. Una foto real autorizada. Vacío no añade ninguna imagen.' });
    for (let j = 0; j < 5; j++) add('fotos', `servicio${i}Foto${j}`, `${serviceNames[i]}: foto ${j + 2}`, '', { type: 'image', default: '', help: 'Opcional. La foto de portada se administra en Servicios. Quitar solo retira esta foto de la galería; conserva el archivo original.' });
  });
  for (let i = 0; i < 6; i++) add('fotos', `localFoto${i}`, `Local: foto ${i + 1}`, '', { type: 'image', default: '', help: 'Foto real autorizada del local. Los espacios vacíos no aparecen en la web.' });
  add('repuestos', 'buscador', 'Ayuda dentro del buscador', '#catalog-search', { attribute: 'placeholder', max: 100 });
  add('repuestos', 'avisoRepuestos', 'Aviso importante del catálogo', '.parts-note', { multiline: true, max: 650 });
  add('compatibilidad', 'compatEtiqueta', 'Frase pequeña', '.compat-copy .eyebrow', { max: 80 });
  add('compatibilidad', 'compatTitulo', 'Título', '.compat-copy h2', { max: 110, required: true });
  add('compatibilidad', 'compatTexto', 'Explicación', '.compat-copy > p:not(.eyebrow)', { max: 500, multiline: true });
  add('compatibilidad', 'compatBoton', 'Texto del botón', '.compat-copy a', { max: 45, required: true });
  for (let i = 0; i < 4; i++) add('compatibilidad', `compatDato${i}`, `Dato que debe enviar el cliente ${i + 1}`, `.checklist li:nth-child(${i + 1})`, { max: 150 });
  add('contacto', 'contactoEtiqueta', 'Frase pequeña', '.contact-info > .eyebrow', { max: 75 });
  add('contacto', 'contactoTitulo', 'Título de ubicación', '.contact-info > h2', { max: 100, required: true });
  add('contacto', 'direccion', 'Dirección', '.contact-row:nth-child(1) div > span', { max: 220, required: true });
  add('contacto', 'telefono', 'Teléfono del mecánico', '', { type: 'phone', default: '593939876118', help: 'Código de país y número, sin +. Ejemplo Ecuador: 593939876118.' });
  add('contacto', 'whatsapp', 'WhatsApp de consultas y repuestos', '', { type: 'phone', default: '593989381059', help: 'Código de país y número, sin +. Cambia también las consultas de productos y promociones.' });
  add('contacto', 'facebook', 'Enlace de Facebook', '.contact-actions a:last-child', { type: 'facebook', attribute: 'href', max: 500 });
  add('contacto', 'latitud', 'Latitud del taller', '', { type: 'latitude', default: '-0.9138362378621425', help: 'Coordenada de Google Maps. Negativa al sur del Ecuador.' });
  add('contacto', 'longitud', 'Longitud del taller', '', { type: 'longitude', default: '-77.81032971735118', help: 'Coordenada de Google Maps. Negativa al oeste.' });
  for (const [key, label, value] of [['semanaAbre', 'Lunes a viernes: apertura', '08:00'], ['semanaCierra', 'Lunes a viernes: cierre', '17:00'], ['sabadoAbre', 'Sábado: apertura', '08:00'], ['sabadoCierra', 'Sábado: cierre', '13:00']]) add('contacto', key, label, '', { type: 'time', default: value });
  add('contacto', 'sabadoAbierto', 'Atender los sábados', '', { type: 'boolean', default: 'true' });
  add('contacto', 'domingoAbierto', 'Atender los domingos (mismo horario del sábado)', '', { type: 'boolean', default: 'false' });
  add('apariencia', 'colorRojo', 'Color principal', '', { type: 'color', default: '#c8272c', help: 'Botones e identidad. El panel ajusta el texto para mantener el contraste.' });
  add('apariencia', 'colorDorado', 'Color de acento', '', { type: 'color', default: '#e9a927' });
  add('apariencia', 'pieNombre', 'Texto de derechos y ubicación', '.footer-inner > span:first-child', { max: 150 });
  add('apariencia', 'pieTexto', 'Texto antes del enlace de consulta', '.footer-inner > span:last-child', { type: 'prefix', max: 100 });
  add('apariencia', 'pieBoton', 'Texto del enlace de consulta', '.footer-inner a', { max: 50, required: true });
  const byKey = new Map(fields.map(field => [field.key, field]));
  const validImage = value => value === '' || /^media:[a-f0-9-]{36}\.(jpg|png|webp)$/.test(value) || /^assets\/[\w\-./]+\.(png|jpe?g|webp)$/i.test(value) && !value.includes('..');
  function validate(content) {
    if (!content || content.version !== 1 || !content.fields || Array.isArray(content.fields) || typeof content.fields !== 'object' || Object.keys(content).some(key => !['version', 'fields'].includes(key))) throw new Error('Formato de contenido no válido.');
    const result = { version: 1, fields: {} };
    for (const [key, value] of Object.entries(content.fields)) {
      const field = byKey.get(key);
      if (!field || typeof value !== 'string' || value.length > (field.type === 'image' ? 350 : field.max || 180) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error(`Revisa el campo ${field?.label || key}.`);
      const v = value.trim();
      if (field.required && !v) throw new Error(`Completa ${field.label}.`);
      if (field.type === 'image' && !validImage(v)) throw new Error(`Sube una imagen válida en ${field.label}; no se permiten enlaces externos.`);
      if (field.type === 'phone' && !/^[1-9]\d{7,14}$/.test(v)) throw new Error(`Revisa ${field.label}: usa código de país y solo números.`);
      if (field.type === 'facebook' && v) {
        let u; try { u = new URL(v); } catch {}
        if (!u || u.protocol !== 'https:' || !['facebook.com', 'www.facebook.com', 'm.facebook.com'].includes(u.hostname) || u.username || u.password) throw new Error('Usa un enlace HTTPS de Facebook.');
      }
      if (['latitude', 'longitude'].includes(field.type) && (!/^-?\d+(\.\d+)?$/.test(v) || Math.abs(Number(v)) > (field.type === 'latitude' ? 90 : 180))) throw new Error(`Revisa ${field.label}.`);
      if (field.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new Error(`Revisa ${field.label}.`);
      if (field.type === 'boolean' && !['true', 'false'].includes(v)) throw new Error(`Revisa ${field.label}.`);
      if (field.type === 'color' && !/^#[a-f\d]{6}$/i.test(v)) throw new Error(`Revisa ${field.label}.`);
      result.fields[key] = v;
    }
    for (const prefix of ['semana', 'sabado']) if (get(result, `${prefix}Abre`) >= get(result, `${prefix}Cierra`)) throw new Error('La hora de cierre debe ser posterior a la apertura.');
    return result;
  }
  function get(content, key) { return content?.fields?.[key] ?? byKey.get(key)?.default ?? ''; }
  function defaults(doc) {
    const values = {};
    for (const field of fields) {
      const node = field.selector && doc.querySelector(field.selector);
      values[field.key] = field.default ?? (field.attribute ? node?.getAttribute(field.attribute) : field.type === 'prefix' ? [...node?.childNodes || []].filter(n => n.nodeType === 3).map(n => n.textContent).join('') : node?.textContent)?.trim() ?? '';
      if (field.type === 'image') {
        const canonical = doc.querySelector('meta[property="og:url"]')?.getAttribute('content');
        if (canonical && values[field.key].startsWith(canonical.replace(/\/$/, '') + '/assets/')) values[field.key] = values[field.key].slice(canonical.replace(/\/$/, '').length + 1);
      }
    }
    return { version: 1, fields: values };
  }
  function contact(content) {
    return { phone: get(content, 'telefono'), whatsapp: get(content, 'whatsapp'), name: get(content, 'nombre') || 'Mecánica Keiko' };
  }
  function isOpen(content, weekday, minutes) {
    const weekdayOpen = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday);
    if (!weekdayOpen && get(content, weekday === 'Sat' ? 'sabadoAbierto' : 'domingoAbierto') !== 'true') return false;
    const toMinutes = key => { const [h, m] = get(content, key).split(':').map(Number); return h * 60 + m; };
    const prefix = weekdayOpen ? 'semana' : 'sabado';
    return minutes >= toMinutes(`${prefix}Abre`) && minutes < toMinutes(`${prefix}Cierra`);
  }
  globalThis.KEIKO_PAGE_MODEL = Object.freeze({ sections, fields, serviceIds, validate, defaults, get, contact, isOpen });
})();
