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
