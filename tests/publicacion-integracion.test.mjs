import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, access, symlink, lstat, realpath } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
const run = promisify(execFile), repo = fileURLToPath(new URL('../', import.meta.url));
const generated = 'panel-11111111-1111-4111-8111-111111111111';
const previousHtml = `<!doctype html><script type="application/json" id="product-data">${JSON.stringify({ id:generated, panelId:generated.slice(6), origen:'respaldo-panel' })}</script><p>FICHA ANTERIOR</p>`;
const fixtureRoot = path.join(repo, '.codex-local', 'publicacion-pruebas');

async function cleanupFixture(folder, ownerToken) {
  const allowed = await realpath(fixtureRoot), target = await realpath(folder);
  assert.equal((await lstat(folder)).isSymbolicLink(), false);
  assert.equal(path.dirname(target), allowed);
  assert.ok(path.basename(target).startsWith('caso-'));
  const marker = path.join(folder, '.fixture-owner.json');
  assert.equal((await lstat(marker)).isSymbolicLink(), false);
  assert.deepEqual(JSON.parse(await readFile(marker, 'utf8')), { version:1, pid:process.pid, token:ownerToken });
  await rm(target, { recursive:true, force:true });
}

async function fixture(t, response = []) {
  // No compartir %TEMP% con otros procesos. El ENOENT observado bajo carga ocurrió
  // durante preparación, antes de ejecutar la app; su causa original no se identificó.
  await mkdir(fixtureRoot, { recursive:true });
  assert.equal((await lstat(fixtureRoot)).isSymbolicLink(), false);
  assert.equal(await realpath(fixtureRoot), path.join(await realpath(repo), '.codex-local', 'publicacion-pruebas'));
  const folder = await mkdtemp(path.join(fixtureRoot, 'caso-')), ownerToken = randomUUID();
  await writeFile(path.join(folder, '.fixture-owner.json'), JSON.stringify({ version:1, pid:process.pid, token:ownerToken }), { flag:'wx' });
  let initialized = false;
  t.after(async () => {
    if (!initialized) { t.diagnostic('Preparación fallida; se conserva evidencia del fixture: ' + folder); return; }
    await cleanupFixture(folder, ownerToken);
  });
  const image = await sharp({ create:{ width:2, height:2, channels:4, background:'#fff' } }).png().toBuffer();
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/storage/v1/object/sign/')) { res.end('{"signedURL":"/object/inventario/foto.png"}'); return; }
    if (req.url.startsWith('/storage/v1/object/inventario/')) {
      res.setHeader('Content-Type', 'image/png');
      res.end(image); return;
    }
    if (req.url.startsWith('/rest/v1/productos_admin')) {
      if (response === 'error') { res.statusCode = 503; res.end('{}'); }
      else res.end(JSON.stringify(response));
    } else res.end(JSON.stringify([{ contenido: { version: 1, fields: {} } }]));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  for (const name of ['assets', 'data', `productos/${generated}`, 'productos/catalogo-original']) await mkdir(path.join(folder, name), { recursive: true });
  const config = await readFile(path.join(repo, 'assets/config.js'), 'utf8');
  await writeFile(path.join(folder, 'assets/config.js'), config + `\nwindow.KEIKO_CONFIG.supabaseUrl="http://127.0.0.1:${server.address().port}";`);
  await writeFile(path.join(folder, 'data/catalogo.json'), '{"productos":[{"id":"catalogo-original","codigo":"ANTERIOR"}]}');
  await writeFile(path.join(folder, 'data/catalogo-panel.json'), '{"total":1,"productos":[{"codigo":"ANTERIOR"}]}');
  await writeFile(path.join(folder, 'index.html'), '<title>Keiko</title><meta name="description" content="Taller">');
  await writeFile(path.join(folder, 'sitemap.xml'), 'ANTERIOR');
  await writeFile(path.join(folder, 'productos', generated, 'index.html'), previousHtml);
  await writeFile(path.join(folder, 'productos/catalogo-original/foto.jpg'), 'ORIGINAL');
  initialized = true;
  return { folder, execute: () => run(process.execPath, [path.join(repo, 'scripts/sincronizar-publicacion.mjs')], { cwd: folder }) };
}

