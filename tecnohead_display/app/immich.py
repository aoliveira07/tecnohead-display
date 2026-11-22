"""Read-only Immich album synchronisation for the display photo frame."""

from __future__ import annotations

import asyncio
import json
import mimetypes
import os
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import quote

import httpx


class ImmichError(RuntimeError):
    """Raised when Immich cannot answer a read-only photo request."""


@dataclass(slots=True)
class ImmichPhotoFrame:
    base_url: str
    api_key: str
    album_id: str
    cache_dir: Path
    sync_interval_seconds: int = 600
    idle_seconds: int = 180
    interval_seconds: int = 12
    timeout: float = 15.0
    max_photos: int = 120
    _lock: asyncio.Lock = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self.base_url = self.base_url.rstrip("/")
        if self.base_url.endswith("/api"):
            self.base_url = self.base_url[:-4].rstrip("/")
        self.sync_interval_seconds = max(60, int(self.sync_interval_seconds))
        self.idle_seconds = max(30, int(self.idle_seconds))
        self.interval_seconds = max(5, int(self.interval_seconds))
        self._lock = asyncio.Lock()

    @classmethod
    def from_env(cls) -> ImmichPhotoFrame:
        return cls(
            base_url=os.environ.get("IMMICH_URL", "http://192.168.0.201:2283"),
            api_key=os.environ.get("IMMICH_API_KEY", "").strip(),
            album_id=os.environ.get("IMMICH_ALBUM_ID", "").strip(),
            cache_dir=Path(os.environ.get("PHOTO_CACHE_DIR", "/data/photo-frame")),
            sync_interval_seconds=_env_int("PHOTO_SYNC_MINUTES", 10) * 60,
            idle_seconds=_env_int("PHOTO_IDLE_SECONDS", 180),
            interval_seconds=_env_int("PHOTO_INTERVAL_SECONDS", 12),
        )

    @property
    def configured(self) -> bool:
        return bool(self.base_url and self.api_key and self.album_id)

    def public_config(self) -> dict[str, object]:
        return {
            "enabled": self.configured,
            "sync_interval_seconds": self.sync_interval_seconds,
            "idle_seconds": self.idle_seconds,
            "interval_seconds": self.interval_seconds,
        }

    @property
    def manifest_path(self) -> Path:
        return self.cache_dir / "manifest.json"

    def _read_manifest(self) -> dict[str, object]:
        try:
            data = json.loads(self.manifest_path.read_text(encoding="utf-8"))
        except (FileNotFoundError, OSError, json.JSONDecodeError):
            data = {}
        if not isinstance(data, dict):
            data = {}
        photos = data.get("photos")
        data["photos"] = photos if isinstance(photos, list) else []
        return data

    def _write_manifest(self, manifest: dict[str, object]) -> None:
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        temporary = self.manifest_path.with_suffix(".tmp")
        temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(self.manifest_path)

    def _headers(self, accept: str = "application/json") -> dict[str, str]:
        return {"Accept": accept, "x-api-key": self.api_key}

    def _url(self, path: str) -> str:
        return f"{self.base_url}/{path.lstrip('/')}"

    async def _request_json(self, method: str, path: str, **kwargs: object) -> object:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as http:
                response = await http.request(
                    method,
                    self._url(path),
                    headers=self._headers(),
                    **kwargs,
                )
        except httpx.HTTPError as exc:
            raise ImmichError(f"Falha de rede ao acessar Immich: {exc}") from exc
        if response.is_error:
            detail = response.text[:180].replace("\n", " ")
            raise ImmichError(f"Immich respondeu HTTP {response.status_code}: {detail}")
        try:
            return response.json()
        except ValueError as exc:
            raise ImmichError("Immich devolveu uma resposta inválida") from exc

    async def _search_assets(self) -> list[dict[str, object]]:
        assets: list[dict[str, object]] = []
        page = 1
        visited_pages: set[int] = set()
        while len(assets) < self.max_photos and page not in visited_pages:
            visited_pages.add(page)
            result = await self._request_json(
                "POST",
                "/api/search/metadata",
                json={
                    "albumIds": [self.album_id],
                    "page": page,
                    "size": self.max_photos,
                    "withExif": False,
                    "withPeople": False,
                    "withStacked": False,
                },
            )
            if not isinstance(result, dict):
                break
            container = result.get("assets", result)
            if isinstance(container, dict):
                page_items = container.get("items", [])
                next_page = container.get("nextPage")
            else:
                page_items = container if isinstance(container, list) else []
                next_page = None
            if not isinstance(page_items, list):
                break
            assets.extend(item for item in page_items if isinstance(item, dict))
            if not next_page:
                break
            try:
                page = int(next_page)
            except (TypeError, ValueError):
                break
        return assets[: self.max_photos]

    @staticmethod
    def _is_image(asset: dict[str, object]) -> bool:
        asset_type = str(asset.get("type") or "").upper()
        mime = str(asset.get("originalMimeType") or asset.get("mimeType") or "").lower()
        if asset_type and asset_type not in {"IMAGE", "PHOTO"}:
            return False
        return not mime or mime.startswith("image/")

    @staticmethod
    def _extension(asset: dict[str, object]) -> str:
        mime = str(asset.get("originalMimeType") or asset.get("mimeType") or "")
        extension = mimetypes.guess_extension(mime) if mime else None
        if extension:
            return extension.lower()
        original_name = str(asset.get("originalFileName") or "")
        suffix = Path(original_name).suffix.lower()
        return suffix if suffix in {".jpg", ".jpeg", ".png", ".webp", ".avif"} else ".jpg"

    async def _download_preview(self, asset_id: str, destination: Path) -> None:
        try:
            async with httpx.AsyncClient(timeout=max(self.timeout, 30.0)) as http:
                response = await http.get(
                    self._url(f"/api/assets/{quote(asset_id, safe='')}/thumbnail"),
                    headers=self._headers("image/*"),
                    params={"size": "preview"},
                )
        except httpx.HTTPError as exc:
            raise ImmichError(f"Falha ao baixar uma foto do Immich: {exc}") from exc
        if response.is_error:
            raise ImmichError(f"Immich não entregou a miniatura (HTTP {response.status_code})")
        temporary = destination.with_suffix(destination.suffix + ".part")
        temporary.write_bytes(response.content)
        temporary.replace(destination)

    async def sync(self, force: bool = False) -> dict[str, object]:
        async with self._lock:
            manifest = self._read_manifest()
            if not self.configured:
                return manifest
            if not force and not self._sync_due(manifest):
                return manifest
            try:
                assets = [asset for asset in await self._search_assets() if self._is_image(asset)]
                previous = {
                    str(photo.get("id")): photo
                    for photo in manifest.get("photos", [])
                    if isinstance(photo, dict) and photo.get("id")
                }
                photos: list[dict[str, object]] = []
                self.cache_dir.mkdir(parents=True, exist_ok=True)
                for asset in assets:
                    asset_id = str(asset.get("id") or "").strip()
                    if not asset_id:
                        continue
                    filename = f"{asset_id}{self._extension(asset)}"
                    destination = self.cache_dir / filename
                    prior = previous.get(asset_id, {})
                    changed = (
                        not destination.exists()
                        or prior.get("updated_at") != asset.get("updatedAt")
                        or prior.get("checksum") != asset.get("checksum")
                    )
                    if changed:
                        await self._download_preview(asset_id, destination)
                    photos.append(
                        {
                            "id": asset_id,
                            "filename": filename,
                            "url": f"api/photos/{quote(filename, safe='')}",
                            "name": str(asset.get("originalFileName") or filename),
                            "created_at": asset.get("fileCreatedAt") or asset.get("localDateTime"),
                            "updated_at": asset.get("updatedAt"),
                            "checksum": asset.get("checksum"),
                        }
                    )
                manifest = {
                    "photos": photos,
                    "synced_at": datetime.now(UTC).isoformat(),
                    "error": None,
                }
                self._write_manifest(manifest)
                return manifest
            except ImmichError as exc:
                manifest["error"] = str(exc)
                self._write_manifest(manifest)
                return manifest

    async def list_photos(self, force: bool = False) -> dict[str, object]:
        manifest = await self.sync(force=force)
        photos = manifest.get("photos", [])
        return {
            "configured": self.configured,
            "photos": photos if isinstance(photos, list) else [],
            "count": len(photos) if isinstance(photos, list) else 0,
            "synced_at": manifest.get("synced_at"),
            "error": manifest.get("error"),
            **self.public_config(),
        }

    def _sync_due(self, manifest: dict[str, object]) -> bool:
        value = manifest.get("synced_at")
        if not isinstance(value, str) or not value:
            return True
        try:
            timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return True
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=UTC)
        return datetime.now(UTC) - timestamp >= timedelta(seconds=self.sync_interval_seconds)

    def photo_path(self, filename: str) -> Path | None:
        if not filename or "/" in filename or "\\" in filename or filename in {".", ".."}:
            return None
        root = self.cache_dir.resolve()
        candidate = (root / filename).resolve()
        if candidate.parent != root or not candidate.is_file():
            return None
        return candidate

    @staticmethod
    def media_type(path: Path) -> str:
        return mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default
