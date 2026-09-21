import process from "node:process";

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GROQ_API_KEY"];
for (const name of required) if (!process.env[name]) throw new Error(`Falta el secreto ${name}.`);

const supabase = process.env.SUPABASE_URL.trim().replace(/\/$/, "");
// Los portapapeles pueden insertar saltos de línea invisibles al copiar la clave.
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY.replace(/\s+/g, "");
const serviceHeaders = (headers = {}) => ({
  apikey: serviceKey,
  ...headers
});
const groqUrl = "https://api.groq.com/openai/v1/chat/completions";
const text = (value) => String(value ?? "").trim();
const codeKey = (value) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const textValue = (value) => {
  if (value && typeof value === "object") return text(value.referencia || value.codigo || value.numero || value.valor || value.nombre || "");
  return text(value);
};
const unique = (items) => [...new Set((items || []).map(textValue).filter(Boolean))];
const blockedSourceDomains = [
  "facebook.com", "instagram.com", "tiktok.com", "pinterest.com", "youtube.com",
  "scribd.com", "pdfcoffee.com", "docplayer", "manualzz", "studocu", "slideshare.net",
  "mercadolibre.", "amazon.", "aliexpress.", "ebay.", "wikipedia.org"
];
const knownTechnicalDomains = [
  "advancefilters.com", "mann-filter.com", "hengst-filter.com", "mahle-aftermarket.com",
  "boschaftermarket.com", "denso.com", "ngkntk.com", "wixfilters.com", "fram.com",
  "hyundai.com", "kia.com", "toyota.com", "distripartes", "maxcar"
];

const sourceUrl = (value) => {
  try {
    const parsed = new URL(text(value));
    const hostname = parsed.hostname.toLowerCase();
    const privateHost = hostname === "localhost" || hostname.endsWith(".local") || /^(127|10|0|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(hostname);
    if (parsed.protocol !== "https:" || privateHost || !hostname.includes(".")) return null;
    return parsed;
  } catch { return null; }
};

const isBlockedSource = (hostname) => blockedSourceDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`) || hostname.includes(domain));
const isKnownTechnicalSource = (hostname) => knownTechnicalDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`) || hostname.includes(domain));
const titleFromHtml = (html) => text(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]).replace(/\s+/g, " ").slice(0, 160);

const parseJson = (value) => {
  const raw = text(value).replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(raw); } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error("Groq no devolvió JSON válido.");
  }
};

const api = async (path, options = {}) => {
  const response = await fetch(`${supabase}${path}`, {
    ...options,
    headers: serviceHeaders({ "Content-Type": "application/json", ...options.headers })
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || `Supabase respondió ${response.status}.`);
  return body;
};

const groq = async (payload, attempts = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(groqUrl, {
      method: "POST",
      signal: AbortSignal.timeout(90000),
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
        "Groq-Model-Version": payload.model.startsWith("groq/compound") ? "2025-07-23" : "latest"
      },
      body: JSON.stringify(payload)
    });
    if (response.ok) return response.json();
    lastError = new Error(`Groq respondió ${response.status}: ${(await response.text()).slice(0, 350)}`);
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === attempts) throw lastError;
    await new Promise((resolve) => setTimeout(resolve, attempt * 2500));
  }
  throw lastError;
};

const inspectPhoto = async (product) => {
  if (!product.fotos?.[0]) return { codigo_visible: "", confianza: "Baja", error: "No hay fotografía." };
  const response = await fetch(`${supabase}/storage/v1/object/inventario/${product.fotos[0]}`, { headers: serviceHeaders() });
  if (!response.ok) throw new Error("No se pudo descargar la fotografía principal.");
  const mime = response.headers.get("content-type") || "image/jpeg";
  const base64 = Buffer.from(await response.arrayBuffer()).toString("base64");
  const result = await groq({
    model: "qwen/qwen3.8-27b",
    messages: [{ role: "user", content: [
      { type: "text", text: `Lee literalmente la etiqueta de este repuesto. El código capturado es ${product.codigo}. No deduzcas aplicaciones por la forma. Devuelve JSON con codigo_visible, marca_visible, tipo_visible, otros_codigos (array), aplicaciones_impresas (array), confianza (Alta|Media|Baja).` },
      { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } }
    ] }],
    response_format: { type: "json_object" }, reasoning_format: "hidden", reasoning_effort: "none", temperature: 0.1, max_completion_tokens: 650
  }, 1);
  return parseJson(result.choices?.[0]?.message?.content);
};

const research = async (product, vision) => {
  const prompt = `Investiga un repuesto automotriz para venta en Ecuador.
Datos capturados: código ${product.codigo}; nombre ${product.nombre}; marca ${product.marca || "no indicada"}. Lectura fotográfica: ${JSON.stringify(vision)}.
Reglas obligatorias:
- Busca el código exacto, no uno parecido. Si el código no aparece literalmente en la fuente, responde codigo_coincide:false.
- La ficha debe describir el mismo tipo de pieza que el nombre capturado y, si existe, que la etiqueta leída. Si hay duda, responde producto_coincide:false.
- No inventes compatibilidades, medidas, equivalencias ni marca. Omite los datos que no estén sustentados.
- Usa solamente enlaces HTTPS directos de fabricante, catálogo técnico o distribuidor automotriz reconocido. Nunca uses redes sociales, PDFs compartidos, Scribd, PDFCoffee, marketplaces ni páginas genéricas de resultados.
- Para confianza Alta usa dos fuentes de dominios distintos; para Media basta una fuente directa. Devuelve únicamente JSON válido, sin explicación antes o después:
{"codigo_coincide":true,"producto_coincide":true,"nombre_sugerido":"","marca":"","categoria":"","descripcion_corta":"máximo 180 caracteres","descripcion":"máximo 500 caracteres","compatibilidad":[""],"referencias":[""],"fuentes":[{"titulo":"","url":"https://...","tipo":"Fabricante|Catálogo técnico|Distribuidor"}],"confianza":"Alta|Media|Baja","observaciones":"","listo_para_revisar":true}`;
  const result = await groq({
    model: "openai/gpt-oss-20b", messages: [{ role: "user", content: prompt }],
    tools: [{ type: "browser_search" }], tool_choice: "required", reasoning_effort: "low",
    temperature: 0.1, max_completion_tokens: 1800
  });
  return parseJson(result.choices?.[0]?.message?.content);
};

