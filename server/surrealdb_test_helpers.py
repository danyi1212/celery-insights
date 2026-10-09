"""Native SurrealDB helpers shared by search regression and workload tests."""

from typing import Any


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


async def _query_last(db: Any, query: str, bindings: dict[str, Any]) -> object:
    """Return the last statement's result; db.query only returns the first, and the workflow search
    prefixes LET statements."""
    response = await db.query_raw(query, bindings)
    if "error" in response:
        raise RuntimeError(f"SurrealDB query failed: {response['error']}")
    results = response.get("result", [])
    errors = [result.get("result") for result in results if result.get("status") == "ERR"]
    if errors:
        raise RuntimeError(f"SurrealDB query failed: {errors}")
    return results[-1]["result"] if results else []
