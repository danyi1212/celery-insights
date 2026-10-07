"""Port of src/lib/task-search.ts so the CSV export matches the explorer.

Keep both in sync; each test suite checks the shared vectors in src/lib/task-search-fixtures.json.
"""

import json
import re
import unicodedata
from dataclasses import dataclass

REGEX_SPECIAL = set(".*+?^${}()|[]\\")

# SurrealDB 3.3 rejects regexes above roughly 110 KB; larger literals fall back to plain text.
MAX_KWARGS_PATTERN_LENGTH = 65_536
# Deeper literals fall back to plain text instead of exhausting the parser stack.
MAX_NESTING_DEPTH = 64


class NestingLimitError(ValueError):
    pass


PLAIN_TEXT_CLAUSE = " OR ".join(
    f"string::contains(string::lowercase({field}), $query)"
    for field in [
        "string::concat('', id)",
        "type ?? ''",
        "worker ?? ''",
        "exception ?? ''",
        "result ?? ''",
        "args ?? ''",
        "kwargs ?? ''",
    ]
)

WORD_PATTERNS = {
    "true": "(?i:true)",
    "false": "(?i:false)",
    "none": "(?:None|null)",
    "null": "(?:None|null)",
}

HEX_ESCAPE_WIDTHS = {"x": 2, "u": 4, "U": 8}

STRING_ESCAPES = {"n": "\n", "r": "\r", "t": "\t", "b": "\b", "f": "\f"}

NUMBER_PATTERN = re.compile(r"^-?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?")
WORD_PATTERN = re.compile(r"^[A-Za-z]+")
OCTAL_PATTERN = re.compile(r"^[0-7]{1,3}")
HEX_PATTERN = re.compile(r"^[0-9A-Fa-f]+$")
LOW_SURROGATE_PATTERN = re.compile(r"^\\u([Dd][C-Fc-f][0-9A-Fa-f]{2})")
KEYWORD_PATTERN = re.compile(r"^([^\s=]+)\s*=\s*(.+)$")

RANGE_WORKFLOWS_QUERY = (
    "SELECT VALUE root_task_id FROM workflow WHERE last_updated >= <datetime>$from AND last_updated <= <datetime>$to"
)


@dataclass(frozen=True)
class Literal:
    pattern: str
    end: int


@dataclass(frozen=True)
class TaskSearch:
    clause: str
    bindings: dict[str, str]


@dataclass(frozen=True)
class WorkflowSearch:
    member_query: str
    clause: str
    bindings: dict[str, str]


def escape_regex(value: str) -> str:
    return "".join(f"\\{character}" if character in REGEX_SPECIAL else character for character in value)


def python_escape(character: str) -> str:
    code = ord(character)
    width = 2 if code < 0x100 else 4 if code < 0x10000 else 8
    prefix = {2: "\\x", 4: "\\u", 8: "\\U"}[width]
    return prefix + format(code, f"0{width}x")


def is_nonprintable(character: str) -> bool:
    return character != " " and unicodedata.category(character)[0] in "CZ"


def python_repr(text: str) -> str:
    quote = '"' if "'" in text and '"' not in text else "'"
    body = (
        text.replace("\\", "\\\\")
        .replace(quote, f"\\{quote}")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t")
    )
    body = "".join(python_escape(character) if is_nonprintable(character) else character for character in body)
    return quote + body + quote


def celery_safe_repr(text: str) -> str:
    return "'" + text.replace("'", "\\'") + "'"


def string_pattern(text: str) -> str:
    json_text = '"' + json.dumps(text, ensure_ascii=False)[1:-1] + '"'
    alternatives = dict.fromkeys([json_text, python_repr(text), celery_safe_repr(text)])
    return "(?:" + "|".join(escape_regex(alternative) for alternative in alternatives) + ")"


def character_at(text: str, index: int) -> str:
    return text[index] if 0 <= index < len(text) else ""


def skip_space(text: str, index: int) -> int:
    return len(text) - len(text[index:].lstrip())


def parse_quoted(text: str, start: int) -> Literal | None:
    quote = text[start]
    decoded = ""
    index = start + 1
    while index < len(text):
        character = text[index]
        if character == quote:
            return Literal(string_pattern(decoded), index + 1)
        if character != "\\":
            decoded += character
            index += 1
            continue
        index += 1
        escaped = character_at(text, index)
        width = HEX_ESCAPE_WIDTHS.get(escaped)
        octal = OCTAL_PATTERN.match(text[index:])
        if width:
            hex_digits = text[index + 1 : index + 1 + width]
            if len(hex_digits) != width or not HEX_PATTERN.match(hex_digits):
                return None
            code = int(hex_digits, 16)
            index += width
            if 0xD800 <= code <= 0xDBFF:
                # JSON writes astral characters as a \u surrogate pair; combine it, reject a lone high surrogate.
                low = LOW_SURROGATE_PATTERN.match(text[index + 1 :])
                if not low:
                    return None
                code = 0x10000 + ((code - 0xD800) << 10) + (int(low.group(1), 16) - 0xDC00)
                index += 6
            if code > 0x10FFFF or 0xDC00 <= code <= 0xDFFF:
                return None
            decoded += chr(code)
        elif octal:
            decoded += chr(int(octal.group(0), 8))
            index += len(octal.group(0)) - 1
        elif not escaped:
            return None
        else:
            decoded += STRING_ESCAPES.get(escaped, escaped)
        index += 1
    return None


