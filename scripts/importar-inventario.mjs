import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import XLSX from "xlsx";

const root = process.cwd();
const inventoryDir = path.join(root, "inventario");
const workbookFile = path.join(inventoryDir, "Inventario_Keiko.xlsx");
const photosDir = path.join(inventoryDir, "fotos");
const catalogDir = path.join(root, "catalogo");
const validateOnly = process.argv.includes("--validar");
const mediaExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const text = (value) => String(value ?? "").trim();
const headerKey = (value) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const codeKey = (value) => headerKey(value).replace(/[^a-z0-9]/g, "");
const slug = (value) => headerKey(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const yes = (value) => ["si", "sí", "yes", "true", "1"].includes(text(value).toLowerCase());
const splitList = (value) => text(value).split(/[|\n]/).map((item) => item.trim()).filter(Boolean);
const csvCell = (value) => `"${text(value).replaceAll('"', '""')}"`;
const codeFromPhotoName = (name) => {
  const base = path.basename(name, path.extname(name));
  const match = base.match(/^(.*?)(?:__|_)(\d+)$/);
  return match ? codeKey(match[1]) : "";
};

const numberOrText = (value, fallback = "Consultar") => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = text(value);
  if (!raw) return fallback;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : raw;
};

const inventoryBuffer = await readFile(workbookFile);
const workbook = XLSX.read(inventoryBuffer, { type: "buffer", cellDates: true });
const sheet = workbook.Sheets.Inventario;
if (!sheet) throw new Error("El archivo necesita una hoja llamada Inventario.");

const rawRows = XLSX.utils.sheet_to_json(sheet, { range: 5, defval: "", raw: true });
const rows = rawRows.map((row, index) => {
  const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [headerKey(key), value]));
  return { row: index + 7, ...normalized };
}).filter((row) => text(row.codigo));

