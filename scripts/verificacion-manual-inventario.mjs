// Las correcciones contrastadas no deben ser revertidas por un Excel antiguo.
// Si el usuario cambia la identidad o los datos técnicos del Excel, prevalece su edición.
export function correccionVerificada(row, revisiones) {
  const key = (value) => String(value ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const revision = revisiones.find((item) => key(item.codigo) === key(row.codigo));
  if (!revision?.inventario_base) return {};
  const unchanged = Object.entries(revision.inventario_base)
    .every(([field, value]) => String(row[field] ?? "").trim() === String(value ?? "").trim());
  if (!unchanged) return {};
  for (const field of ["compatibilidad", "referencias", "fuentes"]) {
    if (!Array.isArray(revision[field])) throw new Error(`Revisión manual inválida: ${revision.codigo}, ${field}.`);
  }
  for (const field of ["descripcion_corta", "descripcion", "confianza"]) {
    if (typeof revision[field] !== "string" || !revision[field].trim()) throw new Error(`Revisión manual incompleta: ${revision.codigo}, ${field}.`);
  }
  const urls = revision.fuentes.map((source) => source.url);
  if (!urls.length || urls.some((url) => typeof url !== "string" || !/^https?:\/\//.test(url))) {
    throw new Error(`Revisión manual sin fuentes válidas: ${revision.codigo}.`);
  }
  return {
    "descripcion corta": revision.descripcion_corta,
    descripcion: revision.descripcion,
    compatibilidad: revision.compatibilidad.join(" | "),
    referencias: revision.referencias.join(" | "),
    fuentes: urls.join(" | "),
    confianza: revision.confianza
  };
}
