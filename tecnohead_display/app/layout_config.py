"""Persistent, user-editable layout configuration for Tecnohead Display."""

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
    "media": True,
    "other": True,
}


def _strings(value: Any, limit: int = 300) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value[:limit]:
        item = str(item).strip()
        if item and item not in result:
            result.append(item)
    return result


def default_layout() -> dict[str, object]:
    """Return the automatic first-run layout used before a user customizes it."""

    return {
        "version": 1,
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
                "icon": default_icon,
                "enabled": bool(candidate.get("enabled", True)),
                "area_ids": _strings(candidate.get("area_ids"), 32),
                "manual": bool(candidate.get("manual", False)),
                "entity_ids": _strings(candidate.get("entity_ids")),
                "order": _strings(candidate.get("order")),
                "sections": sections,
            }
        )

    raw_garage = raw.get("garage") if isinstance(raw.get("garage"), dict) else {}
    return {
        "version": 1,
        "groups": groups,
        "garage": {
            "enabled": bool(raw_garage.get("enabled", True)),
            "manual": bool(raw_garage.get("manual", False)),
            "entity_ids": _strings(raw_garage.get("entity_ids")),
            "order": _strings(raw_garage.get("order")),
        },
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