const existingByCode = new Map();
for (const entry of await readdir(catalogDir, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
  try {
    const product = JSON.parse(await readFile(path.join(catalogDir, entry.name, "producto.json"), "utf8"));
    existingByCode.set(codeKey(product.codigo), { id: entry.name, product });
  } catch {
    // El generador principal reportará carpetas existentes dañadas.
  }
}

const directPhotos = [];
const photoFolders = [];
for (const entry of await readdir(photosDir, { withFileTypes: true })) {
  if (entry.isFile() && mediaExtensions.has(path.extname(entry.name).toLowerCase())) directPhotos.push(entry.name);
  if (entry.isDirectory()) photoFolders.push(entry.name);
}

const photosFor = async (code) => {
  const key = codeKey(code);
  const matchingFolder = photoFolders.find((name) => codeKey(name) === key);
  if (matchingFolder) {
    const folder = path.join(photosDir, matchingFolder);
    const files = (await readdir(folder, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && mediaExtensions.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => ({ source: path.join(folder, entry.name), name: entry.name }));
    return files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }
  return directPhotos
    .filter((name) => codeFromPhotoName(name) === key)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => ({ source: path.join(photosDir, name), name }));
};

const errors = [];
const warnings = [];
const seen = new Map();
const staged = [];
const pending = [];

for (const row of rows) {
  const code = text(row.codigo);
  const key = codeKey(code);
  if (seen.has(key)) {
    errors.push(`Filas ${seen.get(key)} y ${row.row}: código duplicado ${code}.`);
    continue;
  }
  seen.set(key, row.row);

  const existing = existingByCode.get(key);
  const current = existing?.product ?? {};
  const review = text(row.revision) || "Capturado";
  const publishChoice = text(row.publicar) || "No";
  const incomingPhotos = await photosFor(code);
  const targetId = existing?.id || slug(code);
  const targetFolder = path.join(catalogDir, targetId);
  let existingMedia = [];
  try {
    existingMedia = (await readdir(targetFolder)).filter((name) => mediaExtensions.has(path.extname(name).toLowerCase()));
  } catch {}

  const stockRaw = row.cantidad;
  const stock = stockRaw === "" ? current.stock : Number(stockRaw);
  const compatibility = splitList(row.compatibilidad).length ? splitList(row.compatibilidad) : (current.compatibilidad || []);
  const references = splitList(row.referencias).length ? splitList(row.referencias) : (current.referencias || []);
  const sources = splitList(row.fuentes);
  const wantsPublish = publishChoice.toLowerCase() === "mantener" ? current.publicado === true : yes(publishChoice);
  const name = text(row.nombre) || current.nombre || "";
  const category = text(row.categoria) || current.categoria || "Por clasificar";
  const shortDescription = text(row["descripcion corta"]) || current.descripcionCorta || "";
  const description = text(row.descripcion) || current.descripcion || "";

  if (!Number.isInteger(stock) || stock < 0) errors.push(`Fila ${row.row} (${code}): cantidad debe ser un entero igual o mayor que cero.`);
  if (wantsPublish && !["aprobado", "publicado"].includes(review.toLowerCase())) errors.push(`Fila ${row.row} (${code}): para publicar, Revisión debe ser Aprobado o Publicado.`);
  if (wantsPublish && (!name || category === "Por clasificar" || !shortDescription || !description)) errors.push(`Fila ${row.row} (${code}): faltan nombre, categoría confirmada o descripciones para publicar.`);
  if (wantsPublish && compatibility.length === 0) errors.push(`Fila ${row.row} (${code}): falta compatibilidad verificada.`);
  if (wantsPublish && sources.length === 0 && !existing) errors.push(`Fila ${row.row} (${code}): falta al menos una fuente para un producto nuevo.`);
  if (wantsPublish && incomingPhotos.length === 0 && existingMedia.length === 0) errors.push(`Fila ${row.row} (${code}): falta una fotografía.`);
  if (!name) warnings.push(`Fila ${row.row} (${code}): falta el nombre; no se creará la ficha todavía.`);

  if (["capturado", "investigar", "revisar"].includes(review.toLowerCase())) {
    pending.push({ fila: row.row, codigo: code, nombre: name, marca: text(row.marca), estado: review, observaciones: text(row.observaciones) });
  }

  if (name && Number.isInteger(stock) && stock >= 0) {
    staged.push({
      row: row.row,
      id: targetId,
      incomingPhotos,
      product: {
        codigo: code,
        nombre: name,
        categoria: category,
        marca: text(row.marca) || current.marca || "",
        precio: numberOrText(row.precio, current.precio ?? "Consultar"),
        moneda: "USD",
        estado: text(row.estado) || current.estado || "Nuevo",
        stock,
        descripcionCorta: shortDescription || "Información en proceso de verificación.",
        descripcion: description || "Información en proceso de verificación.",
        compatibilidad: compatibility,
        referencias: references,
        fuentes: sources.length ? sources : (current.fuentes || []),
        confianza: text(row.confianza) || current.confianza || "",
        ubicacionInventario: text(row.ubicacion) || current.ubicacionInventario || "",
        destacado: text(row.destacado) ? yes(row.destacado) : Boolean(current.destacado),
        publicado: wantsPublish,
        orden: Number(row.orden) || current.orden || 99
      }
    });
  }
}

const report = {
  fecha: new Date().toISOString(),
  modo: validateOnly ? "validación" : "importación",
  filasConCodigo: rows.length,
  fichasPreparadas: staged.length,
  pendientesInvestigacion: pending.length,
  errores: errors,
  advertencias: warnings
};

await writeFile(path.join(inventoryDir, "reporte-validacion.json"), JSON.stringify(report, null, 2) + "\n");
const pendingHeaders = ["Fila", "Código", "Nombre", "Marca", "Estado", "Observaciones"];
const pendingCsv = [pendingHeaders.map(csvCell).join(","), ...pending.map((item) => [item.fila, item.codigo, item.nombre, item.marca, item.estado, item.observaciones].map(csvCell).join(","))].join("\n") + "\n";
await writeFile(path.join(inventoryDir, "pendientes-investigacion.csv"), pendingCsv);

if (errors.length) {
  console.error(`Inventario con ${errors.length} error(es):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

if (!validateOnly) {
  for (const item of staged) {
    const folder = path.join(catalogDir, item.id);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "producto.json"), JSON.stringify(item.product, null, 2) + "\n");
    for (let index = 0; index < item.incomingPhotos.length; index += 1) {
      const photo = item.incomingPhotos[index];
      const ext = path.extname(photo.name).toLowerCase();
      const targetName = index === 0 ? `portada${ext}` : `${String(index + 1).padStart(2, "0")}${ext}`;
      await copyFile(photo.source, path.join(folder, targetName));
    }
  }
}

console.log(`${validateOnly ? "Validación" : "Importación"} correcta: ${rows.length} filas, ${staged.length} fichas, ${pending.length} pendientes.`);
