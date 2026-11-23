import asyncio

import pytest

from tecnohead_display.app.dashboard import (
    build_dashboard,
    classify_energy,
    execute_entity_action,
    is_garage_related,
    safe_attributes,
)
from tecnohead_display.app.layout_config import DisplayLayoutStore


class FakeHomeAssistant:
    def __init__(self):
        self.calls = []

    async def config(self):
        return {"location_name": "Casa Tecnohead"}

    async def states(self):
        return [
            {
                "entity_id": "sensor.geracao_solar",
                "state": "2.4",
                "attributes": {
                    "friendly_name": "Geração solar",
                    "device_class": "power",
                    "unit_of_measurement": "kW",
                    "secret_attribute": "must not leave the backend",
                },
            },
            {
                "entity_id": "sensor.wallbox_power",
                "state": "7",
                "attributes": {
                    "friendly_name": "Wallbox",
                    "device_class": "power",
                    "unit_of_measurement": "kW",
                },
            },
            {
                "entity_id": "light.cozinha",
                "state": "on",
                "attributes": {"friendly_name": "Luz da cozinha", "icon": "mdi:lightbulb"},
            },
            {
                "entity_id": "scene.festa",
                "state": "scening",
                "attributes": {"friendly_name": "Festa"},
            },
        ]

    async def registry_snapshot(self):
        return {
            "areas": [
                {"area_id": "cozinha", "name": "Cozinha"},
                {"area_id": "garagem", "name": "Garagem"},
            ],
            "entities": [
                {"entity_id": "sensor.geracao_solar", "area_id": "cozinha"},
                {"entity_id": "sensor.wallbox_power", "area_id": "garagem"},
                {"entity_id": "light.cozinha", "area_id": "cozinha"},
                {"entity_id": "scene.festa", "area_id": "cozinha"},
            ],
            "devices": [],
        }

    async def call_service(self, domain, service, service_data):
        self.calls.append((domain, service, service_data))
        return []


def test_safe_attributes_do_not_forward_unknown_data():
    result = safe_attributes(
        {"friendly_name": "Cozinha", "unit_of_measurement": "W", "password": "hidden"}
    )
    assert result == {"friendly_name": "Cozinha", "unit_of_measurement": "W"}


def test_energy_and_garage_classification_uses_names():
    solar = {"entity_id": "sensor.pv_power", "name": "PV", "attributes": {"device_class": "power"}}
    charger = {"entity_id": "sensor.wallbox_power", "name": "Wallbox", "area_name": "Garagem"}
    odometer = {"entity_id": "sensor.volvo_xc40_odometer", "name": "Odometer"}
    door = {"entity_id": "binary_sensor.volvo_xc40_front_door", "name": "Front door"}
    assert classify_energy(solar) == "generation"
    assert is_garage_related(charger)
    assert is_garage_related(odometer)
    assert is_garage_related(door)


def test_dashboard_groups_areas_and_exposes_only_safe_attributes():
    payload = asyncio.run(build_dashboard(FakeHomeAssistant()))

    assert payload["home"]["name"] == "Casa Tecnohead"
    assert {area["name"] for area in payload["areas"]} == {"Cozinha", "Garagem"}
    assert payload["energy"]["metrics"]["generation"][0]["numeric_value"] == 2.4
    assert payload["garage"]["entities"][0]["name"] == "Wallbox"
    assert "secret_attribute" not in payload["areas"][0]["entities"][0]["attributes"]
    assert payload["layout_config"]["layout"]["groups"][0]["key"] == "cozinha"
    assert payload["layout_config"]["catalog"]["areas"][0]["entities"]


def test_layout_store_persists_only_known_layout_fields(tmp_path):
    store = DisplayLayoutStore(tmp_path / "display-layout.json")
    saved = store.save(
        {
            "groups": [
                {
                    "key": "cozinha",
                    "area_ids": ["cozinha"],
                    "manual": True,
                    "entity_ids": ["light.cozinha"],
                    "order": ["light.cozinha"],
                    "sections": {"lighting": True, "media": False, "other": False},
                }
            ],
            "garage": {"manual": True, "entity_ids": ["sensor.carro"], "unexpected": "ignored"},
            "unexpected": "ignored",
        }
    )

    loaded = store.load()
    assert saved == loaded
    assert loaded["groups"][0]["area_ids"] == ["cozinha"]
    assert loaded["groups"][0]["sections"]["media"] is False
    assert "unexpected" not in loaded


def test_actions_are_limited_to_known_home_assistant_services():
    client = FakeHomeAssistant()
    asyncio.run(execute_entity_action(client, "light.cozinha", "toggle"))
    assert client.calls == [("light", "toggle", {"entity_id": "light.cozinha"})]

    with pytest.raises(ValueError):
        asyncio.run(execute_entity_action(client, "sensor.geracao_solar", "turn_off"))

