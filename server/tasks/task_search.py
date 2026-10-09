"""Search normalization for ingestion; query helpers mirror the browser for native regression workloads.

Keep both in sync; each test suite checks the shared vectors in src/lib/task-search-fixtures.json.
"""

import json
import re
import unicodedata
from dataclasses import dataclass
from typing import Literal as ValueKind

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

# Python and JSON escapes (`\/` is JSON's). Python keeps the backslash of an unrecognized escape, so `\q` stays
# two characters.
STRING_ESCAPES = {
    "\\": "\\",
    "'": "'",
    '"': '"',
    "/": "/",
    "a": "\a",
    "b": "\b",
    "f": "\f",
    "n": "\n",
    "r": "\r",
    "t": "\t",
    "v": "\v",
}

# The separators saferepr, repr and JSON write between tokens. JS and Python disagree on what `\s`, trim and strip
# cover (\x1c-\x1f, \x85, \ufeff), so both ports spell the set out to parse a query the same way.
SPACE_CHARACTERS = " \t\n\r\f\v"

# One unit of serialized kwargs text: a plain character, a single-quoted string, or a double-quoted string.
# saferepr only writes a backslash inside a string, so a plain backslash marks a misread quote.
QUOTED = r"""(?:'(?:[^'\\]|\\.|\\)*'|"(?:[^"\\]|\\.)*")"""
TOKEN = r"""(?:[^'"\\]|""" + QUOTED + ")"
TOKENIZES_PATTERN = "^" + TOKEN + "*$"
# Bytes literals and custom __repr__ output are written without escaping; two stray quotes can pair up and
# tokenize, so rows with either shape in a value position get the lenient match. The whole text must tokenize
# around the marker, so a delimiter and marker inside a quoted string don't count.
MALFORMED_REPR_PATTERN = "^" + TOKEN + r"*?[:,\[({]\s*(?:b" + QUOTED + "|<)" + TOKEN + "*$"

NUMBER_PATTERN = re.compile(r"^-?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?")
WORD_PATTERN = re.compile(r"^[A-Za-z]+")
OCTAL_PATTERN = re.compile(r"^[0-7]{1,3}")
HEX_PATTERN = re.compile(r"^[0-9A-Fa-f]+$")
LOW_SURROGATE_PATTERN = re.compile(r"^\\u([Dd][C-Fc-f][0-9A-Fa-f]{2})")
KEYWORD_PATTERN = re.compile(r"^([^ \t\n\r\f\v=]+)[ \t\n\r\f\v]*=[ \t\n\r\f\v]*(.+)$", re.DOTALL)

RANGE_WORKFLOWS_QUERY = (
    "SELECT VALUE root_task_id FROM workflow WHERE last_updated >= <datetime>$from AND last_updated <= <datetime>$to"
)

# Tagged values retain numeric spelling and container order across both parser ports.
type SearchValue = (
    tuple[ValueKind["string", "number"], str]
    | tuple[ValueKind["bool"], bool]
    | tuple[ValueKind["null"], None]
    | tuple[ValueKind["list"], list[SearchValue]]
    | tuple[ValueKind["object"], list[tuple[SearchValue, SearchValue]]]
)


@dataclass(frozen=True)
class Literal:
    pattern: str
    end: int
    value: SearchValue


@dataclass(frozen=True)
class TaskSearch:
    clause: str
    bindings: dict[str, str]


@dataclass(frozen=True)
class WorkflowSearch:
    prelude: list[str]
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
    alternatives = dict.fromkeys([json_text, json.dumps(text), python_repr(text), celery_safe_repr(text)])
    return "(?:" + "|".join(escape_regex(alternative) for alternative in alternatives) + ")"


def character_at(text: str, index: int) -> str:
    return text[index] if 0 <= index < len(text) else ""


def trim_query(query: str) -> str:
    return query.strip(SPACE_CHARACTERS)


def skip_space(text: str, index: int) -> int:
    return len(text) - len(text[index:].lstrip(SPACE_CHARACTERS))


def parse_quoted(text: str, start: int) -> Literal | None:
    quote = text[start]
    decoded = ""
    index = start + 1
    while index < len(text):
        character = text[index]
        if character == quote:
            return Literal(string_pattern(decoded), index + 1, ("string", decoded))
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
            decoded += STRING_ESCAPES.get(escaped, "\\" + escaped)
        index += 1
    return None


