"use client"
import { useEffect, useMemo, useState } from "react"
import { RoadmapBudgetTableEditor } from "@/components/roadmap/roadmap-budget-table-editor"
import { uploadOrgMedia } from "@/lib/organization/org-media"
import { normalizeRoadmapBudgetRows } from "@/lib/roadmap/budget"
import { RichTextEditor } from "@/components/rich-text-editor"
import { Button } from "@/components/ui/button"
import { DocumentDraftRecovery, type RecoverableDocumentDraft } from "./document-draft-recovery"
import type { RichTextEditorProps } from "@/components/rich-text-editor/types"
import type { RoadmapSection } from "@/lib/roadmap"
import type { DocumentTransport } from "../types"
import { DocumentVersionHistory } from "./document-version-history"
import { useOrganizationDocumentCollaborationController } from "../hooks/use-organization-document-collaboration-controller"

function DocumentPanel({ section, organizationId, userId, onPendingChange, onSavedSection, editorProps, canEdit = true, initialDraft, hideTextEditor = false, transport }: {
  hideTextEditor?: boolean; initialDraft?: RecoverableDocumentDraft; canEdit?: boolean; editorProps?: Partial<RichTextEditorProps>; onSavedSection?: (section: RoadmapSection) => void;
  transport?: DocumentTransport; section: RoadmapSection; organizationId: string; userId: string; onPendingChange?: (pending: boolean) => void
}) {
  const [legacyDraft, setLegacyDraft] = useState(initialDraft ?? null)
  const [historyTarget, setHistoryTarget] = useState<HTMLDivElement | null>(null)
  const scope = useMemo(() => ({ organizationId, sectionId: section.id }), [organizationId, section.id])
  const controller = useOrganizationDocumentCollaborationController(scope, userId, transport, canEdit)
  const recoveredDraft = legacyDraft ?? controller.recovery
  const editable = canEdit && !controller.accessDenied && !controller.blocked
  const discardDraft = () => { setLegacyDraft(null); controller.discardRecovery() }
  const { loaded, ready, error, status, onReady, sync, editorRef } = controller
  const statusInToolbar = Boolean(editorProps?.toolbarPortalId) && !hideTextEditor && ready && editable && !recoveredDraft
  const statusContent = <>
    <span>{ready && !editable && !error ? "View only" : status}</span>
    {controller.presenceUnavailable ? <span className="text-xs text-muted-foreground">Live cursors unavailable</span> : null}
  </>
  useEffect(() => { onPendingChange?.(controller.dirty.current) }, [status, onPendingChange, controller.dirty])
  useEffect(() => { if (controller.savedSection && !recoveredDraft) onSavedSection?.(controller.savedSection) }, [controller.savedSection, onSavedSection, recoveredDraft])
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
    {!statusInToolbar ? <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 text-sm" role="status" aria-live="polite">
      {statusContent}
    </div> : null}
    {recoveredDraft ? <DocumentDraftRecovery draft={recoveredDraft} disabled={!ready || !editable}
      discard={discardDraft} restore={() => {
        editorRef.current?.commands.setContent(recoveredDraft.content)
        if (section.id === "budget") controller.changeBudgetRows(recoveredDraft.budgetRows ?? [])
        controller.persistDraft()
        discardDraft()
        void sync()
      }} /> : null}
    {loaded ? <RichTextEditor {...editorProps} className={hideTextEditor ? "hidden" : editorProps?.className} value={loaded.section.content} onChange={() => {}} onReady={onReady}
      toolbarTrailingActions={statusInToolbar ? <><div ref={setHistoryTarget} className="flex shrink-0 items-center" /><div className="flex shrink-0 items-center gap-2 px-2 text-sm text-muted-foreground" role="status" aria-live="polite">{statusContent}</div></> : editorProps?.toolbarTrailingActions}
      onImageUpload={editorProps?.onImageUpload ?? (file => uploadOrgMedia({ file, kind: "roadmap-inline", organizationId }))}
      applyExternalValue={false} readOnly={!ready || !editable || Boolean(recoveredDraft)} preserveImages minHeight={300} ariaLabel={section.title} /> : !error ? <p className="text-sm">Opening document…</p> : null}
    {loaded && section.id === "budget" ? <RoadmapBudgetTableEditor rows={controller.budgetRows}
      canEdit={ready && editable && !recoveredDraft} isDirty={status !== "Saved"} isSaving={status === "Saving…"}
      onRowsChange={controller.changeBudgetRows} onSave={() => void sync()} /> : null}
    {controller.budgetConflict ? <div className="space-y-2">
      <p className="text-sm">Latest saved budget</p>
      <RoadmapBudgetTableEditor rows={controller.budgetConflict} canEdit={false} isDirty={false} isSaving={false} onRowsChange={() => {}} onSave={() => {}} />
      <Button variant="outline" size="sm" onClick={() => controller.resolveBudgetConflict(false)}>Use saved rows</Button>
      <Button variant="outline" size="sm" onClick={() => controller.resolveBudgetConflict(true)}>Save my rows instead</Button>
    </div> : null}
    {error || controller.draftWarning ? <div role={error ? "alert" : "status"} className="space-y-2 rounded-md border p-3 text-sm"><p className={error ? "text-destructive" : "text-muted-foreground"}>{error ?? controller.draftWarning}</p>
      {error && !controller.blocked ? <Button variant="outline" size="sm" onClick={() => void controller.retry()}>Try connecting again</Button> : null}
      {editorRef.current ? <Button variant="outline" size="sm" onClick={() => {
        const html = editorRef.current?.getHTML()
        if (html === undefined) return
        const url = URL.createObjectURL(new Blob([JSON.stringify({ content: html, budgetRows: controller.budgetRows }, null, 2)], { type: "application/json" }))
        const link = document.createElement("a"); link.href = url; link.download = "document-unsaved-copy.json"; link.click(); URL.revokeObjectURL(url)
      }}>Download my current copy</Button> : null}
    </div> : null}
    <DocumentVersionHistory scope={scope} transport={transport} toolbar={statusInToolbar} triggerContainer={historyTarget}
      disabled={!ready || !editable || Boolean(recoveredDraft) || status !== "Saved"} restore={version => {
      if (section.id === "budget") controller.changeBudgetRows(normalizeRoadmapBudgetRows(version.content?.budgetRows))
      editorRef.current?.commands.setContent(String(version.content?.content ?? ""))
      void sync()
    }} />
  </div>
}

// Reset the entire lifecycle when actor or document changes, even in an unkeyed parent.
export function OrganizationDocumentCollaborationPanel(props: Parameters<typeof DocumentPanel>[0]) {
  return <DocumentPanel key={`${props.userId}:${props.organizationId}:${props.section.id}`} {...props} />
}
