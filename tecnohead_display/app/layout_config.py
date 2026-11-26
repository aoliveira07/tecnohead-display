"""Persistent, user-editable layout configuration for Tecnohead Display.

The display is intentionally configured through a small, validated document
instead of hard-coded front-end rules. The document is stored in the add-on
data directory, so a restart or an add-on update does not erase the chosen
rooms, labels, icons, navigation order, or entity selection.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

GROUP_DEFAULTS = (
    ("cozinha", "Cozinha", "kitchen"),
    ("externo", "Externo", "outdoor"),
    ("garagem", "Garagem", "garage"),
)

SECTION_DEFAULTS = {
    "lighting": True,
    "climate": True,
    "media": True,
    "covers": True,
    "locks": True,
    "cameras": True,
    "other": True,
}

SECTION_LABELS = {
    "lighting": "Iluminação",
    "climate": "Clima",
    "media": "Áudio e vídeo",
    "covers": "Persianas e portões",
    "locks": "Travas",
    "cameras": "Câmeras",
    "other": "Outros dispositivos",
}

# These keys are the only icon names accepted from the editor. The browser
# maps them to its local SVG icon set; no HTML or SVG is accepted from users.
ICON_CHOICES = (
    ("home", "Casa"),
    ("kitchen", "Cozinha"),
    ("outdoor", "Externo"),
    ("garage", "Garagem"),
    ("light", "Luzes"),
    ("climate", "Clima"),
    ("fan", "Ventilação"),
    ("cover", "Persianas"),
    ("lock", "Travas"),
    ("camera", "Câmeras"),
    ("media", "Áudio"),
    ("tv", "TV"),
    ("car", "Carro"),
    ("energy", "Energia"),
    ("scene", "Cena"),
    ("sensor", "Sensor"),
    ("button", "Ação"),
)
VALID_ICON_KEYS = {key for key, _ in ICON_CHOICES}

NAV_DEFAULTS = (
    ("home", "Casa", "all", "home"),
    ("lighting", "Luzes", "solution", "light"),
    ("climate", "Clima", "solution", "climate"),
    ("covers", "Persianas", "solution", "cover"),
    ("locks", "Travas", "solution", "lock"),
    ("cameras", "Câmeras", "cameras", "camera"),
    ("energy", "Energia", "energy", "energy"),
    ("garage", "Garagem", "garage", "garage"),
)


def _strings(value: Any, limit: int = 300) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value[:limit]:
        item = str(item).strip()
        if item and item not in result:
            result.append(item)
    return result


def _icon(value: Any, fallback: str) -> str:
    candidate = str(value or "").strip().lower()
    return candidate if candidate in VALID_ICON_KEYS else fallback


def _entity_settings(value: Any, limit: int = 500) -> dict[str, dict[str, str]]:
    """Normalize per-entity display overrides without accepting arbitrary data."""

    if not isinstance(value, dict):
        return {}
    result: dict[str, dict[str, str]] = {}
    for raw_entity_id, raw_setting in list(value.items())[:limit]:
        entity_id = str(raw_entity_id).strip()[:255]
        if not entity_id or not isinstance(raw_setting, dict):
            continue
        setting: dict[str, str] = {}
        label = str(raw_setting.get("label") or "").strip()
        if label:
            setting["label"] = label[:80]
        icon = str(raw_setting.get("icon") or "").strip().lower()
        if icon in VALID_ICON_KEYS:
            setting["icon"] = icon
        if setting:
            result[entity_id] = setting
    return result


def _navigation(value: Any) -> list[dict[str, object]]:
    """Keep the known navigation items, in the user's chosen order."""

    raw_items = value if isinstance(value, list) else []
    by_key = {
        str(item.get("key")): item
        for item in raw_items
        if isinstance(item, dict) and str(item.get("key", "")).strip()
    }
    defaults = {key: (label, view, icon) for key, label, view, icon in NAV_DEFAULTS}
    result: list[dict[str, object]] = []
    seen: set[str] = set()

    def append(key: str) -> None:
        if key in seen or key not in defaults:
            return
        default_label, view, default_icon = defaults[key]
        candidate = by_key.get(key) if isinstance(by_key.get(key), dict) else {}
        result.append(
            {
                "key": key,
                "label": str(candidate.get("label") or default_label)[:40],
                "view": view,
                "icon": _icon(candidate.get("icon"), default_icon),
                "enabled": bool(candidate.get("enabled", True)),
            }
        )
        seen.add(key)

    for item in raw_items:
        if isinstance(item, dict):
            append(str(item.get("key") or ""))
    for key, _, _, _ in NAV_DEFAULTS:
        append(key)
    return result


