(() => {
  // Las mismas tres señales del catálogo, también en enlaces directos de productos.
  // Sin cookies ni identificadores: solo código del repuesto y tipo de clic.
  const allowed = new Set(['ver_ficha', 'whatsapp', 'compartir']);
  function register(product, eventType) {
    if (new URL(location.href).searchParams.get('vista-pagina') === '1' || !allowed.has(eventType)) return;
    const config = window.KEIKO_CONFIG || {};
    if (!product?.codigo || !config.supabaseUrl || !config.supabaseAnonKey) return;
    try {
      fetch(`${config.supabaseUrl}/rest/v1/catalogo_eventos`, {
        method:'POST', keepalive:true,
        headers:{ apikey:config.supabaseAnonKey, Authorization:`Bearer ${config.supabaseAnonKey}`, 'Content-Type':'application/json', Prefer:'return=minimal' },
        body:JSON.stringify({ codigo:String(product.codigo).slice(0,80), evento:eventType })
      }).catch(() => {});
    } catch { /* Una métrica nunca debe impedir consultar un repuesto. */ }
  }
  window.KEIKO_CATALOG_EVENTS = Object.freeze({ register });
})();
