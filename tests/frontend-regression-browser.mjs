// Pruebas aisladas: ninguna llamada sale del navegador hacia Supabase o redes sociales.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import http from 'node:http';
import path from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.KEIKO_PLAYWRIGHT_PATH ? pathToFileURL(process.env.KEIKO_PLAYWRIGHT_PATH).href : 'playwright');
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const photo = await readFile(path.join(root, 'assets/marca/logo/logo.png'));
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg' };
const product = { id:'11111111-1111-4111-8111-111111111111', version:1, codigo:'PUBLIC-1', nombre:'Producto publicado', cantidad:2, precio:12, categoria:'Filtros', revision:'publicado', fotos:['publicada.png'], resultado_bot:{ edicion_pendiente:{ codigo:'PRIVATE-1', nombre:'Borrador privado', cantidad:99, precio:987, fotos:['privada.png'] } } };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/__frontend-preview') {
      res.setHeader('Content-Type','text/html');
      res.end(`<!doctype html><meta charset="utf-8"><button id="clear">Quitar imágenes</button><button id="restore">Restaurar imágenes</button><iframe id="preview" src="/?vista-pagina=1" style="width:100%;height:700px"></iframe><script>
        const send=fields=>document.querySelector('iframe').contentWindow.postMessage({type:'keiko:preview',content:{version:1,fields},media:{}},location.origin);
        document.querySelector('#clear').onclick=()=>send({logo:'',portadaImagen:'',imagenSocial:''});
        document.querySelector('#restore').onclick=()=>send({logo:'assets/marca/logo/logo.png',portadaImagen:'assets/marca/mascota/mascota.png',imagenSocial:'assets/marca/logo/logo.png'});
      </script>`); return;
    }
    const target = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative) || pathname.includes('/.')) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', mime[path.extname(target)] || 'application/octet-stream'); res.end(await readFile(target));
  } catch { res.writeHead(404).end(); }
});
let browser, base;
before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless:true, ...(process.env.KEIKO_BROWSER_CHANNEL ? {channel:process.env.KEIKO_BROWSER_CHANNEL} : {}) });
});
after(async () => { await browser?.close(); await new Promise(resolve => server.close(resolve)); });

async function pageFor(options = {}) {
  const context = await browser.newContext({ viewport:options.viewport || {width:390,height:844}, serviceWorkers:'block' });
  // Únicamente sesión sintética del fixture, no se lee ni utiliza una cuenta real.
  if (options.admin) await context.addInitScript(() => sessionStorage.setItem('keikoAdminToken', 'fixture-only'));
  const errors = [], signed = [], events = [];
  await context.route('https://**/*', route => {
    const url = new URL(route.request().url());
    const send = json => route.fulfill({json});
    if (url.hostname !== 'ktjzaockvsdlqshgqrmc.supabase.co') return route.abort();
    if (url.pathname === '/rest/v1/productos_admin') {
      if (options.hangProducts) return;
      return send(options.rows || []);
    }
    if (url.pathname === '/rest/v1/estado_taller') return send([{estado:'automatico'}]);
    if (url.pathname === '/rest/v1/pagina_publica') return send(options.content ? [{contenido:options.content}] : []);
    if (url.pathname === '/rest/v1/catalogo_eventos' && route.request().method() === 'POST') { events.push(route.request().postDataJSON()); return route.fulfill({status:204,body:''}); }
    if (url.pathname === '/rest/v1/plan_publicaciones') return send([{id:'fixture-plan',titulo:'Promoción publicada',codigo_producto:'PUBLIC-1',programado:'2026-10-23T15:00:00Z',estado:'pendiente',canal:'whatsapp',formato:'publicacion'}]);
    if (url.pathname.startsWith('/storage/v1/object/sign/inventario/')) {
      signed.push(decodeURIComponent(url.pathname.split('/inventario/')[1]));
      if (options.hangPhotos) return;
      return send({signedURL:'/fixture.png'});
    }
    if (url.pathname === '/storage/v1/fixture.png') return route.fulfill({body:photo,contentType:'image/png'});
    return send([]);
  });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  page.on('popup', popup => popup.close());
  await page.goto(base + (options.admin ? '/admin-estado.html' : options.previewHarness ? '/__frontend-preview' : options.preview ? '/?vista-pagina=1' : '/'), {waitUntil:'domcontentloaded'});
  return { page, context, errors, signed, events };
}

