import test from "node:test";
import assert from "node:assert/strict";
import { cargarBibliotecaFuentes, seleccionarFuentesRecordadas, urlFuentePublica,
  codigoEnTextoVisible, textoVisibleFuente, comprobarFuenteRecordada,
  consultarFuentesRecordadas, contextoFuentesRecordadas, resumenFuentesRecordadas } from "../scripts/fuentes-recordadas.mjs";

const library = await cargarBibliotecaFuentes();
const filter = { codigo: "AFP-523", marca: "ADVANCE Filters", categoria: "Filtros" };
const source = library.productos.find((entry) => entry.codigo === filter.codigo).fuentes[0];
const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];
const html = (body, status = 200) => new Response(`<html><head><title>Ficha técnica</title></head><body>${body}</body></html>`, {
  status, headers: { "Content-Type": "text/html; charset=utf-8" }
});

test("biblioteca: diez productos y trece fuentes revisadas, sin inventario ni precios", () => {
  assert.equal(library.productos.length, 10);
  assert.equal(library.productos.flatMap((entry) => entry.fuentes).length, 13);
  for (const entry of library.productos) {
    assert.ok(entry.marcas.length && entry.limitaciones && entry.revisado_por_taller_en);
    for (const item of entry.fuentes) assert.ok(urlFuentePublica(item.url));
    for (const field of ["cantidad", "precio", "fotos", "descripcion"]) assert.equal(field in entry, false);
  }
});

test("solo recuerda el código, marca y categoría correspondientes", () => {
  assert.equal(seleccionarFuentesRecordadas(filter, library).length, 1);
  assert.equal(seleccionarFuentesRecordadas({ ...filter, codigo: "AFP523", marca: "advance" }, library).length, 1);
  for (const changed of [{ codigo: "AFP-524" }, { marca: "Otra marca" }, { categoria: "Pastillas de freno" }]) {
    const entries = seleccionarFuentesRecordadas({ ...filter, fuentes: [source], ...changed }, library);
    // Si cambió el código, la fuente vieja solo es candidata, nunca una fuente revisada del nuevo producto.
    assert.ok(entries.every((item) => item.origen !== "biblioteca_revisada"));
    if (!changed.codigo) assert.equal(entries.length, 0);
  }
});

test("prioriza la biblioteca, deduplica y limita a cinco fichas", () => {
  const product = { ...filter, fuentes: [source.url + "#foto", ...Array.from({ length: 6 }, (_, index) => `https://catalogo.keiko.ec/pieza-${index}`)] };
  const entries = seleccionarFuentesRecordadas(product, library);
  assert.equal(entries.length, 5);
  assert.equal(entries[0].origen, "biblioteca_revisada");
  assert.equal(entries[0].url, source.url);
  assert.equal(entries[1].origen, "ficha_del_producto");
  assert.equal(seleccionarFuentesRecordadas({ ...filter, fuentes: `${source.url} | https://catalogo.keiko.ec/otra` }, library).length, 2);
});

test("D831C recuerda D831 únicamente al consultar la base, sin generalizar a otros códigos", () => {
  const pads = { codigo: "D831C", marca: "Double link brake", categoria: "Pastillas de freno" };
  assert.equal(seleccionarFuentesRecordadas(pads, library).length, 0);
  const [entry] = seleccionarFuentesRecordadas(pads, library, "D831");
  assert.equal(entry.alcance, "referencia_base");
  assert.match(entry.limitaciones, /No se encontró ficha directa/);
  assert.equal(seleccionarFuentesRecordadas({ ...pads, codigo: "D832C" }, library, "D832").length, 0);
});

test("rechaza direcciones privadas, credenciales, puertos y fuentes no técnicas", () => {
  for (const url of ["http://catalogo.keiko.ec/ficha", "https://usuario:clave@catalogo.keiko.ec/ficha",
    "https://127.0.0.1/", "https://10.0.0.1/", "https://2130706433/", "https://[::1]/", "https://localhost/",
    "https://servidor.local/", "https://catalogo.internal/", "https://catalogo.keiko.ec:8443/",
    "https://m.facebook.com/ficha", "https://www.amazon.com/ficha", "https://pdfcoffee.com/ficha", "no-es-url"]) {
    assert.equal(urlFuentePublica(url), null, url);
  }
  assert.equal(urlFuentePublica("https://catalogo.keiko.ec/ficha#foto").href, "https://catalogo.keiko.ec/ficha");
});

