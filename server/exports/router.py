import csv
import io
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from starlette.responses import Response

from surrealdb_client import get_db

exports_router = APIRouter(prefix="/api/exports", tags=["exports"])

TASK_SORT_FIELDS = {"last_updated", "state", "type", "worker", "runtime", "sent_at", "started_at"}
WORKFLOW_SORT_FIELDS = {
    "last_updated",
    "aggregate_state",
    "root_task_type",
    "task_count",
    "failure_count",
    "active_count",
    "worker_count",
}


class ExplorerCsvExportRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    kind: Literal["explorer"]
    mode: Literal["tasks", "workflows"]
    from_: str = Field(alias="from")
    to: str
    query: str = ""
    states: list[str] = Field(default_factory=list)
    types: list[str] = Field(default_factory=list)
    workers: list[str] = Field(default_factory=list)
    workflow_states: list[str] = Field(default_factory=list, alias="workflowStates")
    root_types: list[str] = Field(default_factory=list, alias="rootTypes")
    sort_field: str = Field(default="last_updated", alias="sortField")
    sort_direction: Literal["ASC", "DESC"] = Field(default="DESC", alias="sortDirection")


class RawEventsCsvExportRequest(BaseModel):
    kind: Literal["raw-events"]
    from_: str = Field(alias="from")
    to: str
    query: str = ""
    types: list[str] = Field(default_factory=list)


def _extract_rows(result: object) -> list[dict[str, Any]]:
    if not isinstance(result, list) or len(result) == 0:
        return []
    first = result[0]
    if isinstance(first, dict):
        return result  # type: ignore[return-value]
    if isinstance(first, list):
        return first  # type: ignore[return-value]
    return []


def _extract_id(value: Any) -> str:
    if value is None:
        return ""
    raw = str(value)
    if ":" in raw:
        raw = raw.split(":", 1)[1]
    if len(raw) >= 2 and raw[0] in {"<", "⟨", "'", '"'}:
        return raw[1:-1]
    return raw


