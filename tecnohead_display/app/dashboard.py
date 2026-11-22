"""Home Assistant discovery and safe actions for Tecnohead Display."""

from __future__ import annotations

import re
from datetime import UTC, datetime

from .ha_client import HomeAssistantClient

DISPLAY_DOMAINS = {
    "binary_sensor",
    "button",
    "climate",
    "cover",
    "fan",
    "input_boolean",
    "light",
    "lock",
    "media_player",
    "number",
    "scene",
    "script",
    "select",
    "sensor",
    "switch",
    "vacuum",
}

SAFE_ATTRIBUTE_KEYS = {
    "brightness",
    "device_class",
    "entity_category",
    "fan_mode",
    "friendly_name",
    "hvac_action",
    "hvac_mode",
    "icon",
    "is_volume_muted",
    "media_album_name",
    "media_artist",
    "media_duration",
    "media_position",
    "media_title",
    "percentage",
    "source",
    "source_list",
    "state_class",
    "swing_mode",
    "target_temperature",
    "target_temp_high",
    "target_temp_low",
    "temperature",
    "unit_of_measurement",
    "volume_level",
}

ENERGY_BUCKETS = ("generation", "consumption", "grid", "storage")
ENERGY_KEYWORDS = {
    "generation": (
        "solar",
        "sol",
        "fotovolta",
        "geração",
        "geracao",
        "generation",
        "inversor",
        "pv_",
    ),
    "consumption": ("consumo", "consumption", "load", "carga", "demanda"),
    "grid": ("rede", "grid", "concession", "import", "export", "injet", "meter"),
    "storage": ("bateria", "battery", "armazen", "storage", "soc", "state_of_charge"),
}
GARAGE_KEYWORDS = (
    "garagem",
    "garage",
    "carro",
    "car",
    "veículo",
    "veiculo",
    "vehicle",
    "wallbox",
    "carregador",
    "charger",
    "ev_",
)
ENTITY_ID_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")


def _text(*values: object) -> str:
    return " ".join(str(value).strip().lower() for value in values if value)


def _number(value: object) -> float | int | None:
    if value is None or value == "" or str(value).strip().lower() in {
        "unknown",
        "unavailable",
        "none",
    }:
        return None
    try:
        parsed = float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return None
    return int(parsed) if parsed.is_integer() else parsed


def _boolean(value: object) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def safe_attributes(attributes: object) -> dict[str, object]:
    """Keep only display-safe, small attributes from a Home Assistant state."""

    if not isinstance(attributes, dict):
        return {}
    result: dict[str, object] = {}
    for key in SAFE_ATTRIBUTE_KEYS:
        value = attributes.get(key)
        if value is None:
            continue
        if key == "source_list" and isinstance(value, list):
            result[key] = [str(item) for item in value[:24]]
        elif isinstance(value, (str, int, float, bool)):
            result[key] = value
    return result


def classify_energy(entity: dict[str, object]) -> str | None:
    """Classify a sensor using only explicit Home Assistant metadata and names."""

    attributes = entity.get("attributes") if isinstance(entity.get("attributes"), dict) else {}
    device_class = str(attributes.get("device_class", "")).lower()
    haystack = _text(
        entity.get("entity_id"),
        entity.get("name"),
        entity.get("area_name"),
        entity.get("device_name"),
        attributes.get("friendly_name"),
    )
    if device_class in {"battery", "battery_charging"} or any(
        word in haystack for word in ENERGY_KEYWORDS["storage"]
    ):
        return "storage"
    for bucket in ("generation", "grid", "consumption"):
        if any(word in haystack for word in ENERGY_KEYWORDS[bucket]):
            return bucket
    if device_class in {"energy", "power"}:
        return "consumption"
    return None


def is_garage_related(entity: dict[str, object]) -> bool:
    haystack = _text(
        entity.get("entity_id"),
        entity.get("name"),
        entity.get("area_name"),
        entity.get("device_name"),
    )
    return any(word in haystack for word in GARAGE_KEYWORDS)


def _area_name(area_id: str, area_by_id: dict[str, dict[str, object]]) -> str:
    if area_id in area_by_id:
        return str(area_by_id[area_id].get("name") or area_id)
    return "Sem cômodo"


def serialize_entity(
    state: dict[str, object],
    registry: dict[str, object],
    device: dict[str, object],
    area_by_id: dict[str, dict[str, object]],
) -> dict[str, object]:
    entity_id = str(state.get("entity_id", ""))
    domain = entity_id.split(".", 1)[0] if "." in entity_id else ""
    attributes = safe_attributes(state.get("attributes"))
    area_id = str(registry.get("area_id") or device.get("area_id") or "unassigned")
    name = str(attributes.get("friendly_name") or registry.get("name") or entity_id)
    result = {
        "entity_id": entity_id,
        "domain": domain,
        "name": name,
        "state": state.get("state", "unknown"),
        "numeric_value": _number(state.get("state")),
        "area_id": area_id,
        "area_name": _area_name(area_id, area_by_id),
        "device_name": str(device.get("name") or ""),
        "icon": attributes.get("icon") or registry.get("icon"),
        "attributes": attributes,
    }
    return result


def _area_rows(
    area_registry: list[dict[str, object]], entities: list[dict[str, object]]
) -> dict[str, dict[str, object]]:
    result: dict[str, dict[str, object]] = {}
    for row in area_registry:
        area_id = str(row.get("area_id") or "").strip()
        if not area_id:
            continue
        result[area_id] = {
            "id": area_id,
            "name": str(row.get("name") or area_id),
            "icon": row.get("icon"),
            "entities": [],
        }
    for entity in entities:
        area_id = str(entity.get("area_id") or "unassigned")
        if area_id not in result:
            result[area_id] = {
                "id": area_id,
                "name": str(entity.get("area_name") or "Sem cômodo"),
                "icon": None,
                "entities": [],
            }
    return result


