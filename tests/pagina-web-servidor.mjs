// Servidor de pruebas para revisión visual. Todo Supabase es una simulación local en memoria.
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
let revision = 0, draft = { version: 1, fields: {} }, published = structuredClone(draft), history = [], writes = 0;
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const json = (data, code = 200) => { response.writeHead(code, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(data)); };
  try {
    if (url.pathname === '/assets/config.js') {
      response.setHeader('Content-Type', 'text/javascript'); return response.end(`window.KEIKO_CONFIG={supabaseUrl:'https://local-supabase.example.test',supabaseAnonKey:'test-only-public-key'};const testFetch=window.fetch.bind(window);window.fetch=(input,options)=>testFetch(typeof input==='string'&&input.startsWith('https://local-supabase.example.test')?input.replace('https://local-supabase.example.test',location.origin+'/mock'):input,options);`);
    }
    if (url.pathname === '/test-state') return json({ revision, draft, published, history, writes });
    if (url.pathname.startsWith('/mock/')) {
      const route = url.pathname.slice(5);
      let body = '';
      for await (const chunk of request) body += chunk;
      if (route === '/auth/v1/user') return json({ id: '60712cc3-ee1b-4ad5-9226-4f97d80a13d8', email: 'prueba@example.test' });
      if (route === '/auth/v1/token') return json({ access_token: 'test-only', refresh_token: 'test-only-refresh', user: { id: '60712cc3-ee1b-4ad5-9226-4f97d80a13d8' } });
      if (route === '/rest/v1/estado_taller') return json([{ estado: 'automatico', mensaje: '', actualizado: new Date().toISOString() }]);
      if (route === '/rest/v1/pagina_borrador') return json([{ contenido: draft, revision }]);
      if (route === '/rest/v1/pagina_publica') return json([{ contenido: published }]);
      if (route === '/rest/v1/pagina_historial') return json(history);
      if (route.startsWith('/rest/v1/rpc/pagina_')) {
        const data = JSON.parse(body);
        if (data.p_revision !== revision) return json({ message: 'Otra computadora cambio el borrador. No se sobrescribio nada.' }, 409);
        if (route.endsWith('pagina_guardar')) draft = data.p_contenido;
        else { history.unshift({ id: history.length + 1, contenido: published, creado: new Date().toISOString() }); published = structuredClone(draft); }
        writes++; return json({ revision: ++revision });
      }
      if (route === '/rest/v1/catalogo_eventos' && request.method === 'POST') return json({ message: 'Métrica local de prueba' });
      return json([]);
    }
    const pathname = decodeURIComponent(url.pathname);
    const target = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative) || pathname.includes('/.')) return json({ error: 'Forbidden' }, 403);
    let data = await readFile(target);
    if (path.extname(target) === '.html') data = Buffer.from(data.toString().replace(/<script async src="https:\/\/www.googletagmanager.com[^>]+><\/script>/, ''));
    response.setHeader('Content-Type', mime[path.extname(target)] || 'application/octet-stream'); response.end(data);
  } catch { json({ error: 'Not found' }, 404); }
});
server.listen(0, '127.0.0.1', () => console.log(`Prueba local aislada: http://127.0.0.1:${server.address().port}/admin-estado.html`));
