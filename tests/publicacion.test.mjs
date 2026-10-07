import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import sharp from 'sharp';
const root = new URL('../',import.meta.url);
const snapshot = JSON.parse(await readFile(new URL('data/catalogo-panel.json',root),'utf8'));
test('respaldo público sin notas, fuentes, credenciales o URL temporales',()=>{
  assert.equal(snapshot.total,snapshot.productos.length);
  assert.ok(snapshot.total > 0);
  assert.equal(new Set(snapshot.productos.map(p=>p.panelId)).size,snapshot.total);
  assert.doesNotMatch(JSON.stringify(snapshot), /signedURL|token=|resultado_bot|error_investigacion|access_token|fuentes/);
});
test('foto con otro código queda aislada, sin impedir una sustitución correcta',async()=>{
  const context={window:{}};vm.runInNewContext(await readFile(new URL('assets/config.js',root),'utf8'),context);
  assert.equal(context.window.KEIKO_PHOTOS.approved(['dcpr7e/1790025256071-01.png']).length,0);
  assert.equal(context.window.KEIKO_PHOTOS.approved(['dcpr7e/nueva-foto.png']).length,1);
  const product=snapshot.productos.find(p=>p.codigo==='DCPR7E');
  if(product.avisoFoto){assert.equal(product.medios.length,0);const html=await readFile(new URL('productos/'+product.id+'/index.html',root),'utf8');assert.doesNotMatch(html,/property="og:image"/);}
});
test('cada producto tiene ficha, canonical y metadatos estables; fotos sociales blancas',async()=>{
  for(const product of snapshot.productos){
    assert.match(product.id,/^panel-[a-f0-9-]{36}$/);
    const html=await readFile(new URL('productos/'+product.id+'/index.html',root),'utf8');
    assert.ok(html.includes(product.codigo));
    assert.match(html,/rel="canonical" href="https:\/\/henryconteron.github.io\/mecanica-keiko\/productos\/panel-/);
    assert.doesNotMatch(html,/token=|signedURL/);
    if(!product.medios.length)continue;
    const image=sharp(await readFile(new URL('productos/'+product.id+'/social.jpg',root)));
    const info=await image.metadata();assert.equal(info.width,1200);assert.equal(info.height,630);
    const pixel=await image.extract({left:5,top:200,width:1,height:1}).raw().toBuffer();
    assert.ok(pixel[0]>245&&pixel[1]>245&&pixel[2]>245);
  }
});
