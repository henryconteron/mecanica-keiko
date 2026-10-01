import { readFile } from "node:fs/promises";
import path from "node:path";

const key = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export async function cargarCorreccionesCodigos(root = process.cwd()) {
  let document;
  try {
    document = JSON.parse(await readFile(path.join(root, "inventario/correcciones-codigos.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  if (!Array.isArray(document.correcciones)) throw new Error("Registro de correcciones de códigos inválido.");
  const used = new Set();
  for (const item of document.correcciones) {
    if (item.autorizada !== true || !key(item.codigo) || !key(item.codigo_anterior) || !key(item.marca)
      || key(item.codigo) === key(item.codigo_anterior) || !Array.isArray(item.fotos) || !item.fotos.length
      || item.fotos.some(name => typeof name !== "string" || !/^[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp|gif)$/i.test(name))
      || new Set(item.fotos).size !== item.fotos.length) throw new Error("Corrección no autorizada o archivos inseguros.");
    for (const code of [item.codigo, item.codigo_anterior]) {
      if (used.has(key(code))) throw new Error("Códigos repetidos en el registro de correcciones.");
      used.add(key(code));
    }
  }
  return document.correcciones;
}

export const correccionCodigo = (code, brand, corrections) => corrections.find(item =>
  item.autorizada === true && key(item.codigo) === key(code) && key(item.marca) === key(brand));

// Solo una asociación aprobada y completa; un código parecido nunca es prueba de identidad.
export function fotosConCorreccion(code, brand, photos, corrections) {
  const correction = correccionCodigo(code, brand, corrections);
  if (!correction) return null;
  const selected = correction.fotos.map(name => photos.find(photo => photo.relativeName === name));
  if (selected.some(photo => !photo)) throw new Error(`Faltan fotos originales registradas para ${code}. No se admite una asociación parcial.`);
  return selected;
}
