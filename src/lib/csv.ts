/** Keep producer-controlled text inert when opened in a spreadsheet. */
export function csvText(value: unknown): string {
  const text = String(value ?? "")
  if (typeof value !== "string") return text
  // eslint-disable-next-line no-control-regex -- Spreadsheet markers may follow control characters.
  return /^[\s\u0000-\u001f]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text) ? `'${text}` : text
}