def default_layout() -> dict[str, object]:
    """Return the automatic first-run layout used before customization."""

    return {
        "version": 2,
        "appearance": {
            "theme": "apple-dark",
            "accent": "orange",
            "show_sidebar": True,
        },
        "navigation": [
            {
                "key": key,
                "label": label,
                "view": view,
                "icon": icon,
                "enabled": True,
            }
            for key, label, view, icon in NAV_DEFAULTS
        ],
        "entity_settings": {},
        "groups": [
            {
                "key": key,
                "label": label,
                "icon": icon,
                "enabled": True,
                "area_ids": [],
                "manual": False,
                "entity_ids": [],
                "order": [],
                "sections": dict(SECTION_DEFAULTS),
            }
            for key, label, icon in GROUP_DEFAULTS
        ],
        "garage": {
            "label": "Garagem",
            "icon": "garage",
            "enabled": True,
            "manual": False,
            "entity_ids": [],
            "order": [],
        },
    }


def normalize_layout(value: Any) -> dict[str, object]:
    """Keep only the small, predictable layout document the UI needs."""

    raw = value if isinstance(value, dict) else {}
    raw_groups = raw.get("groups") if isinstance(raw.get("groups"), list) else []
    by_key = {
        str(group.get("key")): group
        for group in raw_groups
        if isinstance(group, dict) and str(group.get("key", "")).strip()
    }
    groups: list[dict[str, object]] = []
    for key, default_label, default_icon in GROUP_DEFAULTS:
        candidate = by_key.get(key) if isinstance(by_key.get(key), dict) else {}
        raw_sections = candidate.get("sections")
        sections = {
            name: bool(raw_sections.get(name, enabled))
            if isinstance(raw_sections, dict)
            else enabled
            for name, enabled in SECTION_DEFAULTS.items()
        }
        groups.append(
            {
                "key": key,
                "label": str(candidate.get("label") or default_label)[:60],
                "icon": _icon(candidate.get("icon"), default_icon),
                "enabled": bool(candidate.get("enabled", True)),
                "area_ids": _strings(candidate.get("area_ids"), 32),
                "manual": bool(candidate.get("manual", False)),
                "entity_ids": _strings(candidate.get("entity_ids")),
                "order": _strings(candidate.get("order")),
                "sections": sections,
            }
        )

    raw_appearance = raw.get("appearance") if isinstance(raw.get("appearance"), dict) else {}
    theme = str(raw_appearance.get("theme") or "apple-dark").strip().lower()
    if theme not in {"apple-dark", "graphite-orange"}:
        theme = "apple-dark"
    accent = str(raw_appearance.get("accent") or "orange").strip().lower()
    if accent not in {"orange", "blue", "green"}:
        accent = "orange"

    raw_garage = raw.get("garage") if isinstance(raw.get("garage"), dict) else {}
    return {
        "version": 2,
        "appearance": {
            "theme": theme,
            "accent": accent,
            "show_sidebar": bool(raw_appearance.get("show_sidebar", True)),
        },
        "navigation": _navigation(raw.get("navigation")),
        "entity_settings": _entity_settings(raw.get("entity_settings")),
        "groups": groups,
        "garage": {
            "label": str(raw_garage.get("label") or "Garagem")[:60],
            "icon": _icon(raw_garage.get("icon"), "garage"),
            "enabled": bool(raw_garage.get("enabled", True)),
            "manual": bool(raw_garage.get("manual", False)),
            "entity_ids": _strings(raw_garage.get("entity_ids")),
            "order": _strings(raw_garage.get("order")),
        },
    }


def layout_schema() -> dict[str, object]:
    """Return the editor catalog used by the front end."""

    return {
        "icons": [{"key": key, "label": label} for key, label in ICON_CHOICES],
        "sections": [
            {"key": key, "label": label}
            for key, label in SECTION_LABELS.items()
        ],
        "navigation": [
            {"key": key, "label": label, "view": view, "icon": icon}
            for key, label, view, icon in NAV_DEFAULTS
        ],
    }


class DisplayLayoutStore:
    """Read and write the layout in the add-on's persistent ``/data`` mount."""

    def __init__(self, path: str | Path | None = None) -> None:
        configured = path or os.environ.get("DISPLAY_LAYOUT_PATH", "/data/display-layout.json")
        self.path = Path(configured)

    def load(self) -> dict[str, object]:
        try:
            value = json.loads(self.path.read_text(encoding="utf-8"))
        except (FileNotFoundError, OSError, json.JSONDecodeError):
            return default_layout()
        return normalize_layout(value)

    def save(self, value: Any) -> dict[str, object]:
        layout = normalize_layout(value)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with NamedTemporaryFile(
            "w", encoding="utf-8", dir=self.path.parent, prefix=".display-layout-", delete=False
        ) as temporary:
            json.dump(layout, temporary, ensure_ascii=False, indent=2)
            temporary.write("\n")
            temporary_path = Path(temporary.name)
        temporary_path.replace(self.path)
        return layout

    def reset(self) -> dict[str, object]:
        return self.save(default_layout())
