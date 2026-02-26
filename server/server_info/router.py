import json
import logging

from fastapi import APIRouter, Body, Request, UploadFile
from fastapi_cache.decorator import cache
from starlette.responses import StreamingResponse

from server_info.backup import export_database, import_database
from server_info.debug_bundle import create_debug_bundle
from server_info.models import ClientDebugInfo, ServerInfo
from surrealdb_client import get_db

logger = logging.getLogger(__name__)

settings_router = APIRouter(prefix="/api/settings", tags=["settings"])


@settings_router.get("/info")
@cache(1)
async def get_server_info(request: Request) -> ServerInfo:
    return await ServerInfo.create(request)


@settings_router.post("/clear")
async def clear_state() -> bool:
    try:
        db = get_db()
        await db.query("DELETE FROM task; DELETE FROM event; DELETE FROM worker;")
        logger.info("Cleared all tasks, events, and workers from SurrealDB")
    except Exception:
        logger.exception("Failed to clear SurrealDB tables")
        return False
    return True


@settings_router.post("/download-debug-bundle")
async def download_debug_bundle(request: Request, client_info: ClientDebugInfo = Body(...)):  # noqa B008
    buffer = await create_debug_bundle(request, client_info)
    return StreamingResponse(
        buffer, media_type="application/zip", headers={"Content-Disposition": "attachment; filename=debug_bundle.zip"}
    )


@settings_router.get("/export")
async def export_backup():
    buffer = await export_database()
    return StreamingResponse(
        buffer,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=celery_insights_backup.json"},
    )


@settings_router.post("/import")
async def import_backup(file: UploadFile):
    content = await file.read()
    try:
        data = json.loads(content)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        return {"success": False, "error": f"Invalid JSON file: {e}"}

    try:
        counts = await import_database(data)
    except ValueError as e:
        return {"success": False, "error": str(e)}
    except Exception:
        logger.exception("Database import failed")
        return {"success": False, "error": "Import failed — check server logs"}

    return {"success": True, "imported": counts}
