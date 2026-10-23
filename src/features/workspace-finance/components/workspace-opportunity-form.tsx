"use client"

import { useCallback, useId, useRef, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createWorkspaceOpportunity, updateWorkspaceOpportunity } from "@/actions/workspace-opportunities"
import styles from "@/components/organization/org-profile-card/profile-edit-fields.module.css"
import type { WorkspaceFinanceOpportunityInput } from "../types"
import { WorkspaceOpportunityTimeline } from "./workspace-opportunity-timeline"
import { OpportunityReportEditor } from "./opportunity-report-editor"
import { readOpportunityReport } from "../lib/opportunity-report"
import { OpportunitySourcesInput } from "./opportunity-sources-input"
import { OpportunitySourceDropZone } from "./opportunity-source-drop-zone"
import { opportunitySourceSchema, sourceKey, type OpportunitySource, type OpportunitySourceOption } from "../lib/opportunity-sources"

export function WorkspaceOpportunityForm({ organizationId, onCreated, onCancel, sourceOptions, loadSources, sourcesLoading, sourcesError, onSourceOptionsAdded, initial }: {
  initial?: WorkspaceFinanceOpportunityInput
  organizationId: string; onCreated: (item: WorkspaceFinanceOpportunityInput) => void; onCancel: () => void
  sourceOptions: OpportunitySourceOption[]; loadSources: () => void; sourcesLoading: boolean; sourcesError: string | null
  onSourceOptionsAdded: (options: OpportunitySourceOption[]) => void
}) {
  const prefix = useId()
  const [title, setTitle] = useState(initial?.title ?? "")
  const [sources, setSources] = useState<OpportunitySource[]>(initial?.sources ?? [])
  const [sourceQuery, setSourceQuery] = useState("")
  const [deadline, setDeadline] = useState(initial?.dueAt?.slice(0, 10) ?? "")
  const [report, setReport] = useState(() => readOpportunityReport(initial?.report))
  const [pending, setPending] = useState(false)
  const [uploadsPending, setUploadsPending] = useState(0)
  const uploading = uploadsPending > 0
  const setUploading = useCallback((busy: boolean) => setUploadsPending(value => Math.max(0, value + (busy ? 1 : -1))), [])
  const [error, setError] = useState<string | null>(null)
  const submission = useRef<{ key: string; id: string } | null>(null)
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending || uploading) return
    let submittedSources = sources
    if (sourceQuery.trim()) {
      const text = sourceQuery.trim()
      const parsed = opportunitySourceSchema.safeParse(/^https?:\/\//i.test(text) ? { kind: "link", url: text } : { kind: "text", label: text })
      if (text.startsWith("@") || !parsed.success) { setError("Choose a source from the suggestions or enter a valid link."); return }
      submittedSources = [...new Map([...sources, parsed.data].map(item => [sourceKey(item), item])).values()]
      if (submittedSources.length > 20) { setError("You can add up to 20 sources."); return }
      setSources(submittedSources); setSourceQuery("")
    }
    const key = JSON.stringify([organizationId, title.trim(), submittedSources, deadline, report])
    if (submission.current?.key !== key) submission.current = { key, id: crypto.randomUUID() }
    setPending(true)
    setError(null)
    try {
      const result = await (initial ? updateWorkspaceOpportunity : createWorkspaceOpportunity)({ id: initial?.id ?? submission.current.id, updatedAt: initial?.updatedAt, organizationId, title, source: initial?.source ?? "", sources: submittedSources, deadline, report })
      if ("error" in result) setError(result.error)
      else onCreated(result.opportunity)
    } catch { setError("Unable to add this opportunity. Your entries are still here.") }
    finally { setPending(false) }
  }
  return <form aria-label={initial ? "Edit opportunity" : "Add opportunity"} onSubmit={submit} className="space-y-3" aria-busy={pending || uploading}>
    <div className="flex items-center justify-between gap-2 pl-3"><h3 className="text-sm font-medium">{initial ? "Edit opportunity" : "Add opportunity"}</h3><Button type="button" size="icon" variant="ghost" className="size-9 rounded-full [@media(pointer:coarse)]:size-11" aria-label={initial ? "Cancel editing opportunity" : "Cancel adding opportunity"} disabled={pending || uploading} onClick={onCancel}><X className="size-4" aria-hidden="true" /></Button></div>
    <fieldset disabled={pending || uploading} className="space-y-3">
      <div className={styles.group}>
        <div className={`${styles.row} ${styles.stacked} !py-2`}><Label className="sr-only" htmlFor={`${prefix}-title`}>Opportunity</Label><Input autoFocus id={`${prefix}-title`} value={title} onChange={event => setTitle(event.target.value)} required maxLength={200} placeholder="Opportunity" /></div>
        <div className={`${styles.row} ${styles.stacked} !py-2`}><OpportunitySourceDropZone organizationId={organizationId} value={sources} onChange={setSources} onOptionsAdded={onSourceOptionsAdded} disabled={pending || uploading} onBusyChange={setUploading}>{openFiles => <OpportunitySourcesInput value={sources} onChange={setSources} query={sourceQuery} onQueryChange={setSourceQuery} organizationId={organizationId} options={sourceOptions} loadOptions={loadSources} loading={sourcesLoading} error={sourcesError} disabled={pending || uploading} onAttachFiles={openFiles} />}</OpportunitySourceDropZone></div>
        <WorkspaceOpportunityTimeline value={deadline} onChange={setDeadline} disabled={pending} />
      </div>
      <OpportunityReportEditor value={report} onChange={setReport} organizationId={organizationId} options={sourceOptions} loadOptions={loadSources} loading={sourcesLoading} error={sourcesError} onOptionsAdded={onSourceOptionsAdded} onBusyChange={setUploading} disabled={pending || uploading} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full rounded-full" disabled={!title.trim() || uploading}>{pending ? "Saving…" : uploading ? "Attaching…" : initial ? "Save changes" : "Add opportunity"}</Button>
    </fieldset>
  </form>
}
