import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import vm from "node:vm";

// Diagnóstico de solo lectura. No crea productos, eventos ni investigaciones.
// Firmar URLs existentes permite leer fotos privadas; no escribe objetos en Storage.
const site = "https://henryconteron.github.io/mecanica-keiko/";
const window = {};
vm.runInNewContext(await readFile(new URL("../assets/config.js", import.meta.url), "utf8"), { window });
const config = window.KEIKO_CONFIG;
const headers = { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}` };
const get = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(25000) });
const digest = (value) => createHash("sha256").update(value.replaceAll("\r\n", "\n")).digest("hex");

for (const file of ["index.html", "admin-estado.html", "assets/catalogo.js", "assets/admin-estado.js", "assets/promocion.js"]) {
  const response = await get(new URL(file, site));
  assert.equal(response.status, 200, `${file}: página o recurso no disponible`);
  const deployed = await response.text();
  const local = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  assert.equal(digest(deployed), digest(local), `${file}: producción difiere de la copia local`);
}
console.log("Página, panel y promociones: archivos publicados coinciden con el proyecto.");

const response = await get(`${config.supabaseUrl}/rest/v1/productos_admin?revision=eq.publicado&select=id,codigo,nombre,cantidad,precio,marca,categoria,descripcion_corta,descripcion,compatibilidad,referencias,fotos`, { headers });
assert.equal(response.status, 200, "Catálogo anónimo inaccesible");
const products = await response.json();
assert.ok(products.length > 0, "El catálogo público está vacío");
for (const path of ["productos_admin?select=resultado_bot&limit=1", "productos_admin?select=error_investigacion&limit=1", "catalogo_eventos?select=*&limit=1", "plan_publicaciones?select=*&limit=1"]) {
  const privateResponse = await get(`${config.supabaseUrl}/rest/v1/${path}`, { headers });
  assert.ok([401, 403].includes(privateResponse.status), `Datos internos accesibles anónimamente: ${path}`);
  await privateResponse.body?.cancel();
}
console.log(`Catálogo público: ${products.length} productos. Notas, investigaciones, métricas y agenda privadas.`);

let images = 0;
// Procesa por producto para no saturar el servicio ni confundir un límite temporal con una foto borrada.
for (const product of products) {
  assert.ok(product.fotos?.length, `${product.codigo}: publicado sin foto`);
  assert.ok(product.descripcion?.trim(), `${product.codigo}: publicado sin descripción`);
  const checked = await Promise.all(product.fotos.map(async (path, index) => {
    const signed = await get(`${config.supabaseUrl}/storage/v1/object/sign/inventario/${encodeURIComponent(path).replaceAll("%2F", "/")}`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 120 })
    });
    assert.equal(signed.status, 200, `${product.codigo}: no se puede leer foto ${index + 1}`);
    const body = await signed.json();
    assert.ok(body.signedURL, `${product.codigo}: URL de foto ausente`);
    const photo = await get(`${config.supabaseUrl}/storage/v1${body.signedURL}`, { method: "HEAD" });
    assert.equal(photo.status, 200, `${product.codigo}: falta foto ${index + 1}`);
    assert.match(photo.headers.get("content-type") || "", /^image\//i, `${product.codigo}: foto ${index + 1} no es imagen`);
    const size = photo.headers.get("content-length");
    if (size !== null) assert.ok(Number(size) > 0, `${product.codigo}: foto ${index + 1} vacía`);
    return true;
  }));
  images += checked.length;
}
console.log(`Fotografías: ${images} archivos disponibles, incluidas todas las portadas. No se modificó ningún dato.`);
