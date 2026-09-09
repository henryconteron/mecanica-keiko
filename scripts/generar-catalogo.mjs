import { readdir, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const catalogRoot = path.join(projectRoot, "catalogo");
const outputFile = path.join(projectRoot, "data", "catalogo.json");
const productPagesRoot = path.join(projectRoot, "productos");
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const videoExtensions = new Set([".mp4", ".webm"]);

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const siteUrlFromEnvironment = () => {
  if (process.env.SITE_URL) return process.env.SITE_URL.endsWith("/") ? process.env.SITE_URL : `${process.env.SITE_URL}/`;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository?.includes("/")) return "";
  const [owner, repositoryName] = repository.split("/");
  const userSite = repositoryName.toLowerCase() === `${owner}.github.io`.toLowerCase();
  return userSite
    ? `https://${owner}.github.io/`
    : `https://${owner}.github.io/${repositoryName}/`;
};

const siteUrl = siteUrlFromEnvironment();

const priceText = (product) => {
  if (typeof product.precio === "number") {
    return new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: product.moneda || "USD",
      maximumFractionDigits: product.precio % 1 === 0 ? 0 : 2
    }).format(product.precio);
  }
  return product.precio || "Consultar";
};

const renderMedia = (product) => {
  if (!product.medios.length) return `<div class="empty">Foto disponible próximamente</div>`;
  return product.medios.map((medium, index) => {
    const src = `../../${medium.src}`;
    if (medium.tipo === "video") {
      return `<figure class="media-item${index === 0 ? " main" : ""}"><video src="${escapeHtml(src)}" controls preload="metadata" playsinline></video></figure>`;
    }
    return `<figure class="media-item${index === 0 ? " main" : ""}"><img src="${escapeHtml(src)}" alt="${escapeHtml(`${product.nombre} ${product.codigo} — imagen ${index + 1}`)}" ${index === 0 ? "" : "loading=\"lazy\""}></figure>`;
  }).join("");
};

