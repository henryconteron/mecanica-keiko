(() => {
  const config = window.KEIKO_CONFIG || {};
  const configured = /^https:\/\//.test(config.supabaseUrl || "") && Boolean(config.supabaseAnonKey);
  const login = document.querySelector("#admin-login");
  const panel = document.querySelector("#admin-panel");
  const notice = document.querySelector("#admin-notice");
  const message = document.querySelector("#admin-message");
  const current = document.querySelector("#admin-current");
  const productForm = document.querySelector("#product-form");
  const productList = document.querySelector("#inventory-list");
  const productReview = document.querySelector("#product-review");
  const importLegacy = document.querySelector("#import-legacy");
  let productsCache = [];
  let token = sessionStorage.getItem("keikoAdminToken") || "";

  const showNotice = (text, type = "") => {
    notice.textContent = text;
    notice.dataset.type = type;
    notice.hidden = !text;
  };

  const request = async (path, options = {}) => {
    const response = await fetch(`${config.supabaseUrl}${path}`, {
      ...options,
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${token || config.supabaseAnonKey}`,
        "Content-Type": "application/json",
        ...options.headers
      }
    });
    const body = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.msg || body?.message || body?.error_description || "No se pudo completar la operación.");
    return body;
  };

  const loadState = async () => {
    const rows = await request("/rest/v1/estado_taller?id=eq.1&select=estado,mensaje,actualizado");
    const state = rows?.[0];
    if (!state) throw new Error("No se encontró el registro del taller.");
    current.textContent = state.estado;
    message.value = state.mensaje || "";
    document.querySelectorAll("[data-state]").forEach((button) => button.classList.toggle("is-current", button.dataset.state === state.estado));
  };

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const normalizedCode = (value) => String(value ?? "").trim().toUpperCase();

  const publicProductUrl = (product) => {
    const url = new URL("./", document.baseURI);
    url.searchParams.set("producto", product.id);
    url.hash = "repuestos";
    return url.toString();
  };

  const priceText = (product) => product.precio === null || product.precio === undefined || product.precio === ""
    ? "Consultar"
    : new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: Number(product.precio) % 1 === 0 ? 0 : 2 }).format(Number(product.precio));

  const promotionText = (product) => [
    "🔧 REPUESTO DISPONIBLE | MECÁNICA KEIKO",
    `✅ ${product.nombre}`,
    `Código: ${product.codigo}`,
    `Precio: ${priceText(product)}`,
    product.compatibilidad?.length ? `Compatible con: ${product.compatibilidad.slice(0, 2).join(" · ")}` : "",
    "📍 Archidona, Napo",
    "💬 Confirma compatibilidad y disponibilidad por WhatsApp.",
    `🔗 Fotos y detalles: ${publicProductUrl(product)}`
  ].filter(Boolean).join("\n");

  const signedPhotoUrl = async (path) => {
    if (!path) return null;
    const body = await request(`/storage/v1/object/sign/inventario/${encodeURIComponent(path).replaceAll("%2F", "/")}`, {
      method: "POST",
      body: JSON.stringify({ expiresIn: 3600 })
    });
    return body?.signedURL ? `${config.supabaseUrl}/storage/v1${body.signedURL}` : null;
  };

  const loadImage = (src) => new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

  const drawContainedImage = (context, image, x, y, width, height) => {
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const renderedWidth = image.naturalWidth * scale;
    const renderedHeight = image.naturalHeight * scale;
    context.drawImage(image, x + (width - renderedWidth) / 2, y + (height - renderedHeight) / 2, renderedWidth, renderedHeight);
  };

  const drawCoverImage = (context, image, x, y, width, height) => {
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const renderedWidth = image.naturalWidth * scale;
    const renderedHeight = image.naturalHeight * scale;
    context.drawImage(image, x + (width - renderedWidth) / 2, y + (height - renderedHeight) / 2, renderedWidth, renderedHeight);
  };

  const drawPromotionImage = (context, image, x, y, width, height) => {
    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    context.filter = "blur(26px) brightness(.38)";
    drawCoverImage(context, image, x - 28, y - 28, width + 56, height + 56);
    context.filter = "none";
    context.fillStyle = "rgba(0,0,0,.18)";
    context.fillRect(x, y, width, height);
    drawContainedImage(context, image, x, y, width, height);
    context.restore();
  };

  const drawWrappedText = (context, value, x, y, maxWidth, lineHeight, maxLines = 2) => {
    const words = value.split(/\s+/);
    const lines = [];
    let line = "";
    let truncated = false;
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width <= maxWidth || !line) line = next;
      else if (lines.length < maxLines - 1) { lines.push(line); line = word; }
      else { truncated = true; break; }
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (truncated) {
      let last = lines.at(-1) || "";
      while (last && context.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      lines[lines.length - 1] = `${last}…`;
    }
    lines.forEach((text, index) => context.fillText(text, x, y + index * lineHeight));
    return y + lines.length * lineHeight;
  };

  const createPromotionFile = async (product) => {
    const source = await signedPhotoUrl(product.fotos?.[0]);
    if (!source) return null;
    const image = await loadImage(source);
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const context = canvas.getContext("2d");
    context.fillStyle = "#171717";
    context.fillRect(0, 0, 1080, 1350);
    context.fillStyle = "#c8272c";
    context.fillRect(0, 0, 1080, 126);
    context.fillStyle = "#e9a927";
    context.fillRect(0, 126, 1080, 8);
    context.fillStyle = "#ffffff";
    context.font = "800 42px Inter, Arial, sans-serif";
    context.fillText("MECÁNICA KEIKO", 54, 70);
    context.fillStyle = "#ffd779";
    context.font = "800 24px Inter, Arial, sans-serif";
    context.textAlign = "right";
    context.fillText("REPUESTO DISPONIBLE", 1026, 67);
    context.textAlign = "left";
    drawPromotionImage(context, image, 54, 172, 972, 620);
    context.fillStyle = "#ffffff";
    context.font = "700 54px Oswald, Arial Narrow, sans-serif";
    const textBottom = drawWrappedText(context, product.nombre.toUpperCase(), 54, 860, 972, 62, 2);
    context.fillStyle = "#e9a927";
    context.font = "800 30px Inter, Arial, sans-serif";
    context.fillText(`CÓDIGO: ${product.codigo}`, 54, textBottom + 26);
    context.fillStyle = "#ffffff";
    context.font = "800 38px Inter, Arial, sans-serif";
    context.textAlign = "right";
    context.fillText(priceText(product), 1026, textBottom + 26);
    context.textAlign = "left";
    const footerY = Math.max(1010, Math.min(1125, textBottom + 100));
    context.fillStyle = "#2a2a2a";
    context.fillRect(0, footerY, 1080, 1350 - footerY);
    context.fillStyle = "#ffffff";
    context.font = "800 27px Inter, Arial, sans-serif";
    context.fillText("VER FOTOS Y DETALLES EN LA WEB", 54, footerY + 60);
    context.fillStyle = "#c9c9c9";
    context.font = "700 23px Inter, Arial, sans-serif";
    context.fillText("ARCHIDONA · NAPO", 54, footerY + 108);
    context.fillStyle = "#50d47d";
    context.textAlign = "right";
    context.fillText("WHATSAPP 098 938 1059", 1026, footerY + 108);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    return blob ? new File([blob], `${product.codigo || product.id}-mecanica-keiko.jpg`, { type: "image/jpeg" }) : null;
  };

  const downloadFile = (file) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const sharePromotion = async (product) => {
    try {
      const promotionFile = await createPromotionFile(product);
      if (!promotionFile) throw new Error("Este producto aún no tiene una foto para promocionar.");
      const text = promotionText(product);
      let copied = false;
      try { await navigator.clipboard.writeText(text); copied = true; } catch { /* El navegador puede bloquear el portapapeles. */ }
      const shareData = { title: product.nombre, text, url: publicProductUrl(product) };
      if (navigator.share && navigator.canShare?.({ files: [promotionFile] })) {
        await navigator.share({ ...shareData, files: [promotionFile] });
        showNotice("Se abrió el menú para publicar la promoción.", "success");
      } else {
        downloadFile(promotionFile);
        showNotice(copied ? "Imagen descargada y texto con enlace copiado. Súbelos a tu red social." : "Imagen descargada. Usa el enlace del producto al publicar.", "success");
      }
    } catch (error) {
      if (error?.name !== "AbortError") showNotice(error.message || "No se pudo preparar la promoción.", "error");
    }
  };

  const loadProducts = async () => {
    const products = await request("/rest/v1/productos_admin?select=*&order=actualizado.desc");
    productsCache = products;
    productList.innerHTML = products.length ? products.map((product) => `
      <article class="product-row">
        <div><strong>${escapeHtml(product.nombre)}</strong><span>${escapeHtml(product.codigo)} · ${product.cantidad} unidad${product.cantidad === 1 ? "" : "es"}</span><small>${product.fotos?.length || 0} foto${product.fotos?.length === 1 ? "" : "s"}</small><button class="secondary" data-product="${product.id}" type="button">Ver detalles</button></div>
        <span class="badge">${escapeHtml(product.revision)}</span>
      </article>`).join("") : '<p class="empty">Todavía no hay productos. Pulsa “Nuevo” para comenzar.</p>';
  };

  const showProduct = (product) => {
    const sources = (product.fuentes || []).map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.titulo || source.url)}</a></li>`).join("");
    productReview.innerHTML = `
      <h3>${escapeHtml(product.nombre)}</h3><p><strong>Código:</strong> ${escapeHtml(product.codigo)} · <strong>Confianza:</strong> ${escapeHtml(product.confianza || "Pendiente")}</p>
      ${product.descripcion ? `<p>${escapeHtml(product.descripcion)}</p>` : ""}
      ${product.compatibilidad?.length ? `<p><strong>Compatibilidad</strong></p><ul>${product.compatibilidad.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      ${sources ? `<p><strong>Fuentes para comprobar</strong></p><ul>${sources}</ul>` : ""}
      ${product.error_investigacion ? `<p class="review-error"><strong>Requiere atención:</strong> ${escapeHtml(product.error_investigacion)}</p>` : ""}
      <div class="review-actions">
        ${product.revision === "revisar" ? '<button class="primary" data-review-action="aprobar" type="button">Aprobar información</button>' : ""}
        ${product.revision === "aprobado" ? '<button class="primary" data-review-action="publicar" type="button">Publicar producto</button>' : ""}
        ${product.revision === "publicado" ? '<button class="share-promotion" data-review-action="compartir" type="button">Compartir promoción</button>' : ""}
        <button class="secondary" data-review-action="cerrar" type="button">Cerrar</button>
      </div>`;
    productReview.dataset.productId = product.id;
    productReview.hidden = false;
    productList.hidden = true;
  };

  const preparePhoto = async (file) => {
    if (!file.type.startsWith("image/")) throw new Error(`${file.name} no es una imagen compatible.`);
    try {
      const image = await createImageBitmap(file);
      const scale = Math.min(1, 1800 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d", { alpha: false }).drawImage(image, 0, 0, canvas.width, canvas.height);
      image.close();
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
      if (!blob) throw new Error("No se pudo optimizar la fotografía.");
      return { blob, extension: "jpg", type: "image/jpeg" };
    } catch {
      return { blob: file, extension: file.name.split(".").pop()?.toLowerCase() || "jpg", type: file.type || "image/jpeg" };
    }
  };

  const uploadPhoto = async (file, code, index) => {
    const prepared = await preparePhoto(file);
    const safeCode = code.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const filePath = `${safeCode}/${Date.now()}-${String(index + 1).padStart(2, "0")}.${prepared.extension}`;
    const response = await fetch(`${config.supabaseUrl}/storage/v1/object/inventario/${filePath}`, {
      method: "POST",
      headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${token}`, "Content-Type": prepared.type, "x-upsert": "false" },
      body: prepared.blob
    });
    if (!response.ok) throw new Error(`No se pudo subir ${file.name}.`);
    return filePath;
  };

  const showPanel = async () => {
    login.hidden = true;
    panel.hidden = false;
    try { await loadState(); } catch (error) { showNotice(error.message, "error"); }
  };

  document.querySelectorAll("[data-screen]").forEach((button) => button.addEventListener("click", async () => {
    document.querySelectorAll("[data-screen]").forEach((item) => item.classList.toggle("is-current", item === button));
    document.querySelector("#screen-workshop").hidden = button.dataset.screen !== "workshop";
    document.querySelector("#screen-inventory").hidden = button.dataset.screen !== "inventory";
    if (button.dataset.screen === "inventory") {
      try { await loadProducts(); } catch (error) { showNotice(error.message, "error"); }
    }
  }));

  document.querySelector("#new-product").addEventListener("click", () => {
    productForm.reset();
    document.querySelector("#product-quantity").value = 1;
    productForm.hidden = false;
    productList.hidden = true;
    document.querySelector("#product-code").focus();
  });

  const legacyPhotoFile = async (medium) => {
    const response = await fetch(new URL(medium.src, document.baseURI));
    if (!response.ok) throw new Error(`No se encontró la foto ${medium.nombre || medium.src}.`);
    const blob = await response.blob();
    return new File([blob], medium.nombre || medium.src.split("/").at(-1) || "foto.jpg", { type: blob.type || "image/jpeg" });
  };

  const importLegacyCatalog = async () => {
    importLegacy.disabled = true;
    try {
      showNotice("Leyendo el catálogo anterior…");
      const response = await fetch(new URL("data/catalogo.json", document.baseURI));
      if (!response.ok) throw new Error("No se pudo leer el catálogo anterior.");
      const source = await response.json();
      const legacyProducts = (source.productos || []).filter((product) => product.publicado !== false);
      const knownCodes = new Set(productsCache.map((product) => normalizedCode(product.codigo)));
      const pending = legacyProducts.filter((product) => !knownCodes.has(normalizedCode(product.codigo)));
      if (!pending.length) {
        showNotice("El catálogo anterior ya está en el panel; no se duplicó nada.", "success");
        return;
      }
      const errors = [];
      let imported = 0;
      for (const [index, legacy] of pending.entries()) {
        const code = normalizedCode(legacy.codigo);
        showNotice(`Importando ${index + 1} de ${pending.length}: ${code}…`);
        try {
          const files = await Promise.all((legacy.medios || []).filter((item) => item.tipo === "imagen").map(legacyPhotoFile));
          if (!files.length) throw new Error("No tiene fotografías para importar.");
          const payload = {
            codigo: code,
            nombre: legacy.nombre,
            cantidad: Number(legacy.stock || 0),
            precio: typeof legacy.precio === "number" ? legacy.precio : null,
            marca: legacy.marca || "",
            observaciones: legacy.estado || "Importado del catálogo anterior.",
            categoria: legacy.categoria || "Repuesto disponible",
            descripcion_corta: legacy.descripcionCorta || "Consulta disponibilidad y compatibilidad.",
            descripcion: legacy.descripcion || legacy.descripcionCorta || "Consulta disponibilidad y compatibilidad.",
            compatibilidad: legacy.compatibilidad || [],
            referencias: legacy.referencias || [],
            fuentes: (legacy.fuentes || []).map((source) => typeof source === "string" ? { url: source, titulo: source, tipo: "Referencia" } : source),
            confianza: legacy.confianza || "",
            fotos: [],
            revision: "revisar",
            actualizado: new Date().toISOString()
          };
          const created = await request("/rest/v1/productos_admin", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) });
          const photoPaths = [];
          for (const [photoIndex, file] of files.entries()) photoPaths.push(await uploadPhoto(file, code, photoIndex));
          await request(`/rest/v1/productos_admin?id=eq.${encodeURIComponent(created[0].id)}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ fotos: photoPaths, revision: "publicado", actualizado: new Date().toISOString() })
          });
          knownCodes.add(code);
          imported += 1;
        } catch (error) {
          errors.push(`${code}: ${error.message || "no se pudo importar"}`);
        }
      }
      await loadProducts();
      showNotice(errors.length ? `Se importaron ${imported} productos. Revisa estos casos: ${errors.join(" · ")}` : `Catálogo anterior importado: ${imported} productos con sus fotos.`, errors.length ? "error" : "success");
    } catch (error) {
      showNotice(error.message || "No se pudo importar el catálogo anterior.", "error");
    } finally {
      importLegacy.disabled = false;
    }
  };

  importLegacy.addEventListener("click", importLegacyCatalog);

  document.querySelector("#cancel-product").addEventListener("click", () => {
    productForm.hidden = true;
    productList.hidden = false;
  });

  productList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-product]");
    if (button) showProduct(productsCache.find((product) => product.id === button.dataset.product));
  });

  productReview.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-review-action]")?.dataset.reviewAction;
    if (!action) return;
    if (action === "cerrar") { productReview.hidden = true; productList.hidden = false; return; }
    if (action === "compartir") {
      const product = productsCache.find((item) => item.id === productReview.dataset.productId);
      if (product) await sharePromotion(product);
      return;
    }
    if (action === "publicar" && !window.confirm("¿Confirmas que revisaste código, compatibilidad, precio y fotografías? El producto será visible para clientes.")) return;
    const revision = action === "aprobar" ? "aprobado" : "publicado";
    try {
      await request(`/rest/v1/productos_admin?id=eq.${productReview.dataset.productId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ revision, actualizado: new Date().toISOString() }) });
      productReview.hidden = true; productList.hidden = false; await loadProducts();
      showNotice(revision === "publicado" ? "Producto publicado correctamente." : "Información aprobada. Ya puedes publicarlo.", "success");
    } catch (error) { showNotice(error.message, "error"); }
  });

  productForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = document.querySelector("#product-code").value.trim().toUpperCase();
    const files = [...document.querySelector("#product-photos").files];
    if (!files.length) return showNotice("Añade al menos una foto donde se vea el código.", "error");
    if (files.some((file) => file.size > 10 * 1024 * 1024)) return showNotice("Cada fotografía debe pesar menos de 10 MB.", "error");
    showNotice(`Guardando ${code} y subiendo ${files.length} foto${files.length === 1 ? "" : "s"}…`);
    try {
      const payload = {
        codigo: code,
        nombre: document.querySelector("#product-name").value.trim(),
        cantidad: Number(document.querySelector("#product-quantity").value),
        precio: document.querySelector("#product-price").value || null,
        marca: document.querySelector("#product-brand").value.trim(),
        observaciones: document.querySelector("#product-notes").value.trim(),
        revision: "investigar",
        actualizado: new Date().toISOString()
      };
      const created = await request("/rest/v1/productos_admin", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) });
      const photoPaths = [];
      for (const [index, file] of files.entries()) photoPaths.push(await uploadPhoto(file, code, index));
      await request(`/rest/v1/productos_admin?id=eq.${encodeURIComponent(created[0].id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ fotos: photoPaths }) });
      productForm.hidden = true;
      productList.hidden = false;
      await loadProducts();
      showNotice(`${code} quedó guardado para investigación.`, "success");
    } catch (error) {
      showNotice(error.message.includes("duplicate") ? "Ese código ya existe en el inventario." : error.message, "error");
    }
  });

  login.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!configured) return showNotice("Primero configura Supabase siguiendo la guía del proyecto.", "error");
    showNotice("Ingresando…");
    try {
      const form = new FormData(login);
      const result = await request("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") })
      });
      token = result.access_token;
      sessionStorage.setItem("keikoAdminToken", token);
      showNotice("");
      await showPanel();
    } catch (error) {
      showNotice("No se pudo ingresar. Revisa el correo y la contraseña.", "error");
    }
  });

  panel.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-state]");
    if (!button) return;
    button.disabled = true;
    showNotice("Actualizando la página…");
    try {
      await request("/rest/v1/estado_taller?id=eq.1", {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ estado: button.dataset.state, mensaje: message.value.trim(), actualizado: new Date().toISOString() })
      });
      await loadState();
      showNotice("Estado actualizado. La página pública lo mostrará en menos de un minuto.", "success");
    } catch (error) {
      if (/JWT|token|expired/i.test(error.message)) {
        sessionStorage.removeItem("keikoAdminToken");
        location.reload();
      } else showNotice(error.message, "error");
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector("#admin-logout").addEventListener("click", () => {
    sessionStorage.removeItem("keikoAdminToken");
    location.reload();
  });

  if (!configured) showNotice("Panel preparado. Falta conectar Supabase; consulta la guía.", "error");
  if (token && configured) showPanel();
})();
