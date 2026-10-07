(() => {
  const model = window.KEIKO_PAGE_MODEL;
  if (!model) return;
  const config = window.KEIKO_CONFIG || {};
  const base = model.defaults(document);
  const preview = new URL(location.href).searchParams.get('vista-pagina') === '1' && window.parent !== window;
  let generation = 0;
  let current = { version: 1, fields: {} };
  const imageCache = new Map();
  const imageUrl = async value => {
    if (!value.startsWith('media:')) return value;
    if (imageCache.has(value)) return imageCache.get(value);
    const response = await fetch(`${config.supabaseUrl}/storage/v1/object/sign/pagina-media/${encodeURIComponent(value.slice(6))}`, {
      method: 'POST', headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 3600 }), signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error('Foto no disponible.');
    const body = await response.json();
    const url = `${config.supabaseUrl}/storage/v1${body.signedURL}`;
    imageCache.set(value, url);
    return url;
  };
  window.KEIKO_PAGE_IMAGE = imageUrl;
  const contrast = color => {
    const channels = color.slice(1).match(/../g).map(hex => parseInt(hex, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    return luminance > .179 ? '#171717' : '#ffffff';
  };
  async function apply(content, media = {}) {
    current = model.validate(content);
    const epoch = ++generation;
    window.KEIKO_PAGE_CONTENT = current;
    const combined = { version: 1, fields: { ...base.fields, ...current.fields } };
    for (const field of model.fields) {
      if (!field.selector) continue;
      const node = document.querySelector(field.selector);
      if (!node) continue;
      const value = combined.fields[field.key];
      if (field.type === 'image') {
        if (!value) continue;
        try {
          const url = media[value] || await imageUrl(value);
          if (epoch !== generation) return;
          if (node.tagName === 'IMG') {
            // No borrar la foto actual hasta comprobar que la sustituta carga.
            const img = new Image();
            await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
            if (epoch !== generation) return;
          }
          node.setAttribute(field.attribute, url);
        } catch { /* Conserva la imagen original si falla la nueva. */ }
      } else if (field.attribute) node.setAttribute(field.attribute, value);
      else if (field.type === 'prefix') {
        const child = [...node.childNodes].find(n => n.nodeType === 3);
        if (child) child.textContent = value + ' ';
      } else node.textContent = value;
    }
    const contact = model.contact(combined);
    document.querySelectorAll('a[href^="tel:"]').forEach(link => { link.href = `tel:+${contact.phone}`; });
    document.querySelectorAll('a[href^="https://wa.me/"]').forEach(link => {
      const url = new URL(link.href);
      if (url.pathname === '/') return;
      url.pathname = '/' + contact.whatsapp;
      link.href = url.href;
    });
    const phoneNode = document.querySelector('.contact-row:nth-child(3) a');
    const waNode = document.querySelector('.contact-row:nth-child(4) a');
    if (phoneNode) phoneNode.textContent = '+' + contact.phone;
    if (waNode) waNode.textContent = '+' + contact.whatsapp;
    const schedule = document.querySelector('.contact-row:nth-child(2) div > span');
    if (schedule) {
      schedule.style.whiteSpace = 'pre-line';
      const saturday = `${model.get(combined, 'sabadoAbre')}–${model.get(combined, 'sabadoCierra')}`;
      schedule.textContent = `Lunes a viernes: ${model.get(combined, 'semanaAbre')}–${model.get(combined, 'semanaCierra')}\nSábado: ${model.get(combined, 'sabadoAbierto') === 'true' ? saturday : 'cerrado'}\nDomingo: ${model.get(combined, 'domingoAbierto') === 'true' ? saturday : 'cerrado'}`;
    }
    const map = document.querySelector('.map iframe');
    if (map && ('latitud' in current.fields || 'longitud' in current.fields)) {
      const src = `https://maps.google.com/maps?q=${model.get(combined, 'latitud')},${model.get(combined, 'longitud')}&z=16&output=embed`;
      if (map.getAttribute('src') !== src) map.src = src;
    }
    for (const [key, variable] of [['colorRojo', '--red'], ['colorDorado', '--gold']]) {
      const color = model.get(combined, key);
      document.documentElement.style.setProperty(variable, color);
      document.documentElement.style.setProperty(variable + '-text', contrast(color));
    }
    document.querySelectorAll('meta[property="og:site_name"]').forEach(node => node.content = contact.name);
    const structured = document.querySelector('script[type="application/ld+json"]');
    if (structured) {
      try {
        const data = JSON.parse(structured.textContent);
        data.name = contact.name; data.telephone = '+' + contact.phone;
        data.description = combined.fields.descripcionSeo;
        if (data.address) data.address.streetAddress = combined.fields.direccion;
        if (data.geo) { data.geo.latitude = Number(model.get(combined, 'latitud')); data.geo.longitude = Number(model.get(combined, 'longitud')); }
        data.openingHoursSpecification = [
          { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: model.get(combined, 'semanaAbre'), closes: model.get(combined, 'semanaCierra') },
          ...['Saturday', 'Sunday'].filter(day => model.get(combined, day === 'Saturday' ? 'sabadoAbierto' : 'domingoAbierto') === 'true').map(day => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: day, opens: model.get(combined, 'sabadoAbre'), closes: model.get(combined, 'sabadoCierra') }))
        ];
        data.sameAs = combined.fields.facebook ? [combined.fields.facebook] : [];
        structured.textContent = JSON.stringify(data);
      } catch { /* No altera otros datos estructurados si cambia el formato. */ }
    }
    window.dispatchEvent(new CustomEvent('keiko:pagina', { detail: { content: current, media } }));
  }
  window.addEventListener('keiko:servicios-listos', () => {
    for (let i = 0; i < model.serviceIds.length; i++) for (const suffix of ['Nombre', 'Texto']) {
      const field = model.fields.find(f => f.key === `servicio${i}${suffix}`);
      const node = document.querySelector(field.selector);
      if (node && field.key in current.fields) node.textContent = current.fields[field.key];
    }
  });
  window.KEIKO_PAGE_READY = (async () => {
    if (preview) {
      document.addEventListener('click', event => {
        const link = event.target.closest('a');
        if (link && !link.getAttribute('href')?.startsWith('#')) event.preventDefault();
      }, true);
      document.addEventListener('submit', event => event.preventDefault(), true);
      const banner = document.createElement('div');
      banner.textContent = 'VISTA PREVIA PRIVADA · Nada de esto está publicado';
      banner.style.cssText = 'position:sticky;top:0;z-index:1000;padding:10px;background:#fff0bd;color:#171717;text-align:center;font:700 14px system-ui';
      document.body.prepend(banner);
      window.addEventListener('message', event => {
        if (event.source !== window.parent || event.origin !== location.origin || event.data?.type !== 'keiko:preview') return;
        apply(event.data.content, event.data.media).catch(() => {});
      });
      window.parent.postMessage({ type: 'keiko:preview-ready' }, location.origin);
      return current;
    }
    try {
      if (config.supabaseUrl && config.supabaseAnonKey) {
        const response = await fetch(`${config.supabaseUrl}/rest/v1/pagina_publica?id=eq.1&select=contenido`, {
          cache: 'no-store', headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}` }, signal: AbortSignal.timeout(8000)
        });
        if (response.ok) {
          const row = (await response.json())[0];
          if (row) await apply(row.contenido);
        }
      }
    } catch { /* La web original funciona si no hay conexión o todavía no se instaló el editor. */ }
    return current;
  })();
})();