const renderProductPage = (product) => {
  const productUrl = siteUrl ? new URL(`productos/${product.id}/`, siteUrl).href : "";
  const imageUrl = siteUrl && product.medios[0]
    ? new URL(product.medios[0].src, siteUrl).href
    : "";
  const whatsappMessage = encodeURIComponent(`Hola, consulto por ${product.nombre}. Código: ${product.codigo}. ${productUrl ? `Enlace: ${productUrl}. ` : ""}Mi vehículo es:`);
  const facebookShare = productUrl ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}` : "../../#repuestos";
  const details = [
    ...(product.compatibilidad || []).map((item) => `Compatible con: ${item}`),
    ...(product.referencias || []).map((item) => `Referencia: ${item}`),
    product.estado ? `Estado: ${product.estado}` : "",
    typeof product.stock === "number" ? `Stock registrado: ${product.stock}` : ""
  ].filter(Boolean);

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(product.nombre)} ${escapeHtml(product.codigo)} | Tecnicentro Keiko</title>
  <meta name="description" content="${escapeHtml(product.descripcionCorta || product.descripcion)}">
  <meta name="theme-color" content="#171717">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="Tecnicentro Automotriz Keiko">
  <meta property="og:title" content="${escapeHtml(`${product.nombre} — ${product.codigo}`)}">
  <meta property="og:description" content="${escapeHtml(`${priceText(product)}. ${product.descripcionCorta || product.descripcion}`)}">
  ${productUrl ? `<meta property="og:url" content="${escapeHtml(productUrl)}">` : ""}
  ${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}"><meta property="og:image:alt" content="${escapeHtml(`${product.nombre} ${product.codigo}`)}">` : ""}
  ${productUrl ? `<link rel="canonical" href="${escapeHtml(productUrl)}">` : ""}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Oswald:wght@600;700&display=swap" rel="stylesheet">
  <style>
    :root{--ink:#171717;--paper:#f4f1eb;--red:#c8272c;--gold:#e9a927;--green:#20a856;--muted:#68645e}*{box-sizing:border-box}body{margin:0;color:var(--ink);background:var(--paper);font-family:Inter,system-ui,sans-serif;line-height:1.6}a{color:inherit}.top{padding:14px 0;color:#fff;background:var(--ink)}.wrap{width:min(1120px,calc(100% - 28px));margin:auto}.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:15px}.brand{font-family:Oswald,sans-serif;font-size:1.15rem;font-weight:700;text-decoration:none;text-transform:uppercase}.back{color:#d1d1d1;text-decoration:none;font-size:.86rem;font-weight:700}.product{padding:clamp(34px,6vw,76px) 0}.layout{display:grid;grid-template-columns:1.08fr .92fr;gap:34px;align-items:start}.gallery{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.media-item{min-height:210px;margin:0;overflow:hidden;display:grid;place-items:center;background:#121212;border-radius:16px}.media-item.main{grid-column:1/-1;min-height:470px}.media-item img,.media-item video{width:100%;height:100%;max-height:580px;display:block;object-fit:contain}.empty{grid-column:1/-1;padding:80px 20px;color:#777;text-align:center;border:1px dashed #bbb;border-radius:16px}.copy{position:sticky;top:24px;padding:34px;background:#fff;border:1px solid #ddd7cf;border-radius:22px;box-shadow:0 18px 46px rgba(0,0,0,.08)}.eyebrow{margin:0 0 8px;color:var(--red);font-size:.76rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase}h1{margin:0 0 12px;font-family:Oswald,sans-serif;font-size:clamp(2.5rem,5vw,4.5rem);line-height:1;text-transform:uppercase}.code{color:var(--muted);font-weight:700}.price{margin:20px 0;color:var(--red);font-size:2rem;font-weight:900}.description{color:var(--muted)}ul{padding-left:20px}li{margin-bottom:7px}.buttons{margin-top:28px;display:grid;gap:10px}.button{min-height:50px;padding:12px 18px;display:flex;align-items:center;justify-content:center;border:0;border-radius:999px;color:#fff;background:var(--red);cursor:pointer;text-decoration:none;font:inherit;font-weight:800}.whatsapp{background:var(--green)}.secondary{color:var(--ink);border:1px solid #d4cec5;background:#fff}.notice{margin-top:20px;padding:14px 16px;border-left:4px solid var(--gold);background:#faf6e9;font-size:.84rem}.footer{padding:26px 0;color:#aaa;background:#101010;font-size:.82rem}@media(max-width:800px){.layout{grid-template-columns:1fr}.copy{position:static;order:-1}.media-item.main{min-height:320px}}@media(max-width:520px){.gallery{grid-template-columns:1fr}.media-item,.media-item.main{grid-column:1;min-height:280px}.copy{padding:25px 20px}.top .wrap{align-items:flex-start;flex-direction:column}}
  </style>
</head>
<body>
  <header class="top"><div class="wrap"><a class="brand" href="../../">Tecnicentro Automotriz Keiko</a><a class="back" href="../../#repuestos">← Volver al catálogo</a></div></header>
  <main class="product"><div class="wrap layout">
    <section class="gallery" aria-label="Fotos y videos del producto">${renderMedia(product)}</section>
    <article class="copy">
      <p class="eyebrow">${escapeHtml(product.categoria)}</p>
      <h1>${escapeHtml(product.nombre)}</h1>
      <p class="code">Código: ${escapeHtml(product.codigo)}</p>
      <div class="price">${escapeHtml(priceText(product))}</div>
      <p class="description">${escapeHtml(product.descripcion)}</p>
      ${details.length ? `<ul>${details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>` : ""}
      <div class="buttons">
        <a class="button whatsapp" href="https://wa.me/593989381059?text=${whatsappMessage}" target="_blank" rel="noopener">Consultar por WhatsApp</a>
        <button class="button" id="share" type="button">Compartir producto</button>
        <a class="button secondary" href="${escapeHtml(facebookShare)}" target="_blank" rel="noopener">Compartir en Facebook</a>
      </div>
      <p class="notice"><strong>Antes de comprar:</strong> confirmamos código, año, motor y versión del vehículo.</p>
    </article>
  </div></main>
  <footer class="footer"><div class="wrap">Tecnicentro Automotriz Keiko · Archidona, Napo · WhatsApp 098 938 1059</div></footer>
  <script>document.querySelector('#share').addEventListener('click',async()=>{const data={title:${JSON.stringify(`${product.nombre} ${product.codigo}`)},text:${JSON.stringify(`${product.nombre} — ${priceText(product)}`)},url:location.href};try{if(navigator.share){await navigator.share(data)}else{await navigator.clipboard.writeText(location.href);alert('Enlace copiado')}}catch(error){if(error.name!=='AbortError')alert('No se pudo compartir')}});</script>
</body>
</html>
`;
};

const directories = (await readdir(catalogRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith("."))
  .sort((a, b) => a.name.localeCompare(b.name));

const products = [];
const errors = [];

for (const directory of directories) {
  const productFolder = path.join(catalogRoot, directory.name);
  const dataFile = path.join(productFolder, "producto.json");
  let data;

  try {
    data = JSON.parse(await readFile(dataFile, "utf8"));
  } catch (error) {
    errors.push(`${directory.name}: no se pudo leer producto.json (${error.message})`);
    continue;
  }

  if (!data.codigo || !data.nombre || !data.categoria) {
    errors.push(`${directory.name}: producto.json necesita codigo, nombre y categoria`);
    continue;
  }

  const files = (await readdir(productFolder, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => imageExtensions.has(path.extname(name).toLowerCase()) || videoExtensions.has(path.extname(name).toLowerCase()))
    .sort((a, b) => {
      const aCover = a.toLowerCase().startsWith("portada") ? -1 : 0;
      const bCover = b.toLowerCase().startsWith("portada") ? -1 : 0;
      return aCover - bCover || a.localeCompare(b, undefined, { numeric: true });
    });

  const media = files.map((name) => ({
    tipo: videoExtensions.has(path.extname(name).toLowerCase()) ? "video" : "imagen",
    src: `catalogo/${directory.name}/${encodeURIComponent(name)}`,
    nombre: name
  }));

  products.push({
    id: directory.name,
    ...data,
    medios: media
  });
}

if (errors.length) {
  console.error("No se pudo generar el catálogo:\n- " + errors.join("\n- "));
  process.exit(1);
}

const publicProducts = products
  .filter((product) => product.publicado !== false)
  .sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99) || a.nombre.localeCompare(b.nombre));

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, JSON.stringify({
  actualizado: new Date().toISOString(),
  total: publicProducts.length,
  productos: publicProducts
}, null, 2) + "\n");

await rm(productPagesRoot, { recursive: true, force: true });
await mkdir(productPagesRoot, { recursive: true });
for (const product of publicProducts) {
  const pageFolder = path.join(productPagesRoot, product.id);
  await mkdir(pageFolder, { recursive: true });
  await writeFile(path.join(pageFolder, "index.html"), renderProductPage(product));
}

console.log(`Catálogo generado: ${publicProducts.length} productos publicados y ${publicProducts.length} páginas individuales.`);
