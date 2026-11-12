"use client"

import { useCoreDocumentAccess } from "@/features/document-editing/client"
import { useCanvasDocumentSource } from "@/components/workspace/workspace-canvas-source-context"

import { organizationDocumentCollaborationEnabled } from "@/lib/feature-flags"
import { OrganizationDocumentCollaborationPanel } from "@/features/organization-document-collaboration/client"
import { useEffect, useState } from "react"
import { saveRoadmapSectionAction } from "@/actions/roadmap"
import { RichTextEditor } from "@/components/rich-text-editor"
import { RoadmapBudgetTableEditor } from "@/components/roadmap/roadmap-budget-table-editor"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import type { RoadmapSection } from "@/lib/roadmap"
import { toast } from "@/lib/toast"

type CoreEditorProps = {
  section: RoadmapSection
  organizationId: string
  userId: string
  onClose: () => void
  onSaved: () => void
}

export function OrganizationCoreDocumentEditor(props: CoreEditorProps) {
  return <CoreDocumentEditorSession key={`${props.userId}:${props.organizationId}:${props.section.id}`} {...props} />
}

function CoreDocumentEditorSession({ section, organizationId, userId, onClose, onSaved }: CoreEditorProps) {
  useCanvasDocumentSource("editor", section.id)
  const access = useCoreDocumentAccess({ organizationId, userId }, [section.id])
  const canEdit = access.state === "ready" && access.canEdit
  const [livePending, setLivePending] = useState(false)
  const [content, setContent] = useState(section.content)
  const [rows, setRows] = useState(section.budgetRows ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty =
    content !== section.content ||
    JSON.stringify(rows) !== JSON.stringify(section.budgetRows ?? [])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])
  const close = () => {
    if (
      !saving &&
      (!dirty || window.confirm("Discard unsaved document changes?"))
    )
      onClose()
  }
  const save = async () => {
    if (!canEdit) return
    setSaving(true)
    setError(null)
    try {
      const result = await saveRoadmapSectionAction({
        targetOrganizationId: organizationId,
        expectedOrganizationId: organizationId,
        expectedUserId: userId,
        expectedLastUpdated: section.lastUpdated,
        sectionId: section.id,
        content,
        budgetRows: rows,
      })
      if ("error" in result) {
        setError(result.error)
        return
      }
      toast.success("Document saved")
      onSaved()
      onClose()
    } catch {
      setError("Unable to save. Your changes are still here. Try again.")
    } finally {
      setSaving(false)
    }
  }
  if (access.state !== "ready") return <Dialog open onOpenChange={open => { if (!open) close() }}>
    <DialogContent><DialogHeader><DialogTitle>Document</DialogTitle><DialogDescription>{access.state === "checking" ? "Checking access…" : "Document unavailable. Close and reopen to check access."}</DialogDescription></DialogHeader>
      <Button variant="outline" onClick={close}>Close document</Button>
    </DialogContent>
  </Dialog>
  if (organizationDocumentCollaborationEnabled) {
    const closeLive = () => {
      if (!livePending || window.confirm("Some changes may not be saved. Keep this editor open to finish syncing, or close anyway?")) { onSaved(); onClose() }
    }
    return <Dialog open onOpenChange={open => { if (!open) closeLive() }}>
      <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader className="shrink-0"><DialogTitle>{section.title}</DialogTitle>
          <DialogDescription>Changes save automatically and appear for everyone editing this document.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <OrganizationDocumentCollaborationPanel key={`${organizationId}:${section.id}`} section={section}
            organizationId={organizationId} userId={userId} canEdit={canEdit} onPendingChange={setLivePending} />
        </div>
        <div className="flex shrink-0 justify-end gap-2"><Button variant="outline" onClick={closeLive}>Close</Button></div>
      </DialogContent>
    </Dialog>
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{section.title}</DialogTitle>
          <DialogDescription>
            Edit this organization’s core document.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <RichTextEditor
            value={content}
            onChange={setContent}
            ariaLabel={section.title}
            preserveImages
            readOnly={saving || !canEdit}
            minHeight={300}
          />
          {section.id === "budget" ? (
            <RoadmapBudgetTableEditor
              rows={rows}
              canEdit={!saving && canEdit}
              isDirty={dirty}
              isSaving={saving}
              onRowsChange={setRows}
              onSave={() => void save()}
            />
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <div className="flex shrink-0 justify-end gap-2">
          <Button variant="outline" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || !dirty || !canEdit}>
            {saving ? "Saving…" : "Save document"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
