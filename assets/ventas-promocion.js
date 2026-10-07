(() => {
  const api = window.KEIKO_ADMIN_API, screen = document.querySelector('#screen-marketing');
  if (!api || !screen) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const box = document.createElement('section'); box.className = 'marketing-card'; box.style.marginTop = '18px';
  box.innerHTML = `<h3>Consultas y ventas reales</h3><p>Registra una oportunidad por consulta real, no por clic. Actualiza la misma fila si pasa a conversación o venta. Información privada, solo para la cuenta propietaria.</p>
    <div class="sales-summary" aria-live="polite"><div>En consulta<strong data-total="consulta">—</strong></div><div>En conversación<strong data-total="conversacion">—</strong></div><div>Ventas registradas<strong data-total="venta">—</strong></div></div>
    <p data-sales-info></p><details><summary>Registrar una consulta real</summary><form data-lead-form style="padding:0">
      <div class="product-grid"><label>Código de producto (opcional)<input name="codigo" maxlength="80"></label>
      <label>De dónde llegó<select name="canal"><option value="whatsapp">WhatsApp</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="google">Google</option><option value="local">Visita al local</option><option value="referido">Referido</option><option value="otro">Otro</option></select></label>
      <label>Estado<select name="etapa"><option value="consulta">Consulta recibida</option><option value="conversacion">Conversación iniciada</option><option value="venta">Venta realizada</option><option value="no_concretada">No se concretó</option></select></label>
      <label>Importe de la venta (USD; opcional)<input name="importe" type="number" min="0" step="0.01"></label>
      <label class="wide">Nota opcional, sin nombres, teléfonos ni placas<textarea name="nota" maxlength="300" placeholder="Ej.: Consultó por filtro; faltó confirmar el motor"></textarea></label></div>
      <button class="primary" type="submit">Registrar</button></form></details>
      <p data-sales-status role="status"></p><div data-leads></div>`;
  screen.append(box);
  const status = message => box.querySelector('[data-sales-status]').textContent = message;
  let rows = [], loading = false;
  const stages = [['consulta','Consulta'],['conversacion','Conversación'],['venta','Venta'],['no_concretada','No concretada']];
  async function load() {
    if (loading) return; loading = true;
    try {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      rows = await api.request('/rest/v1/consultas_taller?select=*&creado=gte.' + encodeURIComponent(since) + '&order=creado.desc&limit=1000');
      for (const stage of ['consulta','conversacion','venta']) box.querySelector('[data-total="' + stage + '"]').textContent = rows.filter(row => row.etapa === stage).length;
      const sales = rows.filter(row => row.etapa === 'venta');
      const sum = sales.reduce((total, row) => total + Number(row.importe || 0), 0);
      box.querySelector('[data-sales-info]').textContent = `Últimos 30 días: ${rows.length} oportunidades registradas · ${rows.filter(row => row.etapa === 'no_concretada').length} no concretadas · USD ${sum.toFixed(2)} con importe registrado. Los estados son actuales, no un embudo histórico. Mostrando las últimas 20 de hasta 1000 registros.`;
      box.querySelector('[data-leads]').innerHTML = rows.slice(0,20).map(row => `<div class="lead-row" data-lead="${esc(row.id)}"><div><strong>${esc(row.codigo || 'Consulta general')}</strong><p>${esc(row.canal)} · ${esc(new Date(row.creado).toLocaleDateString('es-EC'))}</p>${row.nota ? '<p>' + esc(row.nota) + '</p>' : ''}</div><label>Estado<select data-stage>${stages.map(([value,label]) => `<option value="${value}" ${row.etapa === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>Venta USD<input data-amount type="number" min="0" step="0.01" value="${row.importe ?? ''}" style="max-width:110px"></label><button type="button" data-save-lead>Guardar</button></div>`).join('');
    } catch (error) { status('No se pudieron cargar las consultas: ' + error.message); }
    finally { loading = false; }
  }
  box.querySelector('[data-lead-form]').onsubmit = async event => {
    event.preventDefault(); const form = event.currentTarget, button = form.querySelector('button'); if (button.disabled) return;
    const data = Object.fromEntries(new FormData(form)); data.codigo = data.codigo.trim().toUpperCase(); data.nota = data.nota.trim();
    data.importe = data.etapa === 'venta' && data.importe !== '' ? Number(data.importe) : null;
    button.disabled = true;
    try { await api.request('/rest/v1/consultas_taller', { method:'POST', body:JSON.stringify(data) }); form.reset(); await load(); status('Consulta registrada. No se envió ningún mensaje al cliente.'); }
    catch (error) { status(error.message); } finally { button.disabled = false; }
  };
  box.querySelector('[data-leads]').onclick = async event => {
    const button = event.target.closest('[data-save-lead]'); if (!button || button.disabled) return;
    const node = button.closest('[data-lead]'), row = rows.find(item => item.id === node.dataset.lead);
    const etapa = node.querySelector('[data-stage]').value, amount = node.querySelector('[data-amount]').value;
    button.disabled = true;
    try {
      const result = await api.request('/rest/v1/consultas_taller?id=eq.' + encodeURIComponent(row.id) + '&actualizado=eq.' + encodeURIComponent(row.actualizado), { method:'PATCH', headers:{Prefer:'return=representation'}, body:JSON.stringify({ etapa, importe: etapa === 'venta' && amount !== '' ? Number(amount) : null, actualizado:new Date().toISOString() }) });
      if (!result?.length) throw new Error('Otra computadora cambió esta consulta. Actualiza los datos antes de editar.');
      await load(); status('Estado actualizado. No se duplicó la oportunidad.');
    } catch (error) { status(error.message); } finally { button.disabled = false; }
  };
  document.querySelector('[data-screen="marketing"]').addEventListener('click', load);
  document.querySelector('#refresh-marketing').addEventListener('click', load);

  const organic = document.createElement('section'); organic.className = 'marketing-card organic-tools'; organic.style.marginTop = '18px';
  organic.innerHTML = `<h3>Promocionar sin pagar anuncios</h3><ol><li><a href="https://business.google.com/" target="_blank" rel="noopener">Revisar el Perfil de Empresa en Google</a>: mismo nombre, teléfono, ubicación y horario que esta web. La verificación la completa el dueño.</li><li>Elige en la agenda un producto disponible. Prepara su promoción, revisa la foto y compártela en un estado de WhatsApp o grupo local que permita avisos.</li><li>Pide una reseña honesta a clientes reales, sin descuentos, regalos ni pedir solo opiniones positivas. <a href="https://support.google.com/business/answer/3474122?hl=es" target="_blank" rel="noopener">Guía de Google</a>.</li><li>Registra las consultas reales y actualízalas cuando converses o vendas; así sabremos qué producto conviene promocionar.</li></ol>
    <button type="button" data-promo-copy>Preparar texto del producto seleccionado en la agenda</button><textarea data-organic-text aria-label="Texto para revisar y copiar" placeholder="Selecciona un producto en Planear una publicación y pulsa Preparar texto."></textarea>
    <button type="button" data-copy-organic>Copiar texto</button><p data-organic-status role="status">No publica ni envía mensajes automáticamente. Revisa disponibilidad, precio y compatibilidad antes de compartir.</p>`;
  screen.append(organic);
  organic.querySelector('[data-promo-copy]').onclick = async () => {
    const code = document.querySelector('#publication-product').value;
    if (!code) { organic.querySelector('[data-organic-status]').textContent = 'Selecciona un producto en la agenda.'; return; }
    try {
      const products = await api.request('/rest/v1/productos_admin?revision=eq.publicado&codigo=eq.' + encodeURIComponent(code) + '&select=id,codigo,nombre,cantidad,precio,descripcion_corta');
      const product = products[0]; if (!product || product.cantidad <= 0) throw new Error('Este producto no está publicado o no tiene stock disponible.');
      const contact = window.KEIKO_PAGE_MODEL.contact(window.KEIKO_PAGE_CONTENT);
      let ready = false;
      try { const response = await fetch('data/catalogo-panel.json', {cache:'no-store'}); const snapshot=await response.json(); ready=snapshot.productos?.some(item=>item.panelId===product.id); } catch { /* Un producto nuevo todavía puede abrirse desde el catálogo dinámico. */ }
      const link = new URL(ready ? 'productos/panel-' + product.id + '/' : './?producto=' + product.id + '#repuestos', document.baseURI).href;
      organic.querySelector('[data-organic-text]').value = [contact.name, product.nombre, 'Código: ' + product.codigo, product.descripcion_corta, product.precio === null ? 'Precio: consultar' : 'Precio: USD ' + product.precio, 'Confirma compatibilidad por modelo, año y motor.', 'Consulta y reserva: https://wa.me/' + contact.whatsapp, 'Fotos y detalles: ' + link].filter(Boolean).join('\n');
      organic.querySelector('[data-organic-status]').textContent = 'Borrador listo. No añade garantías ni beneficios que no consten en la ficha.';
    } catch (error) { organic.querySelector('[data-organic-status]').textContent = error.message; }
  };
  organic.querySelector('[data-copy-organic]').onclick = async () => {
    const input = organic.querySelector('[data-organic-text]'); if (!input.value) return;
    try { await navigator.clipboard.writeText(input.value); organic.querySelector('[data-organic-status]').textContent = 'Copiado. Revisa las reglas del grupo antes de publicar.'; }
    catch { input.select(); organic.querySelector('[data-organic-status]').textContent = 'Selecciona y copia el texto manualmente.'; }
  };
})();