const verifySource = async (source, product) => {
  const parsed = sourceUrl(source?.url);
  if (!parsed) return { source, ok: false, reason: "La fuente no tiene una URL HTTPS pública y directa." };
  if (isBlockedSource(parsed.hostname)) return { source, ok: false, reason: `La fuente ${parsed.hostname} no es aceptable para información técnica.` };
  try {
    const response = await fetch(parsed, {
      redirect: "follow", signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "MecanicaKeikoCatalogBot/1.0 (+https://henryconteron.github.io/mecanica-keiko/)" }
    });
    const finalUrl = sourceUrl(response.url);
    if (!response.ok || !finalUrl || isBlockedSource(finalUrl.hostname)) {
      return { source, ok: false, reason: `No se pudo verificar una página técnica directa (${response.status}).` };
    }
    const contentType = response.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      return { source, ok: false, reason: "La fuente no es una página técnica legible que permita comprobar el código." };
    }
    const page = (await response.text()).slice(0, 1_500_000);
    if (!codeKey(page).includes(codeKey(product.codigo))) {
      return { source, ok: false, reason: `La fuente no muestra el código exacto ${product.codigo}.` };
    }
    return {
      ok: true,
      source: {
        titulo: text(source.titulo) || titleFromHtml(page) || finalUrl.hostname,
        url: finalUrl.toString(),
        tipo: text(source.tipo) || "Fuente técnica",
        dominio: finalUrl.hostname,
        codigo_verificado: true,
        fuente_tecnica_reconocida: isKnownTechnicalSource(finalUrl.hostname)
      }
    };
  } catch (error) {
    return { source, ok: false, reason: `No se pudo comprobar la fuente: ${error.message}` };
  }
};

const pending = await api("/rest/v1/productos_admin?revision=eq.investigar&select=*&order=creado.asc&limit=5");
console.log(`Productos pendientes: ${pending.length}`);

for (const product of pending) {
  console.log(`Investigando ${product.codigo}…`);
  try {
    let vision;
    try { vision = await inspectPhoto(product); } catch (error) { vision = { codigo_visible: "", confianza: "Baja", error: error.message }; }
    const result = await research(product, vision);
    const sourceChecks = await Promise.all((result.fuentes || []).slice(0, 5).map((source) => verifySource(source, product)));
    const sources = sourceChecks.filter((check) => check.ok).map((check) => check.source);
    const sourceProblems = sourceChecks.filter((check) => !check.ok).map((check) => check.reason);
    const independentDomains = new Set(sources.map((source) => source.dominio)).size;
    const reasons = [];
    if (vision.error) reasons.push(vision.error);
    if (vision.codigo_visible && codeKey(vision.codigo_visible) !== codeKey(product.codigo)) reasons.push(`El código visible ${vision.codigo_visible} no coincide con ${product.codigo}.`);
    if (result.codigo_coincide !== true) reasons.push("La investigación no confirmó el código exacto del producto.");
    if (result.producto_coincide !== true) reasons.push("La investigación no confirmó que la descripción corresponde al mismo producto.");
    if (!sources.length) reasons.push("No se obtuvo una fuente directa donde aparezca el código exacto.");
    if (!result.compatibilidad?.length) reasons.push("No se obtuvo compatibilidad verificable.");
    if (text(result.confianza).toLowerCase() === "alta" && independentDomains < 2) reasons.push("La confianza Alta exige dos fuentes verificadas de dominios distintos.");
    const ready = !reasons.length && result.listo_para_revisar === true;
    // Una propuesta bloqueada se conserva solo como evidencia del bot: nunca reemplaza la ficha del producto.
    const safeDetails = ready ? {
      nombre: text(result.nombre_sugerido) || product.nombre, marca: text(result.marca) || product.marca,
      categoria: text(result.categoria), descripcion_corta: text(result.descripcion_corta), descripcion: text(result.descripcion),
      compatibilidad: unique(result.compatibilidad), referencias: unique(result.referencias), fuentes: sources,
      confianza: text(result.confianza)
    } : {
      nombre: product.nombre, marca: product.marca, categoria: product.categoria,
      descripcion_corta: product.descripcion_corta, descripcion: product.descripcion,
      compatibilidad: product.compatibilidad || [], referencias: product.referencias || [], fuentes: product.fuentes || [],
      confianza: product.confianza || "Baja"
    };
    await api(`/rest/v1/productos_admin?id=eq.${product.id}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({
        ...safeDetails, resultado_bot: { vision, investigacion: result, verificacion_fuentes: sourceChecks },
        error_investigacion: unique([...reasons, ...sourceProblems, result.observaciones]).join(" "), revision: ready ? "revisar" : "investigar", actualizado: new Date().toISOString()
      })
    });
    console.log(`${product.codigo}: ${ready ? "listo para revisar" : "bloqueado"}.`);
  } catch (error) {
    await api(`/rest/v1/productos_admin?id=eq.${product.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ error_investigacion: error.message, actualizado: new Date().toISOString() }) });
    console.error(`${product.codigo}: ${error.message}`);
  }
}
