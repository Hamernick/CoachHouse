import type { OpportunityReport } from "./opportunity-report"

/** Presentation only: keep the original title for attribution, editing and search. */
export function opportunityCardTitle(title: string, manual: boolean) {
  const clean = title.trim().replace(/\s+/g, " ")
  if (manual || clean.split(" ").length <= 5) return title
  const acronym = clean.match(/\(([A-Z][A-Z0-9-]{1,11})\)$/)?.[1]
  const words = clean.replace(/\s*\([A-Z][A-Z0-9-]{1,11}\)$/, "").split(" ")
  const short = words.slice(0, acronym ? 4 : 5)
  while (short.length > 2 && /^(and|or|for|in|of|the|to|with)$/i.test(short.at(-1)!)) short.pop()
  return acronym ? `${acronym}: ${short.join(" ")}` : `${short.join(" ")}…`
}

/** Read the explicit per-award fact, never a program pool, budget or inferred value. */
export function opportunityCardAmount(report: OpportunityReport) {
  const values = report.blocks.flatMap(block => block.kind === "facts" ? block.items.filter(item => /^award$/i.test(item.label.trim())).map(item => item.value.trim()) : [])
  if (values.length !== 1) return null
  const value = values[0]
  const amount = String.raw`\$(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?`
  const match = value.match(new RegExp(`^(?:(Up to|From) )?(${amount})(?:[–-](${amount}))?(?: per award)?(?:; maximum not published)?$`, "i"))
  if (!match || (match[1] && match[3])) return null
  const dollars = (text: string) => Number(text.replace(/[$,]/g, ""))
  const low = dollars(match[2]), high = match[3] ? dollars(match[3]) : null
  if (!Number.isFinite(low) || low < 0 || (high !== null && (!Number.isFinite(high) || high < low))) return null
  const format = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n).replace(/K$/, "k")
  const label = high !== null && high !== low ? `${format(low)}–${format(high)}` : `${match[1] ? /^from$/i.test(match[1]) ? "From " : "Up to " : ""}${format(low)}`
  return { label, detail: value, maximumUsd: /^from$/i.test(match[1] ?? "") ? null : high ?? low }
}
