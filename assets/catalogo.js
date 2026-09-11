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
  let toastTimer;

  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const productUrl = (product) => {
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

  const mediaElement = (medium, alt, options = {}) => {
    if (!medium) return `<span aria-hidden="true">Sin foto</span>`;
    if (medium.tipo === "video") {
      return `<video src="${escapeHtml(medium.src)}" ${options.controls ? "controls" : "muted playsinline preload=\"metadata\""} aria-label="${escapeHtml(alt)}"></video>`;
    }
    return `<img src="${escapeHtml(medium.src)}" alt="${escapeHtml(alt)}" loading="lazy">`;
  };

  const normalizeSearch = (value = "") => String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");

  const productLabel = (product) => normalizeSearch(product.nombre).includes(normalizeSearch(product.codigo))
    ? product.nombre
    : `${product.nombre} ${product.codigo}`;

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

  const shareProduct = async (product) => {
    const shareData = {
      title: productLabel(product),
      text: `${product.nombre} — código ${product.codigo} — ${priceText(product)}`,
      url: productUrl(product)
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        showToast("Enlace del producto copiado");
      }
    } catch (error) {
      if (error?.name !== "AbortError") showToast("No se pudo compartir el enlace");
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
    target.innerHTML = mediaElement(medium, productLabel(product), { controls: true });
    dialogContent.querySelectorAll(".dialog-thumb").forEach((thumb, thumbIndex) => {
      const selected = thumbIndex === activeMediaIndex;
      thumb.classList.toggle("is-active", selected);
      thumb.setAttribute("aria-pressed", String(selected));
    });
    const counter = dialogContent.querySelector("[data-media-counter]");
    if (counter) counter.textContent = `${activeMediaIndex + 1} / ${total}`;
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
    const details = [
      ...compatibility.map((item) => `Compatible con: ${item}`),
      ...references.map((item) => `Referencia: ${item}`),
      product.estado ? `Estado: ${product.estado}` : "",
      typeof product.stock === "number" ? `Stock registrado: ${product.stock}` : ""
    ].filter(Boolean);
    const media = product.medios || [];
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl(product))}`;

    dialogContent.innerHTML = `
      <div class="dialog-layout">
        <div class="dialog-gallery">
          <div class="dialog-main-media" id="dialog-main-media">${mediaElement(media[0], productLabel(product), { controls: true })}</div>
          ${media.length > 1 ? `
            <button class="dialog-nav dialog-nav-prev" type="button" data-media-step="-1" aria-label="Ver imagen anterior">‹</button>
            <button class="dialog-nav dialog-nav-next" type="button" data-media-step="1" aria-label="Ver imagen siguiente">›</button>
            <span class="dialog-counter" data-media-counter aria-live="polite">1 / ${media.length}</span>
          ` : ""}
          ${media.length > 1 ? `<div class="dialog-thumbs">${media.map((medium, index) => `
            <button class="dialog-thumb${index === 0 ? " is-active" : ""}" type="button" data-media-index="${index}" aria-label="Ver archivo ${index + 1}" aria-pressed="${index === 0}">
              ${mediaElement(medium, "", { controls: false })}
            </button>`).join("")}</div>` : ""}
        </div>
        <div class="dialog-copy">
          <div class="dialog-copy-scroll">
            <p class="eyebrow">${escapeHtml(product.categoria || "Repuesto disponible")}</p>
            <h2 id="dialog-title">${escapeHtml(product.nombre)}</h2>
            <p><strong>Código:</strong> ${escapeHtml(product.codigo)}</p>
            <div class="dialog-price">${escapeHtml(priceText(product))}</div>
            <p>${escapeHtml(product.descripcion || "Consulta el estado y la compatibilidad antes de comprar.")}</p>
            ${details.length ? `<ul class="dialog-list">${details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>` : ""}
            <div class="dialog-buttons">
            <button class="button button-red" type="button" data-share-current>Compartir enlace</button>
            <a class="button" href="${facebookUrl}" target="_blank" rel="noopener">Compartir en Facebook</a>
            </div>
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
    dialog.showModal();
  };

  const productById = (id) => products.find((product) => product.id === id);

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
    if (event.key === "ArrowLeft") stepMedia(-1);
    if (event.key === "ArrowRight") stepMedia(1);
  });
  dialog.addEventListener("close", () => {
    activeProduct = null;
    activeMediaIndex = 0;
    touchStartX = null;
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  fetch(`data/catalogo.json?v=${Date.now()}`)
    .then((response) => {
      if (!response.ok) throw new Error("No se pudo cargar el catálogo");
      return response.json();
    })
    .then((data) => {
      products = (data.productos || [])
        .filter((product) => product.publicado !== false)
        .sort((a, b) => Number(Boolean(b.destacado)) - Number(Boolean(a.destacado)) || (a.orden || 99) - (b.orden || 99));
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
