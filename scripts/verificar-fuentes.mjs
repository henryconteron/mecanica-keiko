const text = (value) => String(value ?? "").trim();
const normalized = (value) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
const phraseAppears = (page, value) => {
  const phrase = normalized(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Boolean(phrase) && new RegExp(`(^|[^\\p{L}\\p{N}])${phrase}(?=$|[^\\p{L}\\p{N}])`, "u").test(normalized(page));
};

// Fabricantes ya reconocidos por el bot y distribuidores con URL documentada
// en inventario/investigacion/reporte.json. Otros dominios requieren revisión humana.
const technicalDomains = [
  "advancefilters.com", "mann-filter.com", "hengst-filter.com", "mahle-aftermarket.com",
  "boschaftermarket.com", "denso.com", "ngkntk.com", "wixfilters.com", "fram.com",
  "hyundai.com", "kia.com", "toyota.com", "distriparteslm.ec", "maxcarsumegacentro.com"
];
const domainFor = (hostname) => technicalDomains.find((domain) => hostname === domain || hostname.endsWith(`.${domain}`));

const technicalUrl = (value) => {
  try {
    const url = new URL(text(value));
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null;
    if (!domainFor(url.hostname)) return null;
    url.hash = "";
    return url;
  } catch { return null; }
};

export const codeAppearsExactly = (page, code) => {
  const parts = text(code).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  if (!parts.length) return false;
  const escaped = parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(^|[^A-Z0-9])${escaped.join("[\\s._-]*")}(?=$|[^A-Z0-9])`, "i")
    .test(String(page || "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
};

const visibleText = (html) => String(html)
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code) => {
    const names = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
    if (code[0] !== "#") return names[code.toLowerCase()] || entity;
    const number = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : " ";
  }).replace(/\s+/g, " ").trim();

export const verifySource = async (source, code) => {
  const reject = (reason) => ({ source, ok: false, reason });
  let url = technicalUrl(typeof source === "string" ? source : source?.url);
  if (!url) return reject("La fuente requiere revisión humana: usa HTTPS y un dominio técnico reconocido, sin credenciales ni puertos especiales.");
  const requestedUrl = url.href;
  try {
    const signal = AbortSignal.timeout(20000);
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      const response = await fetch(url, {
        redirect: "manual", signal,
        headers: { "User-Agent": "MecanicaKeikoCatalogBot/1.0 (+https://henryconteron.github.io/mecanica-keiko/)" }
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        url = location && technicalUrl(new URL(location, url).href);
        if (!url) return reject("La fuente redirige a un destino que requiere revisión humana.");
        continue;
      }
      if (!response.ok) return reject(`No se pudo comprobar la fuente (${response.status}).`);
      if (!/text\/html|application\/xhtml\+xml/i.test(response.headers.get("content-type") || "")) return reject("La fuente no es una página técnica legible; requiere revisión humana.");
      const html = (await response.text()).slice(0, 1_500_000);
      const pageText = visibleText(html);
      if (!codeAppearsExactly(pageText, code)) return reject(`La fuente no muestra el código exacto ${code} en su texto.`);
      return {
        ok: true, pageText,
        source: {
          titulo: (text(source?.titulo) || visibleText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "") || url.hostname).slice(0, 160),
          url: url.href, url_solicitada: requestedUrl, tipo: text(source?.tipo) || "Fuente técnica", dominio: domainFor(url.hostname),
          codigo_verificado: true, codigo_consultado: code, fuente_tecnica_reconocida: true
        }
      };
    }
    return reject("La fuente tiene demasiadas redirecciones; requiere revisión humana.");
  } catch (error) { return reject(`No se pudo comprobar la fuente: ${error.message}`); }
};

// La cita debe estar en la página comprobada y vincular el código con el valor
// propuesto. Una coincidencia aislada del código no demuestra una aplicación.
export const verifyEvidence = (proposal, checks, code) => {
  const evidence = Array.isArray(proposal.evidencias) ? proposal.evidencias : [];
  const verified = [];
  const reasons = [];
  for (const field of ["compatibilidad", "referencias"]) {
    const values = Array.isArray(proposal[field]) ? proposal[field] : [];
    for (const value of values) {
      const item = evidence.find((entry) => {
        if (entry?.campo !== field || normalized(entry.valor) !== normalized(value)) return false;
        const url = technicalUrl(entry.url);
        const check = checks.find((candidate) => candidate.ok && url && [candidate.source.url, candidate.source.url_solicitada].includes(url.href));
        const quote = text(entry.cita);
        return Boolean(check && text(value) && quote.length <= 500 && codeAppearsExactly(quote, code)
          && phraseAppears(quote, value) && normalized(check.pageText).includes(normalized(quote)));
      });
      if (item) {
        const url = technicalUrl(item.url).href;
        const check = checks.find((candidate) => candidate.ok && [candidate.source.url, candidate.source.url_solicitada].includes(url));
        verified.push({ campo: field, valor: text(value), url: check.source.url, cita: text(item.cita) });
      }
      else reasons.push(`Falta evidencia literal comprobada para ${field}: ${text(value) || "valor vacío"}.`);
    }
  }
  return { verified, reasons };
};

export const sourceCheckSummary = ({ pageText, ...check }) => check;
