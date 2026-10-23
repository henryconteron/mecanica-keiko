import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.KEIKO_PLAYWRIGHT_PATH ? pathToFileURL(process.env.KEIKO_PLAYWRIGHT_PATH).href : 'playwright');
const root = process.cwd();
const snapshot = JSON.parse(await readFile(path.join(root, 'data/catalogo-panel.json'), 'utf8'));
const imagePath = snapshot.productos.find(product => product.medios?.some(media => media.tipo === 'imagen')).medios.find(media => media.tipo === 'imagen').src;
const image = await readFile(path.join(root, imagePath));
const productFixture = {
  id:'test', version:1, codigo:'TEST-1', nombre:'Filtro prueba', marca:'Marca de prueba', categoria:'Filtros', cantidad:2, precio:7,
  descripcion_corta:'Resumen para una prueba local.', descripcion:'Descripción de prueba, pendiente de confirmar referencia y medidas.',
  compatibilidad:[], referencias:[], revision:'publicado', fotos:['one.jpg','two.jpg'], actualizado:new Date().toISOString(),
  resultado_bot:{estado_investigacion:'verificada_manualmente',verificacion_manual:{limitaciones:'Confirmar referencia y medidas.'}}
};
const photoResponse = route => route.fulfill({contentType:'image/jpeg', headers:{'Access-Control-Allow-Origin':'*'}, body:image});
const signedPhotoResponse = route => route.request().method() === 'POST'
  ? route.fulfill({json:{signedURL:'/object/sign/inventario/fixture.jpg?token=test-only'}})
  : photoResponse(route);
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(root + path.sep)) throw new Error('outside root');
    const content = await readFile(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css':'text/css', '.json': 'application/json', '.png': 'image/png', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(content);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, ...(process.env.KEIKO_BROWSER_CHANNEL ? {channel:process.env.KEIKO_BROWSER_CHANNEL} : {}) });
try {
  for (const [width, height] of [[360,640], [390,844], [844,390], [1440,900]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.setDefaultTimeout(5000);
    const errors = [];
    const tracked = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => {
      const url = route.request().url();
      if (url.includes('/rest/v1/productos_admin')) return route.fulfill({ json: [productFixture] });
      if (url.includes('/rest/v1/estado_taller')) return route.fulfill({ json: [{ estado: 'automatico' }] });
      if (url.includes('/rest/v1/catalogo_eventos')) { tracked.push(route.request().postDataJSON()); return route.fulfill({status:204,body:''}); }
      if (url.includes('/rest/v1/pagina_publica')) return route.fulfill({json:[{contenido:{version:1,fields:{}}}]});
      if (url.includes('/storage/v1/object/sign/')) return signedPhotoResponse(route);
      return route.abort();
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('[data-open-product]').first().click();
    await page.waitForFunction(() => document.querySelector('#product-dialog')?.open);
    assert(tracked.some(event => event.evento === 'ver_ficha'));
    await page.locator('#dialog-main-media img').waitFor();
    const fit = await page.locator('#dialog-main-media img').evaluate(img => {
      const a = img.getBoundingClientRect(), b = img.parentElement.getBoundingClientRect();
      return { fits: a.left >= b.left && a.top >= b.top && a.right <= b.right + 1 && a.bottom <= b.bottom + 1, mode: getComputedStyle(img).objectFit };
    });
    assert.equal(fit.fits, true, `Image outside gallery at ${width}x${height}`);
    assert.equal(fit.mode, 'contain');
    assert(await page.locator('.dialog-primary-action a').isVisible());
    if(width===390){
      await page.locator('[data-share-current]').click();
      await page.waitForFunction(() => document.querySelector('.keiko-share'));
      assert(tracked.some(event => event.evento === 'compartir'));
      await page.waitForFunction(()=>!document.querySelector('.keiko-share [data-download]').disabled);
      const preview=page.locator('.keiko-share [data-preview]');
      await preview.evaluate(img=>img.decode());
      assert.equal(await preview.evaluate(img=>img.naturalWidth),1080);
      assert.equal(await preview.evaluate(img=>img.naturalHeight),1350);
      await page.locator('.keiko-share [data-format]').selectOption('story');
      await page.waitForFunction(()=>!document.querySelector('.keiko-share [data-download]').disabled);
      await preview.evaluate(img=>img.decode());
      assert.equal(await preview.evaluate(img=>img.naturalHeight),1920);
      await page.locator('.keiko-share [data-close]').click();
      console.log('Promotion preview passed: publication and story');
    }
    await page.locator('#dialog-close').click();
    await page.waitForFunction(() => document.body.style.position !== 'fixed');
    assert.equal(await page.evaluate(() => document.body.style.position), '');
    assert.deepEqual(errors, []);
    console.log(`Gallery and dialog passed: ${width}x${height}`);
    await page.close();
  }
  const admin = await browser.newPage({viewport:{width:390,height:844}});
  admin.setDefaultTimeout(5000);
  const errors = [];
  let savedPlan;
  admin.on('pageerror', e => errors.push(e.message));
  await admin.route('https://**/*', route => {
    const url = route.request().url();
    if (url.includes('/auth/v1/user')) return route.fulfill({json:{id:'60712cc3-ee1b-4ad5-9226-4f97d80a13d8',email:'fixture@example.test'}});
    if (url.includes('/auth/v1/token')) return route.fulfill({json:{access_token:'test-only-not-a-token',refresh_token:'test-only-refresh',user:{id:'60712cc3-ee1b-4ad5-9226-4f97d80a13d8'}}});
    if (url.includes('/rest/v1/productos_admin')) return route.fulfill({json:[productFixture]});
    if (url.includes('/rest/v1/estado_taller')) return route.fulfill({json:[{estado:'automatico'}]});
    if (url.includes('/rest/v1/catalogo_eventos')) return route.fulfill({json:[{codigo:'TEST-1',evento:'ver_ficha'},{codigo:'TEST-1',evento:'whatsapp'}]});
    if (url.includes('/rest/v1/plan_publicaciones')) {
      if (route.request().method()==='POST') { savedPlan=route.request().postDataJSON(); return route.fulfill({status:201,json:{}}); }
      return route.fulfill({json:[]});
    }
    if (url.includes('/rest/v1/consultas_taller')) return route.fulfill({json:[]});
    if (url.includes('/storage/v1/object/sign/')) return signedPhotoResponse(route);
    return route.abort();
  });
  await admin.goto(`http://127.0.0.1:${server.address().port}/admin-estado.html`);
  await admin.locator('#admin-login input[name=email]').fill('fixture@example.test');
  await admin.locator('#admin-login input[name=password]').fill('prueba-local');
  await admin.locator('#admin-login button').click();
  await admin.locator('[data-screen="inventory"]').click();
  await admin.locator('#inventory-search').fill('TEST-1');
  await admin.locator('[data-product="test"]').click();
  assert(await admin.getByText('Estado de búsqueda: Revisada con fuentes.', {exact:true}).isVisible());
  assert.match(await admin.locator('.review-progress').innerText(), /Confirmar referencia y medidas\./);
  assert.equal(await admin.locator('[data-review-action="manual"]').count(),0);
  await admin.locator('[data-review-action="editar"]').click();
  await admin.locator('[data-remove-existing="1"]').click();
  await admin.waitForFunction(()=>document.querySelectorAll('[data-remove-existing]').length===1);
  assert.equal(await admin.locator('#existing-photos .photo-queue-card').count(),1);
  await admin.locator('[data-screen="marketing"]').click();
  await admin.waitForFunction(() => document.querySelector('#metric-views')?.textContent === '1');
  assert.equal(await admin.locator('#metric-views').textContent(),'1');
  assert.equal(await admin.locator('#metric-whatsapp').textContent(),'1');
  assert(await admin.locator('#marketing-top').getByText('TEST-1').isVisible());
  assert(await admin.locator('#publication-product option').count()>1);
  await admin.locator('#publication-title').fill('Publicación de prueba');
  await admin.locator('#publication-date').fill('2026-10-01T10:00');
  await admin.locator('#publication-product').selectOption('TEST-1');
  await admin.locator('#publication-form button[type="submit"]').click();
  await admin.waitForFunction(() => document.querySelector('#admin-notice')?.textContent.includes('Idea guardada'));
  assert.equal(savedPlan.codigo_producto,'TEST-1');
  assert.deepEqual(errors,[]);
  console.log('Admin: search, photo editing, publication dashboard passed');
  await admin.close();
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
