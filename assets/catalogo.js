(() => {
  const WHATSAPP = "593989381059";
  const grid = document.querySelector("#catalog-grid");
  const status = document.querySelector("#catalog-status");
  const search = document.querySelector("#catalog-search");
  const filters = document.querySelector("#catalog-filters");
  const dialog = document.querySelector("#product-dialog");
  const dialogContent = document.querySelector("#dialog-content");
  const closeDialog = document.querySelector("#dialog-close");
  const toast = document.querySelector("#catalog-toast");

  if (!grid || !status || !search || !filters || !dialog || !dialogContent) return;

  let products = [];
  let activeCategory = "Todos";
  let activeProduct = null;
  let activeMediaIndex = 0;
  let touchStartX = null;
  let imageZoomScale = 1;
  let savedScrollY = 0;
  let pageScrollLocked = false;
  let toastTimer;

  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const productUrl = (product) => {
    if (product.origen === "panel") {
      const url = new URL("./", document.baseURI);
      url.searchParams.set("producto", product.id);
      url.hash = "repuestos";
      return url.toString();
    }
    return new URL(`productos/${product.id}/`, document.baseURI).toString();
  };

  const priceText = (product) => {
    if (typeof product.precio === "number") {
      return new Intl.NumberFormat("es-EC", {
        style: "currency",
        currency: product.moneda || "USD",
        maximumFractionDigits: product.precio % 1 === 0 ? 0 : 2
      }).format(product.precio);
    }
    return product.precio || "Consultar";
  };

  const compactText = (value, limit = 240) => {
    const source = String(value || "").trim();
    if (source.length <= limit) return source;
    const cut = source.slice(0, limit).replace(/\s+\S*$/, "").trim();
    return `${cut}…`;
  };

  const mediaElement = (medium, alt, options = {}) => {
    if (!medium) return `<span aria-hidden="true">Sin foto</span>`;
    if (medium.tipo === "video") {
      return `<video src="${escapeHtml(medium.src)}" ${options.controls ? "controls" : "muted playsinline preload=\"metadata\""} aria-label="${escapeHtml(alt)}"></video>`;
    }
    const fitStyle = options.fit === "contain"
      ? ' style="width:auto!important;height:auto!important;max-width:calc(100% - 28px)!important;max-height:calc(100% - 28px)!important;object-fit:contain!important"'
      : "";
    return `<img src="${escapeHtml(medium.src)}" alt="${escapeHtml(alt)}" loading="lazy"${fitStyle}>`;
  };

  // Algunos navegadores móviles fuerzan el ancho de las imágenes dentro de diálogos.
  // Calculamos su tamaño con los píxeles reales para que una foto vertical nunca se recorte.
  const fitMainImage = (container) => {
    const image = container?.querySelector("img");
    if (!image) return;
    const fit = () => {
      if (!image.naturalWidth || !image.naturalHeight || !container.clientWidth || !container.clientHeight) return;
      const availableWidth = Math.max(1, container.clientWidth - 28);
      const availableHeight = Math.max(1, container.clientHeight - 28);
      const scale = Math.min(availableWidth / image.naturalWidth, availableHeight / image.naturalHeight);
      image.style.setProperty("width", `${Math.max(1, Math.floor(image.naturalWidth * scale))}px`, "important");
      image.style.setProperty("height", `${Math.max(1, Math.floor(image.naturalHeight * scale))}px`, "important");
      image.style.setProperty("max-width", "none", "important");
      image.style.setProperty("max-height", "none", "important");
    };
    // Dos cuadros aseguran que el diálogo ya tenga su alto definitivo en móvil.
    const scheduleFit = () => requestAnimationFrame(() => requestAnimationFrame(fit));
    if (image.complete) scheduleFit();
    else image.addEventListener("load", scheduleFit, { once: true });
  };

  const normalizeSearch = (value = "") => String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");

  const productLabel = (product) => normalizeSearch(product.nombre).includes(normalizeSearch(product.codigo))
    ? product.nombre
    : `${product.nombre} ${product.codigo}`;

  const lockPageScroll = () => {
    if (pageScrollLocked) return;
    savedScrollY = window.scrollY;
    pageScrollLocked = true;
    document.body.style.position = "fixed";
    document.body.style.inset = `-${savedScrollY}px 0 auto`;
    document.body.style.width = "100%";
  };

  const unlockPageScroll = () => {
    if (!pageScrollLocked) return;
    document.body.style.position = "";
    document.body.style.inset = "";
    document.body.style.width = "";
    const previousBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, savedScrollY);
    document.documentElement.style.scrollBehavior = previousBehavior;
    pageScrollLocked = false;
  };

  const searchableText = (product) => normalizeSearch([
    product.codigo,
    product.nombre,
    product.categoria,
    product.marca,
    product.descripcion,
    ...(product.compatibilidad || []),
    ...(product.referencias || [])
  ].filter(Boolean).join(" "));

  const visibleProducts = () => {
    const terms = normalizeSearch(search.value).trim().split(/\s+/).filter(Boolean);
    return products.filter((product) => {
      const categoryMatches = activeCategory === "Todos" || product.categoria === activeCategory;
      const haystack = searchableText(product);
      const searchMatches = terms.every((term) => haystack.includes(term));
      return categoryMatches && searchMatches;
    });
  };

  const showToast = (message) => {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2300);
  };

  const whatsappUrl = (product) => {
    const message = [
      `Hola, consulto por ${product.nombre}.`,
      `Código: ${product.codigo}.`,
      `Enlace: ${productUrl(product)}`,
      "Mi vehículo es:"
    ].join(" ");
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`;
  };

  const promotionText = (product) => {
    const compatibility = (product.compatibilidad || []).slice(0, 2).join(" · ");
    return [
      "🔧 REPUESTO DISPONIBLE | MECÁNICA KEIKO",
      `✅ ${product.nombre}`,
      `Código: ${product.codigo}`,
      `Precio: ${priceText(product)}`,
      compatibility ? `Compatible con: ${compatibility}` : "",
      "📍 Archidona, Napo",
      "💬 Confirma compatibilidad y disponibilidad por WhatsApp.",
      `🔗 Fotos y detalles: ${productUrl(product)}`
    ].filter(Boolean).join("\n");
  };

  const loadImage = (src) => new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = new URL(src, document.baseURI).toString();
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
      else if (lines.length < maxLines - 1) {
        lines.push(line);
        line = word;
      } else {
        truncated = true;
        break;
      }
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
    const medium = (product.medios || []).find((item) => item.tipo === "imagen");
    if (!medium) return null;
    const image = await loadImage(medium.src);
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
    return blob ? new File([blob], `${product.id}-mecanica-keiko.jpg`, { type: "image/jpeg" }) : null;
  };

  const downloadFile = (file) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copyPromotionText = async (product) => {
    try {
      await navigator.clipboard.writeText(promotionText(product));
      return true;
    } catch {
      return false;
    }
  };

  const downloadPromotion = async (product) => {
    try {
      const promotionFile = await createPromotionFile(product);
      if (!promotionFile) {
        showToast("Este repuesto aún no tiene una foto para promocionar");
        return;
      }
      downloadFile(promotionFile);
      const copied = await copyPromotionText(product);
      showToast(copied ? "Imagen descargada y texto con enlace copiado" : "Imagen promocional descargada");
    } catch {
      showToast("No se pudo preparar la imagen promocional");
    }
  };

  const shareProduct = async (product) => {
    const shareData = { title: productLabel(product), text: promotionText(product), url: productUrl(product) };
    try {
      const promotionFile = await createPromotionFile(product);
      await copyPromotionText(product);
      const canSharePromotion = Boolean(promotionFile && navigator.share && navigator.canShare?.({ files: [promotionFile] }));
      if (canSharePromotion) {
        shareData.files = [promotionFile];
        await navigator.share(shareData);
      } else if (navigator.share) {
        await navigator.share(shareData);
      } else {
        if (promotionFile) downloadFile(promotionFile);
        showToast("Promoción lista: imagen descargada y texto con enlace copiado");
      }
    } catch (error) {
      if (error?.name !== "AbortError") showToast("No se pudo preparar la promoción");
    }
  };

  const renderFilters = () => {
    const categories = ["Todos", ...new Set(products.map((product) => product.categoria).filter(Boolean))];
    filters.innerHTML = categories.map((category) => `
      <button class="filter-button${category === activeCategory ? " is-active" : ""}" type="button" data-category="${escapeHtml(category)}" aria-pressed="${category === activeCategory}">
        ${escapeHtml(category)}
      </button>
    `).join("");
  };

  const cardTemplate = (product) => {
    const media = product.medios?.[0];
    const mediaCount = product.medios?.length || 0;
    const tags = [product.categoria, ...(product.compatibilidad || []).slice(0, 2)].filter(Boolean);
    return `
      <article class="product-card" id="producto-${escapeHtml(product.id)}" data-product-id="${escapeHtml(product.id)}">
        <button class="product-media" type="button" data-open-product="${escapeHtml(product.id)}" aria-label="Ver detalles de ${escapeHtml(product.nombre)}">
          ${mediaElement(media, productLabel(product))}
          ${mediaCount > 1 ? `<span class="media-count">${mediaCount} fotos/videos</span>` : ""}
        </button>
        <div class="product-body">
          <div class="product-meta">
            <span class="product-code">${escapeHtml(product.codigo)}</span>
            <span class="product-price">${escapeHtml(priceText(product))}</span>
          </div>
          <h3>${escapeHtml(product.nombre)}</h3>
          <p>${escapeHtml(product.descripcionCorta || product.descripcion || "Consulta disponibilidad y compatibilidad.")}</p>
          <div class="product-tags">
            ${tags.map((tag) => `<span class="product-tag">${escapeHtml(tag)}</span>`).join("")}
          </div>
          <div class="product-actions">
            <a class="button button-whatsapp" href="${whatsappUrl(product)}" target="_blank" rel="noopener">Consultar por WhatsApp</a>
            <button class="button share-button" type="button" data-share-product="${escapeHtml(product.id)}" aria-label="Compartir ${escapeHtml(product.nombre)}">↗</button>
          </div>
        </div>
      </article>
    `;
  };

  const renderProducts = () => {
    const result = visibleProducts();
    status.textContent = result.length === 1 ? "1 producto encontrado" : `${result.length} productos encontrados`;
    if (!result.length) {
      grid.innerHTML = `<div class="catalog-empty">No encontramos esa referencia. Escríbenos por WhatsApp y la revisamos.</div>`;
      return;
    }
    grid.innerHTML = result.map(cardTemplate).join("");
  };

  const setMainMedia = (product, index) => {
    const target = dialogContent.querySelector("#dialog-main-media");
    if (!target) return;
    const total = product.medios.length;
    activeMediaIndex = ((index % total) + total) % total;
    const medium = product.medios[activeMediaIndex];
    target.innerHTML = mediaElement(medium, productLabel(product), { controls: true, fit: "contain" });
    fitMainImage(target);
    dialogContent.querySelectorAll(".dialog-thumb").forEach((thumb, thumbIndex) => {
      const selected = thumbIndex === activeMediaIndex;
      thumb.classList.toggle("is-active", selected);
      thumb.setAttribute("aria-pressed", String(selected));
    });
    const counter = dialogContent.querySelector("[data-media-counter]");
    if (counter) counter.textContent = `${activeMediaIndex + 1} / ${total}`;
  };

  const closeImageZoom = () => {
    const zoom = dialogContent.querySelector("[data-image-zoom]");
    if (!zoom) return;
    zoom.hidden = true;
    imageZoomScale = 1;
  };

  const updateImageZoom = () => {
    const image = dialogContent.querySelector("[data-image-zoom] img");
    const label = dialogContent.querySelector("[data-zoom-level]");
    if (image) image.style.transform = `scale(${imageZoomScale})`;
    if (label) label.textContent = `${Math.round(imageZoomScale * 100)}%`;
  };

  const openImageZoom = () => {
    const medium = activeProduct?.medios?.[activeMediaIndex];
    if (!medium || medium.tipo === "video") return;
    const zoom = dialogContent.querySelector("[data-image-zoom]");
    const image = zoom?.querySelector("img");
    if (!zoom || !image) return;
    image.src = medium.src;
    image.alt = productLabel(activeProduct);
    imageZoomScale = 1;
    zoom.hidden = false;
    updateImageZoom();
  };

  const stepMedia = (step) => {
    if (!activeProduct?.medios?.length) return;
    setMainMedia(activeProduct, activeMediaIndex + step);
  };

  const openProduct = (product) => {
    activeProduct = product;
    activeMediaIndex = 0;
    const compatibility = product.compatibilidad || [];
    const references = product.referencias || [];
    const media = product.medios || [];
    const fullDescription = product.descripcion || "Consulta disponibilidad y compatibilidad antes de comprar.";
    const summarySource = product.descripcionCorta || fullDescription;
    const summary = compactText(summarySource);
    const hasMoreDescription = fullDescription !== summarySource || summarySource.length > summary.length;

    dialogContent.innerHTML = `
      <div class="dialog-layout">
        <div class="dialog-gallery">
          <div class="dialog-main-media" id="dialog-main-media">${mediaElement(media[0], productLabel(product), { controls: true, fit: "contain" })}</div>
          ${media.length > 1 ? `
            <button class="dialog-nav dialog-nav-prev" type="button" data-media-step="-1" aria-label="Ver imagen anterior">‹</button>
            <button class="dialog-nav dialog-nav-next" type="button" data-media-step="1" aria-label="Ver imagen siguiente">›</button>
            <span class="dialog-counter" data-media-counter aria-live="polite">1 / ${media.length}</span>
          ` : ""}
          ${media.length > 1 ? `<div class="dialog-thumbs">${media.map((medium, index) => `
            <button class="dialog-thumb${index === 0 ? " is-active" : ""}" type="button" data-media-index="${index}" aria-label="Ver archivo ${index + 1}" aria-pressed="${index === 0}">
              ${mediaElement(medium, "", { controls: false })}
            </button>`).join("")}</div>` : ""}
          ${media[0] && media[0].tipo !== "video" ? `<button class="dialog-zoom-trigger" type="button" data-open-image-zoom aria-label="Ampliar foto">⌕ <span>Ampliar</span></button>` : ""}
          <section class="dialog-image-zoom" data-image-zoom hidden aria-label="Foto ampliada">
            <button class="dialog-image-zoom-close" type="button" data-close-image-zoom aria-label="Cerrar ampliación">×</button>
            <div class="dialog-image-zoom-canvas"><img src="" alt=""></div>
            <div class="dialog-image-zoom-controls"><button type="button" data-zoom-step="-0.25" aria-label="Alejar">−</button><span data-zoom-level>100%</span><button type="button" data-zoom-step="0.25" aria-label="Acercar">+</button></div>
          </section>
        </div>
        <div class="dialog-copy">
          <div class="dialog-copy-scroll">
            <p class="eyebrow">${escapeHtml(product.categoria || "Repuesto disponible")}</p>
            <h2 id="dialog-title">${escapeHtml(product.nombre)}</h2>
            <p class="dialog-summary">${escapeHtml(summary)}</p>
            <div class="dialog-key-facts"><span><strong>Código</strong>${escapeHtml(product.codigo)}</span>${product.marca ? `<span><strong>Marca</strong>${escapeHtml(product.marca)}</span>` : ""}${typeof product.stock === "number" ? `<span><strong>Stock</strong>${escapeHtml(product.stock)}</span>` : ""}</div>
            <div class="dialog-price">${escapeHtml(priceText(product))}</div>
            ${hasMoreDescription ? `<details class="dialog-accordion" open><summary>Descripción del repuesto</summary><p>${escapeHtml(fullDescription)}</p></details>` : ""}
            ${compatibility.length ? `<details class="dialog-accordion" open><summary>Compatibilidad <span>${compatibility.length}</span></summary><ul>${compatibility.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></details>` : ""}
            ${references.length ? `<details class="dialog-accordion"><summary>Referencias y equivalencias <span>${references.length}</span></summary><ul>${references.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></details>` : ""}
            <div class="dialog-buttons">
              <button class="button button-red" type="button" data-share-current>Compartir promoción</button>
              <button class="button button-light" type="button" data-download-promotion>Descargar imagen promocional</button>
            </div>
            <p class="promotion-note">En celular se abre el menú para compartir con imagen, texto y enlace. El enlace lleva a este repuesto en la web.</p>
          </div>
          <div class="dialog-primary-action"><a class="button button-whatsapp" href="${whatsappUrl(product)}" target="_blank" rel="noopener">Consultar este repuesto</a></div>
        </div>
      </div>
    `;

    dialogContent.querySelectorAll("[data-media-index]").forEach((button) => {
      button.addEventListener("click", () => setMainMedia(product, Number(button.dataset.mediaIndex)));
    });
    dialogContent.querySelectorAll("[data-media-step]").forEach((button) => {
      button.addEventListener("click", () => stepMedia(Number(button.dataset.mediaStep)));
    });
    fitMainImage(dialogContent.querySelector("#dialog-main-media"));
    dialogContent.querySelector("[data-open-image-zoom]")?.addEventListener("click", openImageZoom);
    dialogContent.querySelector("[data-close-image-zoom]")?.addEventListener("click", closeImageZoom);
    dialogContent.querySelectorAll("[data-zoom-step]").forEach((button) => button.addEventListener("click", () => {
      imageZoomScale = Math.max(1, Math.min(3, imageZoomScale + Number(button.dataset.zoomStep)));
      updateImageZoom();
    }));
    const mainMedia = dialogContent.querySelector("#dialog-main-media");
    mainMedia?.addEventListener("touchstart", (event) => {
      touchStartX = event.changedTouches[0]?.clientX ?? null;
    }, { passive: true });
    mainMedia?.addEventListener("touchend", (event) => {
      if (touchStartX === null) return;
      const distance = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
      touchStartX = null;
      if (Math.abs(distance) >= 45) stepMedia(distance < 0 ? 1 : -1);
    }, { passive: true });
    dialogContent.querySelector("[data-share-current]")?.addEventListener("click", () => shareProduct(product));
    dialogContent.querySelector("[data-download-promotion]")?.addEventListener("click", () => downloadPromotion(product));
    lockPageScroll();
    dialog.showModal();
  };

  const productById = (id) => products.find((product) => product.id === id);

  const remoteMedia = async (paths = []) => {
    const config = window.KEIKO_CONFIG || {};
    if (!config.supabaseUrl || !config.supabaseAnonKey || !paths.length) return [];
    const headers = { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}`, "Content-Type": "application/json" };
    return Promise.all(paths.map(async (path) => {
      try {
        const response = await fetch(`${config.supabaseUrl}/storage/v1/object/sign/inventario/${encodeURIComponent(path).replaceAll("%2F", "/")}`, {
          method: "POST", headers, body: JSON.stringify({ expiresIn: 604800 })
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.signedURL) return null;
        return { tipo: "imagen", src: `${config.supabaseUrl}/storage/v1${body.signedURL}`, nombre: path.split("/").at(-1) || "foto" };
      } catch { return null; }
    })).then((items) => items.filter(Boolean));
  };

  const loadPanelProducts = async () => {
    const config = window.KEIKO_CONFIG || {};
    if (!/^https:\/\//.test(config.supabaseUrl || "") || !config.supabaseAnonKey) return [];
    const response = await fetch(`${config.supabaseUrl}/rest/v1/productos_admin?revision=eq.publicado&select=id,codigo,nombre,cantidad,precio,marca,categoria,descripcion_corta,descripcion,compatibilidad,referencias,fotos&order=actualizado.desc`, {
      headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}` }
    });
    if (!response.ok) throw new Error("No se pudo cargar los productos publicados del panel.");
    const rows = await response.json();
    const cleanTextList = (values = []) => values
      .map((value) => String(value ?? "").trim())
      .filter((value) => value && value !== "[object Object]");
    return Promise.all(rows.map(async (row) => ({
      id: row.id,
      codigo: row.codigo,
      nombre: row.nombre,
      categoria: row.categoria || "Repuesto disponible",
      marca: row.marca || "",
      precio: row.precio === null ? "Consultar" : Number(row.precio),
      moneda: "USD",
      estado: "Disponible — confirmar antes de comprar",
      stock: Number(row.cantidad || 0),
      descripcionCorta: row.descripcion_corta || row.descripcion || "Consulta disponibilidad y compatibilidad.",
      descripcion: row.descripcion || "Consulta disponibilidad y compatibilidad antes de comprar.",
      compatibilidad: cleanTextList(row.compatibilidad),
      referencias: cleanTextList(row.referencias),
      destacado: false,
      publicado: true,
      origen: "panel",
      medios: await remoteMedia(row.fotos)
    })));
  };

  filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    activeCategory = button.dataset.category;
    renderFilters();
    renderProducts();
  });

  search.addEventListener("input", renderProducts);

  grid.addEventListener("click", (event) => {
    const share = event.target.closest("[data-share-product]");
    if (share) {
      const product = productById(share.dataset.shareProduct);
      if (product) shareProduct(product);
      return;
    }
    const opener = event.target.closest("[data-open-product]");
    if (opener) {
      const product = productById(opener.dataset.openProduct);
      if (product) openProduct(product);
    }
  });

  grid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const opener = event.target.closest("[data-open-product]");
    if (!opener) return;
    event.preventDefault();
    const product = productById(opener.dataset.openProduct);
    if (product) openProduct(product);
  });

  closeDialog?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dialogContent.querySelector("[data-image-zoom]")?.hidden) {
      event.preventDefault();
      closeImageZoom();
      return;
    }
    if (event.key === "ArrowLeft") stepMedia(-1);
    if (event.key === "ArrowRight") stepMedia(1);
  });
  dialog.addEventListener("close", () => {
    activeProduct = null;
    activeMediaIndex = 0;
    touchStartX = null;
    imageZoomScale = 1;
    unlockPageScroll();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  Promise.all([
    fetch(`data/catalogo.json?v=${Date.now()}`).then((response) => {
      if (!response.ok) throw new Error("No se pudo cargar el catálogo");
      return response.json();
    }),
    loadPanelProducts().catch(() => [])
  ])
    .then(([data, panelProducts]) => {
      const staticProducts = (data.productos || [])
        .filter((product) => product.publicado !== false && !panelProducts.some((panelProduct) => String(panelProduct.codigo || "").trim().toUpperCase() === String(product.codigo || "").trim().toUpperCase()))
        .sort((a, b) => Number(Boolean(b.destacado)) - Number(Boolean(a.destacado)) || (a.orden || 99) - (b.orden || 99));
      products = [...panelProducts, ...staticProducts];
      renderFilters();
      renderProducts();

      const requestedId = new URLSearchParams(window.location.search).get("producto");
      const requested = requestedId && productById(requestedId);
      if (requested) {
        requestAnimationFrame(() => {
          const card = document.querySelector(`#producto-${CSS.escape(requested.id)}`);
          card?.classList.add("is-targeted");
          card?.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => openProduct(requested), 450);
        });
      }
    })
    .catch(() => {
      status.textContent = "No fue posible cargar el catálogo.";
      grid.innerHTML = `<div class="catalog-empty">Escríbenos por WhatsApp para consultar el inventario disponible.</div>`;
    });
})();
