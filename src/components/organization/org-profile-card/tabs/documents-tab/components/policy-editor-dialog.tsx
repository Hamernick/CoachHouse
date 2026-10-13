"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PolicyEditorDialogFields } from "./policy-editor-dialog-fields"
import type { PolicyEditorDialogProps } from "./policy-editor-dialog-types"

export function PolicyEditorDialog({
  readOnly = false,
  open,
  onOpenChange,
  draft,
  categoryOptions,
  peopleOptions,
  programOptions,
  pending,
  pendingDocumentName,
  pendingDocumentUpload,
  viewingDocument,
  onChange,
  onToggleCategory,
  onCreateCategory,
  onRemoveCategory,
  onSelectDocument,
  onClearPendingDocument,
  onRemoveExistingDocument,
  onViewDocument,
  onSave,
}: PolicyEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{readOnly ? draft.title : draft.id ? "Edit policy" : "New policy"}</DialogTitle>
          <DialogDescription>
            {readOnly ? "View your saved policy. Upgrade to make changes." : "Add a policy with categories, associations, and a supporting PDF file."}
          </DialogDescription>
        </DialogHeader>

        {readOnly ? (
          <p className="max-h-[60dvh] overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">{draft.summary || "No summary added."}</p>
        ) : <PolicyEditorDialogFields
          open={open}
          draft={draft}
          categoryOptions={categoryOptions}
          peopleOptions={peopleOptions}
          programOptions={programOptions}
          pendingDocumentName={pendingDocumentName}
          pendingDocumentUpload={pendingDocumentUpload}
          viewingDocument={viewingDocument}
          onChange={onChange}
          onToggleCategory={onToggleCategory}
          onCreateCategory={onCreateCategory}
          onRemoveCategory={onRemoveCategory}
          onSelectDocument={onSelectDocument}
          onClearPendingDocument={onClearPendingDocument}
          onRemoveExistingDocument={onRemoveExistingDocument}
          onViewDocument={onViewDocument}
        />}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly ? <Button type="button" onClick={onSave} disabled={pending || pendingDocumentUpload}>
            {pending || pendingDocumentUpload ? "Saving…" : "Save policy"}
          </Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
