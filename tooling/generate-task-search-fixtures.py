"""Generate src/lib/task-search-fixtures.json with kwargs text built the way it reaches SurrealDB.

Celery events carry `kwargs` from `celery.utils.saferepr` (see celery/app/amqp.py), and the
result fetcher stores `repr()` of the extended result meta. Both frontend and backend search
tests seed these rows and assert the same expected matches.

Run from the repository root: `uv run python tooling/generate-task-search-fixtures.py && bun run format-fix`
"""

import json
import uuid
from pathlib import Path
from typing import Any

from celery.utils.saferepr import saferepr

KWARGSREPR_MAXSIZE = 1024  # celery.app.amqp.AMQP.kwargsrepr_maxsize


class Opaque:
    def __repr__(self) -> str:
        return "<Opaque it's>"


TASKS: list[dict[str, Any]] = [
    {
        "id": "one",
        "workflow_id": "one",
        "kwargs": {"organization_id": 1, "run_id": "Run.A", "enabled": True, "label": "North team"},
    },
    {"id": "ten", "workflow_id": "two", "kwargs": {"organization_id": 10}, "format": "json"},
    {"id": "json", "workflow_id": "two", "kwargs": {"organization_id": 1, "enabled": True}, "format": "json"},
    {"id": "string", "kwargs": {"organization_id": "1"}},
    {"id": "missing", "type": "reports.render"},
    {
        "id": "containers",
        "kwargs": {
            "families": ["ad", "query"],
            "options": {"enabled": True, "end": None},
            "empty": [],
            "channel": "FacebookAds",
        },
    },
    {"id": "big", "kwargs": {"organization_id": 9007199254740993, "ratio": 1.0, "count": 1000}},
    {"id": "inside", "kwargs": {"message": "{'organization_id': 1}", "organization_id": 2}},
    {"id": "apostrophe", "kwargs": {"note": "it's {", "organization_id": 3}},
    {"id": "apostrophe_repr", "kwargs": {"note": "it's {", "organization_id": 4}, "format": "repr"},
    {"id": "ordered", "kwargs": {"options": {"2": "b", "1": "a"}}},
    {
        "id": "failed",
        "kwargs": {"retries": 3},
        "exception": "MaxRetriesExceededError: status=failed, retries=3 exceeded",
    },
    {"id": "keyword", "kwargs": {"kind": "constructor", "tags": ["constructor"]}},
    {
        "id": "control",
        "kwargs": {
            "label": "\x01",
            "tags": ["​"],
            "nested": {"key": "\x7f"},
            "plain": "café",
            "flag": "\U000e0001",
            "quoted": "it's\x01",
            "quotes": ["it's\x01"],
        },
    },
    {
        "id": "control_repr",
        "kwargs": {"label": "\x01", "tags": ["​"], "quoted": "it's\x01", "quotes": ["it's\x01"]},
        "format": "repr",
    },
    {"id": "escapes", "kwargs": {"path": "a\\b", "text": "line1\nline2", "quote": 'say "hi"'}},
    {"id": "escapes_repr", "kwargs": {"path": "a\\b", "text": "line1\nline2"}, "format": "repr"},
    {"id": "unicode_key", "kwargs": {"café": 1, "user-id": 7, "options": {"user-id": 8}}},
    {"id": "trailing_backslash", "kwargs": {"path": "C:\\", "label": "x", "organization_id": 5}},
    {"id": "quoted_inside", "kwargs": {"message": 'it\'s {"organization_id": 1}'}},
    {"id": "quoted_inside_repr", "kwargs": {"message": 'it\'s {"organization_id": 1}'}, "format": "repr"},
    {"id": "emoji", "kwargs": {"label": "😀"}},
    {"id": "delimiter_inside", "kwargs": {"message": 'it\', {"organization_id": 1}'}},
    {"id": "escaped_quote", "kwargs": {"path": "a\\'b", "organization_id": 7}},
    # saferepr writes bytes without escaping, so b'it's' leaves a stray quote and the text never tokenizes.
    {"id": "bytes_before", "kwargs": {"organization_id": 11, "blob": b"it's"}},
    {"id": "bytes_after", "kwargs": {"blob": b"it's", "organization_id": 12}},
    # The later escaped apostrophe would pair the stray quote if a plain backslash could tokenize.
    {"id": "bytes_apostrophe", "kwargs": {"blob": b"it's", "organization_id": 14, "note": "it's"}},
    # The 1024-character budget cuts the text inside UUID('…, leaving an unterminated quote.
    {"id": "truncated", "kwargs": {"organization_id": 13, "pad": "x" * 960, "ref": uuid.UUID(int=1)}},
    # Two stray quotes pair up, so these rows tokenize with the key inside a misread string.
    {"id": "two_bytes", "kwargs": {"a": b"it's", "organization_id": 27, "b": b"it's"}},
    {"id": "two_reprs", "kwargs": {"a": Opaque(), "organization_id": 28, "b": Opaque()}},
    # A "<" or "b'" inside an ordinary string is not a malformed value and keeps the strict match.
    {"id": "angle_inside", "kwargs": {"note": 'a < b, "organization_id": 1, c'}},
    {"id": "bytes_text_inside", "kwargs": {"note": 'see b\'x, "organization_id": 1, c'}},
    {"id": "delimited_angle_inside", "kwargs": {"note": 'a: < b, "organization_id": 1, c'}},
    {"id": "escaped_angle_inside", "kwargs": {"note": 'it\': < b, "organization_id": 1, c'}},
]