def parse_container(text: str, start: int, depth: int) -> Literal | None:
    if depth > MAX_NESTING_DEPTH:
        raise NestingLimitError
    is_dictionary = text[start] == "{"
    close = "}" if is_dictionary else "]"
    items: list[str] = []
    values: list[SearchValue] = []
    entries: list[tuple[SearchValue, SearchValue]] = []
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
            entries.append((item.value, value.value))
            item = Literal(f"{item.pattern}\\s*:\\s*{value.pattern}", value.end, item.value)
        items.append(item.pattern)
        values.append(item.value)
        index = skip_space(text, item.end)
        if character_at(text, index) == ",":
            index = skip_space(text, index + 1)
        elif character_at(text, index) != close:
            return None
    open_pattern, close_pattern = ("\\{", "\\}") if is_dictionary else ("\\[", "\\]")
    return Literal(
        open_pattern + "\\s*" + "\\s*,\\s*".join(items) + "\\s*" + close_pattern,
        index + 1,
        ("object", entries) if is_dictionary else ("list", values),
    )


def parse_literal(text: str, start: int, depth: int = 0) -> Literal | None:
    index = skip_space(text, start)
    character = character_at(text, index)
    if character in {"[", "{"}:
        return parse_container(text, index, depth + 1)
    if character in {'"', "'"}:
        return parse_quoted(text, index)
    number = NUMBER_PATTERN.match(text[index:])
    if number:
        return Literal(escape_regex(number.group(0)), index + len(number.group(0)), ("number", number.group(0)))
    word = WORD_PATTERN.match(text[index:])
    pattern = WORD_PATTERNS.get(word.group(0).lower()) if word else None
    return (
        Literal(
            pattern,
            index + len(word.group(0)),
            ("null", None) if word.group(0).lower() in {"none", "null"} else ("bool", word.group(0).lower() == "true"),
        )
        if word and pattern
        else None
    )


def build_task_search(query: str) -> TaskSearch:
    trimmed = trim_query(query)
    bindings = {"query": trimmed.lower()}
    keyword = KEYWORD_PATTERN.match(trimmed)
    if not keyword:
        return TaskSearch(PLAIN_TEXT_CLAUSE, bindings)
    key, value = keyword.group(1), keyword.group(2)
    try:
        literal = parse_literal(value, 0)
    except NestingLimitError:
        return TaskSearch(PLAIN_TEXT_CLAUSE, bindings)
    pattern = literal.pattern if literal and skip_space(value, literal.end) == len(value) else string_pattern(value)
    key_value_pattern = r"\s*" + string_pattern(key) + r"\s*:\s*" + pattern + r"\s*"
    # The whole kwargs text must tokenize into plain characters and quoted strings around the key, so the key
    # only matches at a dictionary key position (top-level or nested). saferepr leaves backslashes raw, so a
    # backslash in a single-quoted string reads as either an escape pair or a plain character; a false early
    # close leaves a stray quote that cannot tokenize to the end, which rejects that reading.
    kwargs_pattern = "^" + TOKEN + "*?(?:^|[,{])" + key_value_pattern + "(?:[,}]" + TOKEN + "*)?$"
    # saferepr also stores malformed text: bytes with an unescaped quote (b'it's'), a budget cut inside UUID('…,
    # or a custom __repr__ with a quote. Rows that don't tokenize, or that contain a bytes or custom-repr shape,
    # match the key after any delimiter. That can over-match keys inside their strings instead of hiding them.
    lenient_kwargs_pattern = "(?:^|[,{])" + key_value_pattern + "(?:[,}]|$)"
    # The lenient pattern is shorter than the strict one, so this bounds both.
    if len(kwargs_pattern) > MAX_KWARGS_PATTERN_LENGTH:
        return TaskSearch(PLAIN_TEXT_CLAUSE, bindings)
    # Every strict match is also a lenient match, so the cheap lenient check runs first and skips most rows.
    return TaskSearch(
        "(string::matches(kwargs ?? '', $lenientKwargsPattern) AND (string::matches(kwargs ?? '', $kwargsPattern)"
        " OR !string::matches(kwargs ?? '', $tokenizesPattern)"
        f" OR string::matches(kwargs ?? '', $malformedReprPattern))) OR {PLAIN_TEXT_CLAUSE}",
        {
            **bindings,
            "kwargsPattern": kwargs_pattern,
            "lenientKwargsPattern": lenient_kwargs_pattern,
            "tokenizesPattern": TOKENIZES_PATTERN,
            "malformedReprPattern": MALFORMED_REPR_PATTERN,
        },
    )


WORKFLOW_TEXT_CLAUSE = (
    "string::contains(string::lowercase(root_task_id), $query) "
    "OR string::contains(string::lowercase(root_task_type ?? ''), $query) "
    "OR string::contains(string::lowercase(latest_exception_preview ?? ''), $query)"
)


