import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import ExcelJS from "exceljs";
import XLSX from "xlsx";

const root = process.cwd();
const inventoryDir = path.join(root, "inventario");
const workbookFile = path.join(inventoryDir, "Inventario_Keiko.xlsx");
const photosDir = path.join(inventoryDir, "fotos");
const researchDir = path.join(inventoryDir, "investigacion");
const reportFile = path.join(researchDir, "reporte.json");
const summaryFile = path.join(researchDir, "resumen.md");
const apiUrl = "https://api.groq.com/openai/v1/chat/completions";
const visionModel = process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";
const researchModel = process.env.GROQ_RESEARCH_MODEL || "groq/compound-mini";
const formatterModel = process.env.GROQ_FORMATTER_MODEL || "llama-3.3-70b-versatile";
const maxProducts = Math.max(1, Number(process.env.GROQ_MAX_PRODUCTS || 10));
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const text = (value) => String(value ?? "").trim();
const headerKey = (value) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const codeKey = (value) => headerKey(value).replace(/[^a-z0-9]/g, "");
const splitList = (value) => text(value).split(/[|\n]/).map((item) => item.trim()).filter(Boolean);
const unique = (values) => [...new Set(values.map(text).filter(Boolean))];

export const editDistance = (left, right) => {
  const a = codeKey(left);
  const b = codeKey(right);
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
};

const photoCode = (name) => {
  const base = path.basename(name, path.extname(name));
  const match = base.match(/^(.*?)(?:__|_)(\d+)$/);
  return match ? match[1] : "";
};

const mimeFor = (file) => ({
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif"
}[path.extname(file).toLowerCase()] || "application/octet-stream");

const parseJson = (value) => {
  const raw = text(value).replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(raw);
  } catch (error) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw error;
  }
};

const groqRequest = async (payload, maxAttempts = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(apiUrl, {
      method: "POST",
      signal: AbortSignal.timeout(90000),
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
        "Groq-Model-Version": payload.model?.startsWith("groq/compound") ? "2025-07-23" : "latest"
      },
      body: JSON.stringify(payload)
    });
    if (response.ok) return response.json();
    const detail = await response.text();
    lastError = new Error(`Groq respondió ${response.status}: ${detail.slice(0, 500)}`);
    if (detail.includes("Request too large") || ![429, 500, 502, 503, 504].includes(response.status) || attempt === maxAttempts) throw lastError;
    const suggestedWait = Number(detail.match(/try again in ([\d.]+)s/i)?.[1] || response.headers.get("retry-after") || 0);
    await new Promise((resolve) => setTimeout(resolve, Math.min(30000, Math.max(attempt * 1500, suggestedWait * 1000 + 500))));
  }
  throw lastError;
};

const listPhotos = async () => {
  const entries = await readdir(photosDir, { withFileTypes: true });
  const photos = [];
  for (const entry of entries) {
    if (entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase())) {
      photos.push({ file: path.join(photosDir, entry.name), name: entry.name, code: photoCode(entry.name) });
    }
    if (entry.isDirectory()) {
      const nested = await readdir(path.join(photosDir, entry.name), { withFileTypes: true });
      for (const file of nested) {
        if (file.isFile() && imageExtensions.has(path.extname(file.name).toLowerCase())) {
          photos.push({ file: path.join(photosDir, entry.name, file.name), name: file.name, code: entry.name });
        }
      }
    }
  }
  return photos;
};

export const choosePhotos = (code, photos) => {
  const exact = photos.filter((photo) => codeKey(photo.code) === codeKey(code));
  if (exact.length) return { photos: exact, approximate: false };
  const nearby = photos.filter((photo) => photo.code && editDistance(photo.code, code) === 1);
  return { photos: nearby, approximate: nearby.length > 0 };
};

