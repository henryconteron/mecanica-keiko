import assert from "node:assert/strict";
import test from "node:test";
import { verifySource, verifyEvidence, sourceCheckSummary } from "../scripts/verificar-fuentes.mjs";

const html = "<html><body>EXACT-123 Toyota Corolla 2010 REF-456</body></html>";
const response = (body = html, options = {}) => new Response(body, { headers: { "content-type": "text/html" }, ...options });
async function withFetch(mock, action) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { return await action(); } finally { globalThis.fetch = original; }
}

test("fuentes no reconocidas o URLs inseguras se bloquean antes de consultar", async () => {
  await withFetch(() => { throw new Error("No debe consultar esta URL"); }, async () => {
    for (const url of ["https://unknown.example/part", "https://denso.com.attacker.example/part", "https://fake-denso.com/part", "https://maxcar-falso.example/part", "http://denso.com/part", "https://user:password@denso.com/part", "https://denso.com:8443/part", "https://127.0.0.1/part", "https://facebook.com/part"]) {
      const check = await verifySource({ url }, "EXACT-123");
      assert.equal(check.ok, false, url);
      assert.match(check.reason, /revisión humana/);
    }
  });
});

test("valida cada redirección y no consulta el destino rechazado", async () => {
  const calls = [];
  await withFetch(async (url, options) => {
    calls.push(String(url));
    assert.equal(options.redirect, "manual");
    return new Response(null, { status: 302, headers: { location: "https://127.0.0.1/private" } });
  }, async () => {
    assert.equal((await verifySource({ url: "https://denso.com/part" }, "EXACT-123")).ok, false);
    assert.deepEqual(calls, ["https://denso.com/part"]);
  });
});

test("redirección válida conserva el vínculo de las citas con la URL inicial", async () => {
  await withFetch(async (url) => String(url) === "https://denso.com/part"
    ? new Response(null, { status: 302, headers: { location: "/catalog/part" } }) : response(), async () => {
    const check = await verifySource({ url: "https://denso.com/part" }, "EXACT-123");
    assert.equal(check.ok, true);
    const evidence = verifyEvidence({ compatibilidad: ["Toyota Corolla 2010"], evidencias: [{ campo: "compatibilidad", valor: "Toyota Corolla 2010", url: "https://denso.com/part", cita: "EXACT-123 Toyota Corolla 2010" }] }, [check], "EXACT-123");
    assert.deepEqual(evidence.reasons, []);
    assert.equal(evidence.verified[0].url, "https://denso.com/catalog/part");
    assert.equal(Object.hasOwn(sourceCheckSummary(check), "pageText"), false);
  });
});

test("rechaza código parecido y código presente solo en scripts, comentarios o atributos", async () => {
  for (const content of ["EXACT-1234 Toyota Corolla 2010", "<script>EXACT-123 Toyota Corolla 2010</script>", "<!-- EXACT-123 Toyota Corolla 2010 -->", '<img alt="EXACT-123 Toyota Corolla 2010">', "<style>EXACT-123</style>"]) {
    await withFetch(async () => response(content), async () => assert.equal((await verifySource({ url: "https://denso.com/part" }, "EXACT-123")).ok, false, content));
  }
});

test("rechaza fuentes ilegibles, fallidas o con demasiadas redirecciones", async () => {
  for (const mock of [async () => response("", { status: 404 }), async () => response("EXACT-123", { headers: { "content-type": "application/pdf" } }), async () => new Response(null, { status: 302, headers: { location: "/loop" } }), async () => { throw new Error("Tiempo agotado"); }]) {
    await withFetch(mock, async () => assert.equal((await verifySource({ url: "https://denso.com/part" }, "EXACT-123")).ok, false));
  }
});

test("subdominios del mismo fabricante no cuentan como dominios independientes", async () => {
  await withFetch(async () => response(), async () => {
    const checks = await Promise.all(["https://denso.com/part", "https://catalog.denso.com/part"].map((url) => verifySource({ url }, "EXACT-123")));
    assert(checks.every((check) => check.ok));
    assert.equal(new Set(checks.map((check) => check.source.dominio)).size, 1);
  });
});

test("cada compatibilidad y referencia necesita su propia cita presente en la página", async () => {
  await withFetch(async () => response(), async () => {
    const checks = [await verifySource({ url: "https://denso.com/part" }, "EXACT-123")];
    const application = { campo: "compatibilidad", valor: "Toyota Corolla 2010", url: "https://denso.com/part", cita: "EXACT-123 Toyota Corolla 2010" };
    const proposal = { compatibilidad: [application.valor], referencias: ["REF-456"], evidencias: [application] };
    assert.equal(verifyEvidence(proposal, checks, "EXACT-123").reasons.length, 1);
    proposal.evidencias.push({ campo: "referencias", valor: "REF-456", url: "https://denso.com/part", cita: "EXACT-123 Toyota Corolla 2010 REF-456" });
    assert.equal(verifyEvidence(proposal, checks, "EXACT-123").verified.length, 2);
    for (const changes of [{ cita: "Toyota Corolla 2010" }, { cita: "EXACT-123 Toyota Corolla 2010 inventado" }, { url: "https://toyota.com/not-checked" }, { valor: "Toyota Corolla 2011" }]) {
      assert(verifyEvidence({ compatibilidad: [application.valor], evidencias: [{ ...application, ...changes }] }, checks, "EXACT-123").reasons.length > 0);
    }
  });
});

test("una referencia corta no coincide con una referencia más larga en la cita", async () => {
  await withFetch(async () => response(), async () => {
    const check = await verifySource({ url: "https://denso.com/part" }, "EXACT-123");
    const evidence = verifyEvidence({ referencias: ["REF-45"], evidencias: [{ campo: "referencias", valor: "REF-45", url: "https://denso.com/part", cita: "EXACT-123 Toyota Corolla 2010 REF-456" }] }, [check], "EXACT-123");
    assert.equal(evidence.verified.length, 0);
    assert.equal(evidence.reasons.length, 1);
  });
});
