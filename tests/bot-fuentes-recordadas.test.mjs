import test from "node:test";
import assert from "node:assert/strict";

// Ejecuta el bot real con TODAS sus llamadas de red sustituidas por respuestas locales.
// No usa credenciales reales, Supabase de producción ni consultas de IA de pago.
async function runBot({ code = "AFP-523", ceramic = false, unavailable = false, draft = null } = {}) {
  const oldFetch = globalThis.fetch;
  const envNames = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GROQ_API_KEY"];
  const oldEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  process.env.SUPABASE_URL = "https://keiko-fixture.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "clave-ficticia-prueba";
  process.env.GROQ_API_KEY = "groq-ficticio-prueba";
  const sourceUrl = code === "D831C" ? "https://www.qytauto.com/d831.html" : "https://distriparteslm.ec/producto/otr-afp-523/";
  const product = { id: "producto-prueba", codigo: code, marca: code === "D831C" ? "Double link brake" : "Advance Filters",
    nombre: code === "D831C" ? "Pastillas de freno delanteras" : "Filtro de combustible",
    categoria: code === "D831C" ? "Pastillas de freno" : "Filtros", revision: "publicado",
    cantidad: 5, precio: "$7", fotos: ["foto-original.png", "foto-2.png"], descripcion: "Descripción pública aprobada",
    descripcion_corta: "Resumen aprobado", fuentes: [{ url: sourceUrl }],
    resultado_bot: { verificacion_solicitada: true, verificacion_manual: { revisado: true }, ...(draft ? { edicion_pendiente: draft } : {}) } };
  const patches = [];
  const calls = [];
  let researchPrompt;
  const json = (value) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
  globalThis.fetch = async (urlValue, options = {}) => {
    const url = String(urlValue);
    calls.push(url);
    if (url.startsWith(process.env.SUPABASE_URL + "/rest/v1/productos_admin")) {
      if (options.method === "PATCH") {
        patches.push(JSON.parse(options.body));
        return new Response(null, { status: 204 });
      }
      return json([product]);
    }
    if (url.startsWith(process.env.SUPABASE_URL + "/storage/v1/object/inventario/")) {
      return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/jpeg" } });
    }
    if (url === "https://api.groq.com/openai/v1/chat/completions") {
      const payload = JSON.parse(options.body);
      let response;
      if (Array.isArray(payload.messages[0].content)) {
        response = { codigo_visible: code, marca_visible: ceramic ? "Double Link CERAMIC" : product.marca, tipo_visible: product.nombre, confianza: "Alta" };
      } else {
        researchPrompt = payload.messages[0].content;
        if (code !== "D831C" || ceramic) assert.ok(calls.slice(0, -1).includes(sourceUrl), "La ficha se debe consultar ANTES de investigar");
        response = { codigo_coincide: !unavailable, producto_coincide: !unavailable, listo_para_revisar: !unavailable,
          nombre_sugerido: product.nombre, marca: product.marca, categoria: product.categoria,
          descripcion_corta: "Resumen nuevo para revisar", descripcion: "Propuesta nueva según fuente actual",
          compatibilidad: unavailable ? [] : ["Aplicación de prueba; confirmar por motor"], referencias: [code],
          fuentes: unavailable ? [] : [{ titulo: "Ficha consultada", url: sourceUrl, tipo: "Distribuidor" }], confianza: "Media" };
      }
      return json({ choices: [{ message: { content: JSON.stringify(response) } }] });
    }
    if (url === sourceUrl) {
      assert.equal(options.headers?.apikey, undefined);
      assert.equal(options.headers?.Authorization, undefined);
      return new Response(unavailable ? "No existe esta ficha" : `<h1>${code === "D831C" ? "D831" : code}</h1><p>Evidencia fresca de la ficha para esta prueba.</p>`, {
        status: unavailable ? 404 : 200, headers: { "Content-Type": "text/html" }
      });
    }
    throw new Error(`Llamada de red no permitida en prueba: ${url}`);
  };
  try {
    await import(`../scripts/investigar-supabase.mjs?prueba=${encodeURIComponent(JSON.stringify({ code, ceramic, unavailable, draft }))}`);
    assert.equal(patches.length, 2);
    return { product, patches, researchPrompt, calls, final: patches.at(-1) };
  } finally {
    globalThis.fetch = oldFetch;
    for (const name of envNames) {
      if (oldEnv[name] === undefined) delete process.env[name]; else process.env[name] = oldEnv[name];
    }
  }
}

