// Ported to server/exports/task_search.py for the CSV export. Keep both in sync; each test suite
// checks the shared vectors in task-search-fixtures.json.

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// SurrealDB 3.3 rejects regexes above roughly 110 KB; larger literals fall back to plain text.
const MAX_KWARGS_PATTERN_LENGTH = 65_536

const PLAIN_TEXT_CLAUSE = [
  "string::concat('', id)",
  "type ?? ''",
  "worker ?? ''",
  "exception ?? ''",
  "result ?? ''",
  "args ?? ''",
  "kwargs ?? ''",
]
  .map((field) => `string::contains(string::lowercase(${field}), $query)`)
  .join(" OR ")

const WORD_PATTERNS = new Map([
  ["true", "(?i:true)"],
  ["false", "(?i:false)"],
  ["none", "(?:None|null)"],
  ["null", "(?:None|null)"],
])

const HEX_ESCAPE_WIDTHS = new Map([
  ["x", 2],
  ["u", 4],
  ["U", 8],
])

const STRING_ESCAPES: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" }

interface Literal {
  pattern: string
  end: number
}

// Python repr writes nonprintable characters as \xNN below U+0100, \uXXXX below U+10000, and \UXXXXXXXX above.
const pythonEscape = (character: string): string => {
  const code = character.codePointAt(0) ?? 0
  const width = code < 0x100 ? 2 : code < 0x10000 ? 4 : 8
  const prefix = width === 2 ? "\\x" : width === 4 ? "\\u" : "\\U"
  return prefix + code.toString(16).padStart(width, "0")
}

// Mirrors Python repr: double quotes only when the text has a single quote and no double quote.
const pythonRepr = (text: string): string => {
  const quote = text.includes("'") && !text.includes('"') ? '"' : "'"
  const body = text
    .replace(/\\/g, "\\\\")
    .replaceAll(quote, `\\${quote}`)
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/(?! )[\p{C}\p{Z}]/gu, pythonEscape)
  return quote + body + quote
}

// Celery events carry kwargs from celery.utils.saferepr: always single quotes, only ' escaped, everything else raw.
const celerySafeRepr = (text: string): string => `'${text.replaceAll("'", "\\'")}'`

const stringPattern = (text: string): string => {
  const alternatives = new Set([`"${JSON.stringify(text).slice(1, -1)}"`, pythonRepr(text), celerySafeRepr(text)])
  return `(?:${[...alternatives].map(escapeRegex).join("|")})`
}

const skipSpace = (text: string, index: number): number => text.length - text.slice(index).trimStart().length

const parseQuoted = (text: string, start: number): Literal | undefined => {
  const quote = text[start]
  let decoded = ""
  for (let index = start + 1; index < text.length; index++) {
    const character = text[index]
    if (character === quote) return { pattern: stringPattern(decoded), end: index + 1 }
    if (character !== "\\") {
      decoded += character
      continue
    }
    const escaped = text[++index]
    const width = HEX_ESCAPE_WIDTHS.get(escaped)
    const octal = /^[0-7]{1,3}/.exec(text.slice(index))?.[0]
    if (width) {
      const hex = text.slice(index + 1, index + 1 + width)
      if (hex.length !== width || !/^[0-9A-Fa-f]+$/.test(hex)) return undefined
      const code = parseInt(hex, 16)
      if (code > 0x10ffff) return undefined
      decoded += String.fromCodePoint(code)
      index += width
    } else if (octal) {
      decoded += String.fromCharCode(parseInt(octal, 8))
      index += octal.length - 1
    } else if (escaped === undefined) {
      return undefined
    } else {
      decoded += STRING_ESCAPES[escaped] ?? escaped
    }
  }
  return undefined
}

