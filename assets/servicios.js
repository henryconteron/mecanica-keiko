(() => {
  const PHONE = "593939876118";
  const grid = document.querySelector("#services-grid");
  const dialog = document.querySelector("#service-dialog");
  const dialogContent = document.querySelector("#service-dialog-content");
  const closeDialog = document.querySelector("#service-dialog-close");

  if (!grid || !dialog || !dialogContent) return;

  let services = [];

  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const mediaElement = (medium, alt, options = {}) => {
    if (!medium) return "";
    if (medium.tipo === "video") {
      return `<video src="${escapeHtml(medium.src)}" ${options.controls ? "controls" : "muted playsinline preload=\"metadata\""} aria-label="${escapeHtml(alt)}"></video>`;
    }
    return `<img src="${escapeHtml(medium.src)}" alt="${escapeHtml(alt)}" loading="lazy">`;
  };

  const cardTemplate = (service) => {
    const media = service.medios || [];
    const cover = media[0];
    const countLabel = media.length === 1 ? "1 foto/video" : `${media.length} fotos/videos`;

    return `
      <article class="service-card${cover ? " has-media" : ""}" data-service-id="${escapeHtml(service.id)}">
        ${cover ? `
          <button class="service-media" type="button" data-open-service="${escapeHtml(service.id)}" aria-label="Ver fotos y videos de ${escapeHtml(service.nombre)}">
            ${mediaElement(cover, `${service.nombre} en Tecnicentro Keiko`)}
            <span class="media-count">${countLabel}</span>
          </button>
        ` : ""}
        <div class="service-body">
          <span class="service-number">${escapeHtml(service.numero)}</span>
          <h3>${escapeHtml(service.nombre)}</h3>
          <p>${escapeHtml(service.descripcion)}</p>
          ${cover ? `<button class="service-gallery-link" type="button" data-open-service="${escapeHtml(service.id)}">Ver trabajo realizado <span aria-hidden="true">→</span></button>` : ""}
        </div>
      </article>
    `;
  };

  const setMainMedia = (service, index) => {
    const target = dialogContent.querySelector("#service-dialog-main-media");
    if (!target) return;
    const medium = service.medios[index];
    target.innerHTML = mediaElement(medium, `${service.nombre} en Tecnicentro Keiko`, { controls: true });
    dialogContent.querySelectorAll(".dialog-thumb").forEach((thumb, thumbIndex) => {
      thumb.classList.toggle("is-active", thumbIndex === index);
    });
  };

  const openService = (service) => {
    const media = service.medios || [];
    if (!media.length) return;
    const message = encodeURIComponent(`Hola, vi el servicio de ${service.nombre} en la página de Tecnicentro Keiko y deseo consultar para mi vehículo.`);

    dialogContent.innerHTML = `
      <div class="dialog-layout">
        <div class="dialog-gallery">
          <div class="dialog-main-media" id="service-dialog-main-media">${mediaElement(media[0], `${service.nombre} en Tecnicentro Keiko`, { controls: true })}</div>
          ${media.length > 1 ? `<div class="dialog-thumbs">${media.map((medium, index) => `
            <button class="dialog-thumb${index === 0 ? " is-active" : ""}" type="button" data-service-media-index="${index}" aria-label="Ver archivo ${index + 1}">
              ${mediaElement(medium, "")}
            </button>`).join("")}</div>` : ""}
        </div>
        <div class="dialog-copy">
          <div class="dialog-copy-scroll">
            <p class="eyebrow">Servicio ${escapeHtml(service.numero)}</p>
            <h2 id="service-dialog-title">${escapeHtml(service.nombre)}</h2>
            <p>${escapeHtml(service.descripcion)}</p>
            <p class="service-dialog-note">Fotos y videos reales de trabajos realizados en el taller.</p>
            <div class="dialog-buttons">
            <a class="button button-red" href="tel:+${PHONE}">Llamar al mecánico</a>
            </div>
          </div>
          <div class="dialog-primary-action"><a class="button button-whatsapp" href="https://wa.me/${PHONE}?text=${message}" target="_blank" rel="noopener">Consultar este servicio</a></div>
        </div>
      </div>
    `;

    dialogContent.querySelectorAll("[data-service-media-index]").forEach((button) => {
      button.addEventListener("click", () => setMainMedia(service, Number(button.dataset.serviceMediaIndex)));
    });
    dialog.showModal();
  };

  const serviceById = (id) => services.find((service) => service.id === id);

  grid.addEventListener("click", (event) => {
    const opener = event.target.closest("[data-open-service]");
    if (!opener) return;
    const service = serviceById(opener.dataset.openService);
    if (service) openService(service);
  });

  closeDialog?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  fetch(`data/servicios.json?v=${Date.now()}`)
    .then((response) => {
      if (!response.ok) throw new Error("No se pudieron cargar los servicios");
      return response.json();
    })
    .then((data) => {
      services = (data.servicios || [])
        .filter((service) => service.publicado !== false)
        .sort((a, b) => (a.orden || 99) - (b.orden || 99));
      if (services.length) grid.innerHTML = services.map(cardTemplate).join("");
    })
    .catch(() => {
      // El contenido estático del HTML queda visible si el archivo aún no se ha generado.
    });
})();