WORKFLOWS: list[dict[str, Any]] = [
    {"id": "one", "root_task_id": "one", "root_task_type": "reports.render"},
    {"id": "two", "root_task_id": "two", "root_task_type": "sync"},
    {"id": "three", "root_task_id": "three", "root_task_type": "sync", "latest_exception_preview": "Timeout"},
]

QUERIES: list[tuple[str, list[str]]] = [
    ("organization_id=1", ["json", "one"]),
    ("organization_id = 10", ["ten"]),
    ('organization_id="1"', ["string"]),
    ("enabled=true", ["containers", "json", "one"]),
    ("run_id=Run.A", ["one"]),
    ("run_id=RunXA", []),
    ('label="North team"', ["one"]),
    ("north TEAM", ["one"]),
    ("reports.render", ["missing"]),
    ('families=["ad", "query"]', ["containers"]),
    ('options={"enabled":true,"end":null}', ["containers"]),
    ('families=["query", "ad"]', []),
    ("empty=[]", ["containers"]),
    ("channel=FacebookAds", ["containers"]),
    ("families=['ad', 'query']", ["containers"]),
    ("options={'enabled': True, 'end': None}", ["containers"]),
    ("label='North team'", ["one"]),
    ("organization_id=9007199254740993", ["big"]),
    ("organization_id=9007199254740992", []),
    ("ratio=1.0", ["big"]),
    ("ratio=1", []),
    ("count=1e3", []),
    ("organization_id=2", ["inside"]),
    ("organization_id=3", ["apostrophe"]),
    ("organization_id=4", ["apostrophe_repr"]),
    ("note=it's {", ["apostrophe", "apostrophe_repr"]),
    ('note="it\'s {"', ["apostrophe", "apostrophe_repr"]),
    ('options={"2":"b","1":"a"}', ["ordered"]),
    ('options={"1":"a","2":"b"}', []),
    ("label='", []),
    ("status=failed", ["failed"]),
    ("retries=3 exceeded", ["failed"]),
    ("retries=3", ["failed"]),
    ("kind=constructor", ["keyword"]),
    ("tags=['constructor']", ["keyword"]),
    ("tags=[constructor]", []),
    ("label='\\x01'", ["control", "control_repr"]),
    ("tags=['\\u200b']", ["control", "control_repr"]),
    ("nested={'key': '\\x7f'}", ["control"]),
    ("plain='caf\\xe9'", ["control"]),
    ("plain=café", ["control"]),
    ("flag='\\U000e0001'", ["control"]),
    ("flag='\\U00110000'", []),
    ('quoted="it\'s\\x01"', ["control", "control_repr"]),
    ('quotes=["it\'s\\x01"]', ["control", "control_repr"]),
    ("path='a\\\\b'", ["escapes", "escapes_repr"]),
    ("text='line1\\nline2'", ["escapes", "escapes_repr"]),
    ("text='line1\\012line2'", ["escapes", "escapes_repr"]),
    ("quote='say \"hi\"'", ["escapes"]),
    ("café=1", ["unicode_key"]),
    ("user-id=7", ["unicode_key"]),
    ("user-id=8", ["unicode_key"]),
    ("user-id=9", []),
    ("organization_id=5", ["trailing_backslash"]),
    ("path='C:\\\\'", ["trailing_backslash"]),
    ("items=" + "[" * 600 + "0" + "]" * 600, []),
    ("label='\\ud800'", []),
    ("label='\\U0000dfff'", []),
    ("label=x", ["trailing_backslash"]),
    ('message=it\'s {"organization_id": 1}', ["quoted_inside", "quoted_inside_repr"]),
    ('label="\\ud83d\\ude00"', ["emoji"]),
    ('label="😀"', ["emoji"]),
    ("label='\\U0001f600'", ["emoji"]),
    ('label="\\ud83d"', []),
    ('label="\\ude00"', []),
    ('message=it\', {"organization_id": 1}', ["delimiter_inside"]),
    ("organization_id=7", ["escaped_quote"]),
    ("path=a\\'b", ["escaped_quote"]),
    ("organization_id=11", ["bytes_before"]),
    ("organization_id=12", ["bytes_after"]),
    ("organization_id=13", ["truncated"]),
    ("organization_id=14", ["bytes_apostrophe"]),
    ("organization_id=27", ["two_bytes"]),
    ("organization_id=28", ["two_reprs"]),
]

WORKFLOW_QUERIES: list[tuple[str, list[str]]] = [
    ("organization_id=1", ["one", "two"]),
    ("organization_id=10", ["two"]),
    ("north team", ["one"]),
    ("sync", ["three", "two"]),
    ("timeout", ["three"]),
    ("organization_id=2", []),
]


def render_kwargs(value: dict[str, Any], text_format: str) -> str:
    if text_format == "saferepr":
        return saferepr(value, KWARGSREPR_MAXSIZE)
    if text_format == "repr":
        return repr(value)
    return json.dumps(value)


def render_task(task: dict[str, Any]) -> dict[str, Any]:
    text_format = task.get("format", "saferepr")
    rendered = {key: value for key, value in task.items() if key not in {"kwargs", "format"}}
    if "kwargs" in task:
        rendered["kwargs"] = render_kwargs(task["kwargs"], text_format)
        rendered["format"] = text_format
    return rendered


def main() -> None:
    fixtures = {
        "tasks": [render_task(task) for task in TASKS],
        "workflows": WORKFLOWS,
        "queries": [{"query": query, "expected": expected} for query, expected in QUERIES],
        "workflowQueries": [{"query": query, "expected": expected} for query, expected in WORKFLOW_QUERIES],
    }
    target = Path(__file__).resolve().parent.parent / "src" / "lib" / "task-search-fixtures.json"
    target.write_text(json.dumps(fixtures, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
