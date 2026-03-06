import json
import logging

from fastapi import APIRouter, Body, Request, UploadFile
from fastapi_cache.decorator import cache
from starlette.responses import StreamingResponse

from server_info.backup import export_database, import_database
from server_info.debug_bundle import create_debug_bundle
from server_info.models import (
    ClientDebugInfo,
    RecordCounts,
    RetentionInfo,
    RetentionSettings,
    ServerInfo,
    query_table_count,
)
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


MAX_IMPORT_SIZE = 100 * 1024 * 1024  # 100 MB


@settings_router.post("/import")
async def import_backup(file: UploadFile):
    content = await file.read(MAX_IMPORT_SIZE + 1)
    if len(content) > MAX_IMPORT_SIZE:
        return {"success": False, "error": f"File too large (max {MAX_IMPORT_SIZE // (1024 * 1024)}MB)"}
    try:
        data = json.loads(content)
    except json.JSONDecodeError, UnicodeDecodeError:
        return {"success": False, "error": "Invalid JSON file"}

    try:
        counts = await import_database(data)
    except ValueError:
        return {"success": False, "error": "Invalid backup format"}
    except Exception:
        logger.exception("Database import failed")
        return {"success": False, "error": "Import failed — check server logs"}

    return {"success": True, "imported": counts}


async def _get_record_counts() -> RecordCounts:
    db = get_db()
    return RecordCounts(
        tasks=await query_table_count(db, "task"),
        events=await query_table_count(db, "event"),
        workers=await query_table_count(db, "worker"),
    )


@settings_router.get("/retention")
async def get_retention_settings(request: Request) -> RetentionInfo:
    cleanup_job = request.app.state.cleanup_job
    settings = RetentionSettings(
        cleanup_interval_seconds=cleanup_job.interval_seconds,
        task_max_count=cleanup_job.task_max_count,
        task_retention_hours=cleanup_job.task_retention_hours,
        dead_worker_retention_hours=cleanup_job.dead_worker_retention_hours,
    )
    counts = await _get_record_counts()
    return RetentionInfo(settings=settings, counts=counts)


@settings_router.put("/retention")
async def update_retention_settings(request: Request, new_settings: RetentionSettings) -> RetentionInfo:
    cleanup_job = request.app.state.cleanup_job
    cleanup_job.task_max_count = new_settings.task_max_count
    cleanup_job.task_retention_hours = new_settings.task_retention_hours
    cleanup_job.dead_worker_retention_hours = new_settings.dead_worker_retention_hours
    cleanup_job.interval_seconds = new_settings.cleanup_interval_seconds
    logger.info(
        "Retention settings updated: max_count=%s, retention_hours=%s, dead_worker_hours=%s, interval=%ds",
        new_settings.task_max_count,
        new_settings.task_retention_hours,
        new_settings.dead_worker_retention_hours,
        new_settings.cleanup_interval_seconds,
    )
    counts = await _get_record_counts()
    return RetentionInfo(
        settings=new_settings,
        counts=counts,
    )


@settings_router.post("/cleanup")
async def trigger_cleanup(request: Request) -> dict:
    cleanup_job = request.app.state.cleanup_job
    try:
        await cleanup_job._run_cleanup()
        counts = await _get_record_counts()
        return {"success": True, "counts": counts.model_dump()}
    except Exception:
        logger.exception("Manual cleanup trigger failed")
        return {"success": False, "error": "Cleanup failed — check server logs"}
