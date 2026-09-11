import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import XLSX from "xlsx";

const projectRoot = process.cwd();
const importer = path.join(projectRoot, "scripts", "importar-inventario.mjs");
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "keiko-inventario-"));

try {
  await cp(path.join(projectRoot, "catalogo"), path.join(tempRoot, "catalogo"), { recursive: true });
  await cp(path.join(projectRoot, "inventario"), path.join(tempRoot, "inventario"), { recursive: true });
  const workbookPath = path.join(tempRoot, "inventario", "Inventario_Keiko.xlsx");
  const workbook = XLSX.read(await readFile(workbookPath), { type: "buffer" });
  const sheet = workbook.Sheets.Inventario;
  const validRow = [8, "TEST-001", "Filtro de prueba", "Marca prueba", "Filtros", 3, 12.5, "Nuevo", "B-01", "Descripción corta verificada.", "Descripción completa verificada para la prueba.", "Vehículo de prueba, según versión", "REF-001", "https://example.com/catalogo/test-001", "Alta", "Aprobado", "Sí", "No", 99, "TEST-001__01.jpg", "Prueba automática"];
  const basicRow = [9, "BASIC-001", "Producto pendiente", "", "", 2, "Consultar", "Nuevo", "", "", "", "", "", "", "", "Investigar", "No", "No", 99, "", "Captura básica"];
  XLSX.utils.sheet_add_aoa(sheet, [validRow, basicRow], { origin: "A14" });
  await writeFile(workbookPath, XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  await mkdir(path.join(tempRoot, "inventario", "fotos"), { recursive: true });
  await writeFile(path.join(tempRoot, "inventario", "fotos", "TEST-001_01.jpg"), "imagen-de-prueba");

  const valid = spawnSync(process.execPath, [importer], { cwd: tempRoot, encoding: "utf8" });
  assert.equal(valid.status, 0, valid.stderr);
  const created = JSON.parse(await readFile(path.join(tempRoot, "catalogo", "test-001", "producto.json"), "utf8"));
  assert.equal(created.codigo, "TEST-001");
  assert.equal(created.stock, 3);
  assert.equal(created.publicado, true);
  await writeFile(path.join(tempRoot, "catalogo", "test-001", "foto-anterior.png"), "imagen-obsoleta");
  const refreshed = spawnSync(process.execPath, [importer], { cwd: tempRoot, encoding: "utf8" });
  assert.equal(refreshed.status, 0, refreshed.stderr);
  await assert.rejects(readFile(path.join(tempRoot, "catalogo", "test-001", "foto-anterior.png")), { code: "ENOENT" });
  assert.equal(await readFile(path.join(tempRoot, "catalogo", "test-001", "portada.jpg"), "utf8"), "imagen-de-prueba");
  const basic = JSON.parse(await readFile(path.join(tempRoot, "catalogo", "basic-001", "producto.json"), "utf8"));
  assert.equal(basic.categoria, "Por clasificar");
  assert.equal(basic.publicado, false);

  XLSX.utils.sheet_add_aoa(sheet, [[10, "TEST-001", "Duplicado"]], { origin: "A16" });
  await writeFile(workbookPath, XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  const duplicate = spawnSync(process.execPath, [importer, "--validar"], { cwd: tempRoot, encoding: "utf8" });
  assert.notEqual(duplicate.status, 0, "El código duplicado debió detener la validación.");
  assert.match(duplicate.stderr, /código duplicado/i);

  console.log("Pruebas del importador correctas: alta válida, limpieza de fotos y bloqueo de duplicado.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
