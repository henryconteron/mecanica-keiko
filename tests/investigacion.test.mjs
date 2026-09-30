import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import XLSX from "xlsx";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixtureParent = path.join(root, "node_modules");
const headers = ["Código", "Nombre", "Marca", "Categoría", "Revisión", "Observaciones", "Cantidad", "Precio", "Ubicación", "Publicar", "Descripción", "Descripción corta", "Compatibilidad", "Referencias", "Fuentes", "Confianza"];
const originalRow = ["EXACT-123", "Nombre original", "Marca", "Filtros", "Investigar", "Nota original", 3, 12.5, "B-01", "No", "Descripción original", "Resumen original", "Aplicación original", "REF-ORIGINAL", "https://denso.com/original", "Baja"];

// Este proceso sustituye todas las solicitudes. Una URL inesperada nunca sale a la red.
async function runMockBot(config) {
  const { writeFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const product = {
    id: "local-test", codigo: "EXACT-123", nombre: "Nombre original", marca: "Marca",
    categoria: "Filtros", cantidad: 3, precio: 12.5,
    descripcion: "Descripción original", descripcion_corta: "Resumen original",
    compatibilidad: ["Aplicación original"], referencias: ["REF-ORIGINAL"],
    fuentes: [{ url: "https://denso.com/original" }], confianza: "Baja",
    fotos: config.noPhoto ? [] : ["photo.jpg"], revision: config.recheck ? "publicado" : "investigar",
    resultado_bot: config.recheck ? {
      verificacion_solicitada: true,
      ...(config.draft ? { edicion_pendiente: { nombre: "Borrador humano", descripcion: "Texto pendiente" } } : {})
    } : null
  };
  const patches = [];
  let unexpectedRequests = 0;
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url === "https://supabase.invalid/rest/v1/productos_admin?select=*&order=actualizado.asc&limit=500") return Response.json([product]);
    if (url === "https://supabase.invalid/rest/v1/productos_admin?id=eq.local-test" && options.method === "PATCH") {
      patches.push(JSON.parse(options.body));
      return new Response(null, { status: 204 });
    }
    if (url === "https://supabase.invalid/storage/v1/object/inventario/photo.jpg") return new Response("foto simulada", { headers: { "content-type": "image/jpeg" } });
    if (url === "https://api.groq.com/openai/v1/chat/completions") {
      const payload = JSON.parse(options.body);
      const vision = Array.isArray(payload.messages[0].content);
      if (vision && config.visionError) throw new Error("Lectura visual no disponible");
      const result = vision ? { codigo_visible: config.visibleCode, confianza: "Alta" } : {
        ...(config.omitConfirmation ? {} : { codigo_coincide: config.confirmation ?? true }),
        producto_coincide: true, codigo_investigado: "EXACT-123", nombre_sugerido: "Nombre propuesto",
        marca: "Marca", categoria: "Filtros", descripcion: "Descripción propuesta",
        descripcion_corta: "Resumen propuesto", compatibilidad: ["Aplicación propuesta"], referencias: [],
        fuentes: [{ titulo: "Fuente simulada", url: config.sourceUrl || "https://denso.com/part", tipo: "Fabricante" }],
        evidencias: config.noEvidence ? [] : [{ campo: "compatibilidad", valor: "Aplicación propuesta", url: config.sourceUrl || "https://denso.com/part", cita: config.quote || "EXACT-123 Aplicación propuesta" }],
        confianza: "Media", listo_para_revisar: true
      };
      return Response.json({ choices: [{ message: { content: JSON.stringify(result) } }] });
    }
    if (url === "https://denso.com/part") {
      const response = new Response(config.sourceHtml || "<html><title>Fuente simulada</title>EXACT-123 Aplicación propuesta</html>", { headers: { "content-type": "text/html" } });
      Object.defineProperty(response, "url", { value: url });
      return response;
    }
    unexpectedRequests += 1;
    throw new Error(`Solicitud inesperada bloqueada: ${url}`);
  };
  process.argv[1] = fileURLToPath(config.scriptUrl);
  await import(config.scriptUrl);
  await writeFile("mock-result.json", JSON.stringify({ product, patches, unexpectedRequests }));
}

async function exercise(bot, config) {
  await mkdir(fixtureParent, { recursive: true });
  const fixture = await mkdtemp(path.join(fixtureParent, "keiko-investigacion-test-"));
  assert(path.resolve(fixture).startsWith(path.resolve(fixtureParent) + path.sep));
  try {
    let originalWorkbook;
    if (bot === "inventario") {
      await mkdir(path.join(fixture, "inventario", "fotos"), { recursive: true });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, originalRow]), "Inventario");
      originalWorkbook = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      await writeFile(path.join(fixture, "inventario", "Inventario_Keiko.xlsx"), originalWorkbook);
      if (!config.noPhoto) await writeFile(path.join(fixture, "inventario", "fotos", "EXACT-123_01.jpg"), "foto simulada");
    }
    const script = bot === "panel" ? "investigar-supabase.mjs" : "investigar-inventario.mjs";
    const code = `await (${runMockBot.toString()})(${JSON.stringify({ ...config, scriptUrl: pathToFileURL(path.join(root, "scripts", script)).href })});`;
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", code], {
      cwd: fixture, encoding: "utf8", timeout: 20000,
      env: { ...process.env, SUPABASE_URL: "https://supabase.invalid", SUPABASE_SERVICE_ROLE_KEY: "local-test-only", GROQ_API_KEY: "local-test-only", GROQ_MAX_PRODUCTS: "1", GITHUB_STEP_SUMMARY: "" }
    });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    const mocked = JSON.parse(await readFile(path.join(fixture, "mock-result.json"), "utf8"));
    assert.equal(mocked.unexpectedRequests, 0, result.stdout);
    if (bot === "panel") return { ...mocked, update: mocked.patches.at(-1) };
    const workbookBuffer = await readFile(path.join(fixture, "inventario", "Inventario_Keiko.xlsx"));
    const workbook = XLSX.read(workbookBuffer, { type: "buffer" });
    const row = XLSX.utils.sheet_to_json(workbook.Sheets.Inventario)[0];
    const report = JSON.parse(await readFile(path.join(fixture, "inventario", "investigacion", "reporte.json"), "utf8"));
    return { row, report: report.resultados[0], workbookBuffer, originalWorkbook };
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}