def parse_container(text: str, start: int, depth: int) -> Literal | None:
    if depth > MAX_NESTING_DEPTH:
        raise NestingLimitError
    is_dictionary = text[start] == "{"
    close = "}" if is_dictionary else "]"
    items: list[str] = []
    index = skip_space(text, start + 1)
    while character_at(text, index) != close:
        item = parse_literal(text, index, depth)
        if item is None:
            return None
        if is_dictionary:
            index = skip_space(text, item.end)
            if character_at(text, index) != ":":
                return None
            value = parse_literal(text, index + 1, depth)
            if value is None:
                return None
            item = Literal(f"{item.pattern}\\s*:\\s*{value.pattern}", value.end)
        items.append(item.pattern)
        index = skip_space(text, item.end)
        if character_at(text, index) == ",":
            index = skip_space(text, index + 1)
        elif character_at(text, index) != close:
            return None
    open_pattern, close_pattern = ("\\{", "\\}") if is_dictionary else ("\\[", "\\]")
    return Literal(open_pattern + "\\s*" + "\\s*,\\s*".join(items) + "\\s*" + close_pattern, index + 1)


def parse_literal(text: str, start: int, depth: int = 0) -> Literal | None:
    index = skip_space(text, start)
    character = character_at(text, index)
    if character in {"[", "{"}:
        return parse_container(text, index, depth + 1)
    if character in {'"', "'"}:
        return parse_quoted(text, index)
    number = NUMBER_PATTERN.match(text[index:])
    if number:
        return Literal(escape_regex(number.group(0)), index + len(number.group(0)))
    word = WORD_PATTERN.match(text[index:])
    pattern = WORD_PATTERNS.get(word.group(0).lower()) if word else None
    return Literal(pattern, index + len(word.group(0))) if word and pattern else None


def build_task_search(query: str) -> TaskSearch:
    trimmed = query.strip()
    bindings = {"query": trimmed.lower()}
    keyword = KEYWORD_PATTERN.match(trimmed)
    if not keyword:
        return TaskSearch(PLAIN_TEXT_CLAUSE, bindings)
    key, value = keyword.group(1), keyword.group(2)
    try:
        literal = parse_literal(value, 0)
    except NestingLimitError:
        return TaskSearch(PLAIN_TEXT_CLAUSE, bindings)
    pattern = (
        literal.pattern if literal and skip_space(value, literal.end) == len(value) else string_pattern(value.strip())
    )
    # saferepr leaves backslashes raw, so a single-quoted string may also end in a raw backslash before its
    # closing quote; that reading is only allowed when a structural delimiter follows, and the delimiter is
    # consumed because the regex engine has no lookahead.
    kwargs_pattern = (
        r"""^(?:[^'"]|'(?:[^'\\]|\\.)*'|'(?:[^'\\]|\\.)*\\'\s*[,:}\]]|"(?:[^"\\]|\\.)*")*?"""
        r"""(?:^|[,{]|'(?:[^'\\]|\\.)*\\'\s*,)\s*""" + string_pattern(key) + r"\s*:\s*" + pattern + r"\s*(?:[,}]|$)"
    )
    if len(kwargs_pattern) > MAX_KWARGS_PATTERN_LENGTH:
        return TaskSearch(PLAIN_TEXT_CLAUSE, bindings)
    return TaskSearch(
        f"string::matches(kwargs ?? '', $kwargsPattern) OR {PLAIN_TEXT_CLAUSE}",
        {**bindings, "kwargsPattern": kwargs_pattern},
    )


def build_workflow_search(query: str) -> WorkflowSearch:
    """Callers run RANGE_WORKFLOWS_QUERY, then member_query with $rangeWorkflows, and bind the distinct
    result as $searchWorkflows; the Python SDK returns only the first statement of a batch, so the
    frontend's LET prelude is not available here."""
    search = build_task_search(query)
    return WorkflowSearch(
        f"SELECT VALUE workflow_id FROM task WHERE workflow_id IN $rangeWorkflows AND ({search.clause})",
        "string::contains(string::lowercase(root_task_id), $query) "
        "OR string::contains(string::lowercase(root_task_type ?? ''), $query) "
        "OR string::contains(string::lowercase(latest_exception_preview ?? ''), $query) "
        "OR root_task_id IN $searchWorkflows",
        search.bindings,
    )
