// Identidad/contacto compartidos para fichas estáticas; nunca cambia los datos del producto.
(() => {
  const root = new URL('../', document.currentScript.src);
  const config = window.KEIKO_CONFIG;
  const model = window.KEIKO_PAGE_MODEL;
  if (!config || !model) return;
  (async () => {
    const headers = { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}` };
    const response = await fetch(`${config.supabaseUrl}/rest/v1/pagina_publica?id=eq.1&select=contenido`, { headers, cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!response.ok) return;
    const row = (await response.json())[0]; if (!row) return;
    const content = model.validate(row.contenido), contact = model.contact(content);
    window.KEIKO_PAGE_CONTENT = content;
    document.querySelectorAll('a[href^="tel:"]').forEach(link => link.href = `tel:+${contact.phone}`);
    document.querySelectorAll('a[href^="https://wa.me/"]').forEach(link => { const url = new URL(link.href); if (url.pathname !== '/') { url.pathname = '/' + contact.whatsapp; link.href = url.href; } });
    if (content.fields.nombre) document.querySelectorAll('.brand > span').forEach(node => node.textContent = contact.name);
    const image = content.fields.logo;
    if (image) {
      let url = new URL(image, root).href;
      if (image.startsWith('media:')) {
        const sign = await fetch(`${config.supabaseUrl}/storage/v1/object/sign/pagina-media/${encodeURIComponent(image.slice(6))}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }), signal: AbortSignal.timeout(8000) });
        if (!sign.ok) return;
        url = `${config.supabaseUrl}/storage/v1${(await sign.json()).signedURL}`;
      }
      const check = new Image(); check.onload = () => document.querySelectorAll('.brand img').forEach(node => node.src = url); check.src = url;
    }
  })().catch(() => { /* Conserva el contacto original si el servicio no responde. */ });
})();