const assertPublicPreserved = (result) => {
  for (const patch of result.patches) {
    for (const field of ["codigo", "nombre", "marca", "categoria", "cantidad", "precio", "fotos", "descripcion", "descripcion_corta", "fuentes", "compatibilidad", "referencias"]) {
      assert.equal(field in patch, false, `No se debe reemplazar el campo público ${field}`);
    }
  }
  assert.equal(result.final.revision, "publicado");
  assert.deepEqual(result.final.resultado_bot.verificacion_manual, { revisado: true });
  assert.equal(result.final.resultado_bot.verificacion_solicitada, undefined);
};

test("bot: usa evidencia recordada actual, deja borrador y conserva ficha pública", async () => {
  const result = await runBot();
  assertPublicPreserved(result);
  assert.equal(result.patches[0].resultado_bot.estado_investigacion, "investigando");
  assert.equal(result.final.resultado_bot.estado_investigacion, "lista_para_revisar");
  assert.equal(result.final.resultado_bot.fuentes_recordadas[0].origen, "biblioteca_revisada");
  assert.equal(result.final.resultado_bot.fuentes_recordadas[0].comprobada_ahora, true);
  assert.equal(result.final.resultado_bot.edicion_pendiente.descripcion, "Propuesta nueva según fuente actual");
  assert.match(result.researchPrompt, /Evidencia fresca/);
  assert.match(result.researchPrompt, /Se omite la aplicación Kia/);
});

test("bot: D831C conserva código de venta, usa base D831 solo con CERAMIC visible", async () => {
  const result = await runBot({ code: "D831C", ceramic: true });
  assertPublicPreserved(result);
  assert.equal(result.final.resultado_bot.codigo_consultado, "D831");
  assert.equal(result.final.resultado_bot.variante_ceramica_verificada_por_empaque, true);
  assert.equal(result.final.resultado_bot.fuentes_recordadas[0].alcance, "referencia_base");
  assert.match(result.researchPrompt, /no confirma el ajuste exacto, el compuesto ni la garantía/);
  assert.match(result.researchPrompt, /No se encontró ficha directa del fabricante para Double Link D831C/);
});

test("bot: sin CERAMIC no elimina la C y la ficha D831 no pasa por D831C", async () => {
  const result = await runBot({ code: "D831C" });
  assertPublicPreserved(result);
  assert.equal(result.final.resultado_bot.codigo_consultado, "D831C");
  assert.equal(result.final.resultado_bot.fuentes_recordadas.length, 0);
  assert.equal(result.final.resultado_bot.estado_investigacion, "requiere_atencion");
  assert.equal(result.final.resultado_bot.edicion_pendiente, undefined);
});

test("bot: enlace caído no valida ficha ni borra borrador revisado por el usuario", async () => {
  const draft = { descripcion: "Cambio pendiente escrito por el taller", fuentes: [] };
  const result = await runBot({ unavailable: true, draft });
  assertPublicPreserved(result);
  assert.equal(result.final.resultado_bot.estado_investigacion, "requiere_atencion");
  assert.equal(result.final.resultado_bot.fuentes_recordadas[0].comprobada_ahora, false);
  assert.match(result.final.resultado_bot.fuentes_recordadas[0].motivo, /404/);
  assert.deepEqual(result.final.resultado_bot.edicion_pendiente, draft);
  assert.doesNotMatch(result.researchPrompt, /Evidencia fresca/);
});
