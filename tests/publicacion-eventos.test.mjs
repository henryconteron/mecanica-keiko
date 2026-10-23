import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
async function events(preview = false) {
  const calls = [], context = { URL, location: { href: 'https://example.test/productos/panel-id/' + (preview ? '?vista-pagina=1' : '') }, window: { KEIKO_CONFIG: { supabaseUrl: 'https://mock.invalid', supabaseAnonKey: 'public-test-key' } }, fetch: async (url, options) => { calls.push({ url, ...options }); return {}; } };
  vm.runInNewContext(await readFile(new URL('assets/catalogo-eventos.js', root), 'utf8'), context);
  return { calls, context, register: context.window.KEIKO_CATALOG_EVENTS.register };
}
test('métricas solo envían código y evento permitido; no texto ni datos personales', async () => {
  const { register, calls } = await events();
  for (const name of ['ver_ficha', 'whatsapp', 'compartir']) register({ codigo: 'D831C', cliente: 'NO ENVIAR', descripcion: 'PRIVADO' }, name);
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.deepEqual(Object.keys(JSON.parse(call.body)).sort(), ['codigo', 'evento']);
    assert.equal(JSON.parse(call.body).codigo, 'D831C');
    assert.equal(call.keepalive, true);
    assert.doesNotMatch(call.body, /PRIVADO|NO ENVIAR/);
  }
  register({ codigo: 'D831C' }, 'venta'); register({}, 'ver_ficha');
  assert.equal(calls.length, 3);
});
test('vista previa no genera métricas y fallos de red no rompen navegación', async () => {
  const preview = await events(true);
  preview.register({ codigo: 'D831C' }, 'whatsapp');
  assert.equal(preview.calls.length, 0);
  const regular = await events();
  regular.context.fetch = () => { throw new Error('sin red'); };
  assert.doesNotThrow(() => regular.register({ codigo: 'D831C' }, 'ver_ficha'));
});
test('ficha registra visualización, consulta y compartir mediante el helper común', async () => {
  const { context, calls } = await events();
  const nodes = new Map();
  const node = key => { if (!nodes.has(key)) nodes.set(key, { textContent: '', hidden: false, disabled: false }); return nodes.get(key); };
  node('#product-data').textContent = JSON.stringify({ panelId: 'id', codigo: 'D831C', nombre: 'Pastillas', precio: null, stock:1, medios:[{ src:'photo.jpg' }] });
  context.document = { querySelector: node };
  context.window.KEIKO_PAGE_MODEL = { contact: () => ({ name: 'Keiko' }) };
  context.window.KEIKO_PROMOTION = { open() {} };
  context.AbortSignal = AbortSignal;
  context.fetch = async (url, options) => { if (options?.method === 'POST') calls.push({ url, ...options }); throw new Error('Solo respaldo, sin red externa'); };
  vm.runInNewContext(await readFile(new URL('assets/ficha-publica.js', root), 'utf8'), context);
  node('#product-contact').onclick(); node('#product-share').onclick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls.map(call => JSON.parse(call.body).evento), ['ver_ficha', 'whatsapp', 'compartir']);
});
test('ficha sin existencias conserva consulta de reposición pero no prepara promociones', async () => {
  const { context } = await events();
  const nodes = new Map(), node = key => { if (!nodes.has(key)) nodes.set(key, { textContent:'', hidden:false, disabled:false }); return nodes.get(key); };
  node('#product-data').textContent = JSON.stringify({ panelId:'id', codigo:'D831C', nombre:'Pastillas', precio:null, stock:0, medios:[{ src:'photo.jpg' }] });
  let promotions = 0;
  context.document = { querySelector:node };
  context.window.KEIKO_PAGE_MODEL = { contact:() => ({ name:'Keiko' }) };
  context.window.KEIKO_PROMOTION = { open(){ promotions++; } };
  context.AbortSignal = AbortSignal;
  context.fetch = async () => { throw new Error('Prueba sin red'); };
  vm.runInNewContext(await readFile(new URL('assets/ficha-publica.js', root), 'utf8'), context);
  assert.equal(node('#product-share').disabled, true);
  node('#product-share').onclick();
  assert.equal(promotions, 0);
  assert.equal(node('#product-contact').hidden, false);
});
