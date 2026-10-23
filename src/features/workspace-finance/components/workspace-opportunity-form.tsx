"use client"

import { useId, useRef, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createWorkspaceOpportunity } from "@/actions/workspace-opportunities"
import styles from "@/components/organization/org-profile-card/profile-edit-fields.module.css"
import type { WorkspaceFinanceOpportunityInput } from "../types"
import { WorkspaceOpportunityTimeline } from "./workspace-opportunity-timeline"
import { OpportunitySourcesInput } from "./opportunity-sources-input"
import { opportunitySourceSchema, sourceKey, type OpportunitySource, type OpportunitySourceOption } from "../lib/opportunity-sources"

export function WorkspaceOpportunityForm({ organizationId, onCreated, onCancel, sourceOptions, loadSources, sourcesLoading, sourcesError }: {
  organizationId: string; onCreated: (item: WorkspaceFinanceOpportunityInput) => void; onCancel: () => void
  sourceOptions: OpportunitySourceOption[]; loadSources: () => void; sourcesLoading: boolean; sourcesError: string | null
}) {
  const prefix = useId()
  const [title, setTitle] = useState("")
  const [sources, setSources] = useState<OpportunitySource[]>([])
  const [sourceQuery, setSourceQuery] = useState("")
  const [deadline, setDeadline] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submission = useRef<{ key: string; id: string } | null>(null)
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return
    let submittedSources = sources
    if (sourceQuery.trim()) {
      const text = sourceQuery.trim()
      const parsed = opportunitySourceSchema.safeParse(/^https?:\/\//i.test(text) ? { kind: "link", url: text } : { kind: "text", label: text })
      if (text.startsWith("@") || !parsed.success) { setError("Choose a source from the suggestions or enter a valid link."); return }
      submittedSources = [...new Map([...sources, parsed.data].map(item => [sourceKey(item), item])).values()]
      if (submittedSources.length > 20) { setError("You can add up to 20 sources."); return }
      setSources(submittedSources); setSourceQuery("")
    }
    const key = JSON.stringify([organizationId, title.trim(), submittedSources, deadline])
    if (submission.current?.key !== key) submission.current = { key, id: crypto.randomUUID() }
    setPending(true)
    setError(null)
    try {
      const result = await createWorkspaceOpportunity({ id: submission.current.id, organizationId, title, source: "", sources: submittedSources, deadline })
      if ("error" in result) setError(result.error)
      else onCreated(result.opportunity)
    } catch { setError("Unable to add this opportunity. Your entries are still here.") }
    finally { setPending(false) }
  }
  return <form aria-label="Add opportunity" onSubmit={submit} className="space-y-3" aria-busy={pending}>
    <div className="flex items-center justify-between gap-2 pl-3"><h3 className="text-sm font-medium">Add opportunity</h3><Button type="button" size="icon" variant="ghost" className="size-9 rounded-full [@media(pointer:coarse)]:size-11" aria-label="Cancel adding opportunity" disabled={pending} onClick={onCancel}><X className="size-4" aria-hidden="true" /></Button></div>
    <fieldset disabled={pending} className="space-y-3">
      <div className={styles.group}>
        <div className={`${styles.row} ${styles.stacked} !py-2`}><Label className="sr-only" htmlFor={`${prefix}-title`}>Opportunity</Label><Input autoFocus id={`${prefix}-title`} value={title} onChange={event => setTitle(event.target.value)} required maxLength={200} placeholder="Opportunity" /></div>
        <div className={`${styles.row} ${styles.stacked} !py-2`}><OpportunitySourcesInput value={sources} onChange={setSources} query={sourceQuery} onQueryChange={setSourceQuery} organizationId={organizationId} options={sourceOptions} loadOptions={loadSources} loading={sourcesLoading} error={sourcesError} disabled={pending} /></div>
        <WorkspaceOpportunityTimeline value={deadline} onChange={setDeadline} disabled={pending} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full rounded-full" disabled={!title.trim()}>{pending ? "Adding…" : "Add opportunity"}</Button>
    </fieldset>
  </form>
}
