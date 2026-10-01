import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import XLSX from "xlsx";
import { cargarCorreccionesCodigos, correccionCodigo, fotosConCorreccion } from "../scripts/correcciones-codigos.mjs";
import { choosePhotos } from "../scripts/investigar-inventario.mjs";

const root = process.cwd();
const corrections = await cargarCorreccionesCodigos(root);
assert.equal(corrections.length, 2);
assert.equal(correccionCodigo("AF7864", "Otra marca", corrections), undefined);
assert.equal(correccionCodigo("AF7865", "SHOGUN", corrections), undefined);
const shogun = corrections.find(item => item.codigo === "AF7864");
const photos = shogun.fotos.map(name => ({ relativeName: name, name, file: path.join(root, "inventario/fotos", name), code: "AFT-7864" }));
assert.deepEqual(fotosConCorreccion("AF7864", "SHOGUN", photos, corrections), photos);
assert.throws(() => fotosConCorreccion("AF7864", "SHOGUN", photos.slice(1), corrections), /asociación parcial/);
const selected = choosePhotos("AF7864", photos, corrections, "SHOGUN");
assert.equal(selected.approximate, false);
assert.equal(selected.correction, true);
assert.equal(selected.photos.length, 3);
assert.equal(choosePhotos("AF7864", photos, corrections, "Otra marca").correction, undefined);

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "keiko-codigos-"));
const importer = path.join(root, "scripts/importar-inventario.mjs");
const run = () => spawnSync(process.execPath, [importer, "--conservar-fotos"], { cwd: tempRoot, encoding: "utf8" });
try {
  await cp(path.join(root, "catalogo"), path.join(tempRoot, "catalogo"), { recursive: true });
  await cp(path.join(root, "inventario"), path.join(tempRoot, "inventario"), { recursive: true });
  const bookPath = path.join(tempRoot, "inventario/Inventario_Keiko.xlsx");
  const workbook = XLSX.read(await readFile(bookPath), { type: "buffer" });
  // Test the migration from its actual legacy IDs, including missing AFE media.
  for (const [id, code] of [["afe-15017", "AFE-15017"], ["aft-7864", "AFT-7864"]]) {
    const file = path.join(tempRoot, "catalogo", id, "producto.json");
    const product = JSON.parse(await readFile(file, "utf8"));
    await writeFile(file, JSON.stringify({ ...product, codigo: code, publicado: false }));
  }
  for (const name of ["portada.jpeg", "02.jpeg", "03.jpeg"]) {
    // Exact files in this disposable fixture, not business originals.
    await rm(path.join(tempRoot, "catalogo/afe-15017", name), { force: true });
  }
  const existingPhoto = path.join(tempRoot, "catalogo/aft-7864/portada.jpeg");
  const previousPhoto = await readFile(existingPhoto);
  const publishedBefore = new Map();
  for (const id of await readdir(path.join(tempRoot, "catalogo"))) {
    try {
      const product = JSON.parse(await readFile(path.join(tempRoot, "catalogo", id, "producto.json"), "utf8"));
      if (product.publicado) publishedBefore.set(id, product);
    } catch {}
  }
  let result = run();
  assert.equal(result.status, 0, result.stderr);
  for (const [id, code] of [["afe-15017", "AFE-1507"], ["aft-7864", "AF7864"]]) {
    const product = JSON.parse(await readFile(path.join(tempRoot, "catalogo", id, "producto.json"), "utf8"));
    assert.equal(product.codigo, code);
    assert.equal(product.publicado, false);
    assert.equal(product.stock, 5);
    assert.equal(product.precio, "Consultar");
    for (const name of ["portada.jpeg", "02.jpeg", "03.jpeg"]) await readFile(path.join(tempRoot, "catalogo", id, name));
  }
  for (const [copy, original] of [["portada.jpeg", "AFE-1507_01.jpeg"], ["02.jpeg", "AFE-1507_02.jpeg"], ["03.jpeg", "AFE-1507_03.jpeg"]]) {
    assert.deepEqual(await readFile(path.join(tempRoot, "catalogo/afe-15017", copy)),
      await readFile(path.join(tempRoot, "inventario/fotos", original)), "Foto recuperada sin cambiar bytes");
  }
  await assert.rejects(readFile(path.join(tempRoot, "catalogo/af7864/producto.json")), { code: "ENOENT" });
  await assert.rejects(readFile(path.join(tempRoot, "catalogo/afe-1507/producto.json")), { code: "ENOENT" });
  assert.deepEqual(await readFile(existingPhoto), previousPhoto);
  result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await readFile(existingPhoto), previousPhoto);
  for (const [id, product] of publishedBefore) {
    const next = JSON.parse(await readFile(path.join(tempRoot, "catalogo", id, "producto.json"), "utf8"));
    assert.deepEqual(next, product, `${id}: la corrección no debe alterar productos publicados`);
  }
  workbook.Sheets.Inventario.B15.v = "AFE-15017";
  await writeFile(bookPath, XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /código anterior/);
  workbook.Sheets.Inventario.B15.v = "AFE-1507";
  await writeFile(bookPath, XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  const affectedPath = path.join(tempRoot, "catalogo/afe-15017/producto.json");
  const affected = JSON.parse(await readFile(affectedPath, "utf8"));
  const blockedBytes = JSON.stringify({ ...affected, codigo: "AFE-15017", publicado: true });
  await writeFile(affectedPath, blockedBytes);
  result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /publicada o duplicada/);
  assert.equal(await readFile(affectedPath, "utf8"), blockedBytes);
  await writeFile(path.join(tempRoot, "inventario/correcciones-codigos.json"), JSON.stringify({ correcciones: [{ ...shogun, fotos: ["../otra.jpeg"] }] }));
  await assert.rejects(cargarCorreccionesCodigos(tempRoot), /archivos inseguros/);
  console.log("Correcciones: identidad y marca exactas, tres fotos, IDs estables, sin publicación ni duplicados, importación repetible y bloqueos seguros.");
} finally {
  const resolved = path.resolve(tempRoot);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith("keiko-codigos-"));
  await rm(resolved, { recursive: true, force: true });
}
