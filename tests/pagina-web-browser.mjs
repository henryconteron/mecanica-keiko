// Prueba aislada: todas las llamadas a Supabase se simulan. No publica datos reales.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.KEIKO_PLAYWRIGHT_PATH ? pathToFileURL(process.env.KEIKO_PLAYWRIGHT_PATH).href : 'playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const target = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!target.startsWith(root + path.sep) || pathname.includes('/.')) { response.writeHead(403).end(); return; }
    response.setHeader('Content-Type', mime[path.extname(target)] || 'application/octet-stream'); response.end(await readFile(target));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.KEIKO_BROWSER_CHANNEL ? { channel: process.env.KEIKO_BROWSER_CHANNEL } : {}) });
try {
  let revision = 0, draft = { version: 1, fields: {} }, published = structuredClone(draft), history = [];
  let databaseWrites = 0;
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route('https://ktjzaockvsdlqshgqrmc.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url()), body = request.postDataJSON();
    const send = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname === '/auth/v1/user') return send({ id: '60712cc3-ee1b-4ad5-9226-4f97d80a13d8', email: 'fixture@example.test' });
    if (url.pathname === '/auth/v1/token') return send({ access_token: 'test-only-not-a-token', refresh_token: 'test-only-refresh', user: { id: '60712cc3-ee1b-4ad5-9226-4f97d80a13d8' } });
    if (url.pathname === '/rest/v1/estado_taller') return send([{ estado: 'automatico', mensaje: '', actualizado: new Date().toISOString() }]);
    if (url.pathname === '/rest/v1/pagina_borrador') return send([{ contenido: draft, revision }]);
    if (url.pathname === '/rest/v1/pagina_publica') return send([{ contenido: published }]);
    if (url.pathname === '/rest/v1/pagina_historial') return send(history);
    if (url.pathname === '/rest/v1/rpc/pagina_guardar') {
      if (body.p_revision !== revision) return send({ message: 'Otra computadora cambio el borrador.' }, 409);
      draft = body.p_contenido; databaseWrites++; return send({ revision: ++revision });
    }
    if (url.pathname === '/rest/v1/rpc/pagina_publicar') {
      if (body.p_revision !== revision) return send({ message: 'Otra computadora cambio el borrador.' }, 409);
      history.unshift({ id: history.length + 1, contenido: published, creado: new Date().toISOString() });
      published = structuredClone(draft); databaseWrites++; return send({ revision: ++revision });
    }
    if (url.pathname === '/rest/v1/catalogo_eventos' && request.method() === 'POST') throw new Error('La vista previa no debe registrar métricas reales.');
    return send([]);
  });
  await context.route('https://www.googletagmanager.com/**', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/admin-estado.html`);
  await page.locator('#admin-login input[name=email]').fill('fixture@example.test');
  await page.locator('#admin-login input[name=password]').fill('prueba-local');
  await page.locator('#admin-login button').click();
  await page.locator('[data-screen=website]').click();
  assert.equal(await page.locator('#website-editor').isVisible(), false);
  await page.locator('#website-password').fill('prueba-local'); await page.locator('#website-unlock button').click();
  await page.locator('#website-editor').waitFor({ state: 'visible' });
  await page.locator('#website-sections [data-section=portada]').click();
  const title = 'Título de prueba <img src=x onerror=alert(1)> 😄';
  await page.locator('#page-field-portadaTitulo').fill(title);
  await page.locator('#website-save').click();
  await page.waitForFunction(() => document.querySelector('#website-status').textContent.startsWith('Borrador guardado'));
  assert.equal(draft.fields.portadaTitulo, title); assert.deepEqual(published.fields, {});
  await page.locator('#website-preview').click();
  const frame = page.frameLocator('#website-preview-frame');
  await frame.locator('.hero-copy h1').getByText(title, { exact: true }).waitFor();
  assert.equal(await frame.locator('.hero-copy h1 img').count(), 0);
  assert.equal(databaseWrites, 1);
  await page.locator('#website-preview-close').click();
  await page.locator('#website-publish').click();
  await page.locator('#website-publish-password').fill('prueba-local');
  await page.locator('#website-confirm button[type=submit]').click();
  await page.waitForFunction(() => document.querySelector('#website-status').textContent.startsWith('Página publicada.'));
  assert.equal(published.fields.portadaTitulo, title); assert.equal(history.length, 1);
  await mkdir(path.join(root, '.codex-local/outputs'), { recursive: true });
  await page.screenshot({ path: path.join(root, '.codex-local/outputs/pagina-editor-desktop-2026-10-07.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: path.join(root, '.codex-local/outputs/pagina-editor-mobile-2026-10-07.png') });
  // Conflicto de edición: conserva la propuesta local sin sobrescribir al otro equipo.
  revision++;
  await page.locator('#page-field-portadaTitulo').fill('No debe sobrescribir otro equipo');
  await page.locator('#website-save').click();
  await page.waitForFunction(() => document.querySelector('#website-status').textContent.includes('Otra computadora'));
  assert.equal(draft.fields.portadaTitulo, title);
  assert.equal(await page.locator('#page-field-portadaTitulo').inputValue(), 'No debe sobrescribir otro equipo');
  assert.deepEqual(errors, []);
  console.log('OK: acceso bloqueado, borrador privado, vista previa sin HTML ejecutable, publicación, historial, celular y conflicto entre equipos.');
  await context.close();
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