const parseContainer = (text: string, start: number): Literal | undefined => {
  const isDictionary = text[start] === "{"
  const close = isDictionary ? "}" : "]"
  const items: string[] = []
  let index = skipSpace(text, start + 1)
  while (text[index] !== close) {
    let item = parseLiteral(text, index)
    if (!item) return undefined
    if (isDictionary) {
      index = skipSpace(text, item.end)
      if (text[index] !== ":") return undefined
      const value = parseLiteral(text, index + 1)
      if (!value) return undefined
      item = { pattern: `${item.pattern}\\s*:\\s*${value.pattern}`, end: value.end }
    }
    items.push(item.pattern)
    index = skipSpace(text, item.end)
    if (text[index] === ",") index = skipSpace(text, index + 1)
    else if (text[index] !== close) return undefined
  }
  const [open, shut] = isDictionary ? ["\\{", "\\}"] : ["\\[", "\\]"]
  return { pattern: `${open}\\s*${items.join("\\s*,\\s*")}\\s*${shut}`, end: index + 1 }
}

// Accepts JSON and Python repr literals. Numbers keep their source text, so 64-bit ids and float formatting survive.
const parseLiteral = (text: string, start: number): Literal | undefined => {
  const index = skipSpace(text, start)
  const character = text[index]
  if (character === "[" || character === "{") return parseContainer(text, index)
  if (character === '"' || character === "'") return parseQuoted(text, index)
  const number = /^-?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(index))?.[0]
  if (number) return { pattern: escapeRegex(number), end: index + number.length }
  const word = /^[A-Za-z]+/.exec(text.slice(index))?.[0]
  const pattern = word && WORD_PATTERNS.get(word.toLowerCase())
  return word && pattern ? { pattern, end: index + word.length } : undefined
}

export const buildTaskSearch = (query: string): { clause: string; bindings: Record<string, string> } => {
  const trimmed = query.trim()
  const bindings: Record<string, string> = { query: trimmed.toLowerCase() }
  const keyword = /^([^\s=]+)\s*=\s*(.+)$/.exec(trimmed)
  if (!keyword) return { clause: PLAIN_TEXT_CLAUSE, bindings }
  const [, key, value] = keyword
  const literal = parseLiteral(value, 0)
  const pattern =
    literal && skipSpace(value, literal.end) === value.length ? literal.pattern : stringPattern(value.trim())
  // The prefix consumes quoted strings whole, so the key only matches at a dictionary key position
  // (top-level or nested), never inside a string value that happens to contain dictionary-like text.
  const kwargsPattern = `^(?:[^'"]|'(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*")*?(?:^|[,{])\\s*${stringPattern(key)}\\s*:\\s*${pattern}\\s*(?:[,}]|$)`
  if (kwargsPattern.length > MAX_KWARGS_PATTERN_LENGTH) return { clause: PLAIN_TEXT_CLAUSE, bindings }
  // Plain text stays included so queries like `status=failed` still search exception and result text.
  return {
    clause: `string::matches(kwargs ?? '', $kwargsPattern) OR ${PLAIN_TEXT_CLAUSE}`,
    bindings: { ...bindings, kwargsPattern },
  }
}

export const RANGE_WORKFLOWS_QUERY =
  "SELECT VALUE root_task_id FROM workflow WHERE last_updated >= <datetime>$from AND last_updated <= <datetime>$to"

// Callers bind $from and $to. Member tasks are scanned once per batch (an inline subquery would run per
// workflow row) and only for workflows in the selected range, which lets SurrealDB use idx_task_workflow_id.
export const buildWorkflowSearch = (
  query: string,
): { prelude: string[]; clause: string; bindings: Record<string, string> } => {
  const search = buildTaskSearch(query)
  return {
    prelude: [
      `LET $rangeWorkflows = (${RANGE_WORKFLOWS_QUERY});`,
      `LET $searchWorkflows = array::distinct(SELECT VALUE workflow_id FROM task WHERE workflow_id IN $rangeWorkflows AND (${search.clause}));`,
    ],
    clause:
      "string::contains(string::lowercase(root_task_id), $query) OR string::contains(string::lowercase(root_task_type ?? ''), $query) OR string::contains(string::lowercase(latest_exception_preview ?? ''), $query) OR root_task_id IN $searchWorkflows",
    bindings: search.bindings,
  }
}
