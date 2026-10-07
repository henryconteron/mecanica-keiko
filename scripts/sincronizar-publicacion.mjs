// Solo datos YA publicados y clave pública. Nunca exporta borradores, fuentes internas ni clientes.
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import sharp from 'sharp';
import '../assets/pagina-modelo.js';
const root = process.cwd(), ctx = { window: {} };
vm.runInNewContext(await readFile(path.join(root, 'assets/config.js'), 'utf8'), ctx);
const config = ctx.window.KEIKO_CONFIG;
const headers = { apikey:config.supabaseAnonKey, Authorization:'Bearer ' + config.supabaseAnonKey };
const base = 'https://henryconteron.github.io/mecanica-keiko/';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json = async route => {
  const response = await fetch(config.supabaseUrl + route, { headers, signal:AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('No se pudo consultar contenido publicado: ' + response.status);
  return response.json();
};
const rows = await json('/rest/v1/productos_admin?revision=eq.publicado&select=id,codigo,nombre,cantidad,precio,marca,categoria,descripcion_corta,descripcion,compatibilidad,referencias,fotos&order=codigo');
if (!rows.length) throw new Error('Catálogo público vacío: no se reemplazará el contenido de respaldo.');
const page = (await json('/rest/v1/pagina_publica?id=eq.1&select=contenido'))[0]?.contenido || {version:1,fields:{}};
const content = globalThis.KEIKO_PAGE_MODEL.validate(page), contact = globalThis.KEIKO_PAGE_MODEL.contact(content);
const photo = async (bucket, name) => {
  const response = await fetch(config.supabaseUrl + '/storage/v1/object/sign/' + bucket + '/' + encodeURIComponent(name).replaceAll('%2F','/'), { method:'POST', headers:{ ...headers, 'Content-Type':'application/json' }, body:JSON.stringify({expiresIn:120}), signal:AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('No se pudo firmar una foto publicada.');
  const signed = (await response.json()).signedURL;
  const source = await fetch(config.supabaseUrl + '/storage/v1' + signed, {signal:AbortSignal.timeout(20000)});
  if (!source.ok) throw new Error('No se pudo leer una foto publicada.');
  const buffer = Buffer.from(await source.arrayBuffer());
  if (buffer.length > 15000000) throw new Error('Foto demasiado grande.');
  return buffer;
};
function lines(text, max = 28) {
  const out = []; let line = '';
  for (const word of String(text).split(/\s+/)) {
    if ((line + ' ' + word).trim().length > max && line) { out.push(line); line = word; } else line = (line + ' ' + word).trim();
  }
  out.push(line); return out.slice(0,4).map((v,i) => esc(i === 3 && out.length > 4 ? v.slice(0,max-1) + '…' : v));
}
const products = [];
// Primero preparar todo; un fallo de foto no debe retirar páginas que ya funcionan.
const prepared = [];
for (const rawRow of rows) {
  const avisoFoto = ctx.window.KEIKO_PHOTOS.notice(rawRow.fotos || []);
  const row = { ...rawRow, fotos:ctx.window.KEIKO_PHOTOS.approved(rawRow.fotos || []) };
  if (!/^[a-f0-9-]{36}$/.test(row.id)) throw new Error('Identificador inesperado.');
  const id = 'panel-' + row.id, folder = path.join(root, 'productos', id);
  const price = row.precio === null ? 'Consultar' : 'USD ' + row.precio;
  let primary, social;
  if (row.fotos[0]) {
    const source = await photo('inventario',row.fotos[0]);
    const resized = await sharp(source, { limitInputPixels:40000000 }).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const {width,height,channels} = resized.info; let left=width,top=height,right=-1,bottom=-1;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(resized.data[(y*width+x)*channels+channels-1]>0){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    if(right<0)throw new Error('Foto principal vacía: ' + row.codigo);
    const cut = sharp(resized.data,{raw:resized.info}).extract({left,top,width:right-left+1,height:bottom-top+1});
    primary = await cut.clone().flatten({background:'#ffffff'}).jpeg({quality:88}).toBuffer();
    const image = await cut.clone().resize(500,460,{fit:'contain',background:'#ffffff'}).flatten({background:'#ffffff'}).png().toBuffer();
    const label = lines(row.nombre);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="white"/><rect width="1200" height="75" fill="#c8272c"/><text x="40" y="50" fill="white" font-family="Arial,Helvetica,Liberation Sans,sans-serif" font-size="32" font-weight="bold">${esc(contact.name)}</text><g fill="#171717" font-family="Arial,Helvetica,Liberation Sans,sans-serif" font-size="31" font-weight="bold">${label.map((line,i)=>`<text x="580" y="${180+i*44}">${line}</text>`).join('')}<text x="580" y="390" font-size="25">Código: ${esc(row.codigo)}</text><text x="580" y="442" fill="#c8272c">${esc(price)}</text></g><rect y="555" width="1200" height="75" fill="#f4f1eb"/><text x="40" y="601" font-family="Arial,Helvetica,Liberation Sans,sans-serif" font-size="26" fill="#158044">WhatsApp +${esc(contact.whatsapp)} · Confirma compatibilidad</text></svg>`;
    social = await sharp(Buffer.from(svg)).composite([{input:image,left:40,top:86}]).jpeg({quality:88}).toBuffer();
  }
  const product = { id,codigo:row.codigo,nombre:row.nombre,categoria:row.categoria,marca:row.marca,precio:row.precio ?? 'Consultar',stock:row.cantidad,descripcionCorta:row.descripcion_corta,descripcion:row.descripcion,compatibilidad:row.compatibilidad,referencias:row.referencias,avisoFoto,publicado:true,origen:'respaldo-panel',panelId:row.id,medios:primary?[{tipo:'imagen',src:'productos/' + id + '/photo.jpg'}]:[] };
  const url = base + 'productos/' + id + '/', description = row.descripcion_corta || row.descripcion;
  const productJson = JSON.stringify({ id:row.id,...product,url }).replaceAll('<','\\u003c');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(row.nombre)} · ${esc(row.codigo)} | ${esc(contact.name)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${url}"><meta property="og:type" content="product"><meta property="og:title" content="${esc(row.nombre + ' · ' + row.codigo)}"><meta property="og:description" content="${esc(price + '. ' + description)}"><meta property="og:url" content="${url}">${social ? '<meta property="og:image" content="' + url + 'social.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="' + esc(row.nombre) + '">' : ''}<meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="../../assets/ficha-publica.css"></head><body><header><a href="../../#repuestos">${esc(contact.name)} · Volver al catálogo</a></header><main><section class="photo"><img id="product-image" src="./photo.jpg" alt="${esc(row.nombre)}"></section><article><p>${esc(row.categoria)}</p><h1 id="product-name">${esc(row.nombre)}</h1><p id="product-short">${esc(description)}</p><p>Código: <strong>${esc(row.codigo)}</strong> · <span id="product-stock">${row.cantidad} unidades registradas</span></p><h2 id="product-price">${esc(price)}</h2><h2>Descripción</h2><p id="product-description">${esc(row.descripcion)}</p><details><summary>Compatibilidad</summary><ul id="product-compatibility">${row.compatibilidad.map(v=>'<li>'+esc(v)+'</li>').join('')}</ul></details><details><summary>Referencias y equivalencias</summary><ul id="product-references">${row.referencias.map(v=>'<li>'+esc(v)+'</li>').join('')}</ul></details><p>Confirma modelo, año, motor y disponibilidad antes de comprar.</p><a class="button" id="product-contact" href="https://wa.me/${contact.whatsapp}?text=${encodeURIComponent('Hola, consulto por ' + row.codigo + '. Mi vehículo es:')}" target="_blank" rel="noopener">Consultar por WhatsApp</a><button id="product-share" type="button">Compartir promoción</button><a id="product-gallery" href="../../?producto=${row.id}#repuestos">Ver todas las fotos y ampliar</a><p id="product-status" role="status"></p></article></main><script type="application/json" id="product-data">${productJson}</script><script src="../../assets/config.js"></script><script src="../../assets/pagina-modelo.js?v=20261007-2"></script><script src="../../assets/pagina-contacto.js?v=20261007-2"></script><script src="../../assets/promocion.js?v=20261007-2"></script><script src="../../assets/ficha-publica.js?v=20261007-2"></script></body></html>`;
  prepared.push({folder,id,html:primary?html:html.replace('<img id="product-image" src="./photo.jpg"', '<img hidden id="product-image" src="./photo.jpg"').replace('<section class="photo">','<section class="photo"><p>Foto del producto pendiente de corregir.</p>').replace('<button id="product-share" type="button">','<button disabled id="product-share" type="button">'),primary,social}); products.push(product);
}
for (const item of prepared) {
  await mkdir(item.folder,{recursive:true});
  await writeFile(path.join(item.folder,'index.html'),item.html);
  if(item.primary){ await writeFile(path.join(item.folder,'photo.jpg'),item.primary); await writeFile(path.join(item.folder,'social.jpg'),item.social); }
  else { for(const name of ['photo.jpg','social.jpg'])await rm(path.join(item.folder,name),{force:true}); }
}
// Mantener enlaces antiguos, pero sin otra ficha desactualizada del mismo producto.
const legacy = JSON.parse(await readFile(path.join(root,'data/catalogo.json'),'utf8'));
for (const old of legacy.productos || []) {
  const current=products.find(product=>product.codigo===old.codigo);
  if(!current || !/^[a-z0-9-]+$/.test(old.id) || old.id.startsWith('panel-'))continue;
  const folder=path.resolve(root,'productos',old.id);
  if(path.dirname(folder)!==path.resolve(root,'productos'))throw new Error('Ruta heredada inválida.');
  const target=base+'productos/'+current.id+'/';
  await mkdir(folder,{recursive:true});
  await writeFile(path.join(folder,'index.html'),`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(current.nombre)} | ${esc(contact.name)}</title><link rel="canonical" href="${target}"><meta http-equiv="refresh" content="0;url=${target}"></head><body><p>La ficha se actualizó. <a href="${target}">Ver ${esc(current.nombre)} (${esc(current.codigo)})</a></p></body></html>`);
}
// Solo directorios generados panel-UUID dentro de productos; nunca originales del catálogo.
const keep = new Set(prepared.map(item=>item.id)), parent = path.resolve(root,'productos');
for(const entry of await readdir(parent,{withFileTypes:true}))if(entry.isDirectory() && /^panel-[a-f0-9-]{36}$/.test(entry.name) && !keep.has(entry.name)){
  const target=path.resolve(parent,entry.name); if(path.dirname(target)!==parent)throw new Error('Ruta fuera de productos.');
  await rm(target,{recursive:true});
}
await writeFile(path.join(root,'data/catalogo-panel.json'),JSON.stringify({total:products.length,productos:products},null,2)+'\n');
let html = await readFile(path.join(root,'index.html'),'utf8');
for(const [key, pattern] of [
  ['tituloSeo', /(<title>)[\s\S]*?(<\/title>)/],
  ['descripcionSeo', /(<meta name="description" content=")[^"]*(")/],
  ['tituloSocial', /(<meta property="og:title" content=")[^"]*(")/],
  ['descripcionSocial', /(<meta property="og:description" content=")[^"]*(")/]
])if(key in content.fields)html=html.replace(pattern,(_,a,b)=>a+esc(content.fields[key])+b);
if(content.fields.imagenSocial?.startsWith('media:')){
  const source=await photo('pagina-media',content.fields.imagenSocial.slice(6));
  await mkdir(path.join(root,'assets/social'),{recursive:true});
  await writeFile(path.join(root,'assets/social/pagina.jpg'),await sharp(source).rotate().resize(1200,630,{fit:'contain',background:'#ffffff'}).flatten({background:'#ffffff'}).jpeg({quality:88}).toBuffer());
  html=html.replace(/(<meta property="og:image" content=")[^"]*(")/,(_,a,b)=>a+base+'assets/social/pagina.jpg'+b);
}else if('imagenSocial' in content.fields)html=html.replace(/(<meta property="og:image" content=")[^"]*(")/,(_,a,b)=>a+(content.fields.imagenSocial?base+content.fields.imagenSocial:'')+b);
await writeFile(path.join(root,'index.html'),html);
await writeFile(path.join(root,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}</loc></url>${products.map(product=>'<url><loc>'+base+'productos/'+product.id+'/</loc></url>').join('')}</urlset>\n`);
console.log('Sincronización: ' + products.length + ' fichas publicadas, imágenes blancas y metadatos permanentes.');
