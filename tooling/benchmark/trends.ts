import { extractMetrics } from "./compare"

type RecordValue = { id: string; sourceSha: string; seriesKey: string | null; referenceEligible: boolean; run: unknown }
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!,
  )

export function trendSvg(records: RecordValue[]) {
  const panels = [
    "pipeline.publication_to_raw_event_live_ms.p95",
    "query.tasks.all.median",
    "browser.explorerUsefulDataMs",
    "image.unpacked",
  ]
  const colors = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#c2410c", "#0891b2"]
  const series = [
    ...new Set(
      records.filter((record) => record.referenceEligible && record.seriesKey).map((record) => record.seriesKey!),
    ),
  ]
  const metrics = records.map((record) => (record.referenceEligible ? extractMetrics(record.run) : {}))
  const fragments = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1040" viewBox="0 0 960 1040" role="img" aria-labelledby="title description">',
    '<title id="title">Benchmark trends by compatible series</title>',
    '<desc id="description">Published attempt order, not commit order. Only valid measurements are plotted. Missing and failed values are gaps. Different colors identify distinct comparison series.</desc>',
    '<rect width="960" height="1040" fill="white"/>',
    '<g font-family="sans-serif" font-size="12" fill="#111827">',
    '<text x="20" y="24" font-size="18">Benchmark trends — publication order</text>',
    '<text x="20" y="45">Valid measurements only; missing/failed values are gaps. Colors identify comparison series.</text>',
  ]
  panels.forEach((name, panel) => {
    const top = 95 + panel * 210
    const values = metrics.map((metric) => metric[name]?.value ?? null)
    const maximum = Math.max(1, ...values.filter((value) => value !== null))
    const unit = metrics.find((metric) => metric[name])?.[name]?.unit ?? "unavailable"
    fragments.push(
      `<text x="20" y="${top - 15}">${escape(name)} (${escape(unit)})</text>`,
      `<path d="M 90 ${top} V ${top + 135} H 900" stroke="#9ca3af" fill="none"/>`,
      `<text x="20" y="${top + 8}">${maximum.toPrecision(3)}</text>`,
      `<text x="60" y="${top + 135}">0</text>`,
    )
    const x = (index: number) => 90 + (index * 810) / Math.max(1, records.length - 1)
    for (const cohort of series) {
      const points = records.flatMap((record, index) =>
        record.seriesKey === cohort && values[index] !== null ? [{ index, value: values[index]! }] : [],
      )
      const color = colors[series.indexOf(cohort) % colors.length]
      // Dots retain missing-attempt gaps; connecting lines could imply continuity.
      for (const point of points)
        fragments.push(
          `<circle cx="${x(point.index)}" cy="${top + 135 - (point.value / maximum) * 135}" r="4" fill="${color}"><title>${escape(records[point.index].id)}: ${point.value} ${escape(unit)}; series ${escape(cohort)}</title></circle>`,
        )
    }
    for (const index of [...new Set([0, records.length - 1])].filter((index) => index >= 0))
      fragments.push(
        `<text x="${x(index)}" y="${top + 155}" text-anchor="${index === 0 ? "start" : "end"}">${escape(records[index].sourceSha.slice(0, 8))}</text>`,
      )
  })
  fragments.push(
    `<text x="20" y="965">${records.length} attempts; ${series.length} compatible series. Hover points for source/run and full series identity.</text>`,
    '<text x="20" y="990">Charts describe measurements; timing flags remain report-only.</text>',
    "</g></svg>",
  )
  return fragments.join("\n") + "\n"
}
