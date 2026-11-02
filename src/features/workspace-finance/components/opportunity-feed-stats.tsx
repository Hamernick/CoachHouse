"use client"

import { Button } from "@/components/ui/button"
import { openWorkspaceCalendar } from "@/lib/roadmap/calendar-events"
import { useEffect, useState } from "react"
import type { WorkspaceFinanceDataState, WorkspaceFinanceOpportunityInput } from "../types"
import { opportunityDeadlineLabel, opportunityFeedStats } from "../lib/opportunity-feed-stats"

export function OpportunityFeedStats({ items, state }: { items: WorkspaceFinanceOpportunityInput[]; state: WorkspaceFinanceDataState }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])
  const stats = opportunityFeedStats(items, now)
  const ready = state === "ready"
  const money = stats.award === null ? "—" : new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(stats.award.value)
  const values = [
    { label: "Opportunity", value: money, detail: stats.award ? `${stats.award.title}: ${stats.award.detail}. Largest stated per-award ceiling in this feed.` : "No explicit award ceiling listed." },
    { label: "Next deadline", value: stats.deadline ? opportunityDeadlineLabel(stats.deadline.at, now) : "—", detail: stats.deadline ? `${stats.deadline.title}: ${new Date(stats.deadline.at).toLocaleString()}` : "No upcoming deadline listed." },
  ]
  return <dl aria-label="Opportunity statistics" aria-busy={state === "loading"} className="grid grid-cols-2 overflow-hidden rounded-lg border border-border/60 py-1">
    {values.map(({ label, value, detail }) => <div key={label} title={detail} className="relative flex min-w-0 flex-col [@media(pointer:coarse)]:min-h-11 items-center justify-center border-r border-border/60 px-1 last:border-r-0">
      <dt className="order-2 text-center text-[10px] leading-3 text-muted-foreground">{label}</dt>
      <dd className="text-[13px] leading-4 font-medium tabular-nums">{ready ? value : "—"}</dd>
      {label === "Next deadline" && <Button type="button" variant="ghost" disabled={!ready || !stats.deadline} aria-label={`Open calendar${ready && stats.deadline ? `: ${value}` : ""}`} onClick={() => { if (stats.deadline) openWorkspaceCalendar(stats.deadline.at) }} className="absolute inset-0 h-full w-full rounded-none p-0"><span className="sr-only">Open calendar</span></Button>}
    </div>)}
  </dl>
}
