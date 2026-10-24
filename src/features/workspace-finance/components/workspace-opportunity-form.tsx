"use client"

import { useCallback, useId, useRef, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { createWorkspaceOpportunity, updateWorkspaceOpportunity } from "@/actions/workspace-opportunities"
import type { WorkspaceFinanceOpportunityInput } from "../types"
import { WorkspaceOpportunityTimeline } from "./workspace-opportunity-timeline"
import { OpportunityReportEditor, OpportunityReportAddMenu } from "./opportunity-report-editor"
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
  return <form aria-label={initial ? "Edit opportunity" : "Add opportunity"} onSubmit={submit} className="relative min-w-0" aria-busy={pending || uploading} onKeyDown={event => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); event.currentTarget.requestSubmit() }
  }}>
    <fieldset disabled={pending || uploading} className="min-w-0">
      <div className="space-y-5 px-4 pt-4 pb-5">
        <div className="space-y-2">
          <Label className="sr-only" htmlFor={`${prefix}-title`}>Opportunity</Label>
          <Textarea autoFocus rows={1} id={`${prefix}-title`} value={title} onChange={event => setTitle(event.target.value)} required maxLength={200} placeholder="Opportunity" className="min-h-10 resize-none border-0 bg-transparent px-1 py-1 text-lg font-semibold leading-snug shadow-none dark:bg-transparent md:text-lg" />
          <WorkspaceOpportunityTimeline value={deadline} onChange={setDeadline} disabled={pending || uploading} />
          <OpportunitySourceDropZone organizationId={organizationId} value={sources} onChange={setSources} onOptionsAdded={onSourceOptionsAdded} disabled={pending || uploading} onBusyChange={setUploading}>{openFiles => <OpportunitySourcesInput value={sources} onChange={setSources} query={sourceQuery} onQueryChange={setSourceQuery} organizationId={organizationId} options={sourceOptions} loadOptions={loadSources} loading={sourcesLoading} error={sourcesError} disabled={pending || uploading} onAttachFiles={openFiles} />}</OpportunitySourceDropZone>
        </div>
        <OpportunityReportEditor addControlId={`${prefix}-add`} value={report} onChange={setReport} organizationId={organizationId} options={sourceOptions} loadOptions={loadSources} loading={sourcesLoading} error={sourcesError} onOptionsAdded={onSourceOptionsAdded} onBusyChange={setUploading} disabled={pending || uploading} />
      </div>
    </fieldset>
    <div className="sticky bottom-0 z-10 space-y-2 rounded-b-2xl border-t border-border/60 bg-card px-3 py-2">
      {error && <p role="alert" className="px-1 text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-1">
        <OpportunityReportAddMenu id={`${prefix}-add`} value={report} onChange={setReport} disabled={pending || uploading} />
        <div className="ml-auto flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="min-h-9 rounded-lg [@media(pointer:coarse)]:min-h-11" aria-label={initial ? "Cancel editing opportunity" : "Cancel adding opportunity"} disabled={pending || uploading} onClick={onCancel}>Cancel</Button>
          <Button type="submit" size="sm" className="min-h-9 rounded-lg px-3 [@media(pointer:coarse)]:min-h-11" disabled={pending || !title.trim() || uploading}>{(pending || uploading) && <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" />}{pending ? "Saving…" : uploading ? "Attaching…" : initial ? "Save changes" : "Add opportunity"}</Button>
        </div>
      </div>
    </div>
  </form>
}
