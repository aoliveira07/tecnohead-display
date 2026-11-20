"""FastAPI entrypoint for the Tecnohead Display Home Assistant add-on."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .dashboard import build_dashboard, execute_entity_action
from .ha_client import HomeAssistantClient, HomeAssistantError

WEB_DIR = Path(__file__).resolve().parents[1] / "web"
client = HomeAssistantClient.from_env()

app = FastAPI(title="Tecnohead Display", version="0.1.0")
app.mount("/static", StaticFiles(directory=WEB_DIR / "static"), name="static")


class EntityAction(BaseModel):
    entity_id: str = Field(min_length=3, max_length=255)
    action: str = Field(min_length=2, max_length=32)
    value: object | None = None


class SceneAction(BaseModel):
    entity_id: str = Field(min_length=3, max_length=255)


@app.get("/", include_in_schema=False)
async def index() -> FileResponse:
    return FileResponse(WEB_DIR / "index.html")


@app.get("/health", include_in_schema=False)
async def health() -> dict[str, str]:
    return {"status": "ok", "app": "tecnohead-display"}


@app.get("/api/dashboard")
async def dashboard() -> dict[str, object]:
    try:
        return await build_dashboard(client)
    except HomeAssistantError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


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

