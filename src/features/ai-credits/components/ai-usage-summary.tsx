"use client"

import { creditSummary } from "../lib/usage-summary"
import type { AiCreditAccount } from "../types"
import { Progress } from "@/components/ui/progress"


export function AiUsageOverview({ account }: { account: AiCreditAccount }) {
  const summary = creditSummary(account)
  return <div className="space-y-6">
    <section className="space-y-3" aria-label="Included AI credits">
      <h3 className="text-sm font-medium">Included allowance</h3>
      <div className="space-y-3 rounded-2xl border bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-4 text-sm"><span>Included credits</span><span className="tabular-nums">{summary.percent === null ? "No active allowance" : `${summary.percent}% left`}</span></div>
        {summary.percent !== null && <Progress aria-label="Included credits remaining" value={summary.percent} className="h-1.5" />}
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{summary.included.toLocaleString()} available{summary.allowance ? ` of ${summary.allowance.toLocaleString()}` : ""}</span>{summary.expires && <span>Expires {new Date(summary.expires).toLocaleDateString()}</span>}</div>
      </div>
    </section>
    <section className="space-y-3" aria-label="Additional AI credits">
      <h3 className="text-sm font-medium">Credits</h3>
      <div className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/30 p-4 text-sm"><span>Additional credits available</span><span className="tabular-nums">{summary.purchased.toLocaleString()}</span></div>
      {summary.reserved > 0 && <p className="text-xs text-muted-foreground">{summary.reserved.toLocaleString()} credits reserved for running requests.</p>}
      {summary.held > 0 && <p className="text-xs text-muted-foreground">{summary.held.toLocaleString()} credits on payment hold.</p>}
    </section>
  </div>
}
