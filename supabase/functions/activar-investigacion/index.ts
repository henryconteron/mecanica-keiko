const allowedOrigins = new Set(["https://henryconteron.github.io", "http://localhost:4173", "http://127.0.0.1:4173"]);
const headersFor = (request: Request) => ({
  "Access-Control-Allow-Origin": allowedOrigins.has(request.headers.get("Origin") || "") ? request.headers.get("Origin")! : "https://henryconteron.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Vary": "Origin",
  "Content-Type": "application/json"
});

const respond = (request: Request, status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: headersFor(request) });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: headersFor(request) });
  if (request.method !== "POST") return respond(request, 405, { error: "Método no permitido." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const githubToken = Deno.env.get("GITHUB_WORKFLOW_TOKEN");
  const authorization = request.headers.get("Authorization") || "";
  if (!supabaseUrl || !anonKey || !githubToken || !authorization.startsWith("Bearer ")) {
    return respond(request, 503, { error: "El disparo automático todavía no está configurado." });
  }

  // El endpoint no es público: confirma la sesión y permite únicamente a la administradora del panel.
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization }
  });
  const user = userResponse.ok ? await userResponse.json() : null;
  if (user?.id !== "60712cc3-ee1b-4ad5-9226-4f97d80a13d8") return respond(request, 403, { error: "No tienes permiso para iniciar la investigación." });

  const payload = await request.json().catch(() => ({}));
  const publication = payload?.tarea === 'publicacion';
  const workflow = publication ? 'actualizar-catalogo.yml' : 'investigar-panel.yml';
  const githubResponse = await fetch(`https://api.github.com/repos/henryconteron/mecanica-keiko/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ref: "main" })
  });
  if (!githubResponse.ok) {
    console.error("GitHub no aceptó el inicio:", githubResponse.status, await githubResponse.text());
    return respond(request, 502, { error: "No se pudo iniciar el bot automáticamente." });
  }
  return respond(request, 202, { iniciado: true, mensaje: publication ? 'Sincronización de fichas y redes solicitada.' : 'El bot empezó a revisar los productos pendientes.' });
});
