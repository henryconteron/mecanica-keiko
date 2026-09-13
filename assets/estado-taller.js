(() => {
  const card = document.querySelector("#workshop-status");
  if (!card) return;
  const heroVisual = card.closest(".hero-visual");

  const label = card.querySelector("#workshop-status-label");
  const message = card.querySelector("#workshop-status-message");
  const updated = card.querySelector("#workshop-status-updated");
  const action = card.querySelector("#workshop-status-action");
  const timeZone = "America/Guayaquil";
  const stateAliases = { disponible: "available", limitado: "limited", ocupado: "busy", cerrado: "closed", automatico: "automatico" };
  let configuration = { estado: "automatico", mensaje: "", actualizado: "" };

  const states = {
    available: {
      label: "Disponible ahora",
      message: "Podemos recibir tu vehículo. Escríbenos antes de venir para reservar tu espacio.",
      action: "Reservar espacio por WhatsApp"
    },
    limited: {
      label: "Quedan pocos espacios",
      message: "Estamos atendiendo vehículos, pero todavía podríamos recibirte. Confirma tu llegada por WhatsApp.",
      action: "Consultar un espacio"
    },
    busy: {
      label: "Taller ocupado",
      message: "En este momento estamos a capacidad completa. Escríbenos para coordinar el siguiente turno disponible.",
      action: "Solicitar el próximo turno"
    },
    closed: {
      label: "Cerrado ahora",
      message: "Déjanos un mensaje y te responderemos en el próximo horario de atención.",
      action: "Dejar un mensaje"
    },
    automatico: {
      label: "Taller abierto",
      message: "Estamos dentro del horario de atención. Confirma por WhatsApp si hay un espacio disponible antes de venir.",
      action: "Confirmar disponibilidad"
    }
  };

  const localTime = () => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return { weekday: values.weekday, minutes: Number(values.hour) * 60 + Number(values.minute) };
  };

  const isOpen = () => {
    const { weekday, minutes } = localTime();
    if (["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday)) return minutes >= 480 && minutes < 1020;
    if (weekday === "Sat") return minutes >= 480 && minutes < 780;
    return false;
  };

  const formatUpdate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `Estado actualizado: ${new Intl.DateTimeFormat("es-EC", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(date)}`;
  };

  const render = () => {
    const configured = stateAliases[configuration.estado] || "automatico";
    const state = configured === "automatico" ? (isOpen() ? "automatico" : "closed") : configured;
    const view = states[state];
    const visualState = state === "automatico" ? "limited" : state;
    card.dataset.state = visualState;
    if (heroVisual) heroVisual.dataset.workshopState = visualState;
    label.textContent = view.label;
    message.textContent = configuration.mensaje && configured !== "automatico" ? configuration.mensaje : view.message;
    action.textContent = view.action;
    updated.textContent = configured === "automatico" ? "Actualización automática según horario" : formatUpdate(configuration.actualizado);
  };

  fetch(`data/estado-taller.json?v=${Date.now()}`, { cache: "no-store" })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error("Estado no disponible")))
    .then((data) => { configuration = data; })
    .catch(() => {})
    .finally(render);

  render();
  window.setInterval(render, 60000);
})();
