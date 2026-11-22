(() => {
  "use strict";

  const state = { payload: null, view: "all", areaId: null, loading: false, timer: null };
  const $ = (selector) => document.querySelector(selector);
  const roomList = $("#room-list");

  const ICONS = {
    light: "✦",
    switch: "◉",
    fan: "◌",
    cover: "▱",
    climate: "⌁",
    sensor: "·",
    binary_sensor: "◌",
    media_player: "♫",
    scene: "✧",
    script: "⌘",
    garage: "▰",
    energy: "ϟ",
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

  function iconFor(entity) {
    const domain = entity?.domain || "sensor";
    const custom = String(entity?.icon || "");
    if (custom.includes("lightbulb")) return "✦";
    if (custom.includes("speaker") || custom.includes("music")) return "♫";
    return ICONS[domain] || "·";
  }

  function areaIcon(area) {
    const text = `${area?.name || ""} ${area?.id || ""}`.toLowerCase();
    if (text.includes("coz")) return "⌂";
    if (text.includes("extern") || text.includes("pisc")) return "◒";
    if (text.includes("cinema") || text.includes("tv")) return "▣";
    if (text.includes("escrit")) return "⌁";
    if (text.includes("quarto") || text.includes("sala")) return "◌";
    return "⌂";
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

  function cardHeader(entity) {
    return `
      <div class="card-top">
        <div class="card-icon">${iconFor(entity)}</div>
        <div class="card-title">
          <div class="card-name" title="${esc(entity.name)}">${esc(entity.name)}</div>
          <div class="card-meta" title="${esc(entity.area_name || entity.entity_id)}">${esc(entity.area_name || entity.entity_id)}</div>
        </div>
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
      <article class="card card-wide">
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
      <article class="card">
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
      <article class="card">
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

  function renderGarage() {
    $("#page-title").textContent = "Garagem";
    $("#page-subtitle").textContent = "Carregamento, carro e acesso próximos deste ambiente.";
    const entities = state.payload?.garage?.entities || [];
    $("#garage-grid").innerHTML = entities.length
      ? entities.map(entityCard).join("")
      : `<div class="empty-state"><div><strong>Garagem ainda sem entidades mapeadas</strong><span>Nomeie a área ou entidade como garagem, carro, wallbox ou carregador no Home Assistant para ela aparecer aqui.</span></div></div>`;
  }

  function render() {
    if (!state.payload) return;
    renderRoomList();
    const room = $("#room-view");
    const energy = $("#energy-view");
    const garage = $("#garage-view");
    room.classList.toggle("is-hidden", state.view !== "all" && state.view !== "area");
    energy.classList.toggle("is-hidden", state.view !== "energy");
    garage.classList.toggle("is-hidden", state.view !== "garage");
    if (state.view === "energy") renderEnergy();
    else if (state.view === "garage") renderGarage();
    else renderRoom();
    $("#last-update").textContent = formatUpdated(state.payload.updated_at);
  }

  function selectViewButton(viewButton) {
    state.view = viewButton.dataset.view;
    state.areaId = viewButton.dataset.areaId || null;
    render();
  }

  async function load(showToast = false) {
    if (state.loading) return;
    state.loading = true;
    $("#refresh-button").classList.add("is-loading");
    try {
      const response = await fetch("api/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.payload = await response.json();
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

  document.addEventListener("change", (event) => {
    const source = event.target.closest('[data-action="source"]');
    if (source && source.value) sendAction(source.dataset.id, "source", source.value);
    const volume = event.target.closest('[data-action="volume"]');
    if (volume) sendAction(volume.dataset.id, "volume", Number(volume.value));
  });

  $("#refresh-button").addEventListener("click", () => load(true));
  load(false);
})();

