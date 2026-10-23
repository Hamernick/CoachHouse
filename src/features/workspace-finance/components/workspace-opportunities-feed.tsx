"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "@/lib/toast"
import { Button } from "@/components/ui/button"
import { updateWorkspaceFinanceOpportunityStatus } from "@/actions/workspace-finance"
import type { WorkspaceFinanceDataState, WorkspaceFinanceOpportunityInput, WorkspaceFinanceOpportunityWorkflowStatus } from "../types"
import { WorkspaceOpportunityForm } from "./workspace-opportunity-form"
import { getWorkspaceOpportunitySources } from "@/actions/workspace-opportunity-sources"
import { sourceKey, type OpportunitySourceOption } from "../lib/opportunity-sources"
import { WorkspaceOpportunityCard } from "./workspace-opportunity-card"
import { opportunityReportSources, readOpportunityReport } from "../lib/opportunity-report"

export function WorkspaceOpportunitiesFeed({ opportunities = [], state = "idle", canEdit = false, onCountChange, organizationId, onOpenSource }: {
  opportunities?: WorkspaceFinanceOpportunityInput[]
  state?: WorkspaceFinanceDataState
  canEdit?: boolean
  onCountChange?: (count: number) => void
  organizationId?: string
  onOpenSource?: (id: string) => boolean
}) {
  const [creating, setCreating] = useState(false)
  const [added, setAdded] = useState<WorkspaceFinanceOpportunityInput[]>([])
  const [sourceOptions, setSourceOptions] = useState<OpportunitySourceOption[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(false)
  const [sourcesError, setSourcesError] = useState<string | null>(null)
  const sourceRequest = useRef(false)
  const sourcesLoaded = useRef(false)
  const loadSources = useCallback(() => {
    if (!organizationId || sourceRequest.current || sourcesLoaded.current) return
    sourceRequest.current = true; setSourcesLoading(true); setSourcesError(null)
    void getWorkspaceOpportunitySources(organizationId).then(result => {
      if ("error" in result) setSourcesError(result.error ?? "Sources couldn’t be loaded.")
      else { setSourceOptions(result.options); sourcesLoaded.current = true }
    }).catch(() => setSourcesError("Sources couldn’t be loaded. Try typing @ again."))
      .finally(() => { sourceRequest.current = false; setSourcesLoading(false) })
  }, [organizationId])
  const hasReferences = opportunities.some(item => [...(item.sources ?? []), ...opportunityReportSources(readOpportunityReport(item.report))].some(source => source.kind !== "link" && source.kind !== "text"))
  useEffect(() => { if (hasReferences) loadSources() }, [hasReferences, loadSources])
  const addButton = useRef<HTMLButtonElement>(null)
  const [changes, setChanges] = useState<Record<string, WorkspaceFinanceOpportunityWorkflowStatus>>({})
  const [pending, setPending] = useState<Set<string>>(() => new Set())
  const items = [...new Map([...opportunities, ...added].map(item => [item.id, item])).values()]
  const visible = items.filter(item => (changes[item.id] ?? item.status) !== "dismissed")
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
  const closeForm = () => { setCreating(false); requestAnimationFrame(() => addButton.current?.focus()) }
  const form = { organizationId: organizationId ?? "", sourceOptions, loadSources, sourcesLoading, sourcesError, onSourceOptionsAdded: (items: OpportunitySourceOption[]) => setSourceOptions(current => [...new Map([...current, ...items].map(item => [sourceKey(item.source), item])).values()]) }
  const saved = (item: WorkspaceFinanceOpportunityInput) => setAdded(value => [item, ...value.filter(existing => existing.id !== item.id)])
  if (creating && canEdit && organizationId) return <WorkspaceOpportunityForm {...form} onCancel={closeForm} onCreated={item => { saved(item); closeForm() }} />
  const addControl = canEdit && organizationId && <Button ref={addButton} variant="outline" className="rounded-full shadow-none" onClick={() => setCreating(true)}>Add opportunity</Button>
  if (!visible.length) return <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 px-4 py-6"><p className="text-sm text-muted-foreground">No opportunities yet.</p>{addControl}</div>
  return <div className="space-y-3"><ul aria-label="Opportunities feed" className="space-y-3">
    {visible.map(item => <WorkspaceOpportunityCard key={item.id} item={item} status={changes[item.id] ?? item.status} canEdit={canEdit} pending={pending.has(item.id)} onStatus={status => void change(item, status)} onSaved={saved} onOpenSource={onOpenSource} form={form} />)}
  </ul>{addControl && <div className="flex justify-center">{addControl}</div>}</div>
}
