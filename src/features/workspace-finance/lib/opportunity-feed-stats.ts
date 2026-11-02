import type { WorkspaceFinanceOpportunityInput } from "../types"
import { opportunityCardAmount } from "./opportunity-card-summary"
import { readOpportunityReport } from "./opportunity-report"

/** Feed-scoped figures, never a claim about the provider's total available funding. */
export function opportunityFeedStats(items: WorkspaceFinanceOpportunityInput[], now: number) {
  const open = items.filter(item => {
    if (!["new", "saved", "applied"].includes(item.status)) return false
    if (!item.dueAt) return true
    const deadline = Date.parse(item.dueAt)
    return Number.isFinite(deadline) && deadline >= now
  })
  const amounts = open.flatMap(item => {
    const amount = opportunityCardAmount(readOpportunityReport(item.report))
    if (!amount || amount.maximumUsd === null) return []
    return [{ value: amount.maximumUsd, title: item.title, detail: amount.detail }]
  }).sort((a, b) => b.value - a.value)
  const deadlines = open.flatMap(item => item.dueAt ? [{ at: Date.parse(item.dueAt), title: item.title }] : []).sort((a, b) => a.at - b.at)
  return { award: amounts[0] ?? null, deadline: deadlines[0] ?? null }
}

export function opportunityDeadlineLabel(at: number, now: number) {
  const remaining = at - now
  if (remaining < 0) return "—"
  if (remaining === 0) return "Now"
  if (remaining < 3_600_000) return `${Math.ceil(remaining / 60_000)} min`
  if (remaining < 86_400_000) return `${Math.ceil(remaining / 3_600_000)} hr`
  const days = Math.ceil(remaining / 86_400_000)
  return `${days} ${days === 1 ? "day" : "days"}`
}