test('cleanup exige propiedad del caso y nunca elimina la raíz privada compartida', async t => {
  const { folder } = await fixture(t);
  await assert.rejects(cleanupFixture(folder, 'token-ajeno'));
  await access(path.join(folder, 'data/catalogo-panel.json'));
  await assert.rejects(cleanupFixture(fixtureRoot, 'token-ajeno'));
  await access(folder);
});

test('cero publicaciones válido retira solo fichas generadas y vacía respaldo y sitemap', async t => {
  const { folder, execute } = await fixture(t);
  await execute();
  assert.deepEqual(JSON.parse(await readFile(path.join(folder, 'data/catalogo-panel.json'), 'utf8')), { total: 0, productos: [] });
  await assert.rejects(access(path.join(folder, 'productos', generated)));
  assert.equal(await readFile(path.join(folder, 'productos/catalogo-original/foto.jpg'), 'utf8'), 'ORIGINAL');
  const legacy = await readFile(path.join(folder, 'productos/catalogo-original/index.html'), 'utf8');
  assert.match(legacy, /https:\/\/henryconteron.github.io\/mecanica-keiko\/#repuestos/);
  assert.doesNotMatch(legacy, /productos\/panel-/);
  const sitemap = await readFile(path.join(folder, 'sitemap.xml'), 'utf8');
  assert.equal((sitemap.match(/<loc>/g) || []).length, 1);
  assert.doesNotMatch(sitemap, /panel-/);
});

test('error de API o respuesta no-lista conserva catálogo, fichas y sitemap', async t => {
  for (const response of ['error', {}]) {
    const { folder, execute } = await fixture(t, response);
    await assert.rejects(execute());
    assert.equal(JSON.parse(await readFile(path.join(folder, 'data/catalogo-panel.json'), 'utf8')).total, 1);
    assert.equal(await readFile(path.join(folder, 'productos', generated, 'index.html'), 'utf8'), previousHtml);
    assert.equal(await readFile(path.join(folder, 'sitemap.xml'), 'utf8'), 'ANTERIOR');
  }
});

test('un enlace de directorio generado nunca permite borrar contenido ajeno', async t => {
  const { folder, execute } = await fixture(t);
  const outside = path.join(folder, 'original-ajeno');
  await mkdir(outside);
  await writeFile(path.join(outside, 'conservar.txt'), 'CONSERVAR');
  await rm(path.join(folder, 'productos', generated), { recursive: true });
  await symlink(outside, path.join(folder, 'productos', generated), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(execute(), /enlace|ruta|directorio/i);
  assert.equal(await readFile(path.join(outside, 'conservar.txt'), 'utf8'), 'CONSERVAR');
  assert.equal(await readFile(path.join(folder, 'sitemap.xml'), 'utf8'), 'ANTERIOR');
});

test('panel-UUID ajeno sin marca del generador conserva sus archivos y aborta antes de escribir', async t => {
  const { folder, execute } = await fixture(t);
  const foreign = path.join(folder, 'productos/panel-22222222-2222-4222-8222-222222222222');
  await mkdir(foreign);
  await writeFile(path.join(foreign, 'index.html'), '<p>Mis archivos, no es una ficha generada</p>');
  await writeFile(path.join(foreign, 'conservar.txt'), 'AJENO');
  await assert.rejects(execute(), /propiedad|generador|ficha.*generada/i);
  assert.equal(await readFile(path.join(foreign, 'conservar.txt'), 'utf8'), 'AJENO');
  assert.equal(await readFile(path.join(folder, 'productos', generated, 'index.html'), 'utf8'), previousHtml);
  assert.equal(JSON.parse(await readFile(path.join(folder, 'data/catalogo-panel.json'), 'utf8')).total, 1);
  assert.equal(await readFile(path.join(folder, 'sitemap.xml'), 'utf8'), 'ANTERIOR');
});

test('la marca del generador debe corresponder al UUID de la carpeta retirada', async t => {
  const { folder, execute } = await fixture(t);
  const index = path.join(folder, 'productos', generated, 'index.html');
  await writeFile(index, previousHtml.replace(generated.slice(6), '22222222-2222-4222-8222-222222222222'));
  await assert.rejects(execute(), /propiedad|generador|ficha.*generada/i);
  assert.equal(await readFile(path.join(folder, 'sitemap.xml'), 'utf8'), 'ANTERIOR');
});

test('un index enlazado no sirve como evidencia de propiedad de una carpeta retirada', async t => {
  const { folder, execute } = await fixture(t);
  const original = path.join(folder, 'pagina-ajena.html'), index = path.join(folder, 'productos', generated, 'index.html');
  await writeFile(original, previousHtml);
  await rm(index);
  if (process.platform === 'win32') {
    // Windows restringe symlinks de archivo sin privilegios; una junction en el
    // mismo index debe rechazarse igualmente sin recorrer su destino.
    const destination = path.join(folder, 'pagina-ajena');
    await mkdir(destination);
    await writeFile(path.join(destination, 'conservar.html'), previousHtml);
    await symlink(destination, index, 'junction');
  } else await symlink(original, index, 'file');
  await assert.rejects(execute(), /enlace|propiedad|generador|ficha.*generada/i);
  assert.equal(await readFile(original, 'utf8'), previousHtml);
  assert.equal(await readFile(path.join(folder, 'sitemap.xml'), 'utf8'), 'ANTERIOR');
});

test('validación pública acepta un catálogo vacío sin depender de DCPR7E', async t => {
  const { folder, execute } = await fixture(t);
  await execute();
  await run(process.execPath, ['--test', path.join(repo, 'tests/publicacion.test.mjs')], { env: { ...process.env, KEIKO_PUBLICACION_ROOT: folder } });
});

test('un producto distinto de DCPR7E valida y carga las métricas antes de la ficha', async t => {
  const product = { id:generated.slice(6), codigo:'OTRO', nombre:'Repuesto de prueba', categoria:'Filtros', marca:'Prueba', cantidad:1, precio:null, descripcion_corta:'Resumen', descripcion:'Descripción', compatibilidad:[], referencias:[], fotos:[] };
  const { folder, execute } = await fixture(t, [product]);
  await execute();
  await run(process.execPath, ['--test', path.join(repo, 'tests/publicacion.test.mjs')], { env:{ ...process.env, KEIKO_PUBLICACION_ROOT:folder } });
  const html = await readFile(path.join(folder, 'productos', generated, 'index.html'), 'utf8');
  assert.ok(html.indexOf('catalogo-eventos.js') < html.indexOf('ficha-publica.js'));
  assert.match(html, /ficha-publica\.js\?v=20261023-1/);
});

test('la ficha estática con foto pero stock cero no habilita promoción antes de ejecutar JavaScript', async t => {
  const product = { id:generated.slice(6), codigo:'OTRO', nombre:'Repuesto de prueba', categoria:'Filtros', marca:'Prueba', cantidad:0, precio:10, descripcion_corta:'Resumen', descripcion:'Descripción', compatibilidad:[], referencias:[], fotos:['foto.png'] };
  const { folder, execute } = await fixture(t, [product]);
  await execute();
  const html = await readFile(path.join(folder, 'productos', generated, 'index.html'), 'utf8');
  assert.match(html, /<button disabled id="product-share"/);
  await access(path.join(folder, 'productos', generated, 'social.jpg'));
});