async def build_dashboard(client: HomeAssistantClient) -> dict[str, object]:
    config, states, registries = await _read_home(client)
    area_registry = registries.get("areas", [])
    entity_registry = {
        str(row.get("entity_id")): row
        for row in registries.get("entities", [])
        if row.get("entity_id")
    }
    device_registry = {
        str(row.get("id")): row
        for row in registries.get("devices", [])
        if row.get("id")
    }
    area_seed = {
        str(row.get("area_id")): row
        for row in area_registry
        if row.get("area_id")
    }

    entities: list[dict[str, object]] = []
    for state in states:
        entity_id = str(state.get("entity_id") or "")
        domain = entity_id.split(".", 1)[0] if "." in entity_id else ""
        registry = entity_registry.get(entity_id, {})
        if (
            domain not in DISPLAY_DOMAINS
            or registry.get("disabled_by")
            or registry.get("hidden_by")
        ):
            continue
        device = device_registry.get(str(registry.get("device_id") or ""), {})
        entities.append(serialize_entity(state, registry, device, area_seed))

    area_by_id = _area_rows(area_registry, entities)
    for entity in entities:
        area_by_id[str(entity["area_id"])]["entities"].append(entity)

    areas = sorted(
        area_by_id.values(),
        key=lambda area: (str(area.get("name", "")).lower(), str(area.get("id", ""))),
    )
    scenes = [entity for entity in entities if entity["domain"] in {"scene", "script"}]
    media = [entity for entity in entities if entity["domain"] == "media_player"]

    metrics: dict[str, list[dict[str, object]]] = {bucket: [] for bucket in ENERGY_BUCKETS}
    garage: list[dict[str, object]] = []
    for entity in entities:
        bucket = classify_energy(entity)
        if bucket:
            metrics[bucket].append(entity)
        if is_garage_related(entity):
            garage.append(entity)

    return {
        "app": {"name": "Tecnohead Display", "version": "0.5.0"},
        "home": {"name": str(config.get("location_name") or "Casa")},
        "areas": areas,
        "scenes": scenes,
        "media": media,
        "energy": {
            "metrics": metrics,
            "available": any(metrics[bucket] for bucket in ENERGY_BUCKETS),
        },
        "garage": {"entities": garage, "available": bool(garage)},
        "summary": {
            "entities": len(entities),
            "areas": len(areas),
            "scenes": len(scenes),
            "media": len(media),
        },
        "refresh_seconds": int(os_environ_int("DISPLAY_REFRESH_SECONDS", 10)),
        "updated_at": datetime.now(UTC).isoformat(),
    }


async def _read_home(
    client: HomeAssistantClient,
) -> tuple[dict[str, object], list[dict[str, object]], dict[str, list[dict[str, object]]]]:
    import asyncio

    config, states, registries = await asyncio.gather(
        client.config(), client.states(), client.registry_snapshot()
    )
    return config, states, registries


def os_environ_int(name: str, default: int) -> int:
    import os

    try:
        return max(3, min(120, int(os.environ.get(name, default))))
    except (TypeError, ValueError):
        return default


async def execute_entity_action(
    client: HomeAssistantClient,
    entity_id: str,
    action: str,
    value: object = None,
) -> dict[str, object]:
    """Execute a deliberately small, auditable set of touch actions."""

    if not ENTITY_ID_RE.fullmatch(entity_id):
        raise ValueError("entity_id inválido")
    domain = entity_id.split(".", 1)[0]
    service: str | None = None
    service_data: dict[str, object] = {"entity_id": entity_id}

    if domain in {"light", "switch", "fan", "input_boolean"} and action in {
        "turn_on",
        "turn_off",
        "toggle",
    }:
        service = action
    elif domain == "media_player":
        service = {
            "play": "media_play",
            "pause": "media_pause",
            "play_pause": "media_play_pause",
            "stop": "media_stop",
            "mute": "volume_mute",
            "source": "select_source",
            "volume": "volume_set",
        }.get(action)
        if action == "volume":
            numeric = _number(value)
            if numeric is None:
                raise ValueError("volume inválido")
            service_data["volume_level"] = max(0.0, min(1.0, float(numeric) / 100))
        elif action == "mute":
            service_data["is_volume_muted"] = _boolean(value)
        elif action == "source":
            if not isinstance(value, str) or not value.strip():
                raise ValueError("source inválida")
            service_data["source"] = value.strip()
    elif domain == "cover" and action in {"open", "close", "stop"}:
        service = {"open": "open_cover", "close": "close_cover", "stop": "stop_cover"}[action]
    elif domain == "lock" and action in {"lock", "unlock"}:
        service = f"{action}_lock"
    elif domain == "button" and action == "press":
        service = "press"
    elif domain in {"scene", "script"} and action == "activate":
        service = "turn_on"
    elif domain == "number" and action == "set_value":
        numeric = _number(value)
        if numeric is None:
            raise ValueError("valor numérico inválido")
        service = "set_value"
        service_data["value"] = numeric
    elif domain == "select" and action == "select_option":
        if not isinstance(value, str) or not value.strip():
            raise ValueError("opção inválida")
        service = "select_option"
        service_data["option"] = value.strip()
    else:
        raise ValueError("ação não permitida para esta entidade")

    await client.call_service(domain, service, service_data)
    return {"ok": True, "entity_id": entity_id, "action": action, "service": service}