test("el código debe estar en texto de la ficha, no solo en URL, atributos, título o scripts", () => {
  const page = textoVisibleFuente('<head><title>D831</title></head><script>D831</script><style>.D831{}</style><!--D831--><a href="/D831">Otra pieza</a><img alt="D831"><template>D831</template>');
  assert.equal(codigoEnTextoVisible(page, "D831"), false);
  assert.equal(codigoEnTextoVisible("Pastillas D831C y D8310", "D831"), false);
  assert.equal(codigoEnTextoVisible("Ficha ZD831", "D831"), false);
  assert.equal(codigoEnTextoVisible("Ficha AFP 523", "AFP-523"), true);
  assert.equal(codigoEnTextoVisible("Ficha 31911-2E000", "319112E000"), false);
  assert.equal(codigoEnTextoVisible(textoVisibleFuente("<p>AFP&#45;523 &amp; datos</p>"), "AFP-523"), true);
  assert.equal(codigoEnTextoVisible("Ficha cualquiera", ""), false);
});

test("lee la página actual y devuelve extracto y limitaciones, sin enviar secretos", async () => {
  let calls = 0;
  const checks = await consultarFuentesRecordadas(filter, library, filter.codigo, { lookupImpl: publicLookup, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, source.url);
    assert.equal(options.redirect, "manual");
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.headers.apikey, undefined);
    return html("<h1>Filtro AFP-523</h1><p>Aplicación contrastada en esta ficha.</p>");
  } });
  assert.equal(calls, 1);
  assert.equal(checks[0].ok, true);
  assert.match(checks[0].extracto, /Aplicación contrastada/);
  assert.equal(checks[0].codigo_consultado, "AFP-523");
  const context = contextoFuentesRecordadas(checks);
  assert.match(context, /NO aprueba automáticamente/);
  assert.match(context, /no a otra fila o producto/);
  assert.match(context, /Nunca traslades fabricante/);
  const summary = resumenFuentesRecordadas(checks);
  assert.equal(summary[0].comprobada_ahora, true);
  assert.equal("extracto" in summary[0], false);
  assert.equal("extracto_visible" in summary[0], false);
});

test("fuente borrada, código eliminado o documento no HTML: falla sin reutilizar texto antiguo", async () => {
  for (const response of [html("AFP-523", 404), html("AFP-524"), html('<script>"AFP-523"</script>Otra pieza'),
    new Response("AFP-523", { headers: { "Content-Type": "application/pdf" } })]) {
    const checked = await comprobarFuenteRecordada(source, "AFP-523", { lookupImpl: publicLookup, fetchImpl: async () => response });
    assert.equal(checked.ok, false);
    assert.equal(checked.extracto, undefined);
    assert.ok(checked.reason);
  }
});

test("rechaza redirecciones externas/privadas antes de visitarlas", async () => {
  for (const destination of ["https://127.0.0.1/ficha", "https://otro.keiko.ec/ficha", "http://distriparteslm.ec/ficha"]) {
    let calls = 0;
    const checked = await comprobarFuenteRecordada(source, "AFP-523", { lookupImpl: publicLookup, fetchImpl: async () => {
      calls++;
      return new Response(null, { status: 302, headers: { location: destination } });
    } });
    assert.equal(checked.ok, false);
    assert.equal(calls, 1);
  }
});

test("permite redirección al mismo dominio y limita bucles de redirección", async () => {
  let calls = 0;
  const checked = await comprobarFuenteRecordada(source, "AFP-523", { lookupImpl: publicLookup, fetchImpl: async () => ++calls === 1
    ? new Response(null, { status: 301, headers: { location: "https://www.distriparteslm.ec/producto/otr-afp-523/" } })
    : html("AFP-523") });
  assert.equal(checked.ok, true);
  assert.equal(calls, 2);
  calls = 0;
  const loop = await comprobarFuenteRecordada(source, "AFP-523", { lookupImpl: publicLookup, fetchImpl: async () => {
    calls++;
    return new Response(null, { status: 302, headers: { location: source.url } });
  } });
  assert.equal(loop.ok, false);
  assert.equal(calls, 4);
});