def _write_csv(rows: list[dict[str, Any]], fields: list[str]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({field: row.get(field, "") for field in fields})
    return buffer.getvalue()


def _task_rows_to_csv(rows: list[dict[str, Any]]) -> str:
    fields = [
        "id",
        "type",
        "state",
        "worker",
        "sent_at",
        "received_at",
        "started_at",
        "succeeded_at",
        "failed_at",
        "retried_at",
        "runtime",
        "last_updated",
        "retries",
        "exchange",
        "routing_key",
        "root_id",
        "workflow_id",
        "parent_id",
        "result",
        "exception",
    ]
    normalized = [{**row, "id": _extract_id(row.get("id"))} for row in rows]
    return _write_csv(normalized, fields)


def _workflow_rows_to_csv(rows: list[dict[str, Any]]) -> str:
    fields = [
        "id",
        "root_task_id",
        "root_task_type",
        "aggregate_state",
        "first_seen_at",
        "last_updated",
        "task_count",
        "completed_count",
        "failure_count",
        "retry_count",
        "active_count",
        "worker_count",
        "latest_exception_preview",
    ]
    normalized = [
        {
            **row,
            "id": _extract_id(row.get("id")),
            "root_task_id": _extract_id(row.get("root_task_id")),
        }
        for row in rows
    ]
    return _write_csv(normalized, fields)


def _event_rows_to_csv(rows: list[dict[str, Any]]) -> str:
    fields = ["id", "timestamp", "event_type", "task_id", "hostname", "data"]
    normalized = [
        {
            **row,
            "id": _extract_id(row.get("id")),
            "task_id": _extract_id(row.get("task_id")),
            "data": row.get("data", ""),
        }
        for row in rows
    ]
    return _write_csv(normalized, fields)


def _build_task_query(payload: ExplorerCsvExportRequest) -> tuple[str, dict[str, Any]]:
    conditions = ["last_updated >= <datetime>$from", "last_updated <= <datetime>$to"]
    bindings: dict[str, Any] = {"from": payload.from_, "to": payload.to}

    if payload.query.strip():
        conditions.append(
            "(string::contains(string::lowercase(string::concat('', id)), $query) "
            "OR string::contains(string::lowercase(type ?? ''), $query) "
            "OR string::contains(string::lowercase(worker ?? ''), $query) "
            "OR string::contains(string::lowercase(exception ?? ''), $query) "
            "OR string::contains(string::lowercase(result ?? ''), $query))"
        )
        bindings["query"] = payload.query.strip().lower()
    if payload.states:
        conditions.append("state IN $states")
        bindings["states"] = payload.states
    if payload.types:
        conditions.append("type IN $types")
        bindings["types"] = payload.types
    if payload.workers:
        conditions.append("worker IN $workers")
        bindings["workers"] = payload.workers

    sort_field = payload.sort_field if payload.sort_field in TASK_SORT_FIELDS else "last_updated"
    clause = f" WHERE {' AND '.join(conditions)}"
    return f"SELECT * FROM task{clause} ORDER BY {sort_field} {payload.sort_direction}", bindings


def _build_workflow_query(payload: ExplorerCsvExportRequest) -> tuple[str, dict[str, Any]]:
    conditions = ["last_updated >= <datetime>$from", "last_updated <= <datetime>$to"]
    bindings: dict[str, Any] = {"from": payload.from_, "to": payload.to}

    if payload.query.strip():
        conditions.append(
            "(string::contains(string::lowercase(root_task_id), $query) "
            "OR string::contains(string::lowercase(root_task_type ?? ''), $query) "
            "OR string::contains(string::lowercase(latest_exception_preview ?? ''), $query))"
        )
        bindings["query"] = payload.query.strip().lower()
    if payload.workflow_states:
        conditions.append("aggregate_state IN $workflowStates")
        bindings["workflowStates"] = payload.workflow_states
    if payload.root_types:
        conditions.append("root_task_type IN $rootTypes")
        bindings["rootTypes"] = payload.root_types

    sort_field = payload.sort_field if payload.sort_field in WORKFLOW_SORT_FIELDS else "last_updated"
    clause = f" WHERE {' AND '.join(conditions)}"
    return f"SELECT * FROM workflow{clause} ORDER BY {sort_field} {payload.sort_direction}", bindings


def _build_raw_events_query(payload: RawEventsCsvExportRequest) -> tuple[str, dict[str, Any]]:
    conditions = ["timestamp >= <datetime>$from", "timestamp <= <datetime>$to"]
    bindings: dict[str, Any] = {"from": payload.from_, "to": payload.to}

    if payload.query.strip():
        conditions.append(
            "(string::contains(string::lowercase(event_type), $query) "
            "OR string::contains(string::lowercase(task_id ?? ''), $query) "
            "OR string::contains(string::lowercase(hostname ?? ''), $query) "
            "OR string::contains(string::lowercase(string::concat('', data ?? '')), $query))"
        )
        bindings["query"] = payload.query.strip().lower()
    if payload.types:
        conditions.append("event_type IN $types")
        bindings["types"] = payload.types

    clause = f" WHERE {' AND '.join(conditions)}"
    return f"SELECT * FROM event{clause} ORDER BY timestamp DESC", bindings


@exports_router.post("/csv")
async def export_csv(payload: ExplorerCsvExportRequest | RawEventsCsvExportRequest):
    db = get_db()

    if isinstance(payload, ExplorerCsvExportRequest):
        query, bindings = _build_task_query(payload) if payload.mode == "tasks" else _build_workflow_query(payload)
        result = await db.query(query, bindings)
        rows = _extract_rows(result)
        csv_content = _task_rows_to_csv(rows) if payload.mode == "tasks" else _workflow_rows_to_csv(rows)
        filename = f"{payload.mode}.csv"
    elif isinstance(payload, RawEventsCsvExportRequest):
        query, bindings = _build_raw_events_query(payload)
        result = await db.query(query, bindings)
        rows = _extract_rows(result)
        csv_content = _event_rows_to_csv(rows)
        filename = "raw-events.csv"
    else:
        raise HTTPException(status_code=400, detail="Unsupported export payload")

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
