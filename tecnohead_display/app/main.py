"""FastAPI entrypoint for the Tecnohead Display Home Assistant add-on."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .dashboard import build_dashboard, execute_entity_action
from .ha_client import HomeAssistantClient, HomeAssistantError
from .immich import ImmichError, ImmichPhotoFrame
from .layout_config import DisplayLayoutStore, layout_schema

WEB_DIR = Path(__file__).resolve().parents[1] / "web"
client = HomeAssistantClient.from_env()
photo_frame = ImmichPhotoFrame.from_env()

app = FastAPI(title="Tecnohead Display", version="0.10.0")
app.mount("/static", StaticFiles(directory=WEB_DIR / "static"), name="static")
layout_store = DisplayLayoutStore()


class EntityAction(BaseModel):
    entity_id: str = Field(min_length=3, max_length=255)
    action: str = Field(min_length=2, max_length=32)
    value: object | None = None


class SceneAction(BaseModel):
    entity_id: str = Field(min_length=3, max_length=255)


class LayoutRequest(BaseModel):
    layout: dict[str, object]


@app.get("/", include_in_schema=False)
async def index() -> FileResponse:
    return FileResponse(WEB_DIR / "index.html")


@app.get("/health", include_in_schema=False)
async def health() -> dict[str, str]:
    return {"status": "ok", "app": "tecnohead-display"}


@app.get("/api/dashboard")
async def dashboard() -> dict[str, object]:
    try:
        payload = await build_dashboard(client, layout_store.load())
        payload["photo_frame"] = photo_frame.public_config()
        return payload
    except HomeAssistantError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/layout")
async def layout() -> dict[str, object]:
    try:
        payload = await build_dashboard(client, layout_store.load())
        return {
            "layout": payload["layout_config"]["layout"],
            "catalog": payload["layout_config"]["catalog"],
            "schema": layout_schema(),
        }
    except HomeAssistantError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.put("/api/layout")
async def save_layout(payload: LayoutRequest) -> dict[str, object]:
    return {"layout": layout_store.save(payload.layout)}


@app.post("/api/layout/reset")
async def reset_layout() -> dict[str, object]:
    return {"layout": layout_store.reset()}


@app.post("/api/entities/action")
async def entity_action(payload: EntityAction) -> dict[str, object]:
    try:
        return await execute_entity_action(client, payload.entity_id, payload.action, payload.value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HomeAssistantError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/api/scenes/activate")
async def scene_action(payload: SceneAction) -> dict[str, object]:
    try:
        return await execute_entity_action(client, payload.entity_id, "activate")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HomeAssistantError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/camera/{entity_id}", include_in_schema=False)
async def camera_image(entity_id: str) -> Response:
    try:
        image, media_type = await client.camera_image(entity_id)
        return Response(content=image, media_type=media_type, headers={"Cache-Control": "no-store"})
    except HomeAssistantError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/photos")
async def photos() -> dict[str, object]:
    try:
        return await photo_frame.list_photos()
    except ImmichError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/api/photos/sync")
async def sync_photos() -> dict[str, object]:
    try:
        return await photo_frame.list_photos(force=True)
    except ImmichError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/photos/{filename:path}", include_in_schema=False)
async def photo_file(filename: str) -> FileResponse:
    path = photo_frame.photo_path(filename)
    if path is None:
        raise HTTPException(status_code=404, detail="Foto não encontrada")
    return FileResponse(path, media_type=photo_frame.media_type(path))

