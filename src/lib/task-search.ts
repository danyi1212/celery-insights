const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const valuePattern = (value: unknown): string => {
  if (value === null) return "(?:None|null)"
  if (typeof value === "boolean") return `(?i:${value})`
  if (typeof value === "number") return escapeRegex(String(value))
  if (Array.isArray(value)) return `\\[\\s*${value.map(valuePattern).join("\\s*,\\s*")}\\s*\\]`
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
    return `\\{\\s*${entries.map(([key, item]) => `${valuePattern(key)}\\s*:\\s*${valuePattern(item)}`).join("\\s*,\\s*")}\\s*\\}`
  }
  const text = String(value)
  const json = JSON.stringify(text).slice(1, -1)
  const python = text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
  return `(?:"${escapeRegex(json)}"|'${escapeRegex(python)}')`
}

export const buildTaskSearch = (query: string): { clause: string; bindings: Record<string, string> } => {
  const trimmed = query.trim()
  const keyword = /^([A-Za-z_]\w*)\s*=\s*(.+)$/.exec(trimmed)
  if (keyword) {
    const [, key, input] = keyword
    const value = input.trim()
    let pattern: string
    try {
      pattern = valuePattern(JSON.parse(value))
    } catch {
      if (/^(true|false|none|null)$/i.test(value)) {
        pattern = /^(true|false)$/i.test(value) ? `(?i:${value.toLowerCase()})` : "(?:None|null)"
      } else {
        pattern = valuePattern(value.startsWith("'") && value.endsWith("'") ? value.slice(1, -1) : value)
      }
    }
    return {
      clause: "string::matches(kwargs ?? '', $kwargsPattern)",
      bindings: { kwargsPattern: `(?:^|[,{])\\s*['"]${escapeRegex(key)}['"]\\s*:\\s*${pattern}\\s*(?:[,}]|$)` },
    }
  }
  return {
    clause: [
      "string::concat('', id)",
      "type ?? ''",
      "worker ?? ''",
      "exception ?? ''",
      "result ?? ''",
      "args ?? ''",
      "kwargs ?? ''",
    ]
      .map((field) => `string::contains(string::lowercase(${field}), $query)`)
      .join(" OR "),
    bindings: { query: trimmed.toLowerCase() },
  }
}