const inspectPhotos = async (row, selected) => {
  if (!selected.photos.length) {
    return { codigo_visible: "", marca_visible: "", otros_codigos: [], texto_relevante: [], confianza: "Baja", sin_fotos: true };
  }
  const content = [{
    type: "text",
    text: `Analiza estas fotografías de un repuesto automotriz. La fila del inventario dice código "${row.codigo}" y marca "${row.marca}". Transcribe literalmente códigos, marca, tipo de pieza, números OEM/equivalentes y aplicaciones impresas. No deduzcas compatibilidad por la forma. Responde solo JSON con: codigo_visible (string), marca_visible (string), tipo_visible (string), otros_codigos (array de strings), aplicaciones_impresas (array de strings), texto_relevante (array de strings), confianza (Alta|Media|Baja).`
  }];
  for (const photo of selected.photos.slice(0, 1)) {
    const base64 = (await readFile(photo.file)).toString("base64");
    content.push({ type: "image_url", image_url: { url: `data:${mimeFor(photo.file)};base64,${base64}` } });
  }
  const models = unique([visionModel, "qwen/qwen3.6-27b"]);
  let lastError;
  for (const model of models) {
    try {
      const response = await groqRequest({
        model,
        messages: [{ role: "user", content }],
        response_format: { type: "json_object" },
        reasoning_format: "hidden",
        reasoning_effort: "none",
        temperature: 0.1,
        max_completion_tokens: 700
      }, 1);
      return parseJson(response.choices?.[0]?.message?.content);
    } catch (error) {
      lastError = error;
      console.warn(`Visión ${model} no disponible; probando respaldo.`);
    }
  }
  throw lastError;
};

const researchProduct = async (row, vision) => {
  const prompt = `Investiga este repuesto automotriz para un inventario de Ecuador.

DATOS CAPTURADOS
- Código escrito: ${row.codigo}
- Nombre escrito: ${row.nombre}
- Marca escrita: ${row.marca}
- Categoría escrita: ${row.categoria}
- Lectura literal de fotografías: ${JSON.stringify(vision)}

REGLAS OBLIGATORIAS
1. Busca el código exacto. Prioriza catálogo oficial del fabricante y confirma con una segunda fuente técnica cuando exista.
2. No uses semejanza visual para afirmar compatibilidad. No conviertas una publicación comercial aislada en confirmación.
3. Si el código visible no coincide con el escrito, marca codigo_coincide=false, explica la diferencia y no inventes una corrección silenciosa.
4. Cada compatibilidad debe indicar marca, modelo, motor y años solo cuando estén respaldados. Si falta precisión, usa "según versión; confirmar por código/VIN".
5. Devuelve enlaces directos, no páginas de resultados de búsqueda.
6. No inventes referencias. No incluyas precio, cantidad ni ubicación.
7. Responde exclusivamente como JSON válido con esta forma:
{
  "codigo_investigado":"string",
  "codigo_coincide":true,
  "nombre_sugerido":"string",
  "marca":"string",
  "categoria":"Filtros",
  "descripcion_corta":"string de hasta 180 caracteres",
  "descripcion":"string de hasta 500 caracteres",
  "compatibilidad":["string"],
  "referencias":["string"],
  "fuentes":[{"titulo":"string","url":"https://...","tipo":"Fabricante|Catálogo técnico|Distribuidor"}],
  "confianza":"Alta|Media|Baja",
  "observaciones":"string",
  "listo_para_revisar":true
}`;
  const response = await groqRequest({
    model: researchModel,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    compound_custom: { tools: { enabled_tools: ["web_search"] } },
    search_settings: { exclude_domains: ["facebook.com", "instagram.com", "tiktok.com", "pinterest.com"] },
    temperature: 0.1,
    max_completion_tokens: 1200
  });
  const rawResearch = response.choices?.[0]?.message?.content;
  try {
    return parseJson(rawResearch);
  } catch {
    const formatted = await groqRequest({
      model: formatterModel,
      messages: [{
        role: "user",
        content: `Convierte el siguiente resultado de investigación al esquema JSON exigido. Conserva solamente datos presentes, no inventes nada y devuelve exclusivamente JSON válido.\n\nESQUEMA Y REGLAS:\n${prompt.slice(prompt.indexOf("REGLAS OBLIGATORIAS"))}\n\nRESULTADO A CONVERTIR:\n${text(rawResearch)}`
      }],
      response_format: { type: "json_object" },
      temperature: 0,
      max_completion_tokens: 1200
    });
    return parseJson(formatted.choices?.[0]?.message?.content);
  }
};