const blockedCases = [
  ["etiqueta vacía", { visibleCode: "" }, /foto nítida/i],
  ["etiqueta con espacios", { visibleCode: "   " }, /foto nítida/i],
  ["etiqueta sin letras ni números", { visibleCode: "---" }, /foto nítida/i],
  ["código parecido", { visibleCode: "EXACT-1234" }, /no coincide/i],
  ["sin fotografía", { noPhoto: true }, /foto/i],
  ["fallo del lector visual", { visionError: true }, /visual|fotografías/i],
  ["modelo sin confirmar código", { visibleCode: "EXACT-123", omitConfirmation: true }, /no confirmó/i],
  ["confirmación de texto en vez de booleano", { visibleCode: "EXACT-123", confirmation: "true" }, /no confirmó/i],
  ["dominio no reconocido", { visibleCode: "EXACT-123", sourceUrl: "https://unrecognized.example/part" }, /revisión humana|fuente directa/i],
  ["código parecido en fuente", { visibleCode: "EXACT-123", sourceHtml: "EXACT-1234 Aplicación propuesta" }, /código exacto|evidencia literal/i],
  ["fuente sin evidencia por aplicación", { visibleCode: "EXACT-123", noEvidence: true }, /evidencia literal/i],
  ["cita inventada", { visibleCode: "EXACT-123", quote: "EXACT-123 Aplicación propuesta inventada" }, /evidencia literal/i],
  ["fuente con código sin aplicación", { visibleCode: "EXACT-123", sourceHtml: "EXACT-123" }, /evidencia literal/i]
];

for (const bot of ["panel", "inventario"]) {
  for (const [name, config, reason] of blockedCases) {
    test(`${bot}: bloquea ${name} y conserva los datos originales`, async () => {
      const result = await exercise(bot, config);
      if (bot === "panel") {
        assert.equal(result.update.resultado_bot.estado_investigacion, "requiere_atencion");
        assert.equal(result.update.revision, "revisar");
        assert.match(result.update.error_investigacion, reason);
        for (const key of ["nombre", "marca", "categoria", "descripcion", "descripcion_corta", "compatibilidad", "referencias", "fuentes", "confianza"]) assert.deepEqual(result.update[key], result.product[key]);
        for (const key of ["cantidad", "precio", "fotos", "codigo"]) assert.equal(Object.hasOwn(result.update, key), false);
      } else {
        assert.equal(result.report.estado, "Bloqueado");
        assert.match(result.report.observaciones, reason);
        assert(result.workbookBuffer.equals(result.originalWorkbook), "Una investigación bloqueada no debe modificar el Excel.");
        assert.equal(result.row.Revisión, "Investigar");
        assert.equal(result.row.Publicar, "No");
      }
    });
  }
  test(`${bot}: código legible con separadores prepara revisión sin publicar`, async () => {
    const result = await exercise(bot, { visibleCode: " exact 123 " });
    if (bot === "panel") {
      assert.equal(result.update.resultado_bot.estado_investigacion, "lista_para_revisar");
      assert.equal(result.update.revision, "revisar");
      assert.equal(result.update.nombre, "Nombre propuesto");
    } else {
      assert.equal(result.report.estado, "Revisar");
      assert.equal(result.row.Nombre, "Nombre propuesto");
      assert.equal(result.row.Publicar, "No");
      assert.equal(result.row.Cantidad, 3);
      assert.equal(result.row.Precio, 12.5);
      assert.equal(result.row.Ubicación, "B-01");
    }
  });
}

for (const draft of [false, true]) {
  for (const noEvidence of [false, true]) {
    test(`panel: reverificación bloqueada ${noEvidence ? "sin evidencia" : "sin etiqueta"} conserva ficha pública${draft ? " y borrador humano" : ""}`, async () => {
      const { update, product } = await exercise("panel", { visibleCode: noEvidence ? "EXACT-123" : "", noEvidence, recheck: true, draft });
      assert.equal(update.revision, "publicado");
      assert.equal(update.resultado_bot.estado_investigacion, "requiere_atencion");
      assert.deepEqual(update.resultado_bot.edicion_pendiente, product.resultado_bot.edicion_pendiente);
      assert.equal(Object.hasOwn(update.resultado_bot, "verificacion_solicitada"), false);
      for (const key of ["nombre", "descripcion", "compatibilidad", "fotos", "cantidad", "precio"]) assert.equal(Object.hasOwn(update, key), false);
    });
  }
}
