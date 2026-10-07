// Galerías estáticas de servicios. Los productos publicados proceden exclusivamente del panel.
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd(), servicesRoot = path.join(root,'servicios');
const images = new Set(['.jpg','.jpeg','.png','.webp','.gif']), videos = new Set(['.mp4','.webm']);
const services = [];
for(const entry of (await readdir(servicesRoot,{withFileTypes:true})).filter(item=>item.isDirectory()&&!item.name.startsWith('_')&&!item.name.startsWith('.'))){
  const data=JSON.parse(await readFile(path.join(servicesRoot,entry.name,'servicio.json'),'utf8'));
  if(!data.nombre||!data.descripcion||!data.numero)throw new Error('Servicio incompleto: '+entry.name);
  const files=(await readdir(path.join(servicesRoot,entry.name),{withFileTypes:true})).filter(item=>item.isFile()).map(item=>item.name).filter(name=>images.has(path.extname(name).toLowerCase())||videos.has(path.extname(name).toLowerCase())).sort((a,b)=>Number(!a.startsWith('portada'))-Number(!b.startsWith('portada'))||a.localeCompare(b,undefined,{numeric:true}));
  services.push({id:entry.name,...data,medios:files.map(name=>({tipo:videos.has(path.extname(name).toLowerCase())?'video':'imagen',src:'servicios/'+entry.name+'/'+encodeURIComponent(name),nombre:name}))});
}
const published=services.filter(item=>item.publicado!==false).sort((a,b)=>(a.orden??99)-(b.orden??99)||a.nombre.localeCompare(b.nombre));
const file=path.join(root,'data/servicios.json');
let date=new Date().toISOString();
try{const current=JSON.parse(await readFile(file,'utf8'));if(JSON.stringify(current.servicios)===JSON.stringify(published))date=current.actualizado;}catch{}
await mkdir(path.dirname(file),{recursive:true});
await writeFile(file,JSON.stringify({actualizado:date,total:published.length,servicios:published},null,2)+'\n');
console.log('Galerías de servicios: '+published.length+'. Productos: ejecutar publicacion:sincronizar.');