test('el catálogo utiliza el respaldo si el inventario remoto no responde', async () => {
  const {page,context,errors} = await pageFor({hangProducts:true});
  try {
    await page.locator('[data-open-product]').first().waitFor({timeout:12000});
    assert.match(await page.locator('#catalog-status').textContent(), /No se pudo cargar parte/);
    await page.locator('[data-open-product]').first().click();
    await page.locator('#dialog-main-media img').evaluate(image => image.decode());
    await mkdir(path.join(root,'.codex-local/outputs'), {recursive:true});
    await page.screenshot({path:path.join(root,'.codex-local/outputs/auditoria-catalogo-respaldo-mobile-2026-10-23.png')});
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('un inventario remoto válido vacío no resucita productos del respaldo', async () => {
  const {page,context,errors} = await pageFor({rows:[]});
  try {
    await page.locator('#catalog-status').filter({hasText:'0 destacados'}).waitFor();
    assert.equal(await page.locator('[data-open-product]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('una firma de foto colgada no bloquea la información del catálogo', async () => {
  const {page,context,errors} = await pageFor({rows:[product],hangPhotos:true});
  try {
    await page.locator('[data-open-product]').first().waitFor({timeout:12000});
    assert.match(await page.locator('#catalog-grid').textContent(), /Producto publicado/);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('la agenda prepara solo datos y fotos publicados, no el borrador privado', async () => {
  const {page,context,errors,signed} = await pageFor({admin:true,rows:[product]});
  try {
    await page.locator('[data-screen="marketing"]').click();
    await page.locator('#publication-list .plan-item').waitFor();
    assert.equal(await page.locator('#publication-product option[value="PUBLIC-1"]').count(), 1);
    assert.equal(await page.locator('#publication-product option[value="PRIVATE-1"]').count(), 0);
    await page.locator('[data-plan-share="PUBLIC-1"]').click();
    await page.locator('.keiko-share [data-download]:enabled').waitFor();
    const text = await page.locator('.keiko-share [data-text]').inputValue();
    assert.match(text, /Producto publicado/); assert.match(text, /12/); assert.doesNotMatch(text, /Borrador privado|987|PRIVATE-1/);
    assert.deepEqual(signed, ['publicada.png']);
    await mkdir(path.join(root,'.codex-local/outputs'), {recursive:true});
    await page.screenshot({path:path.join(root,'.codex-local/outputs/auditoria-promocion-publicada-2026-10-23.png')});
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('la agenda no ofrece promociones para productos sin stock', async () => {
  const {page,context,errors} = await pageFor({admin:true,rows:[{...product,cantidad:0,resultado_bot:null}]});
  try {
    await page.locator('[data-screen="marketing"]').click();
    await page.locator('#publication-list .plan-item').waitFor();
    assert.equal(await page.locator('[data-plan-share]').count(), 0);
    assert.equal(await page.locator('#publication-product option[value="PUBLIC-1"]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('el detalle no ofrece promociones para productos sin stock', async () => {
  const {page,context,errors} = await pageFor({admin:true,rows:[{...product,cantidad:0,resultado_bot:null}]});
  try {
    await page.locator('[data-screen="inventory"]').click();
    await page.locator('[data-product]').first().click();
    assert.equal(await page.locator('[data-review-action="compartir"]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('el catálogo no prepara anuncios de productos agotados', async () => {
  const {page,context,errors} = await pageFor({rows:[{...product,cantidad:0,resultado_bot:null}]});
  try {
    await page.locator('[data-share-product]').first().click();
    assert.match(await page.locator('#catalog-toast').textContent(), /stock|agotado|disponible/i);
    assert.equal(await page.locator('.keiko-share').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('la ficha conserva imagen completa y botón de consulta en cuatro tamaños', async () => {
  for (const [width,height] of [[320,640],[768,1024],[1024,768],[1440,900]]) {
    const {page,context,errors} = await pageFor({rows:[{...product,resultado_bot:null}],viewport:{width,height}});
    try {
      await page.locator('[data-open-product]').first().click();
      const image = page.locator('#dialog-main-media img'); await image.waitFor();
      const bounds = await image.evaluate(node => {
        const image = node.getBoundingClientRect(), box = node.parentElement.getBoundingClientRect();
        return {mode:getComputedStyle(node).objectFit,fits:image.left>=box.left&&image.top>=box.top&&image.right<=box.right+1&&image.bottom<=box.bottom+1};
      });
      assert.equal(bounds.mode,'contain'); assert.equal(bounds.fits,true,`Imagen fuera de galería en ${width}px`);
      assert(await page.locator('.dialog-primary-action a').isVisible());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
      await page.locator('#dialog-close').click();
      await page.waitForFunction(() => document.body.style.position !== 'fixed');
      assert.equal(await page.evaluate(() => document.body.style.position),'');
      assert.deepEqual(errors,[]);
    } finally { await context.close(); }
  }
});

test('las métricas de ficha, WhatsApp y compartir llegan solo al mock; vista previa no registra', async () => {
  for (const preview of [false,true]) {
    const {page,context,errors,events} = await pageFor({rows:[{...product,resultado_bot:null}],preview});
    try {
      await page.locator('[data-open-product]').first().click();
      await page.locator('[data-share-current]').click();
      await page.locator('.keiko-share [data-download]:enabled').waitFor();
      await page.locator('.keiko-share [data-close]').click();
      const whatsappMetric = preview ? Promise.resolve() : page.waitForResponse(response => response.url().includes('/rest/v1/catalogo_eventos') && response.request().postDataJSON()?.evento === 'whatsapp');
      // No se visita WhatsApp: la ruta externa se aborta y se cierra su pestaña sintética.
      await page.locator('.dialog-primary-action a').click({noWaitAfter:true});
      await whatsappMetric;
      assert.deepEqual(events, preview ? [] : [
        {codigo:'PUBLIC-1',evento:'ver_ficha'},
        {codigo:'PUBLIC-1',evento:'compartir'},
        {codigo:'PUBLIC-1',evento:'whatsapp'}
      ]);
      assert.deepEqual(errors,[]);
    } finally { await context.close(); }
  }
});

test('quitar imágenes opcionales en vista previa las oculta y restaurarlas las rehabilita', async () => {
  const {page,context,errors} = await pageFor({previewHarness:true});
  try {
    const frame = page.frameLocator('#preview');
    await frame.getByText('VISTA PREVIA PRIVADA · Nada de esto está publicado',{exact:true}).waitFor();
    await page.locator('#clear').click();
    await frame.locator('.brand-logo img[hidden]').waitFor({state:'attached'});
    assert.equal(await frame.locator('.brand-logo img').isVisible(),false);
    assert.equal(await frame.locator('.hero-visual > img').isVisible(),false);
    assert.equal(await frame.locator('.brand-logo img').getAttribute('src'),null);
    assert.equal(await frame.locator('.hero-visual > img').getAttribute('hidden'),'');
    assert.equal(await frame.locator('meta[property="og:image"]').getAttribute('content'),'');
    await page.locator('#restore').click();
    await frame.locator('.brand-logo img:not([hidden])').waitFor();
    await frame.locator('.hero-visual > img:not([hidden])').waitFor();
    assert.equal(await frame.locator('.brand-logo img').getAttribute('src'),'assets/marca/logo/logo.png');
    assert.equal(await frame.locator('meta[property="og:image"]').getAttribute('content'),'assets/marca/logo/logo.png');
    assert.deepEqual(errors,[]);
  } finally { await context.close(); }
});

test('los colores editables mantienen contraste AA en fondos y controles', async () => {
  for (const [red,gold] of [['#fefefe','#111111'],['#111111','#fefefe'],['#777777','#777777']]) {
    const {page,context,errors} = await pageFor({content:{version:1,fields:{colorRojo:red,colorDorado:gold}}});
    try {
      await page.evaluate(() => window.KEIKO_PAGE_READY);
      const results = await page.evaluate(async () => {
        const selectors = ['.compat-copy','.compat-copy .eyebrow','.compat-copy > p:not(.eyebrow)','.compat-copy .button-light','.filter-button.is-active','.button-red','.nav-cta'];
        await Promise.all(selectors.flatMap(selector => document.querySelector(selector).getAnimations()).map(animation => animation.finished.catch(() => {})));
        const luminance = rgb => {
          const channels=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
          return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
        };
        return selectors.map(selector=>{
          const node=document.querySelector(selector),style=getComputedStyle(node);
          const bg=getComputedStyle(node.closest('.compat-copy')||node).backgroundColor;
          const light=luminance(style.color),dark=luminance(bg);
          return {selector,ratio:(Math.max(light,dark)+.05)/(Math.min(light,dark)+.05)};
        });
      });
      for (const result of results) assert(result.ratio>=4.5,`${result.selector}: contraste ${result.ratio.toFixed(2)} con ${red}/${gold}`);
      for (const selector of ['.button-red','.nav-cta']) {
        const control = page.locator(selector).first(); await control.hover();
        const ratio = await control.evaluate(async node => {
          await Promise.all(node.getAnimations().map(animation=>animation.finished.catch(()=>{})));
          const luminance = rgb => {
            const channels=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
            return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
          };
          const style=getComputedStyle(node),fg=luminance(style.color),bg=luminance(style.backgroundColor);
          return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);
        });
        assert(ratio>=4.5,`${selector}: hover ${ratio.toFixed(2)} con ${red}/${gold}`);
      }
      assert.deepEqual(errors,[]);
    } finally { await context.close(); }
  }
});
