"""Small Home Assistant REST and WebSocket client used by the display."""

from __future__ import annotations

import asyncio
import json
import os
import re
from dataclasses import dataclass
from urllib.parse import urlsplit, urlunsplit

import httpx
import websockets


class HomeAssistantError(RuntimeError):
    """Raised when Home Assistant cannot answer a display request."""


@dataclass(slots=True)
class HomeAssistantClient:
    """Access Home Assistant without exposing its token to the browser."""

    base_url: str
    token: str
    timeout: float = 8.0

    @classmethod
    def from_env(cls) -> HomeAssistantClient:
        return cls(
            base_url=os.environ.get("HA_URL", "http://supervisor/core").rstrip("/"),
            token=os.environ.get("SUPERVISOR_TOKEN") or os.environ.get("HA_TOKEN", ""),
        )

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _url(self, path: str) -> str:
        return f"{self.base_url}/{path.lstrip('/')}"

    async def _request(self, method: str, path: str, **kwargs: object) -> object:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as http:
                response = await http.request(
                    method,
                    self._url(path),
                    headers=self._headers(),
                    **kwargs,
                )
        except httpx.HTTPError as exc:
            raise HomeAssistantError(f"Falha de rede ao acessar Home Assistant: {exc}") from exc

        if response.is_error:
            detail = response.text[:240].replace("\n", " ")
            raise HomeAssistantError(
                f"Home Assistant respondeu HTTP {response.status_code}: {detail}"
            )
        try:
            return response.json()
        except ValueError as exc:
            raise HomeAssistantError("Home Assistant devolveu uma resposta inválida") from exc

    async def config(self) -> dict[str, object]:
        result = await self._request("GET", "/api/config")
        return result if isinstance(result, dict) else {}

    async def states(self) -> list[dict[str, object]]:
        result = await self._request("GET", "/api/states")
        return result if isinstance(result, list) else []

    async def call_service(
        self, domain: str, service: str, service_data: dict[str, object]
    ) -> object:
        return await self._request(
            "POST",
            f"/api/services/{domain}/{service}",
            json=service_data,
        )

    async def camera_image(self, entity_id: str) -> tuple[bytes, str]:
        """Fetch one camera frame while keeping the HA token on the backend."""

        if not re.fullmatch(r"camera\.[a-z0-9_]+", entity_id):
            raise HomeAssistantError("Entidade de câmera inválida")
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as http:
                response = await http.get(
                    self._url(f"/api/camera_proxy/{entity_id}"),
                    headers={**self._headers(), "Accept": "image/*"},
                )
        except httpx.HTTPError as exc:
            raise HomeAssistantError(f"Falha de rede ao acessar câmera: {exc}") from exc

        if response.is_error:
            detail = response.text[:240].replace("\n", " ")
            raise HomeAssistantError(
                f"Home Assistant respondeu HTTP {response.status_code}: {detail}"
            )
        content_type = response.headers.get("content-type", "image/jpeg").split(";", 1)[0]
        if not content_type.startswith("image/"):
            content_type = "image/jpeg"
        return response.content, content_type

    def _websocket_url(self) -> str:
        parsed = urlsplit(self.base_url)
        scheme = "wss" if parsed.scheme == "https" else "ws"
        websocket_suffix = (
            "/websocket" if parsed.path.rstrip("/").endswith("/core") else "/api/websocket"
        )
        path = f"{parsed.path.rstrip('/')}{websocket_suffix}"
        return urlunsplit((scheme, parsed.netloc, path, "", ""))

    async def _ws_command(
        self, websocket: websockets.ClientConnection, command_id: int, command: str
    ) -> object:
        await websocket.send(json.dumps({"id": command_id, "type": command}))
        while True:
            raw = await asyncio.wait_for(websocket.recv(), timeout=self.timeout)
            message = json.loads(raw)
            if message.get("id") != command_id:
                continue
            if not message.get("success", False):
                raise HomeAssistantError(str(message.get("error", "WebSocket command failed")))
            return message.get("result", [])

    async def registry_snapshot(self) -> dict[str, list[dict[str, object]]]:
        """Read the registries needed to map entities to areas.

        The display still works when registries are unavailable; the caller treats an
        empty snapshot as a graceful fallback to the states endpoint.
        """

        if not self.token:
            return {}

        try:
            async with websockets.connect(
                self._websocket_url(),
                open_timeout=self.timeout,
                close_timeout=1,
                max_size=8 * 1024 * 1024,
            ) as websocket:
                first = json.loads(await asyncio.wait_for(websocket.recv(), timeout=self.timeout))
                if first.get("type") != "auth_required":
                    raise HomeAssistantError("Protocolo WebSocket inesperado")
                await websocket.send(json.dumps({"type": "auth", "access_token": self.token}))
                auth = json.loads(await asyncio.wait_for(websocket.recv(), timeout=self.timeout))
                if auth.get("type") != "auth_ok":
                    raise HomeAssistantError("Autenticação WebSocket recusada")

                result = {}
                for command_id, command, key in (
                    (1, "config/area_registry/list", "areas"),
                    (2, "config/entity_registry/list", "entities"),
                    (3, "config/device_registry/list", "devices"),
                ):
                    rows = await self._ws_command(websocket, command_id, command)
                    result[key] = rows if isinstance(rows, list) else []
                return result
        except (
            OSError,
            TimeoutError,
            json.JSONDecodeError,
            HomeAssistantError,
            websockets.WebSocketException,
        ):
            return {}