def build_workflow_search(query: str) -> WorkflowSearch:
    """Only a key=value search looks at member tasks; plain text keeps the workflow-only clause and skips the
    member scan. Callers bind $from and $to and run the prelude in the same request as the workflow query."""
    search = build_task_search(query)
    if "kwargsPattern" not in search.bindings:
        return WorkflowSearch([], WORKFLOW_TEXT_CLAUSE, search.bindings)
    return WorkflowSearch(
        [
            f"LET $rangeWorkflows = ({RANGE_WORKFLOWS_QUERY});",
            "LET $searchWorkflows = array::distinct(SELECT VALUE workflow_id FROM task"
            f" WHERE workflow_id IN $rangeWorkflows AND ({search.clause}));",
        ],
        f"{WORKFLOW_TEXT_CLAUSE} OR root_task_id IN $searchWorkflows",
        search.bindings,
    )


def keyword_search_term(query: str) -> str | None:
    if "kwargsPattern" not in build_task_search(query).bindings:
        return None
    keyword = KEYWORD_PATTERN.match(trim_query(query))
    assert keyword is not None
    key, raw = keyword.group(1), keyword.group(2)
    parsed = parse_literal(raw, 0)
    value = parsed.value if parsed and skip_space(raw, parsed.end) == len(raw) else ("string", raw)
    return json.dumps([key, value], ensure_ascii=False, separators=(",", ":"))


@dataclass(frozen=True)
class KwargsSearchTerms:
    terms: list[str]
    fallback: bool


def kwargs_search_terms(raw: str | None, source: str | None) -> KwargsSearchTerms:
    if not raw:
        return KwargsSearchTerms([], fallback=False)
    fallback = KwargsSearchTerms([], fallback=True)
    if source not in {"saferepr", "repr", "json"} or len(raw) > 4096 or "\\" in raw:
        return fallback
    try:
        parsed = parse_literal(raw, 0)
    except NestingLimitError:
        return fallback
    if not parsed or skip_space(raw, parsed.end) != len(raw) or parsed.value[0] != "object":
        return fallback
    terms: set[str] = set()

    def visit(value: SearchValue) -> None:
        if value[0] == "object":
            for key, child in value[1]:
                if key[0] == "string":
                    terms.add(json.dumps([key[1], child], ensure_ascii=False, separators=(",", ":")))
                visit(child)
        elif value[0] == "list":
            for child in value[1]:
                visit(child)

    visit(parsed.value)
    return fallback if len(terms) > 256 else KwargsSearchTerms(sorted(terms), fallback=False)


@dataclass(frozen=True)
class IndexedSearch:
    prelude: list[str]
    source: str
    clause: str
    bindings: dict[str, str | None]


def candidate_source(table: str, extra: str = "") -> str:
    return (
        f"IF (SELECT VALUE ready FROM search_config:current)[0] = true THEN "
        f"(SELECT VALUE record FROM {table}_search WHERE grams CONTAINS $searchGram OR text_fallback = true {extra}) "
        f"ELSE type::table('{table}') END"
    )


def build_indexed_task_search(query: str) -> IndexedSearch:
    search = build_task_search(query)
    trimmed = trim_query(query).lower()
    if len(trimmed) < 3:
        return IndexedSearch([], "task", search.clause, dict(search.bindings))
    source = candidate_source(
        "task", "OR kwargs_terms CONTAINS $searchTerm OR ($searchTerm != NULL AND kwargs_fallback = true)"
    )
    return IndexedSearch(
        [f"LET $searchTasks = {source};"],
        "$searchTasks",
        search.clause,
        {**search.bindings, "searchGram": trimmed[-3:], "searchTerm": keyword_search_term(query)},
    )


def build_indexed_workflow_search(query: str) -> IndexedSearch:
    original = build_workflow_search(query)
    search = build_indexed_task_search(query)
    if len(trim_query(query).lower()) < 3:
        return IndexedSearch(original.prelude, "workflow", original.clause, dict(original.bindings))
    members = (
        [
            *search.prelude,
            original.prelude[0],
            "LET $searchWorkflows = array::distinct(SELECT VALUE workflow_id "
            f"FROM {search.source} WHERE workflow_id IN $rangeWorkflows AND ({search.clause}));",
        ]
        if original.prelude
        else []
    )
    source = candidate_source("workflow", "OR record.root_task_id IN $searchWorkflows" if members else "")
    return IndexedSearch(
        [*members, f"LET $searchWorkflowRows = {source};"], "$searchWorkflowRows", original.clause, search.bindings
    )
