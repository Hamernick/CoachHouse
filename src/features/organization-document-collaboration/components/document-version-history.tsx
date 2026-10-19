"use client"
import { useState } from "react"
import { createPortal } from "react-dom"
import History from "lucide-react/dist/esm/icons/history"
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { RoadmapBudgetTableEditor } from "@/components/roadmap/roadmap-budget-table-editor"
import { normalizeRoadmapBudgetRows } from "@/lib/roadmap/budget"
import { RichTextEditor } from "@/components/rich-text-editor"
import { defaultDocumentTransport } from "../hooks/use-organization-document-collaboration-controller"
import type { DocumentScope, DocumentVersion, DocumentTransport } from "../types"

export function DocumentVersionHistory({ scope, disabled, restore, transport = defaultDocumentTransport, toolbar = false, triggerContainer }: {
  scope: DocumentScope; transport?: DocumentTransport; disabled: boolean; restore: (version: DocumentVersion) => void
  toolbar?: boolean; triggerContainer?: HTMLElement | null
}) {
  const [versions, setVersions] = useState<DocumentVersion[] | null>(null)
  const [selected, setSelected] = useState<DocumentVersion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  async function load() {
    setLoading(true)
    try {
      const result = await transport.versions(scope)
      if ("error" in result) setError(result.error)
      else { setVersions(result.versions); setError(null) }
    } catch { setError("Unable to load history. Try again.") }
    finally { setLoading(false) }
  }
  const label = versions ? "Close version history" : "Version history"
  const trigger = <Button type="button" size="sm" variant={toolbar ? "ghost" : "outline"}
    className={cn(toolbar && "h-7 w-7 p-0 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8")}
    aria-label={label} title={label} aria-expanded={Boolean(versions)} aria-busy={loading}
    onClick={() => versions ? setVersions(null) : void load()} disabled={loading}>
    {toolbar ? loading ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <History className="size-4" aria-hidden="true" />
      : loading ? "Loading history…" : versions ? "Close history" : "Version history"}
  </Button>
  return <>
    {toolbar ? triggerContainer ? createPortal(trigger, triggerContainer) : null : <div>{trigger}</div>}
    {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
    {versions ? <div className="space-y-3 rounded-lg border p-3">
      <p className="text-muted-foreground text-sm">Preview a saved version before restoring it. Restoring creates a new version.</p>
      {!versions.length ? <p className="text-sm">History starts with the first edit after version recovery is enabled.</p> : null}
      <div className="flex max-h-40 flex-col gap-1 overflow-auto">
        {versions.map(version => <Button key={version.id} variant={selected?.id === version.id ? "secondary" : "ghost"}
          className="justify-start" onClick={() => setSelected(version)} disabled={!version.content}>
          {new Date(version.created_at).toLocaleString()} · {version.actor_name ?? (version.actor_id ? "Team member" : "Original")}{!version.content ? " · Deleted" : ""}
        </Button>)}
      </div>
      {selected?.content ? <>
        <RichTextEditor value={String(selected.content.content ?? "")} onChange={() => {}} readOnly preserveImages minHeight={120} />
        {Array.isArray(selected.content.budgetRows) ? <RoadmapBudgetTableEditor rows={normalizeRoadmapBudgetRows(selected.content.budgetRows)} canEdit={false} isDirty={false} isSaving={false} onRowsChange={() => {}} onSave={() => {}} /> : null}
        <Button disabled={disabled} onClick={() => {
          if (window.confirm("Restore this version? Your current saved content will remain in history.")) {
            restore(selected); setVersions(null); setSelected(null)
          }
        }}>Restore this version</Button>
      </> : null}
    </div> : null}
  </>
}
