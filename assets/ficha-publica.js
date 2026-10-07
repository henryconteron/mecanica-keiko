(() => {
  const initial = JSON.parse(document.querySelector('#product-data').textContent), config = window.KEIKO_CONFIG;
  const id = initial.panelId, headers = {apikey:config.supabaseAnonKey,Authorization:'Bearer '+config.supabaseAnonKey};
  let current = initial, photos = initial.avisoFoto ? [] : ['./photo.jpg'];
  const contact = () => window.KEIKO_PAGE_MODEL.contact(window.KEIKO_PAGE_CONTENT);
  const price = value => value === null || value === 'Consultar' ? 'Consultar' : 'USD ' + value;
  const list = (selector, items) => { const node=document.querySelector(selector);node.replaceChildren();for(const text of items||[]){const li=document.createElement('li');li.textContent=text;node.append(li);} };
  document.querySelector('#product-share').onclick = () => window.KEIKO_PROMOTION.open({name:current.nombre,code:current.codigo,price:price(current.precio),url:location.href,text:[contact().name,current.nombre,'Código: '+current.codigo,price(current.precio),'Confirma compatibilidad y disponibilidad.',location.href].join('\n'),photos,resolvePhoto:async i=>photos[i]});
  (async () => {
    const response=await fetch(config.supabaseUrl+'/rest/v1/productos_admin?id=eq.'+id+'&revision=eq.publicado&select=id,codigo,nombre,cantidad,precio,descripcion_corta,descripcion,compatibilidad,referencias,fotos',{headers,cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('No se pudo actualizar disponibilidad.');
    const row=(await response.json())[0];
    if(!row){document.querySelector('#product-contact').hidden=true;document.querySelector('#product-share').disabled=true;document.querySelector('#product-status').textContent='Este producto ya no figura en el catálogo publicado. Consulta al taller antes de comprar.';return;}
    current=row;
    const approved = window.KEIKO_PHOTOS?.approved(row.fotos || []) || row.fotos || [];
    const notice = window.KEIKO_PHOTOS?.notice(row.fotos || []);
    if (notice && !approved.length) { document.querySelector('#product-image').hidden=true; document.querySelector('#product-share').disabled=true; document.querySelector('#product-status').textContent='Fotografía del código correcto pendiente de subir. La ficha no utiliza una imagen de otro producto.'; }
    for(const [selector,value] of [['#product-name',row.nombre],['#product-short',row.descripcion_corta],['#product-description',row.descripcion],['#product-price',price(row.precio)],['#product-stock',row.cantidad>0?row.cantidad+' unidades registradas':'Sin stock registrado; consulta reposición']])document.querySelector(selector).textContent=value;
    list('#product-compatibility',row.compatibilidad);list('#product-references',row.referencias);
    const next=await Promise.all(approved.map(async name=>{
      try{const result=await fetch(config.supabaseUrl+'/storage/v1/object/sign/inventario/'+encodeURIComponent(name).replaceAll('%2F','/'),{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:3600}),signal:AbortSignal.timeout(10000)});if(!result.ok)return null;return config.supabaseUrl+'/storage/v1'+(await result.json()).signedURL;}catch{return null;}
    }));
    if(next.some(Boolean)){photos=next.filter(Boolean);document.querySelector('#product-image').hidden=false;document.querySelector('#product-share').disabled=false;document.querySelector('#product-image').src=photos[0];}
  })().catch(()=>{document.querySelector('#product-status').textContent='Mostrando la última ficha publicada. Confirma disponibilidad con el taller.';});
})();