const validUrls = (sources) => unique((Array.isArray(sources) ? sources : []).map((source) => {
  const value = typeof source === "string" ? source : source?.url;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}));

const writeStableReport = async (report) => {
  await mkdir(researchDir, { recursive: true });
  try {
    const current = JSON.parse(await readFile(reportFile, "utf8"));
    const { actualizado: oldDate, ...oldContent } = current;
    const { actualizado: newDate, ...newContent } = report;
    if (JSON.stringify(oldContent) === JSON.stringify(newContent) && oldDate) report.actualizado = oldDate;
  } catch {}
  await writeFile(reportFile, JSON.stringify(report, null, 2) + "\n");
};

const appendStepSummary = async (markdown) => {
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown + "\n");
};

const main = async () => {
  if (!process.env.GROQ_API_KEY) {
    const message = "## Investigación con Groq\n\nNo se ejecutó: falta el secreto `GROQ_API_KEY`.";
    console.log(message.replaceAll("\n", " "));
    await appendStepSummary(message);
    return;
  }

  const workbook = XLSX.read(await readFile(workbookFile), { type: "buffer", cellDates: true, cellStyles: true });
  const sheet = workbook.Sheets.Inventario;
  if (!sheet) throw new Error("El archivo necesita una hoja llamada Inventario.");
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
  const headerRow = matrix.findIndex((row) => row.some((value) => headerKey(value) === "codigo") && row.some((value) => headerKey(value) === "revision"));
  if (headerRow < 0) throw new Error("No se encontraron las columnas Código y Revisión.");
  const headers = new Map(matrix[headerRow].map((value, index) => [headerKey(value), index]));
  const column = (name) => {
    const index = headers.get(headerKey(name));
    if (index === undefined) throw new Error(`Falta la columna ${name}.`);
    return index;
  };
  const rows = matrix.slice(headerRow + 1).map((values, offset) => ({
    index: headerRow + 1 + offset,
    fila: headerRow + 2 + offset,
    codigo: text(values[column("Código")]),
    nombre: text(values[column("Nombre")]),
    marca: text(values[column("Marca")]),
    categoria: text(values[column("Categoría")]),
    revision: text(values[column("Revisión")]),
    observaciones: text(values[column("Observaciones")])
  })).filter((row) => row.codigo && headerKey(row.revision) === "investigar").slice(0, maxProducts);

  const allPhotos = await listPhotos();
  const results = [];
  const editableWorkbook = new ExcelJS.Workbook();
  await editableWorkbook.xlsx.readFile(workbookFile);
  const editableSheet = editableWorkbook.getWorksheet("Inventario");
  if (!editableSheet) throw new Error("El archivo necesita una hoja llamada Inventario.");
  const setCell = (row, name, value) => {
    editableSheet.getCell(row.fila, column(name) + 1).value = value;
  };
  let workbookChanged = false;

  for (const row of rows) {
    try {
      console.log(`Investigando ${row.codigo}...`);
      const selected = choosePhotos(row.codigo, allPhotos);
      let vision;
      try {
        vision = await inspectPhotos(row, selected);
      } catch (error) {
        vision = { codigo_visible: "", marca_visible: "", otros_codigos: [], texto_relevante: [], confianza: "Baja", error: error.message };
        console.warn(`${row.codigo}: la lectura visual no estuvo disponible; se continuará con búsqueda textual.`);
      }
      const proposal = await researchProduct(row, vision);
      const visibleCode = text(vision.codigo_visible);
      const programmaticMatch = !visibleCode || codeKey(visibleCode) === codeKey(row.codigo);
      const sources = validUrls(proposal.fuentes);
      const compatibility = unique(Array.isArray(proposal.compatibilidad) ? proposal.compatibilidad : splitList(proposal.compatibilidad));
      const references = unique(Array.isArray(proposal.referencias) ? proposal.referencias : splitList(proposal.referencias));
      const blockedReasons = [];
      if (selected.approximate) blockedReasons.push(`Las fotos se encontraron por código parecido, no exacto.`);
      if (vision.error) blockedReasons.push("No se pudieron leer las fotografías con el modelo visual.");
      if (!programmaticMatch || proposal.codigo_coincide === false) blockedReasons.push(`El código visible (${visibleCode || "no identificado"}) no coincide con ${row.codigo}.`);
      if (!sources.length) blockedReasons.push("No se obtuvo una fuente web directa verificable.");
      if (!compatibility.length) blockedReasons.push("No se obtuvo compatibilidad estructurada.");

      const observation = unique([
        ...blockedReasons,
        text(proposal.observaciones),
        sources.length ? `Fuentes consultadas: ${sources.length}.` : ""
      ]).join(" ");

      if (blockedReasons.length || proposal.listo_para_revisar !== true) {
        results.push({ codigo: row.codigo, estado: "Bloqueado", codigoVisible: visibleCode, observaciones: observation, fuentes: sources });
        continue;
      }

      const updates = {
        "Nombre": text(proposal.nombre_sugerido) || row.nombre,
        "Marca": text(proposal.marca) || row.marca,
        "Categoría": text(proposal.categoria) || row.categoria || "Filtros",
        "Descripción corta": text(proposal.descripcion_corta),
        "Descripción": text(proposal.descripcion),
        "Compatibilidad": compatibility.join(" | "),
        "Referencias": references.join(" | "),
        "Fuentes": sources.join(" | "),
        "Confianza": ["Alta", "Media", "Baja"].includes(proposal.confianza) ? proposal.confianza : "Baja",
        "Revisión": "Revisar",
        "Publicar": "No",
        "Observaciones": observation
      };
      for (const [name, value] of Object.entries(updates)) setCell(row, name, value);
      workbookChanged = true;
      results.push({ codigo: row.codigo, estado: "Revisar", codigoVisible: visibleCode, observaciones: observation, fuentes: sources });
    } catch (error) {
      results.push({ codigo: row.codigo, estado: "Error", observaciones: error.message, fuentes: [] });
      console.error(`${row.codigo}: ${error.message}`);
    }
  }

  if (workbookChanged) await editableWorkbook.xlsx.writeFile(workbookFile);
  const report = { actualizado: new Date().toISOString(), modeloVision: visionModel, modeloInvestigacion: researchModel, pendientesProcesados: rows.length, resultados: results };
  await writeStableReport(report);
  const lines = [
    "# Investigación de inventario",
    "",
    `Procesados: **${rows.length}** · Listos para revisar: **${results.filter((item) => item.estado === "Revisar").length}** · Bloqueados/errores: **${results.filter((item) => item.estado !== "Revisar").length}**`,
    "",
    ...results.map((item) => `- **${item.codigo} — ${item.estado}:** ${item.observaciones || "Sin observaciones."}`),
    "",
    "El bot nunca cambia `Publicar` a `Sí`. Revisa el Excel y las fuentes antes de aprobar."
  ];
  await writeFile(summaryFile, lines.join("\n") + "\n");
  await appendStepSummary(lines.join("\n"));
  console.log(`Investigación terminada: ${results.filter((item) => item.estado === "Revisar").length} para revisar, ${results.filter((item) => item.estado !== "Revisar").length} bloqueados o con error.`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