test("tamaño excesivo y errores de red no se convierten en evidencia", async () => {
  for (const fetchImpl of [async () => html("AFP-523 " + "x".repeat(1_500_000)), async () => { throw new Error("Tiempo agotado"); }]) {
    const checked = await comprobarFuenteRecordada(source, "AFP-523", { lookupImpl: publicLookup, fetchImpl });
    assert.equal(checked.ok, false);
    assert.equal(checked.extracto, undefined);
  }
  assert.match(contextoFuentesRecordadas([]), /búsqueda nueva/);
});

test("DNS: rechaza direcciones privadas y reservadas IPv4/IPv6 antes de la petición", async () => {
  const addresses = ["0.0.0.0", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.169.254",
    "172.16.0.1", "192.0.0.1", "192.0.2.1", "192.168.0.1", "198.18.0.1", "198.51.100.1",
    "203.0.113.1", "224.0.0.1", "255.255.255.255", "::", "::1", "::ffff:127.0.0.1",
    "fc00::1", "fe80::1", "ff02::1", "2001:db8::1", "2002:7f00:1::1", "3fff::1"];
  for (const address of addresses) {
    let requests = 0;
    const checked = await comprobarFuenteRecordada({ url: "https://127.0.0.1.nip.io/ficha" }, "AFP-523", {
      lookupImpl: async () => [{ address, family: address.includes(":") ? 6 : 4 }],
      fetchImpl: async () => { requests++; return html("AFP-523"); }
    });
    assert.equal(checked.ok, false, address);
    assert.equal(requests, 0, address);
    assert.match(checked.reason, /DNS|privada|reservada/i);
  }
});

test("DNS: una sola respuesta privada entre A/AAAA públicos invalida la fuente", async () => {
  let requests = 0;
  const checked = await comprobarFuenteRecordada(source, "AFP-523", {
    lookupImpl: async () => [{ address: "93.184.216.34", family: 4 }, { address: "::1", family: 6 }],
    fetchImpl: async () => { requests++; return html("AFP-523"); }
  });
  assert.equal(checked.ok, false);
  assert.equal(requests, 0);
});

test("DNS: permite respuestas públicas y comprueba de nuevo cada redirección", async () => {
  let resolutions = 0;
  let requests = 0;
  const checked = await comprobarFuenteRecordada(source, "AFP-523", {
    lookupImpl: async () => { resolutions++; return [{ address: "93.184.216.34", family: 4 }, { address: "2606:4700:4700::1111", family: 6 }]; },
    fetchImpl: async () => ++requests === 1 ? new Response(null, { status: 301, headers: { location: "/ficha-final" } }) : html("AFP-523")
  });
  assert.equal(checked.ok, true);
  assert.equal(requests, 2);
  assert.equal(resolutions, 2);
});

test("DNS: no abre el destino si cambia a una dirección privada al redirigir", async () => {
  let resolutions = 0;
  let requests = 0;
  const checked = await comprobarFuenteRecordada(source, "AFP-523", {
    lookupImpl: async () => [{ address: ++resolutions === 1 ? "93.184.216.34" : "127.0.0.1", family: 4 }],
    fetchImpl: async () => { requests++; return new Response(null, { status: 302, headers: { location: "/ficha-final" } }); }
  });
  assert.equal(checked.ok, false);
  assert.equal(requests, 1);
});

test("DNS: ausencia de direcciones, registros inválidos y error de resolución no se convierten en evidencia", async () => {
  for (const lookupImpl of [async () => [], async () => [{ address: "no-es-ip", family: 4 }], async () => { throw new Error("ENOTFOUND"); }]) {
    let requests = 0;
    const checked = await comprobarFuenteRecordada(source, "AFP-523", { lookupImpl,
      fetchImpl: async () => { requests++; return html("AFP-523"); } });
    assert.equal(checked.ok, false);
    assert.equal(requests, 0);
  }
});

test("DNS: una resolución lenta respeta el límite total y nunca inicia la descarga", async () => {
  let requests = 0;
  const checked = await comprobarFuenteRecordada(source, "AFP-523", { timeoutMs: 5,
    lookupImpl: () => new Promise((resolve) => setTimeout(() => resolve([{ address: "93.184.216.34", family: 4 }]), 30)),
    fetchImpl: async () => { requests++; return html("AFP-523"); }
  });
  assert.equal(checked.ok, false);
  assert.equal(requests, 0);
});
