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
const codeAppearsExactly = (page, code) => {
  const parts = text(code).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  if (!parts.length) return false;
  const escaped = parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Permite guiones, espacios y puntos entre bloques del mismo código, pero nunca letras o números extra.
  const pattern = new RegExp(`(^|[^A-Z0-9])${escaped.join("[\\s._-]*")}(?=$|[^A-Z0-9])`, "i");
  return pattern.test(String(page || "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
};
// Algunos fabricantes añaden una C al código de una pastilla para indicar el compuesto
// cerámico. Solo se usa la referencia base cuando esa condición está confirmada en la foto;
// no se eliminan letras de códigos de otros tipos de repuesto.
const baseCodeForCeramicBrakePad = (product, vision) => {
  const productCode = text(product.codigo).toUpperCase();
  const isBrakePad = /pastill|balata|brake\s*pad/i.test(`${text(product.nombre)} ${text(product.categoria)}`);
  const matchesLabel = codeKey(vision.codigo_visible) === codeKey(productCode);
  const saysCeramic = /\bceramic\b/i.test(text(vision.tipo_visible));
  if (!isBrakePad || !matchesLabel || !saysCeramic || !/^[A-Z0-9][A-Z0-9._-]*C$/.test(productCode)) return "";
  const baseCode = productCode.slice(0, -1).replace(/[-._]+$/, "");
  return baseCode.length >= 3 ? baseCode : "";
};
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

const research = async (product, vision, sourceCode = product.codigo) => {
  const usesCeramicBaseCode = codeKey(sourceCode) !== codeKey(product.codigo);
  const prompt = `Investiga un repuesto automotriz para venta en Ecuador.
Datos capturados: código de venta/etiqueta ${product.codigo}; nombre ${product.nombre}; marca ${product.marca || "no indicada"}. Lectura fotográfica: ${JSON.stringify(vision)}.
${usesCeramicBaseCode ? `La etiqueta muestra ${product.codigo} y también dice CERAMIC. Para comprobar la forma y compatibilidad, consulta la referencia base exacta ${sourceCode}. Esta es únicamente una variante cerámica de esa referencia para este producto: conserva ${product.codigo} como código de venta y no atribuyas esta regla a otros repuestos.` : `Código que se debe comprobar en fuentes: ${sourceCode}.`}
Reglas obligatorias:
- Busca el código exacto ${sourceCode}, no uno parecido. Si ese código no aparece literalmente en la fuente, responde codigo_coincide:false.
- La ficha debe describir el mismo tipo de pieza que el nombre capturado y, si existe, que la etiqueta leída. Si hay duda, responde producto_coincide:false.
- No inventes compatibilidades, medidas, equivalencias ni marca. Omite los datos que no estén sustentados.
- Usa solamente enlaces HTTPS directos de fabricante, catálogo técnico o distribuidor automotriz reconocido. Nunca uses redes sociales, PDFs compartidos, Scribd, PDFCoffee, marketplaces ni páginas genéricas de resultados.
- Para confianza Alta usa dos fuentes directas de dominios distintos. No repitas la misma URL ni el mismo dominio. Para Media basta una fuente directa. Devuelve únicamente JSON válido, sin explicación antes o después:
{"codigo_coincide":true,"producto_coincide":true,"nombre_sugerido":"","marca":"","categoria":"","descripcion_corta":"máximo 180 caracteres","descripcion":"máximo 500 caracteres","compatibilidad":[""],"referencias":[""],"fuentes":[{"titulo":"","url":"https://...","tipo":"Fabricante|Catálogo técnico|Distribuidor"}],"confianza":"Alta|Media|Baja","observaciones":"","listo_para_revisar":true}`;
  const result = await groq({
    model: "openai/gpt-oss-20b", messages: [{ role: "user", content: prompt }],
    tools: [{ type: "browser_search" }], tool_choice: "required", reasoning_effort: "low",
    temperature: 0.1, max_completion_tokens: 1800
  });
  return parseJson(result.choices?.[0]?.message?.content);
};

const verifySource = async (source, product, sourceCode = product.codigo) => {
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
    if (!codeAppearsExactly(page, sourceCode)) {
      return { source, ok: false, reason: `La fuente no muestra el código exacto ${sourceCode}.` };
    }
    return {
      ok: true,
      source: {
        titulo: text(source.titulo) || titleFromHtml(page) || finalUrl.hostname,
        url: finalUrl.toString(),
        tipo: text(source.tipo) || "Fuente técnica",
        dominio: finalUrl.hostname,
        codigo_verificado: true,
        codigo_consultado: sourceCode,
        fuente_tecnica_reconocida: isKnownTechnicalSource(finalUrl.hostname)
      }
    };
  } catch (error) {
    return { source, ok: false, reason: `No se pudo comprobar la fuente: ${error.message}` };
  }
};

const candidates = await api("/rest/v1/productos_admin?select=*&order=actualizado.asc&limit=500");
const verificationRequested = (product) => product?.resultado_bot && typeof product.resultado_bot === "object" && !Array.isArray(product.resultado_bot)
  && product.resultado_bot.verificacion_solicitada === true;
const pending = candidates.filter((product) => product.revision === "investigar" || verificationRequested(product)).slice(0, 5);
console.log(`Productos pendientes: ${pending.length}`);

for (const product of pending) {
  console.log(`Investigando ${product.codigo}…`);
  let isRecheck = false;
  try {
    isRecheck = product.revision === "publicado" && verificationRequested(product);
    let vision;
    try { vision = await inspectPhoto(product); } catch (error) { vision = { codigo_visible: "", confianza: "Baja", error: error.message }; }
    const sourceCode = baseCodeForCeramicBrakePad(product, vision) || product.codigo;
    const usesCeramicBaseCode = codeKey(sourceCode) !== codeKey(product.codigo);
    const result = await research(product, vision, sourceCode);
    const sourceChecks = await Promise.all((result.fuentes || []).slice(0, 5).map((source) => verifySource(source, product, sourceCode)));
    const sources = [...new Map(sourceChecks.filter((check) => check.ok).map((check) => [check.source.dominio, check.source])).values()];
    const sourceProblems = sourceChecks.filter((check) => !check.ok).map((check) => check.reason);
    const independentDomains = new Set(sources.map((source) => source.dominio)).size;
    const reasons = [];
    if (vision.error) reasons.push(vision.error);
    if (vision.codigo_visible && codeKey(vision.codigo_visible) !== codeKey(product.codigo)) reasons.push(`El código visible ${vision.codigo_visible} no coincide con ${product.codigo}.`);
    if (result.codigo_coincide !== true) reasons.push(`La investigación no confirmó el código de referencia ${sourceCode}.`);
    if (result.producto_coincide !== true) reasons.push("La investigación no confirmó que la descripción corresponde al mismo producto.");
    if (!sources.length) reasons.push(`No se obtuvo una fuente directa donde aparezca el código exacto ${sourceCode}.`);
    if (!result.compatibilidad?.length) reasons.push("No se obtuvo compatibilidad verificable.");
    if (text(result.confianza).toLowerCase() === "alta" && independentDomains < 2) reasons.push("La confianza Alta exige dos fuentes verificadas de dominios distintos.");
    const ready = !reasons.length && result.listo_para_revisar === true;
    const proposal = {
      nombre: text(result.nombre_sugerido) || product.nombre, marca: text(result.marca) || product.marca,
      categoria: text(result.categoria), descripcion_corta: text(result.descripcion_corta), descripcion: text(result.descripcion),
      compatibilidad: unique(result.compatibilidad), referencias: unique(result.referencias), fuentes: sources,
      confianza: text(result.confianza)
    };
    // El texto visible en el empaque es evidencia primaria. Se puede proponer como ajuste manual,
    // pero nunca desbloquea compatibilidades ni equivalencias que no se hayan comprobado en fuentes técnicas.
    const ceramicVisibleOnPackage = codeKey(vision.codigo_visible) === codeKey(product.codigo) && /\bceramic\b/i.test(text(vision.tipo_visible));
    const visualProposal = ceramicVisibleOnPackage ? {
      nombre: product.nombre,
      marca: product.marca,
      categoria: product.categoria,
      descripcion_corta: /cer[aá]mic/i.test(text(product.descripcion_corta))
        ? product.descripcion_corta
        : `${product.nombre}. Pastillas de freno de compuesto cerámico; compatibilidad por confirmar según vehículo.`,
      descripcion: /cer[aá]mic/i.test(text(product.descripcion))
        ? product.descripcion
        : `${text(product.descripcion) || product.nombre}. En el empaque se lee CERAMIC. Antes de la entrega se confirma compatibilidad por año, modelo y versión.`,
      compatibilidad: product.compatibilidad || [],
      referencias: product.referencias || [],
      fuentes: product.fuentes || [],
      confianza: product.confianza || "Media",
      observaciones: unique([product.observaciones, "Dato visible en el empaque: CERAMIC."]).join(" ")
    } : null;
    // Una propuesta bloqueada se conserva solo como evidencia del bot: nunca reemplaza la ficha del producto.
    const safeDetails = ready ? proposal : {
      nombre: product.nombre, marca: product.marca, categoria: product.categoria,
      descripcion_corta: product.descripcion_corta, descripcion: product.descripcion,
      compatibilidad: product.compatibilidad || [], referencias: product.referencias || [], fuentes: product.fuentes || [],
      confianza: product.confianza || "Baja"
    };
    const previousResult = product.resultado_bot && typeof product.resultado_bot === "object" && !Array.isArray(product.resultado_bot) ? { ...product.resultado_bot } : {};
    delete previousResult.verificacion_solicitada;
    delete previousResult.verificacion_solicitada_en;
    const resultData = {
      ...previousResult, vision, investigacion: result, verificacion_fuentes: sourceChecks,
      codigo_consultado: sourceCode,
      variante_ceramica_verificada_por_empaque: usesCeramicBaseCode,
      ultima_verificacion: new Date().toISOString()
    };
    if (isRecheck && (ready || visualProposal)) resultData.edicion_pendiente = ready ? proposal : visualProposal;
    const update = isRecheck ? {
      resultado_bot: resultData,
      error_investigacion: unique([...reasons, ...sourceProblems, result.observaciones]).join(" "),
      revision: "publicado", actualizado: new Date().toISOString()
    } : {
      ...safeDetails, resultado_bot: resultData,
      error_investigacion: unique([...reasons, ...sourceProblems, result.observaciones]).join(" "),
      revision: ready ? "revisar" : "investigar", actualizado: new Date().toISOString()
    };
    await api(`/rest/v1/productos_admin?id=eq.${product.id}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(update)
    });
    console.log(`${product.codigo}: ${ready ? "listo para revisar" : "bloqueado"}${isRecheck ? " sin ocultar la ficha pública" : ""}.`);
  } catch (error) {
    const previousResult = product.resultado_bot && typeof product.resultado_bot === "object" && !Array.isArray(product.resultado_bot) ? { ...product.resultado_bot } : {};
    delete previousResult.verificacion_solicitada;
    delete previousResult.verificacion_solicitada_en;
    await api(`/rest/v1/productos_admin?id=eq.${product.id}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify(isRecheck
        ? { resultado_bot: previousResult, error_investigacion: error.message, revision: "publicado", actualizado: new Date().toISOString() }
        : { error_investigacion: error.message, actualizado: new Date().toISOString() })
    });
    console.error(`${product.codigo}: ${error.message}`);
  }
}
