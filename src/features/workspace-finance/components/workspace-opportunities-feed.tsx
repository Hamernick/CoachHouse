"use client"

import { useEffect, useState } from "react"
import { Check, X, CalendarDays } from "lucide-react"
import { toast } from "@/lib/toast"
import { Button } from "@/components/ui/button"
import { updateWorkspaceFinanceOpportunityStatus } from "@/actions/workspace-finance"
import type { WorkspaceFinanceDataState, WorkspaceFinanceOpportunityInput, WorkspaceFinanceOpportunityWorkflowStatus } from "../types"

const labels = { new: "Opportunity", saved: "Saved", applied: "Applied", awarded: "Awarded", not_awarded: "Not awarded", dismissed: "Dismissed" }

export function WorkspaceOpportunitiesFeed({ opportunities = [], state = "idle", canEdit = false, onCountChange }: {
  opportunities?: WorkspaceFinanceOpportunityInput[]
  state?: WorkspaceFinanceDataState
  canEdit?: boolean
  onCountChange?: (count: number) => void
}) {
  const [changes, setChanges] = useState<Record<string, WorkspaceFinanceOpportunityWorkflowStatus>>({})
  const [pending, setPending] = useState<Set<string>>(() => new Set())
  const visible = opportunities.filter(item => (changes[item.id] ?? item.status) !== "dismissed")
  useEffect(() => { onCountChange?.(visible.length) }, [onCountChange, visible.length])
  async function change(item: WorkspaceFinanceOpportunityInput, status: WorkspaceFinanceOpportunityWorkflowStatus) {
    if (!canEdit || pending.has(item.id)) return
    const previous = changes[item.id] ?? item.status
    setPending(value => new Set(value).add(item.id))
    setChanges(value => ({ ...value, [item.id]: status }))
    try {
      const result = await updateWorkspaceFinanceOpportunityStatus({ opportunityId: item.id, status })
      if ("error" in result) throw new Error(result.error)
      if (status === "dismissed") toast.success("Opportunity dismissed", { action: { label: "Undo", onClick: () => void change(item, previous) } })
    } catch (error) {
      setChanges(value => ({ ...value, [item.id]: previous }))
      toast.error(error instanceof Error ? error.message : "Unable to update opportunity.")
    } finally {
      setPending(value => { const next = new Set(value); next.delete(item.id); return next })
    }
  }
  if (state === "loading") return <p role="status" className="px-2 py-6 text-center text-sm text-muted-foreground">Loading opportunities…</p>
  if (state === "error") return <p role="alert" className="px-2 py-6 text-center text-sm text-muted-foreground">Opportunities couldn’t be loaded.</p>
  if (!visible.length) return <p className="px-2 py-6 text-center text-sm text-muted-foreground">No opportunities yet.</p>
  return <ul aria-label="Opportunities feed" className="space-y-3">
    {visible.map(item => {
      const status = changes[item.id] ?? item.status
      const date = item.dueAt ? new Date(item.dueAt) : null
      const deadline = date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date) : null
      return <li key={item.id} className="overflow-hidden rounded-2xl border border-border/60 bg-muted/40">
        <div className="flex min-h-11 items-center justify-between gap-3 px-3 py-1.5">
          <span className={`text-xs font-medium ${status === "saved" || status === "awarded" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>{labels[status]}</span>
          {canEdit && <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" className="size-8 rounded-full bg-background text-destructive shadow-none [@media(pointer:coarse)]:size-11" disabled={pending.has(item.id)} aria-label={`Dismiss ${item.title}`} onClick={() => void change(item, "dismissed")}><X aria-hidden="true" className="size-4" /></Button>
            {(status === "new" || status === "saved") && <Button size="icon" variant="outline" className="size-8 rounded-full bg-background text-emerald-700 shadow-none dark:text-emerald-400 [@media(pointer:coarse)]:size-11" disabled={pending.has(item.id) || status === "saved"} aria-label={`${status === "saved" ? "Saved" : "Save"} ${item.title}`} onClick={() => void change(item, "saved")}><Check aria-hidden="true" className="size-4" /></Button>}
          </div>}
        </div>
        <div className="space-y-2 rounded-t-2xl border-t border-border/60 bg-background p-3">
          <h3 className="break-words text-sm font-semibold leading-snug">{item.title}</h3>
          {item.source && <p className="break-words text-sm text-muted-foreground">{item.source}</p>}
          {deadline && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays aria-hidden="true" className="size-3.5 shrink-0" /><span>Due <time dateTime={item.dueAt ?? undefined}>{deadline}</time></span></p>}
          {item.attribution === "grants_gov" && <p className="text-xs text-muted-foreground">Source: Grants.gov</p>}
        </div>
      </li>
    })}
  </ul>
}
