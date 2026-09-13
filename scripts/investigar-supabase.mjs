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
const unique = (items) => [...new Set((items || []).map(text).filter(Boolean))];

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
Busca primero el código exacto en fabricante o catálogo técnico y confirma con otra fuente cuando exista. No inventes compatibilidad ni corrijas silenciosamente códigos distintos. Los enlaces deben ser directos. Devuelve exclusivamente JSON válido:
{"codigo_coincide":true,"nombre_sugerido":"","marca":"","categoria":"","descripcion_corta":"máximo 180 caracteres","descripcion":"máximo 500 caracteres","compatibilidad":[""],"referencias":[""],"fuentes":[{"titulo":"","url":"https://...","tipo":"Fabricante|Catálogo técnico|Distribuidor"}],"confianza":"Alta|Media|Baja","observaciones":"","listo_para_revisar":true}`;
  const result = await groq({
    model: "groq/compound-mini", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" },
    compound_custom: { tools: { enabled_tools: ["web_search"] } }, search_settings: { exclude_domains: ["facebook.com", "instagram.com", "tiktok.com", "pinterest.com"] },
    temperature: 0.1, max_completion_tokens: 1300
  });
  return parseJson(result.choices?.[0]?.message?.content);
};

const pending = await api("/rest/v1/productos_admin?revision=eq.investigar&select=*&order=creado.asc&limit=5");
console.log(`Productos pendientes: ${pending.length}`);

for (const product of pending) {
  console.log(`Investigando ${product.codigo}…`);
  try {
    let vision;
    try { vision = await inspectPhoto(product); } catch (error) { vision = { codigo_visible: "", confianza: "Baja", error: error.message }; }
    const result = await research(product, vision);
    const sources = (result.fuentes || []).filter((source) => /^https?:\/\//.test(source?.url || ""));
    const reasons = [];
    if (vision.error) reasons.push(vision.error);
    if (vision.codigo_visible && codeKey(vision.codigo_visible) !== codeKey(product.codigo)) reasons.push(`El código visible ${vision.codigo_visible} no coincide con ${product.codigo}.`);
    if (result.codigo_coincide === false) reasons.push("La investigación encontró una diferencia de código.");
    if (!sources.length) reasons.push("No se obtuvo una fuente directa verificable.");
    if (!result.compatibilidad?.length) reasons.push("No se obtuvo compatibilidad verificable.");
    const ready = !reasons.length && result.listo_para_revisar === true;
    await api(`/rest/v1/productos_admin?id=eq.${product.id}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({
        nombre: text(result.nombre_sugerido) || product.nombre, marca: text(result.marca) || product.marca,
        categoria: text(result.categoria), descripcion_corta: text(result.descripcion_corta), descripcion: text(result.descripcion),
        compatibilidad: unique(result.compatibilidad), referencias: unique(result.referencias), fuentes: sources,
        confianza: text(result.confianza), resultado_bot: { vision, investigacion: result },
        error_investigacion: unique([...reasons, result.observaciones]).join(" "), revision: ready ? "revisar" : "investigar", actualizado: new Date().toISOString()
      })
    });
    console.log(`${product.codigo}: ${ready ? "listo para revisar" : "bloqueado"}.`);
  } catch (error) {
    await api(`/rest/v1/productos_admin?id=eq.${product.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ error_investigacion: error.message, actualizado: new Date().toISOString() }) });
    console.error(`${product.codigo}: ${error.message}`);
  }
}
