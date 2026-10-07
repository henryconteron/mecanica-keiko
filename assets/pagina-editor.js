(() => {
  const model = window.KEIKO_PAGE_MODEL;
  const api = window.KEIKO_ADMIN_API;
  if (!model || !api) return;
  const q = selector => document.querySelector(selector);
  const status = (message, error = false) => { q('#website-status').textContent = message; q('#website-status').dataset.error = String(error); };
  let baseline, content, saved, row, busy = false, activeSection = 'identidad', unlocked = false;
  let history = [];
  let previewContent, previewMedia = {};
  const mediaUrls = new Map();
  const fingerprint = data => JSON.stringify(Object.entries(data?.fields || {}).sort(([a], [b]) => a.localeCompare(b)));
  const changedKeys = (a, b) => model.fields.filter(field => (a?.fields[field.key] ?? baseline.fields[field.key]) !== (b?.fields[field.key] ?? baseline.fields[field.key]));
  const setBusy = value => {
    busy = value;
    q('#website-editor').querySelectorAll('button,input,textarea,select').forEach(node => node.disabled = value);
    q('#website-confirm').querySelectorAll('button,input').forEach(node => node.disabled = value);
  };
  function rawForm() {
    const fields = {};
    q('#website-fields').querySelectorAll('[data-field]').forEach(input => {
      if (input.value.trim() !== baseline.fields[input.dataset.field]) fields[input.dataset.field] = input.value.trim();
    });
    return { version: 1, fields };
  }
  const readForm = () => model.validate(rawForm());
  function updateChanges() {
    try {
      content = readForm();
      const changed = changedKeys(content, saved).length;
      const pending = changedKeys(content, row.publicado).length;
      q('#website-changes').textContent = `${changed ? `${changed} campo(s) sin guardar` : 'Borrador guardado'} · ${pending} diferencia(s) respecto de la página pública. Guardar no publica.`;
      q('#website-fields').querySelectorAll('[data-field]').forEach(input => input.closest('.website-field').classList.toggle('is-changed', changedKeys(content, row.publicado).some(field => field.key === input.dataset.field)));
    } catch (error) { q('#website-changes').textContent = error.message; }
  }
  const mediaUrl = async value => {
    if (!value) return '';
    if (!value.startsWith('media:')) return value;
    if (mediaUrls.has(value)) return mediaUrls.get(value);
    const result = await api.request(`/storage/v1/object/sign/pagina-media/${encodeURIComponent(value.slice(6))}`, { method: 'POST', body: JSON.stringify({ expiresIn: 3600 }) });
    const url = `${window.KEIKO_CONFIG.supabaseUrl}/storage/v1${result.signedURL}`;
    mediaUrls.set(value, url);
    return url;
  };
  async function showImage(value, node) {
    node.hidden = true;
    try { const url = await mediaUrl(value); if (node.dataset.value !== value) return; node.src = url; node.hidden = !url; } catch { /* El error aparece al revisar la vista previa, no se borra la foto. */ }
  }
  function renderFields() {
    const target = q('#website-fields'); target.replaceChildren();
    for (const field of model.fields) {
      const wrapper = document.createElement('div'); wrapper.className = 'website-field'; wrapper.dataset.section = field.section;
      const label = document.createElement('label'); label.htmlFor = `page-field-${field.key}`; label.textContent = field.label;
      const input = document.createElement(field.type === 'boolean' ? 'select' : field.multiline ? 'textarea' : 'input');
      input.id = label.htmlFor; input.dataset.field = field.key; input.required = !!field.required;
      if (field.type === 'boolean') { input.add(new Option('Sí', 'true')); input.add(new Option('No', 'false')); }
      else if (input.tagName === 'INPUT') input.type = field.type === 'time' ? 'time' : field.type === 'color' ? 'color' : 'text';
      input.maxLength = field.type === 'image' ? 350 : field.max || 180;
      input.value = content.fields[field.key] ?? baseline.fields[field.key];
      if (field.type === 'image') input.readOnly = true;
      label.append(input); wrapper.append(label);
      const help = document.createElement('small'); help.id = `${input.id}-help`;
      help.textContent = field.help || (field.multiline ? `Texto sin formato. Máximo ${field.max} caracteres; no pegues código HTML.` : field.type === 'text' || field.type === 'prefix' ? `Máximo ${field.max} caracteres. El diseño se ajusta automáticamente.` : 'Revisa este dato antes de publicar.');
      input.setAttribute('aria-describedby', help.id); wrapper.append(help);
      const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Volver al valor original';
      reset.onclick = () => { input.value = baseline.fields[field.key]; input.dispatchEvent(new Event('input', { bubbles: true })); };
      wrapper.append(reset);
      if (field.type === 'image') {
        const image = document.createElement('img'); image.alt = `Vista actual: ${field.label}`; image.dataset.value = input.value;
        image.onerror = () => { image.hidden = true; }; wrapper.append(image); showImage(input.value, image);
        input.addEventListener('input', () => { image.dataset.value = input.value; showImage(input.value, image); });
        const uploadLabel = document.createElement('label'); uploadLabel.textContent = 'Subir otra imagen (máximo 5 MB)';
        const upload = document.createElement('input'); upload.type = 'file'; upload.accept = 'image/jpeg,image/png,image/webp';
        uploadLabel.append(upload); wrapper.append(uploadLabel);
        upload.onchange = async () => {
          const file = upload.files[0]; if (!file || busy) return;
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { upload.value = ''; return status('Usa JPG, PNG o WebP de hasta 5 MB.', true); }
          setBusy(true); status('Subiendo imagen privada. No sustituirá la foto publicada hasta que publiques.');
          try {
            await createImageBitmap(file).then(bitmap => { if (bitmap.width * bitmap.height > 40000000) { bitmap.close(); throw new Error('La foto es demasiado grande; usa menos de 40 megapíxeles.'); } bitmap.close(); });
            const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
            const name = `${crypto.randomUUID()}.${extension}`;
            await api.request(`/storage/v1/object/pagina-media/${name}`, { method: 'POST', headers: { 'Content-Type': file.type, 'x-upsert': 'false' }, body: file });
            input.value = 'media:' + name; input.dispatchEvent(new Event('input', { bubbles: true })); status('Imagen preparada. Guarda el borrador y revísala antes de publicar.');
          } catch (error) { status(error.message, true); } finally { upload.value = ''; setBusy(false); }
        };
      }
      target.append(wrapper);
    }
    filterFields(); updateChanges();
  }
  function filterFields() {
    const search = q('#website-search').value.toLocaleLowerCase('es').trim();
    q('#website-fields').querySelectorAll('.website-field').forEach(node => { node.hidden = search ? !node.textContent.toLocaleLowerCase('es').includes(search) : node.dataset.section !== activeSection; });
    q('#website-sections').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.section === activeSection && !search)));
  }
  function renderSections() {
    q('#website-sections').replaceChildren();
    for (const [id, title, explanation] of model.sections) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = title; button.dataset.section = id;
      button.onclick = () => { activeSection = id; q('#website-search').value = ''; filterFields(); status(explanation); };
      q('#website-sections').append(button);
    }
  }
  async function loadHistory() {
    history = await api.request('/rest/v1/pagina_historial?select=id,contenido,creado&order=creado.desc&limit=20');
    const select = q('#website-history'); select.replaceChildren(new Option('Selecciona una versión', ''));
    for (const item of history) select.add(new Option(new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.creado)), String(item.id)));
  }
  async function load() {
    const response = await fetch('./index.html', { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo leer la página original.');
    baseline = model.validate(model.defaults(new DOMParser().parseFromString(await response.text(), 'text/html')));
    const [drafts, published] = await Promise.all([
      api.request('/rest/v1/pagina_borrador?id=eq.1&select=contenido,revision,actualizado'),
      api.request('/rest/v1/pagina_publica?id=eq.1&select=contenido,actualizado')
    ]);
    if (!drafts[0] || !published[0]) throw new Error('El editor necesita la instalación de supabase/pagina-web.sql por la cuenta propietaria.');
    row = { ...drafts[0], publicado: model.validate(published[0].contenido) };
    window.KEIKO_PAGE_CONTENT = row.publicado;
    content = model.validate(row.contenido); saved = structuredClone(content);
    await loadHistory(); renderSections(); renderFields();
  }
  q('#website-unlock').onsubmit = async event => {
    event.preventDefault(); if (busy) return;
    const password = q('#website-password').value; q('#website-password').value = '';
    busy = true; q('#website-unlock button').disabled = true; status('Confirmando acceso y cargando contenido…');
    try {
      await api.confirmPassword(password); await load(); unlocked = true;
      q('#website-unlock').hidden = true; q('#website-editor').hidden = false;
      q('#website-guide').open = false;
      status('Editor desbloqueado. Los visitantes solo ven la última versión publicada.');
    } catch (error) { status(/pagina_|schema cache|relation/i.test(error.message) ? 'Falta activar el editor en Supabase. Ejecuta supabase/pagina-web.sql en SQL Editor; los demás controles siguen funcionando.' : 'No se pudo desbloquear: ' + error.message, true); }
    finally { busy = false; q('#website-unlock button').disabled = false; }
  };
  q('#website-fields').addEventListener('input', updateChanges);
  q('#website-fields').onsubmit = event => event.preventDefault();
  q('#website-search').oninput = filterFields;
  async function save() {
    content = readForm();
    const result = await api.request('/rest/v1/rpc/pagina_guardar', { method: 'POST', body: JSON.stringify({ p_contenido: content, p_revision: row.revision }) });
    row.revision = result.revision; saved = structuredClone(content); updateChanges();
  }
  q('#website-save').onclick = async () => {
    if (busy) return; setBusy(true);
    try { await save(); status('Borrador guardado y compartido entre tus computadoras. La web pública no cambió.'); }
    catch (error) { status(error.message, true); } finally { setBusy(false); }
  };
  function sendPreview() {
    if (previewContent && q('#website-preview-dialog').open) q('#website-preview-frame').contentWindow.postMessage({ type: 'keiko:preview', content: previewContent, media: previewMedia }, location.origin);
  }
  window.addEventListener('message', event => {
    if (event.origin === location.origin && event.source === q('#website-preview-frame').contentWindow && event.data?.type === 'keiko:preview-ready') sendPreview();
  });
  q('#website-preview').onclick = async () => {
    if (busy) return; setBusy(true);
    try {
      previewContent = readForm(); previewMedia = {};
      for (const field of model.fields.filter(f => f.type === 'image')) {
        const value = previewContent.fields[field.key];
        if (value?.startsWith('media:')) previewMedia[value] = await mediaUrl(value);
      }
      q('#website-preview-dialog').showModal();
      q('#website-preview-frame').src = './?vista-pagina=1';
    } catch (error) { status(error.message, true); } finally { setBusy(false); }
  };
  q('#website-preview-mobile').onclick = () => q('#website-preview-frame').classList.toggle('is-mobile');
  q('#website-preview-close').onclick = () => q('#website-preview-dialog').close();
  q('#website-preview-dialog').addEventListener('close', () => { q('#website-preview-frame').src = 'about:blank'; previewContent = null; previewMedia = {}; });
  q('#website-publish').onclick = () => {
    if (busy) return;
    try {
      content = readForm();
      const changes = changedKeys(content, row.publicado);
      if (!changes.length) return status('No hay cambios respecto de la página publicada.');
      q('#website-publish-summary').textContent = `${changes.length} campo(s): ${changes.map(field => field.label).join(', ')}.`;
      q('#website-confirm-error').textContent = ''; q('#website-publish-dialog').showModal(); q('#website-publish-password').focus();
    } catch (error) { status(error.message, true); }
  };
  q('#website-confirm').onsubmit = async event => {
    event.preventDefault(); if (busy) return;
    const password = q('#website-publish-password').value; q('#website-publish-password').value = ''; setBusy(true);
    try {
      // Una sesión recién autenticada es obligatoria también en la función del servidor.
      await api.confirmPassword(password);
      await save();
      const result = await api.request('/rest/v1/rpc/pagina_publicar', { method: 'POST', body: JSON.stringify({ p_revision: row.revision }) });
      row.revision = result.revision; row.publicado = structuredClone(content); saved = structuredClone(content);
      window.KEIKO_PAGE_CONTENT = row.publicado;
      q('#website-publish-dialog').close(); updateChanges();
      status('Página publicada. Al abrir o recargar la web se verá en todos los dispositivos.');
      try { await loadHistory(); } catch { status('Página publicada. No se pudo recargar el historial; vuelve a desbloquear para verlo.'); }
    } catch (error) { q('#website-confirm-error').textContent = error.message; } finally { setBusy(false); }
  };
  q('#website-publish-cancel').onclick = () => q('#website-publish-dialog').close();
  q('#website-publish-dialog').addEventListener('close', () => { q('#website-publish-password').value = ''; });
  function prepare(value) {
    if (fingerprint(rawForm()) !== fingerprint(saved) && !confirm('Tienes cambios sin guardar. ¿Quieres reemplazarlos por esta propuesta?')) return;
    content = model.validate(value); renderFields(); status('Versión preparada. Guarda y revisa la vista previa antes de publicar.');
  }
  q('#website-restore').onclick = () => {
    const item = history.find(item => String(item.id) === q('#website-history').value);
    if (!item) return status('Selecciona una versión anterior.', true);
    try { prepare(item.contenido); } catch (error) { status(error.message, true); }
  };
  q('#website-reset').onclick = () => { try { prepare({ version: 1, fields: {} }); } catch (error) { status(error.message, true); } };
  q('#website-lock').onclick = () => {
    if (busy || fingerprint(rawForm()) !== fingerprint(saved) && !confirm('Hay cambios sin guardar. ¿Bloquear y descartarlos?')) return;
    unlocked = false; q('#website-editor').hidden = true; q('#website-unlock').hidden = false;
    q('#website-fields').replaceChildren(); content = saved = null; mediaUrls.clear(); status('Editor bloqueado. El borrador guardado permanece en Supabase.');
  };
  window.addEventListener('beforeunload', event => {
    if (unlocked && fingerprint(rawForm()) !== fingerprint(saved)) { event.preventDefault(); event.returnValue = ''; }
  });
})();
