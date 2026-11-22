(() => {
  "use strict";

  const state = {
    payload: null,
    layout: null,
    catalog: null,
    view: "all",
    areaId: null,
    configDirty: false,
    loading: false,
    timer: null,
    photoSyncTimer: null,
    photoIdleTimer: null,
    photoTimer: null,
    photos: [],
    photoIndex: 0,
    photoFrameVisible: false,
    photoConfig: null,
  };
  const $ = (selector) => document.querySelector(selector);
  const roomList = $("#room-list");
  const photoFrame = $("#photo-frame");
  const photoImage = $("#photo-frame-image");
  const photoName = $("#photo-frame-name");

  const ICONS = {
    light: "light",
    switch: "switch",
    fan: "fan",
    cover: "cover",
    climate: "climate",
    sensor: "sensor",
    binary_sensor: "sensor",
    media_player: "media",
    scene: "scene",
    script: "script",
    garage: "garage",
    energy: "energy",
  };

  const ICON_PATHS = {
    light: '<path d="M9 17.5h6M10 20.5h4M8.6 14.5c-1.3-1.1-2.1-2.7-2.1-4.6a5.5 5.5 0 0 1 11 0c0 1.9-.8 3.5-2.1 4.6-.8.7-1.2 1.3-1.3 2.1h-4.2c-.1-.8-.5-1.4-1.3-2.1Z"/>',
    sink: '<path d="M4 11.5h16M6 11.5V8a2 2 0 0 1 4 0v1M10 9h8M4 11.5v1.5a5 5 0 0 0 5 5h6a5 5 0 0 0 5-5v-1.5M8 20h8"/>',
    hood: '<path d="M6 5h12v4H6zM4 9h16l1.5 8H2.5L4 9ZM8 20h8"/>',
    fan: '<circle cx="12" cy="12" r="2.2"/><path d="M12 9.5C9 4 14 2.7 15.5 5.4 16.7 7.6 14 10 12 9.5ZM14.5 12c5.5-3 6.8 2 4.1 3.5-2.2 1.2-4.6-1.5-4.1-3.5ZM12 14.5c3 5.5-2 6.8-3.5 4.1C7.3 16.4 10 13.9 12 14.5Z"/>',
    cover: '<path d="M4 4h16v16H4zM7 8h10M7 12h10M7 16h10"/>',
    climate: '<path d="M8 4v16M5 7l3 3 3-3M5 17l3-3 3 3M16 4v16M13 7l3 3 3-3M13 17l3-3 3 3"/>',
    sensor: '<circle cx="12" cy="12" r="3"/><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
    media: '<path d="M8 5v14l11-7L8 5Z"/><path d="M4 5v14"/>',
    tv: '<rect x="3" y="5" width="18" height="12" rx="1.5"/><path d="M8 21h8M12 17v4"/>',
    car: '<path d="m5 16 1.5-5h11L19 16M4 16h16v4H4zM7 20v1M17 20v1M7.5 15h.1M16.4 15h.1"/>',
    energy: '<path d="m13 2-8 12h6l-1 8 8-12h-6l1-8Z"/>',
    outdoor: '<path d="M12 21V9M12 11 7 6M12 14l5-5M8 21h8M5 8c1.4-2.2 3.5-3.2 6-3M19 8c-1.4-2.2-3.5-3.2-6-3"/>',
    kitchen: '<path d="M5 4v7M8 4v7M11 4v7M8 11v9M17 4v16M17 4c2 1.4 2 4 0 5"/>',
    garage: '<path d="M4 20V8l8-5 8 5v12M7 20v-6h10v6M9 11h6"/>',
    switch: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M12 7v5M9 16h6"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2"/>',
    button: '<circle cx="12" cy="12" r="7"/><path d="m12 8 2.5 4-2.5 4-2.5-4L12 8Z"/>',
    scene: '<path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3ZM19 16l.6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z"/>',
    script: '<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>',
  };

  // Room pages are meant for touch control, not for dumping every diagnostic
  // entity from Home Assistant into the DOM. Sensors remain available to the
  // dedicated energy/garage views, while room pages stay quick to paint.
  const ROOM_DOMAINS = new Set([
    "light",
    "switch",
    "fan",
    "input_boolean",
    "cover",
    "lock",
    "button",
    "media_player",
    "climate",
    "vacuum",
  ]);

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const entityAttributes = (entity) => entity?.attributes || {};
  const entityUnit = (entity) => entityAttributes(entity).unit_of_measurement || "";

  function svgIcon(kind, className = "") {
    const path = ICON_PATHS[kind] || ICON_PATHS.sensor;
    return `<svg class="icon-svg ${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${path}</svg>`;
  }

  function roomIcon(key) {
    return svgIcon(key === "cozinha" ? "kitchen" : key === "externo" ? "outdoor" : "garage");
  }

  function friendlyEntityName(entity) {
    const raw = String(entity?.name || entity?.entity_id || "Dispositivo");
    const lower = raw.toLowerCase();
    if (lower.includes("charge control") || lower.includes("carga ring")) return "Carregamento";
    if (lower.includes("availability") || lower.includes("available")) return "Disponibilidade";
    if (lower.includes("reset")) return "Reset";
    if (lower.includes("unlock")) return "Destravar";
    if (lower.includes("pia")) return "Pia";
    if (lower.includes("coifa")) return "Coifa";
    if (lower.includes("bancada")) return "Bancada";
    if (lower.includes("cristaleira")) return "Cristaleira";
    if (lower.includes("led")) return "Led";
    if (lower.includes("árvore") || lower.includes("arvore")) return "Árvore entrada";

    let name = raw.replace(/^charger\s+/i, "");
    const area = String(entity?.area_name || "").trim();
    if (area) name = name.replace(new RegExp(`\\s+${area.replace(/[.*+?^${}()|[\\]\\]/g, "\\\\$&")}$`, "i"), "");
    return name.trim() || raw;
  }

  function spotifyLogo() {
    return '<svg class="spotify-logo" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5.1 9.2c4.3-1.3 9.6-.9 13.8 1.1M6.3 13c3.4-1 7.4-.7 10.7.9M7.5 16.6c2.5-.6 5.1-.4 7.4.7"/></svg>';
  }

  function iconFor(entity) {
    const domain = entity?.domain || "sensor";
    const custom = String(entity?.icon || "");
    const text = `${entity?.name || ""} ${entity?.entity_id || ""} ${custom}`.toLowerCase();
    if (text.includes("pia")) return svgIcon("sink");
    if (text.includes("coifa") || text.includes("hood")) return svgIcon("hood");
    if (text.includes("tv") || text.includes("televis")) return svgIcon("tv");
    if (text.includes("charger") || text.includes("carga") || text.includes("carreg") || text.includes("volvo")) return svgIcon("car");
    if (text.includes("portão") || text.includes("portao") || text.includes("gate")) return svgIcon("cover");
    if (custom.includes("lightbulb") || domain === "light") return svgIcon("light");
    if (custom.includes("speaker") || custom.includes("music")) return svgIcon("media");
    return svgIcon(ICONS[domain] || "sensor");
  }

  function areaIcon(area) {
    const text = `${area?.name || ""} ${area?.id || ""}`.toLowerCase();
    if (text.includes("coz")) return roomIcon("cozinha");
    if (text.includes("extern") || text.includes("pisc")) return roomIcon("externo");
    if (text.includes("cinema") || text.includes("tv")) return svgIcon("tv");
    if (text.includes("escrit")) return svgIcon("climate");
    if (text.includes("quarto") || text.includes("sala")) return svgIcon("light");
    return svgIcon("kitchen");
  }

  function humanState(entity) {
    const raw = String(entity?.state ?? "unknown");
    const labels = {
      on: "Ligado",
      off: "Desligado",
      playing: "Reproduzindo",
      paused: "Pausado",
      idle: "Parado",
      unavailable: "Indisponível",
      unknown: "Sem leitura",
      open: "Aberto",
      closed: "Fechado",
      locked: "Trancado",
      unlocked: "Destrancado",
    };
    return labels[raw] || raw;
  }

  function displayValue(entity) {
    const raw = String(entity?.state ?? "unknown");
    if (["unknown", "unavailable", "none"].includes(raw)) return "Sem leitura";
    if (["on", "off", "playing", "paused", "idle", "open", "closed", "locked", "unlocked"].includes(raw)) {
      return humanState(entity);
    }
    return `${esc(raw)}${entityUnit(entity) ? `<span class="unit">${esc(entityUnit(entity))}</span>` : ""}`;
  }

  function isOn(entity) {
    return ["on", "playing", "open", "unlocked", "home"].includes(String(entity?.state));
  }

  function isPlaying(entity) {
    return ["playing"].includes(String(entity?.state));
  }

  function formatUpdated(iso) {
    if (!iso) return "—";
    try {
      return `Atualizado ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso))}`;
    } catch (_) {
      return "Atualizado agora";
    }
  }

  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("is-visible");
    window.clearTimeout(toast.timeout);
    toast.timeout = window.setTimeout(() => element.classList.remove("is-visible"), 2600);
  }

  function photoSettings() {
    return state.payload?.photo_frame || state.photoConfig || {
      enabled: false,
      idle_seconds: 180,
      interval_seconds: 12,
      sync_interval_seconds: 600,
    };
  }

  function clearPhotoTimer() {
    window.clearInterval(state.photoTimer);
    state.photoTimer = null;
  }

  function renderPhoto() {
    const photo = state.photos[state.photoIndex];
    if (!photo) return;
    const cacheBust = photo.updated_at ? `?v=${encodeURIComponent(photo.updated_at)}` : "";
    photoImage.src = `${photo.url}${cacheBust}`;
    photoImage.alt = photo.name || "Foto do álbum Tecnohead Display";
    photoName.textContent = photo.name || "Porta-retrato";
  }

  function showPhotoFrame() {
    if (!state.photos.length || state.photoFrameVisible) return;
    state.photoIdleTimer = null;
    state.photoFrameVisible = true;
    state.photoIndex = Math.min(state.photoIndex, state.photos.length - 1);
    photoFrame.classList.remove("is-hidden");
    photoFrame.setAttribute("aria-hidden", "false");
    document.body.classList.add("photo-frame-open");
    renderPhoto();
    clearPhotoTimer();
    const seconds = Math.max(5, Number(photoSettings().interval_seconds) || 12);
    state.photoTimer = window.setInterval(() => {
      state.photoIndex = (state.photoIndex + 1) % state.photos.length;
      renderPhoto();
    }, seconds * 1000);
  }

  function schedulePhotoFrame() {
    window.clearTimeout(state.photoIdleTimer);
    state.photoIdleTimer = null;
    if (state.photoFrameVisible) return;
    const settings = photoSettings();
    if (!settings.enabled || !state.photos.length) return;
    const seconds = Math.max(30, Number(settings.idle_seconds) || 180);
    state.photoIdleTimer = window.setTimeout(showPhotoFrame, seconds * 1000);
  }

  function exitPhotoFrame() {
    if (!state.photoFrameVisible) return;
    state.photoFrameVisible = false;
    clearPhotoTimer();
    photoImage.removeAttribute("src");
    photoFrame.classList.add("is-hidden");
    photoFrame.setAttribute("aria-hidden", "true");
    document.body.classList.remove("photo-frame-open");
    schedulePhotoFrame();
  }

  async function loadPhotos(force = false) {
    try {
      const response = await fetch(force ? "api/photos/sync" : "api/photos", {
        method: force ? "POST" : "GET",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      state.photos = Array.isArray(body.photos) ? body.photos : [];
      state.photoConfig = body;
      if (state.photoIndex >= state.photos.length) state.photoIndex = 0;
      window.clearInterval(state.photoSyncTimer);
      const syncSeconds = Math.max(60, Number(body.sync_interval_seconds) || 600);
      state.photoSyncTimer = window.setInterval(() => loadPhotos(false), syncSeconds * 1000);
      schedulePhotoFrame();
    } catch (error) {
      console.warn("Falha ao sincronizar fotos do Immich", error);
      schedulePhotoFrame();
    }
  }

  function setConnection(online, message) {
    const pill = $("#connection-pill");
    pill.classList.toggle("is-online", online);
    pill.classList.toggle("is-offline", !online);
    $("#connection-label").textContent = message;
  }

  function findArea(areaId) {
    return (state.payload?.areas || []).find((area) => area.id === areaId);
  }

  function allEntities() {
    const seen = new Set();
    const result = [];
    for (const area of state.payload?.areas || []) {
      for (const entity of area.entities || []) {
        if (!seen.has(entity.entity_id)) {
          seen.add(entity.entity_id);
          result.push(entity);
        }
      }
    }
    return result;
  }

  function currentEntities() {
    if (state.view === "area") return findArea(state.areaId)?.entities || [];
    return allEntities();
  }

  function roomEntities(entities) {
    return entities.filter((entity) => (
      ROOM_DOMAINS.has(entity.domain)
      && entityAttributes(entity).entity_category !== "diagnostic"
    ));
  }

  function configEntityRelevant(entity, groupKey = "") {
    if (entityAttributes(entity).entity_category === "diagnostic") return false;
    if (ROOM_DOMAINS.has(entity?.domain) || ["scene", "script"].includes(entity?.domain)) return true;
    if (groupKey !== "garagem") return false;
    const text = vehicleEntityText(entity);
    return /volvo|xc40|ex40|carreg|charg|wallbox|bater|battery|\bsoc\b|pot[eê]ncia|power|energy|connector|port[aã]o|gate|status|reset|destravar/.test(text);
  }

  function garageDisplayRelevant(entity) {
    const text = vehicleEntityText(entity);
    if (["light", "switch", "fan", "cover", "lock", "button"].includes(entity?.domain)) return true;
    if (/\b(volvo|xc40|ex40)\b/.test(text)) {
      return /bater(?:ia|y)|n[ií]vel de carga|state of charge|\bsoc\b|estado do carregamento|charging state|pot[eê]ncia de carregamento|charging power|liga[cç][aã]o ao carro|car connection/.test(text);
    }
    return /carga ring|charge control|carregamento|availability|disponibilidade|port[aã]o|gate|destravar|unlock/.test(text);
  }

  function renderRoomList() {
    const areas = state.payload?.areas || [];
    roomList.innerHTML = areas.map((area) => `
      <button class="rail-button ${state.view === "area" && state.areaId === area.id ? "is-active" : ""}"
        data-view="area" data-area-id="${esc(area.id)}" type="button">
        <span class="rail-icon">${areaIcon(area)}</span><span>${esc(area.name)}</span>
      </button>
    `).join("");

    document.querySelectorAll(".rail-button[data-view]").forEach((button) => {
      const active = button.dataset.view === state.view
        && (button.dataset.view !== "area" || button.dataset.areaId === state.areaId);
      button.classList.toggle("is-active", active);
    });
  }

  function levelPercent(entity) {
    const attributes = entityAttributes(entity);
    let value = null;
    if (attributes.brightness != null) value = Number(attributes.brightness) / 255 * 100;
    else if (attributes.volume_level != null) value = Number(attributes.volume_level) * 100;
    else if (attributes.percentage != null) value = Number(attributes.percentage);
    else if (entity.domain === "cover" && attributes.current_position != null) value = Number(attributes.current_position);
    if (!Number.isFinite(value)) return null;
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  function levelRing(entity) {
    const level = levelPercent(entity);
    if (level === null) return "";
    return `<div class="level-ring" style="--level: ${level}%" aria-label="${level}%"><span>${level}%</span></div>`;
  }

  function roomGroupKey(area) {
    const text = `${area?.name || ""} ${area?.id || ""}`.toLowerCase();
    if (text.includes("coz")) return "cozinha";
    if (text.includes("extern") || text.includes("pisc")) return "externo";
    if (text.includes("garag") || text.includes("garage")) return "garagem";
    return null;
  }

  function homeRoomGroups() {
    const configured = Array.isArray(state.layout?.groups) ? state.layout.groups : null;
    if (configured) {
      return configured
        .filter((group) => group.enabled !== false)
        .map((group) => {
          const areaIds = Array.isArray(group.area_ids) && group.area_ids.length
            ? group.area_ids
            : (state.payload?.areas || [])
              .filter((area) => roomGroupKey(area) === group.key)
              .map((area) => area.id);
          const selectedIds = new Set(Array.isArray(group.entity_ids) ? group.entity_ids : []);
          const candidates = allEntities().filter((entity) => (
            areaIds.includes(entity.area_id) || selectedIds.has(entity.entity_id)
          ));
          const entityById = new Map(candidates.map((entity) => [entity.entity_id, entity]));
          const ordered = [];
          const seen = new Set();
          const append = (entity) => {
            if (!entity || seen.has(entity.entity_id)) return;
            seen.add(entity.entity_id);
            ordered.push(entity);
          };
          const order = Array.isArray(group.order) ? group.order : [];
          order.forEach((entityId) => append(entityById.get(entityId)));
          candidates.forEach(append);
          const sections = group.sections || {};
          const visible = (entity) => {
            if (group.manual && !selectedIds.has(entity.entity_id)) return false;
            const section = entitySection(entity);
            return sections[section] !== false;
          };
          return {
            key: group.key,
            label: group.label || group.key,
            icon: roomIcon(group.key),
            areaId: areaIds[0] || null,
            manual: Boolean(group.manual),
            entities: ordered.filter(visible),
          };
        });
    }

    const groups = new Map();
    for (const area of state.payload?.areas || []) {
      const key = roomGroupKey(area);
      if (!key) continue;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: key === "cozinha" ? "Cozinha" : key === "externo" ? "Externo" : "Garagem",
          icon: roomIcon(key),
          areaId: area.id,
          entities: [],
        });
      }
      const group = groups.get(key);
      group.entities.push(...(area.entities || []));
    }
    return ["cozinha", "externo", "garagem"]
      .map((key) => groups.get(key))
      .filter(Boolean)
      .map((group) => ({
        ...group,
        entities: [...new Map(group.entities.map((entity) => [entity.entity_id, entity])).values()],
      }));
  }

  function entitySection(entity) {
    if (["light", "switch", "fan", "input_boolean"].includes(entity?.domain)) return "lighting";
    if (entity?.domain === "media_player") return "media";
    return "other";
  }

  function featuredEntities(entities, limit = 4, groupKey = "") {
    const order = {
      light: 1,
      switch: 2,
      fan: 3,
      cover: 4,
      media_player: 5,
      input_boolean: 6,
      lock: 7,
      climate: 8,
      button: 9,
    };
    const preferred = {
      cozinha: ["pia", "coifa", "led", "bancada", "cristaleira", "jardim"],
      externo: ["som externo", "tv piscina", "piscina", "som", "tv", "entrada", "depósito", "deposito", "árvore", "arvore"],
      garagem: ["flap", "portão", "portao", "gate", "charge", "charger", "carga", "carreg", "volvo", "garage", "garagem"],
    }[groupKey] || [];
    const preferenceScore = (entity) => {
      const text = `${entity?.name || ""} ${entity?.entity_id || ""}`.toLowerCase();
      const match = preferred.findIndex((term) => text.includes(term));
      return match === -1 ? 100 : match;
    };
    return roomEntities(entities)
      .filter((entity) => entityAttributes(entity).entity_category !== "diagnostic")
      .sort((left, right) => preferenceScore(left) - preferenceScore(right)
        || (order[left.domain] || 99) - (order[right.domain] || 99))
      .slice(0, limit);
  }

  function tileAction(entity) {
    if (["light", "switch", "fan", "input_boolean"].includes(entity.domain)) {
      return `data-action="entity" data-id="${esc(entity.entity_id)}" data-command="toggle"`;
    }
    return "";
  }

  function displayTile(entity) {
    const clickable = ["light", "switch", "fan", "input_boolean"].includes(entity.domain);
    const detail = entity.domain === "media_player"
      ? entityAttributes(entity).media_title || humanState(entity)
      : humanState(entity);
    return `
      <article class="display-tile ${isOn(entity) ? "is-active" : ""} ${clickable ? "is-touchable" : ""}" ${tileAction(entity)}>
        <div class="tile-top"><div class="tile-icon">${iconFor(entity)}</div>${levelRing(entity)}</div>
        <div class="tile-name" title="${esc(entity.name)}">${esc(friendlyEntityName(entity))}</div>
        <div class="tile-state">${esc(detail)}</div>
      </article>
    `;
  }

  function homeZone(group) {
    const entities = group.manual
      ? group.entities.slice(0, 4)
      : featuredEntities(group.entities, 4, group.key);
    return `
      <section class="home-zone home-zone-${esc(group.key)}">
        <button class="zone-heading" data-view="area" data-area-id="${esc(group.areaId)}" type="button">
          <span class="zone-heading-icon">${group.icon}</span><span>${esc(group.label)}</span>
        </button>
        <div class="tile-grid">${entities.length ? entities.map(displayTile).join("") : `<div class="zone-empty">Sem dispositivos selecionados</div>`}</div>
      </section>
    `;
  }

  function featuredMediaCard(entity) {
    const attributes = entityAttributes(entity);
    const title = attributes.media_title || entity.name || "Mídia";
    const artist = attributes.media_artist || attributes.source || "Fonte não informada";
    const volume = attributes.volume_level == null ? 0 : Math.round(Number(attributes.volume_level) * 100);
    return `
      <article class="feature-media ${isPlaying(entity) ? "is-playing" : ""}">
        <div class="feature-media-head"><div class="feature-media-icon">${iconFor(entity)}</div><div><div class="feature-media-title">${esc(title)}</div><div class="feature-media-meta">${esc(entity.name)} · ${esc(artist)}</div></div></div>
        <div class="feature-media-controls">
          <button class="media-control" data-action="entity" data-id="${esc(entity.entity_id)}" data-command="stop" type="button">■</button>
          <button class="media-control media-control-main" data-action="entity" data-id="${esc(entity.entity_id)}" data-command="play_pause" type="button">${isPlaying(entity) ? "Ⅱ" : "▶"}</button>
          <button class="media-control" data-action="entity" data-id="${esc(entity.entity_id)}" data-command="mute" data-value="${attributes.is_volume_muted ? "false" : "true"}" type="button">${attributes.is_volume_muted ? "Som" : "Mudo"}</button>
        </div>
        <div class="feature-media-volume"><span>Vol.</span><input data-action="volume" data-id="${esc(entity.entity_id)}" type="range" min="0" max="100" value="${Number.isFinite(volume) ? volume : 0}" aria-label="Volume de ${esc(entity.name)}"><span>${volume}%</span></div>
      </article>
    `;
  }

  function formatMediaTime(value) {
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds < 0) return "—";
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  }

  function mediaCommandButton(entity, command, label, value = null, extraClass = "") {
    if (!entity) return `<button class="media-control ${extraClass} is-disabled" type="button" disabled aria-label="${esc(label)}">${label}</button>`;
    const valueAttribute = value === null ? "" : ` data-value="${esc(value)}"`;
    return `<button class="media-control ${extraClass}" data-action="entity" data-id="${esc(entity.entity_id)}" data-command="${esc(command)}"${valueAttribute} type="button" aria-label="${esc(label)}">${label}</button>`;
  }

  function spotifyMediaCard(entity) {
    const connected = Boolean(entity);
    const attributes = entityAttributes(entity);
    const title = connected ? (attributes.media_title || "Playlist Festa") : "Playlist Festa";
    const meta = connected ? (attributes.media_artist || attributes.source || "Spotify") : "Spotify ainda não conectado";
    const duration = connected ? formatMediaTime(attributes.media_duration) : "3:56";
    const position = connected ? formatMediaTime(attributes.media_position) : "1:24";
    const percent = connected && Number.isFinite(Number(attributes.media_duration)) && Number(attributes.media_duration) > 0
      ? Math.max(0, Math.min(100, Number(attributes.media_position || 0) / Number(attributes.media_duration) * 100))
      : 35;
    const mutedValue = attributes.is_volume_muted ? "false" : "true";
    return `
      <article class="feature-media spotify-card ${connected && isPlaying(entity) ? "is-playing" : ""} ${connected ? "" : "is-preview"}">
        <div class="spotify-card-art">
          <div class="spotify-art-glow"></div>
          <div class="spotify-art-top"><span class="spotify-mark">${spotifyLogo()}</span><span class="spotify-platform">Spotify</span><button class="media-heart" type="button" disabled aria-label="Favorito">♡</button></div>
          <div class="spotify-art-copy"><strong>${esc(title)}</strong><span>${esc(meta)}</span></div>
        </div>
        <div class="spotify-progress"><div class="progress-times"><span>${esc(position)}</span><span>${esc(duration)}</span></div><div class="progress-track"><span style="width:${percent}%"></span></div></div>
        <div class="feature-media-controls">
          ${mediaCommandButton(entity, "stop", "■")}
          ${mediaCommandButton(entity, "play_pause", connected && isPlaying(entity) ? "Ⅱ" : "▶", null, "media-control-main")}
          ${mediaCommandButton(entity, "mute", attributes.is_volume_muted ? "Som" : "Mudo", mutedValue)}
        </div>
        ${connected ? `<div class="feature-media-volume"><span>Vol.</span><input data-action="volume" data-id="${esc(entity.entity_id)}" type="range" min="0" max="100" value="${Math.round(Number(attributes.volume_level || 0) * 100)}" aria-label="Volume de ${esc(entity.name)}"><span>${Math.round(Number(attributes.volume_level || 0) * 100)}%</span></div>` : `<div class="media-connection-note">Conectar Spotify no Home Assistant</div>`}
      </article>
    `;
  }

  function videoMediaCard(entity) {
    const connected = Boolean(entity);
    const title = connected ? friendlyEntityName(entity) : "TV Piscina";
    const stateLabel = connected ? humanState(entity) : "Aguardando entidade";
    return `
      <article class="video-feature ${connected && isOn(entity) ? "is-active" : ""}">
        <div class="video-art">
          <div class="video-art-sky"></div><div class="video-art-water"></div><div class="video-art-lights"></div>
          <div class="video-art-toolbar"><span>${svgIcon("tv")}</span><button type="button" disabled aria-label="Tela cheia">⤢</button></div>
          <div class="video-art-caption"><span class="video-art-icon">${svgIcon("tv")}</span><div><strong>${esc(title)}</strong><small>${esc(stateLabel)}</small></div></div>
          ${connected ? mediaCommandButton(entity, "play_pause", isPlaying(entity) ? "Ⅱ" : "▶", null, "video-play") : ""}
        </div>
      </article>
    `;
  }

  function energyPercent(bucket, numericValue) {
    if (!Number.isFinite(Number(numericValue))) return 0;
    const entity = (state.payload?.energy?.metrics?.[bucket] || []).find((item) => item.numeric_value === numericValue);
    if (entityUnit(entity) === "%") return Math.max(0, Math.min(100, Math.round(Number(numericValue))));
    const values = Object.values(state.payload?.energy?.metrics || {})
      .flat()
      .map((item) => Math.abs(Number(item.numeric_value)))
      .filter(Number.isFinite);
    const maximum = Math.max(...values, 1);
    return Math.max(0, Math.min(100, Math.round(Math.abs(Number(numericValue)) / maximum * 100)));
  }

  function energyShowcase() {
    const rows = [
      ["Geração", "generation", "outdoor"],
      ["Consumo", "consumption", "kitchen"],
      ["Bateria", "storage", "energy"],
    ];
    return `
      <section class="energy-showcase">
        <div class="showcase-heading"><span class="showcase-heading-icon">${svgIcon("energy")}</span><span>Energia</span></div>
        <div class="energy-showcase-rows">${rows.map(([label, bucket, icon]) => {
          const reading = metricValue(bucket);
          const percent = energyPercent(bucket, reading.value);
          return `<div class="energy-showcase-row"><div class="energy-row-label"><span>${svgIcon(icon)}</span><strong>${label}</strong><b>${esc(reading.value)} ${esc(reading.unit)}</b></div><div class="energy-bar"><span style="width:${percent}%"></span></div></div>`;
        }).join("")}</div>
      </section>
    `;
  }

  function renderHomeDashboard() {
    const groups = homeRoomGroups();
    const media = allEntities().filter((entity) => entity.domain === "media_player");
    const spotify = media.find((entity) => `${entity.entity_id} ${entity.name} ${entityAttributes(entity).source || ""}`.toLowerCase().includes("spotify"));
    const video = media.filter((entity) => entity !== spotify).find((entity) => `${entity.name} ${entity.entity_id}`.toLowerCase().match(/pisc|extern|tv|televis/)) || media.find((entity) => entity !== spotify);
    const zones = groups.map(homeZone).join("");
    $("#home-dashboard").innerHTML = `
      <div class="home-zones">${zones || `<div class="home-empty">Nenhum cômodo principal encontrado.</div>`}</div>
      <div class="home-lower">
        <section class="media-showcase"><div class="showcase-heading"><span class="showcase-heading-icon">${svgIcon("media")}</span><span>Áudio e Vídeo</span></div><div class="media-showcase-grid media-showcase-visual">${spotifyMediaCard(spotify)}${videoMediaCard(video)}</div></section>
        ${energyShowcase()}
      </div>
    `;
  }

  function renderSidebar() {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
    const date = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(now);
    $("#sidebar-clock").textContent = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(now);
    $("#sidebar-date").textContent = date.charAt(0).toUpperCase() + date.slice(1);
    $("#sidebar-greeting").textContent = `${greeting} · Tecnohead`;

    if (!state.payload) return;
    const active = roomEntities(allEntities()).filter(isOn);
    const names = active.slice(0, 3).map((entity) => entity.name).join(", ");
    $("#sidebar-active").innerHTML = active.length
      ? `<strong>${active.length} ${active.length === 1 ? "dispositivo ligado" : "dispositivos ligados"}</strong><span>${esc(names)}${active.length > 3 ? "…" : ""}</span>`
      : `<strong>Casa tranquila</strong><span>Nenhum dispositivo ligado</span>`;

    const generation = metricValue("generation");
    const consumption = metricValue("consumption");
    const readings = [];
    if (generation.value !== "—") readings.push(`<span><b>Geração</b>${esc(generation.value)} ${esc(generation.unit)}</span>`);
    if (consumption.value !== "—") readings.push(`<span><b>Consumo</b>${esc(consumption.value)} ${esc(consumption.unit)}</span>`);
    $("#sidebar-energy").innerHTML = readings.length
      ? `<div class="sidebar-section-label">ENERGIA AGORA</div>${readings.join("")}`
      : `<div class="sidebar-section-label">ENERGIA AGORA</div><span>Sem sensores mapeados</span>`;
  }

  function renderOverview() {
    const summary = state.payload?.summary || {};
    const discovered = currentEntities();
    const entities = roomEntities(discovered);
    const active = entities.filter(isOn).length;
    const media = entities.filter((entity) => entity.domain === "media_player").length;
    const areaCount = state.view === "area" ? 1 : summary.areas || 0;
    const detail = discovered.length > entities.length
      ? `${discovered.length} entidades descobertas`
      : "Comandos disponíveis";
    $("#overview-strip").innerHTML = `
      <div class="overview-card"><div class="label">Controles</div><div class="value">${entities.length}</div><div class="detail">${detail}</div></div>
      <div class="overview-card"><div class="label">Ativos agora</div><div class="value">${active}</div><div class="detail">Comandos disponíveis</div></div>
      <div class="overview-card"><div class="label">Cômodos</div><div class="value">${areaCount}</div><div class="detail">Descobertos no Home Assistant · ${media} mídia</div></div>
    `;
  }

  function renderScenes() {
    const scenes = state.payload?.scenes || [];
    const panel = $("#scene-panel");
    if (!scenes.length) {
      panel.innerHTML = `<div class="scene-heading"><div class="label">CENAS RÁPIDAS</div><div class="hint">Nenhuma cena configurada.</div></div>`;
      return;
    }
    panel.innerHTML = `
      <div class="scene-heading"><div class="label">CENAS RÁPIDAS</div><div class="hint">Um toque para ativar</div></div>
      <div class="scene-list">${scenes.slice(0, 12).map((scene) => `
        <button class="scene-button" data-action="scene" data-id="${esc(scene.entity_id)}" type="button">
          ${esc(scene.name)}<span class="scene-type">${esc(scene.domain === "script" ? "Script" : "Cena")}</span>
        </button>
      `).join("")}</div>
    `;
  }

  function renderQuickActions() {
    const scenes = (state.payload?.scenes || []).slice(0, 3);
    const groups = homeRoomGroups().filter((group) => group.key !== "garagem");
    const actions = [
      { view: "all", icon: svgIcon("kitchen"), label: "Casa" },
      ...scenes.map((scene) => ({ scene: scene.entity_id, icon: svgIcon("scene"), label: scene.name })),
      ...groups.map((group) => ({ view: "area", areaId: group.areaId, icon: group.icon, label: group.label })),
      { view: "garage", icon: svgIcon("garage"), label: "Garagem" },
      { view: "energy", icon: svgIcon("energy"), label: "Energia" },
    ];
    $("#quick-actions").innerHTML = actions.map((action) => {
      const selected = action.view === state.view && (action.view !== "area" || action.areaId === state.areaId);
      if (action.scene) {
        return `<button class="quick-action" data-action="scene" data-id="${esc(action.scene)}" type="button"><span>${action.icon}</span>${esc(action.label)}</button>`;
      }
      return `<button class="quick-action ${selected ? "is-active" : ""}" data-view="${action.view}" data-area-id="${esc(action.areaId || "")}" type="button"><span>${action.icon}</span>${esc(action.label)}</button>`;
    }).join("");
  }

  let draggedConfigRow = null;

  document.addEventListener("dragstart", (event) => {
    const row = event.target.closest?.(".config-entity-row");
    if (!row) return;
    draggedConfigRow = row;
    row.classList.add("is-dragging");
    event.dataTransfer?.setData("text/plain", row.dataset.configEntity || "");
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  });

  document.addEventListener("dragover", (event) => {
    const target = event.target.closest?.(".config-entity-row");
    if (!draggedConfigRow || !target || target === draggedConfigRow) return;
    if (target.closest(".config-entity-list") !== draggedConfigRow.closest(".config-entity-list")) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  });

  document.addEventListener("drop", (event) => {
    const target = event.target.closest?.(".config-entity-row");
    if (!draggedConfigRow || !target || target === draggedConfigRow) return;
    if (target.closest(".config-entity-list") !== draggedConfigRow.closest(".config-entity-list")) return;
    event.preventDefault();
    target.parentElement.insertBefore(draggedConfigRow, target);
    draggedConfigRow.classList.remove("is-dragging");
    draggedConfigRow = null;
    state.configDirty = true;
  });

  document.addEventListener("dragend", () => {
    draggedConfigRow?.classList.remove("is-dragging");
    draggedConfigRow = null;
  });

  function cardHeader(entity) {
    return `
      <div class="card-top">
        <div class="card-icon">${iconFor(entity)}</div>
        <div class="card-title">
          <div class="card-name" title="${esc(entity.name)}">${esc(entity.name)}</div>
          <div class="card-meta" title="${esc(entity.area_name || entity.entity_id)}">${esc(entity.area_name || entity.entity_id)}</div>
        </div>
        ${levelRing(entity)}
      </div>
    `;
  }

  function cardFooter(entity, status = humanState(entity), playing = false) {
    return `<div class="card-footer"><span class="status-dot ${isOn(entity) ? "is-on" : ""} ${playing ? "is-playing" : ""}"></span><span class="status-label">${esc(status)}</span></div>`;
  }

  function mediaCard(entity) {
    const attributes = entityAttributes(entity);
    const title = attributes.media_title || humanState(entity);
    const artist = attributes.media_artist || attributes.source || "Fonte não informada";
    const volume = attributes.volume_level == null ? 0 : Math.round(Number(attributes.volume_level) * 100);
    const sources = Array.isArray(attributes.source_list) ? attributes.source_list : [];
    return `
      <article class="card card-wide ${isPlaying(entity) ? "is-active" : ""}">
        ${cardHeader(entity)}
        <div class="entity-state ${attributes.media_title ? "" : "is-muted"}">${esc(title)}</div>
        <div class="card-meta">${esc(artist)}</div>
        <div class="media-controls">
          <button class="small-action" data-action="entity" data-id="${esc(entity.entity_id)}" data-command="stop" type="button">■</button>
          <button class="small-action play-button" data-action="entity" data-id="${esc(entity.entity_id)}" data-command="play_pause" type="button">${isPlaying(entity) ? "Ⅱ" : "▶"}</button>
          <button class="small-action" data-action="entity" data-id="${esc(entity.entity_id)}" data-command="mute" data-value="${attributes.is_volume_muted ? "false" : "true"}" type="button">${attributes.is_volume_muted ? "Som" : "Mudo"}</button>
        </div>
        <div class="volume-row"><span>Vol.</span><input data-action="volume" data-id="${esc(entity.entity_id)}" type="range" min="0" max="100" value="${Number.isFinite(volume) ? volume : 0}" aria-label="Volume de ${esc(entity.name)}"><span>${volume}%</span></div>
        ${sources.length ? `<select class="source-select" data-action="source" data-id="${esc(entity.entity_id)}" aria-label="Fonte de ${esc(entity.name)}"><option value="">Fonte atual: ${esc(attributes.source || "—")}</option>${sources.map((source) => `<option value="${esc(source)}">${esc(source)}</option>`).join("")}</select>` : ""}
        ${cardFooter(entity, attributes.media_title || humanState(entity), isPlaying(entity))}
      </article>
    `;
  }

  function controlCard(entity) {
    const domain = entity.domain;
    let control = "";
    if (["light", "switch", "fan", "input_boolean"].includes(domain)) {
      control = `<button class="toggle-button ${isOn(entity) ? "is-on" : ""}" data-action="entity" data-id="${esc(entity.entity_id)}" data-command="toggle" type="button">${isOn(entity) ? "Ligado" : "Desligado"}</button>`;
    } else if (domain === "cover") {
      control = `<div class="cover-actions"><button class="small-action" data-action="entity" data-id="${esc(entity.entity_id)}" data-command="open" type="button">Abrir</button><button class="small-action" data-action="entity" data-id="${esc(entity.entity_id)}" data-command="stop" type="button">Parar</button><button class="small-action" data-action="entity" data-id="${esc(entity.entity_id)}" data-command="close" type="button">Fechar</button></div>`;
    } else if (domain === "lock") {
      control = `<div class="cover-actions"><button class="small-action" data-action="entity" data-id="${esc(entity.entity_id)}" data-command="lock" type="button">Trancar</button><button class="small-action" data-action="entity" data-id="${esc(entity.entity_id)}" data-command="unlock" type="button">Abrir</button></div>`;
    } else if (domain === "button") {
      control = `<button class="toggle-button" data-action="entity" data-id="${esc(entity.entity_id)}" data-command="press" type="button">Acionar</button>`;
    }
    return `
      <article class="card ${isOn(entity) ? "is-active" : ""}">
        ${cardHeader(entity)}
        <div class="entity-state">${displayValue(entity)}</div>
        ${control}
        ${cardFooter(entity)}
      </article>
    `;
  }

  function readOnlyCard(entity) {
    const attributes = entityAttributes(entity);
    const detail = attributes.hvac_action || attributes.hvac_mode || attributes.media_title || entity.device_name || humanState(entity);
    return `
      <article class="card ${isOn(entity) ? "is-active" : ""}">
        ${cardHeader(entity)}
        <div class="entity-state">${displayValue(entity)}</div>
        <div class="card-meta">${esc(detail)}</div>
        ${cardFooter(entity)}
      </article>
    `;
  }

  function entityCard(entity) {
    if (entity.domain === "media_player") return mediaCard(entity);
    if (["light", "switch", "fan", "input_boolean", "cover", "lock", "button"].includes(entity.domain)) return controlCard(entity);
    return readOnlyCard(entity);
  }

  function renderRoom() {
    if (state.view === "all") {
      $("#page-title").textContent = state.payload?.home?.name || "Casa";
      $("#page-subtitle").textContent = "Seu ambiente, em um só lugar.";
      $("#home-dashboard").classList.remove("is-hidden");
      $("#overview-strip").classList.add("is-hidden");
      $("#scene-panel").classList.add("is-hidden");
      $("#room-grid").classList.add("is-hidden");
      renderHomeDashboard();
      return;
    }
    $("#home-dashboard").classList.add("is-hidden");
    $("#overview-strip").classList.remove("is-hidden");
    $("#scene-panel").classList.remove("is-hidden");
    $("#room-grid").classList.remove("is-hidden");
    const entities = roomEntities(currentEntities());
    $("#page-title").textContent = state.view === "area" ? (findArea(state.areaId)?.name || "Cômodo") : (state.payload?.home?.name || "Casa");
    $("#page-subtitle").textContent = state.view === "area" ? "Controles e dispositivos deste cômodo." : "Seu ambiente, em um só lugar.";
    renderOverview();
    renderScenes();
    $("#room-grid").innerHTML = entities.length
      ? entities.map(entityCard).join("")
      : `<div class="empty-state"><div><strong>Nada para mostrar aqui</strong><span>Quando o Home Assistant encontrar entidades nesta área, elas aparecem neste painel.</span></div></div>`;
  }

  function metricValue(bucket) {
    const entities = state.payload?.energy?.metrics?.[bucket] || [];
    const found = entities.find((entity) => entity.numeric_value !== null && entity.numeric_value !== undefined);
    if (!found) return { value: "—", unit: "", note: entities.length ? "Sem leitura no momento" : "Sensor não mapeado" };
    return { value: found.numeric_value, unit: entityUnit(found), note: found.name };
  }

  function energyNode(label, bucket, tone) {
    const reading = metricValue(bucket);
    return `<div class="energy-node" style="--node-tone: ${tone}"><div class="node-label">${label}</div><div class="node-value">${esc(reading.value)}<small>${esc(reading.unit)}</small></div><div class="node-note">${esc(reading.note)}</div></div>`;
  }

  function metricCard(label, bucket) {
    const entities = state.payload?.energy?.metrics?.[bucket] || [];
    const reading = metricValue(bucket);
    return `<article class="metric-card"><div class="metric-label">${label}</div><h3>${esc(reading.value)} <small>${esc(reading.unit)}</small></h3><div class="metric-entities">${entities.length ? entities.slice(0, 5).map((entity) => `<div class="metric-entity"><span title="${esc(entity.name)}">${esc(entity.name)}</span><span>${esc(entity.state)}${entityUnit(entity) ? ` ${esc(entityUnit(entity))}` : ""}</span></div>`).join("") : `<div class="metric-entity"><span>Sensor não encontrado</span><span>—</span></div>`}</div></article>`;
  }

  function renderEnergy() {
    $("#page-title").textContent = "Energia";
    $("#page-subtitle").textContent = "Geração, consumo, rede e armazenamento em uma leitura.";
    $("#energy-flow").innerHTML = `${energyNode("Geração", "generation", "#ffd09a")}<div class="energy-arrow">→</div>${energyNode("Casa", "consumption", "#ff9b6b")}<div class="energy-arrow">→</div>${energyNode("Rede", "grid", "#a4d4ff")}`;
    $("#energy-metrics").innerHTML = `${metricCard("Geração solar", "generation")}${metricCard("Consumo da casa", "consumption")}${metricCard("Rede", "grid")}${metricCard("Bateria / reserva", "storage")}`;
  }

  function garageEntitiesForDisplay() {
    const discovered = state.payload?.garage?.entities || [];
    const garageConfig = state.layout?.garage || {};
    if (!garageConfig.manual) return discovered.filter(garageDisplayRelevant);
    const selected = new Set(Array.isArray(garageConfig.entity_ids) ? garageConfig.entity_ids : []);
    return discovered.filter((entity) => selected.has(entity.entity_id));
  }

  function vehicleEntityText(entity) {
    return `${entity?.name || ""} ${entity?.entity_id || ""} ${entity?.device_name || ""}`.toLowerCase();
  }

  function firstVehicleEntity(entities, keywords) {
    return entities.find((entity) => keywords.some((keyword) => vehicleEntityText(entity).includes(keyword)));
  }

  function vehicleValue(entity) {
    if (!entity) return "—";
    if (entity.numeric_value !== null && entity.numeric_value !== undefined) {
      return `${entity.numeric_value}${entityUnit(entity) ? ` ${entityUnit(entity)}` : ""}`;
    }
    return humanState(entity);
  }

  function garageVehicleCard() {
    const garageEntities = garageEntitiesForDisplay();
    const all = [...garageEntities, ...allEntities().filter((entity) => !garageEntities.includes(entity))];
    const hasVolvo = all.some((entity) => vehicleEntityText(entity).match(/volvo|xc40|ex40/));
    const battery = firstVehicleEntity(all, ["nível de carga", "nivel de carga", "battery", "bateria", "state of charge", "soc"]);
    const charging = firstVehicleEntity(all, ["estado do carregamento", "charging state", "carregando", "charge state"]);
    const power = firstVehicleEntity(all, ["potência de carregamento", "potencia de carregamento", "charging power"]);
    const connection = firstVehicleEntity(all, ["ligação ao carro", "ligacao ao carro", "car connection", "connection"]);
    const vehicleName = hasVolvo
      ? (all.some((entity) => vehicleEntityText(entity).includes("ex40")) ? "Volvo EX40" : "Volvo XC40")
      : "Volvo XC40 / EX40";
    const batteryPercent = battery?.numeric_value != null && entityUnit(battery) === "%"
      ? Math.max(0, Math.min(100, Number(battery.numeric_value)))
      : null;
    const batteryLabel = batteryPercent === null ? vehicleValue(battery) : `${Math.round(batteryPercent)}%`;
    return `
      <article class="vehicle-card">
        <div class="vehicle-card-art"><div class="vehicle-glow"></div><div class="vehicle-car-icon">${svgIcon("car")}</div><span>GARAGEM</span></div>
        <div class="vehicle-card-body">
          <div class="vehicle-card-title"><div><div class="eyebrow">CARRO ELÉTRICO</div><h3>${esc(vehicleName)}</h3><p>${hasVolvo ? "Dados espelhados do Home Assistant" : "Pronto para receber a entidade do veículo"}</p></div><span class="vehicle-battery-badge">${esc(batteryLabel)}</span></div>
          <div class="vehicle-battery-track"><span style="width:${batteryPercent === null ? 0 : batteryPercent}%"></span></div>
          <div class="vehicle-stats">
            <div><span>Carregamento</span><strong>${esc(vehicleValue(charging))}</strong></div>
            <div><span>Potência</span><strong>${esc(vehicleValue(power))}</strong></div>
            <div><span>Ligação</span><strong>${esc(vehicleValue(connection))}</strong></div>
          </div>
        </div>
      </article>
    `;
  }

  function renderGarage() {
    $("#page-title").textContent = "Garagem";
    $("#page-subtitle").textContent = "Carregamento, carro e acesso próximos deste ambiente.";
    $("#garage-vehicle").innerHTML = garageVehicleCard();
    const entities = garageEntitiesForDisplay();
    $("#garage-grid").innerHTML = entities.length
      ? entities.map(entityCard).join("")
      : `<div class="empty-state"><div><strong>Garagem ainda sem entidades mapeadas</strong><span>Nomeie a área ou entidade como garagem, carro, wallbox ou carregador no Home Assistant para ela aparecer aqui.</span></div></div>`;
  }

  function configAreas() {
    return state.catalog?.areas || state.payload?.areas || [];
  }

  function configEntitiesForGroup(group) {
    const explicitAreas = Array.isArray(group.area_ids) ? group.area_ids : [];
    const areaIds = explicitAreas.length
      ? explicitAreas
      : configAreas().filter((area) => roomGroupKey(area) === group.key).map((area) => area.id);
    const selectedIds = new Set(Array.isArray(group.entity_ids) ? group.entity_ids : []);
    return allEntities().filter((entity) => (
      (areaIds.includes(entity.area_id) || selectedIds.has(entity.entity_id))
      && configEntityRelevant(entity, group.key)
    ));
  }

  function orderedConfigEntities(entities, order) {
    const byId = new Map(entities.map((entity) => [entity.entity_id, entity]));
    const result = [];
    const seen = new Set();
    for (const entityId of Array.isArray(order) ? order : []) {
      const entity = byId.get(entityId);
      if (entity && !seen.has(entity.entity_id)) {
        result.push(entity);
        seen.add(entity.entity_id);
      }
    }
    entities.forEach((entity) => {
      if (!seen.has(entity.entity_id)) result.push(entity);
    });
    return result;
  }

  function configEntityRow(entity, checked) {
    return `
      <label class="config-entity-row" draggable="true" data-config-entity="${esc(entity.entity_id)}">
        <span class="config-drag-handle" aria-hidden="true">⠿</span>
        <input class="config-entity-check" type="checkbox" data-config-entity-check="${esc(entity.entity_id)}" ${checked ? "checked" : ""}>
        <span class="config-entity-icon">${iconFor(entity)}</span>
        <span class="config-entity-copy"><strong>${esc(friendlyEntityName(entity))}</strong><small>${esc(entity.domain)} · ${esc(entity.area_name || "Sem cômodo")}</small></span>
        <span class="config-entity-state">${esc(humanState(entity))}</span>
        <span class="config-move-buttons"><button type="button" data-config-move="up" aria-label="Mover para cima">↑</button><button type="button" data-config-move="down" aria-label="Mover para baixo">↓</button></span>
      </label>
    `;
  }

  function configRoomCard(group) {
    const entities = orderedConfigEntities(configEntitiesForGroup(group), group.order);
    const selectedIds = new Set(Array.isArray(group.entity_ids) ? group.entity_ids : []);
    const automatic = !group.manual;
    const areaIds = Array.isArray(group.area_ids) && group.area_ids.length
      ? group.area_ids
      : configAreas().filter((area) => roomGroupKey(area) === group.key).map((area) => area.id);
    const sections = group.sections || {};
    const section = (key, label, hint) => {
      const rows = entities.filter((entity) => entitySection(entity) === key);
      return `
        <div class="config-section ${sections[key] === false ? "is-disabled" : ""}">
          <label class="config-section-heading"><input type="checkbox" data-config-section="${esc(group.key)}:${key}" ${sections[key] === false ? "" : "checked"}><span><strong>${label}</strong><small>${hint}</small></span><b>${rows.length}</b></label>
          <div class="config-entity-list" data-config-list="${esc(group.key)}:${key}">${rows.length ? rows.map((entity) => configEntityRow(entity, automatic || selectedIds.has(entity.entity_id))).join("") : `<div class="config-empty">Nenhuma entidade encontrada nesta categoria.</div>`}</div>
        </div>
      `;
    };
    return `
      <article class="config-room-card" data-config-group="${esc(group.key)}">
        <div class="config-room-heading"><div class="config-room-title"><span class="config-room-icon">${roomIcon(group.key)}</span><div><h3>${esc(group.label || group.key)}</h3><p>Selecione as áreas espelhadas e os equipamentos visíveis.</p></div></div><label class="config-toggle"><input type="checkbox" data-config-enabled ${group.enabled === false ? "" : "checked"}><span></span><b>Exibir</b></label></div>
        <div class="config-area-block"><div class="config-label">ÁREAS ESPELHADAS</div><div class="config-area-choices">${configAreas().map((area) => `<label class="config-area-choice"><input type="checkbox" data-config-area="${esc(area.id)}" ${areaIds.includes(area.id) ? "checked" : ""}><span>${areaIcon(area)}</span>${esc(area.name)}</label>`).join("") || `<span class="config-empty">Nenhuma área descoberta.</span>`}</div></div>
        <div class="config-sections">${section("lighting", "Iluminação e acionamentos", "Luzes, interruptores, ventilação e persianas")}${section("media", "Áudio e vídeo", "TVs, caixas e players")}${section("other", "Outros dispositivos", "Sensores, portões, cenas e controles auxiliares")}</div>
      </article>
    `;
  }

  function configGarageCard() {
    const garageConfig = state.layout?.garage || {};
    const selectedIds = new Set(Array.isArray(garageConfig.entity_ids) ? garageConfig.entity_ids : []);
    const discovered = state.payload?.garage?.entities || [];
    const source = garageConfig.manual
      ? discovered.filter((entity) => selectedIds.has(entity.entity_id) || garageDisplayRelevant(entity))
      : discovered.filter(garageDisplayRelevant);
    const entities = orderedConfigEntities(source, garageConfig.order);
    const automatic = !garageConfig.manual;
    return `
      <article class="config-room-card config-garage-card" data-config-garage>
        <div class="config-room-heading"><div class="config-room-title"><span class="config-room-icon">${roomIcon("garagem")}</span><div><h3>Dados da garagem</h3><p>Carregamento, portão e dados do Volvo XC40 / EX40.</p></div></div><label class="config-toggle"><input type="checkbox" data-config-garage-enabled ${garageConfig.enabled === false ? "" : "checked"}><span></span><b>Exibir</b></label></div>
        <div class="config-entity-list" data-config-list="garage">${entities.length ? entities.map((entity) => configEntityRow(entity, automatic || selectedIds.has(entity.entity_id))).join("") : `<div class="config-empty">Nenhuma entidade de garagem encontrada.</div>`}</div>
      </article>
    `;
  }

  function renderConfig() {
    $("#page-title").textContent = "Configurar painel";
    $("#page-subtitle").textContent = "Cômodos, categorias e ordem dos dispositivos.";
    const groups = Array.isArray(state.layout?.groups) ? state.layout.groups : [];
    $("#config-rooms").innerHTML = groups.map(configRoomCard).join("") + configGarageCard();
  }

  function collectLayoutFromConfig() {
    const groups = [...document.querySelectorAll("[data-config-group]")].map((card) => {
      const key = card.dataset.configGroup;
      const current = (state.layout?.groups || []).find((group) => group.key === key) || {};
      const entityIds = [...card.querySelectorAll(".config-entity-check:checked")].map((input) => input.dataset.configEntityCheck);
      return {
        ...current,
        key,
        enabled: Boolean(card.querySelector("[data-config-enabled]")?.checked),
        area_ids: [...card.querySelectorAll("[data-config-area]:checked")].map((input) => input.dataset.configArea),
        manual: true,
        entity_ids: entityIds,
        order: entityIds,
        sections: Object.fromEntries([...card.querySelectorAll("[data-config-section]")].map((input) => [input.dataset.configSection.split(":").pop(), input.checked])),
      };
    });
    const garageCard = $("[data-config-garage]");
    const garageIds = garageCard
      ? [...garageCard.querySelectorAll(".config-entity-check:checked")].map((input) => input.dataset.configEntityCheck)
      : [];
    return {
      version: 1,
      groups,
      garage: {
        ...(state.layout?.garage || {}),
        enabled: Boolean(garageCard?.querySelector("[data-config-garage-enabled]")?.checked),
        manual: true,
        entity_ids: garageIds,
        order: garageIds,
      },
    };
  }

  function render() {
    if (!state.payload) return;
    renderRoomList();
    renderSidebar();
    renderQuickActions();
    const room = $("#room-view");
    const energy = $("#energy-view");
    const garage = $("#garage-view");
    const config = $("#config-view");
    room.classList.toggle("is-hidden", state.view !== "all" && state.view !== "area");
    energy.classList.toggle("is-hidden", state.view !== "energy");
    garage.classList.toggle("is-hidden", state.view !== "garage");
    config.classList.toggle("is-hidden", state.view !== "config");
    if (state.view === "config") {
      if (!state.configDirty) renderConfig();
    } else if (state.view === "energy") renderEnergy();
    else if (state.view === "garage") renderGarage();
    else renderRoom();
    $("#last-update").textContent = formatUpdated(state.payload.updated_at);
  }

  function selectViewButton(viewButton) {
    state.view = viewButton.dataset.view;
    state.areaId = viewButton.dataset.areaId || null;
    state.configDirty = false;
    render();
    if (state.view === "config") loadLayoutConfig();
  }

  async function loadLayoutConfig(showToast = false) {
    try {
      const response = await fetch("api/layout", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      state.layout = body.layout || state.layout;
      state.catalog = body.catalog || state.catalog;
      state.configDirty = false;
      if (state.view === "config") render();
      if (showToast) toast("Configuração carregada");
    } catch (error) {
      toast("Não foi possível carregar a configuração");
      console.warn(error);
    }
  }

  async function saveLayoutConfig() {
    const layout = collectLayoutFromConfig();
    try {
      const response = await fetch("api/layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || "Configuração recusada");
      state.layout = body.layout || layout;
      state.configDirty = false;
      state.view = "all";
      state.areaId = null;
      await load(false);
      toast("Layout salvo no Home Assistant");
    } catch (error) {
      toast(error.message || "Não foi possível salvar o layout");
    }
  }

  async function resetLayoutConfig() {
    try {
      const response = await fetch("api/layout/reset", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || "Configuração recusada");
      state.layout = body.layout;
      state.configDirty = false;
      renderConfig();
      toast("Seleção automática restaurada");
    } catch (error) {
      toast(error.message || "Não foi possível restaurar o layout");
    }
  }

  async function load(showToast = false) {
    if (state.loading) return;
    state.loading = true;
    $("#refresh-button").classList.add("is-loading");
    try {
      const response = await fetch("api/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.payload = await response.json();
      state.layout = state.payload.layout_config?.layout || state.layout;
      state.catalog = state.payload.layout_config?.catalog || state.catalog;
      setConnection(true, "Home Assistant conectado");
      render();
      if (showToast) toast("Painel atualizado");
      window.clearInterval(state.timer);
      const seconds = Math.max(3, Number(state.payload.refresh_seconds) || 10);
      state.timer = window.setInterval(() => load(false), seconds * 1000);
    } catch (error) {
      setConnection(false, "Sem conexão");
      if (!state.payload) {
        $("#room-grid").innerHTML = `<div class="empty-state"><div><strong>Home Assistant indisponível</strong><span>Verifique a conexão do add-on e tente atualizar novamente.</span></div></div>`;
      }
      toast("Não foi possível atualizar o Home Assistant");
      console.warn(error);
    } finally {
      state.loading = false;
      $("#refresh-button").classList.remove("is-loading");
    }
  }

  async function sendAction(entityId, command, value, sourceButton = null) {
    if (sourceButton) {
      sourceButton.disabled = true;
      sourceButton.classList.add("is-pending");
    }
    try {
      const response = await fetch("api/entities/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_id: entityId, action: command, value }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || "Ação recusada");
      toast("Comando enviado");
      // Let the touch action finish immediately. The authoritative state is
      // refreshed shortly after, without holding the button interaction open.
      window.setTimeout(() => load(false), 350);
    } catch (error) {
      toast(error.message || "Não foi possível enviar o comando");
    } finally {
      if (sourceButton?.isConnected) {
        sourceButton.disabled = false;
        sourceButton.classList.remove("is-pending");
      }
    }
  }

  async function activateScene(entityId) {
    try {
      const response = await fetch("api/scenes/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_id: entityId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || "Cena recusada");
      toast("Cena ativada");
      window.setTimeout(() => load(false), 350);
    } catch (error) {
      toast(error.message || "Não foi possível ativar a cena");
    }
  }

  let lastTouchNavigation = 0;

  // Some Chromium/touchscreen combinations scroll the rail without emitting
  // a click reliably. Commit the room selection on the touch pointer itself;
  // the short guard prevents the synthetic click from running twice.
  document.addEventListener("pointerup", (event) => {
    if (!["touch", "pen"].includes(event.pointerType)) return;
    const viewButton = event.target?.closest?.("[data-view]");
    if (!viewButton) return;
    event.preventDefault();
    lastTouchNavigation = performance.now();
    selectViewButton(viewButton);
  }, { passive: false });

  document.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      if (performance.now() - lastTouchNavigation < 700) return;
      selectViewButton(viewButton);
      return;
    }
    const configAction = event.target.closest("[data-config-action]");
    if (configAction) {
      event.preventDefault();
      const action = configAction.dataset.configAction;
      if (action === "save") saveLayoutConfig();
      else if (action === "reload") loadLayoutConfig(true);
      else if (action === "reset") resetLayoutConfig();
      return;
    }
    const moveButton = event.target.closest("[data-config-move]");
    if (moveButton) {
      event.preventDefault();
      event.stopPropagation();
      const row = moveButton.closest(".config-entity-row");
      const direction = moveButton.dataset.configMove;
      if (row && direction === "up" && row.previousElementSibling) {
        row.parentElement.insertBefore(row, row.previousElementSibling);
        state.configDirty = true;
      } else if (row && direction === "down" && row.nextElementSibling) {
        row.parentElement.insertBefore(row.nextElementSibling, row);
        state.configDirty = true;
      }
      return;
    }
    const sceneButton = event.target.closest('[data-action="scene"]');
    if (sceneButton) {
      activateScene(sceneButton.dataset.id);
      return;
    }
    const entityButton = event.target.closest('[data-action="entity"]');
    if (entityButton) {
      sendAction(entityButton.dataset.id, entityButton.dataset.command, entityButton.dataset.value, entityButton);
    }
  });

  function registerActivity(event) {
    if (state.photoFrameVisible) {
      if (photoFrame.contains(event.target)) return;
      exitPhotoFrame();
      return;
    }
    schedulePhotoFrame();
  }

  photoFrame.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    exitPhotoFrame();
  });
  $("#photo-frame-exit").addEventListener("click", (event) => {
    event.stopPropagation();
    exitPhotoFrame();
  });
  document.addEventListener("pointerdown", registerActivity, { passive: true });
  document.addEventListener("keydown", (event) => {
    if (state.photoFrameVisible) {
      exitPhotoFrame();
      return;
    }
    registerActivity(event);
  });

  document.addEventListener("change", (event) => {
    if (event.target.closest("#config-view")) state.configDirty = true;
    const source = event.target.closest('[data-action="source"]');
    if (source && source.value) sendAction(source.dataset.id, "source", source.value);
    const volume = event.target.closest('[data-action="volume"]');
    if (volume) sendAction(volume.dataset.id, "volume", Number(volume.value));
  });

  $("#refresh-button").addEventListener("click", () => load(true));
  load(false);
  loadPhotos();
  window.setInterval(renderSidebar, 30000);
})();

