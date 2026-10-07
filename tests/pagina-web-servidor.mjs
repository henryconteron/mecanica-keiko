// Servidor de pruebas para revisión visual. Todo Supabase es una simulación local en memoria.
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
let revision = 0, draft = { version: 1, fields: {} }, published = structuredClone(draft), history = [], writes = 0;
const snapshot = JSON.parse(await readFile(path.join(root,'data/catalogo-panel.json'),'utf8'));
const products = snapshot.productos.map(product => ({...product,id:product.panelId,version:1,revision:'publicado',cantidad:product.stock,precio:typeof product.precio==='number'?product.precio:null,descripcion_corta:product.descripcionCorta,fotos:[product.medios[0]?.src].filter(Boolean),actualizado:new Date().toISOString()}));
const uploads = new Map(), leads = [];
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const json = (data, code = 200) => { response.writeHead(code, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(data)); };
  try {
    if (url.pathname === '/assets/config.js') {
      response.setHeader('Content-Type', 'text/javascript'); return response.end(`window.KEIKO_CONFIG={supabaseUrl:location.origin+'/mock',supabaseAnonKey:'test-only-public-key'};`);
    }
    if (url.pathname === '/test-state') return json({ revision, draft, published, history, writes });
    if (url.pathname.startsWith('/mock/')) {
      const route = url.pathname.slice(5);
      let body = '';
      const buffers=[]; for await (const chunk of request) buffers.push(chunk);
      const raw=Buffer.concat(buffers); body=raw.toString();
      if(route.startsWith('/storage/v1/object/pagina-media/') && request.method==='POST') { uploads.set(route.split('/').at(-1),raw); return json({ok:true}); }
      if(route.startsWith('/storage/v1/object/sign/')){
        const bucket=route.split('/')[5], name=decodeURIComponent(route.split('/').slice(6).join('/'));
        return json({signedURL:'/object/test/'+bucket+'/'+encodeURIComponent(name)});
      }
      if(route.startsWith('/storage/v1/object/test/')){
        const bucket=route.split('/')[5],name=decodeURIComponent(route.split('/').slice(6).join('/'));
        const data=bucket==='pagina-media'?uploads.get(name):await readFile(path.join(root,name));
        if(!data)return json({error:'Not found'},404); response.setHeader('Content-Type','image/jpeg');return response.end(data);
      }
      if (route === '/auth/v1/user') return json({ id: '60712cc3-ee1b-4ad5-9226-4f97d80a13d8', email: 'prueba@example.test' });
      if (route === '/auth/v1/token') return json({ access_token: 'test-only', refresh_token: 'test-only-refresh', user: { id: '60712cc3-ee1b-4ad5-9226-4f97d80a13d8' } });
      if (route === '/rest/v1/estado_taller') return json([{ estado: 'automatico', mensaje: '', actualizado: new Date().toISOString() }]);
      if (route === '/rest/v1/productos_admin') {
        const id=url.searchParams.get('id')?.slice(3),expected=Number(url.searchParams.get('version')?.slice(3));
        const found=products.filter(product=>!id||product.id===id);
        if(request.method==='PATCH'){const data=JSON.parse(body);if(!found[0]||expected!==found[0].version)return json([]);Object.assign(found[0],data);writes++;}
        return json(found);
      }
      if(route==='/rest/v1/consultas_taller'){
        if(request.method==='POST'){leads.unshift({id:crypto.randomUUID(),creado:new Date().toISOString(),actualizado:new Date().toISOString(),...JSON.parse(body)});return json([]);}
        if(request.method==='PATCH'){const found=leads.find(row=>'eq.'+row.id===url.searchParams.get('id'));if(!found)return json([]);Object.assign(found,JSON.parse(body));return json([found]);}
        return json(leads);
      }
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
