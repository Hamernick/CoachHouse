import type { DocumentsOption, PolicyDraft } from "../types"

export type PolicyEditorDialogProps = {
  readOnly?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: PolicyDraft
  categoryOptions: string[]
  peopleOptions: DocumentsOption[]
  programOptions: DocumentsOption[]
  pending: boolean
  pendingDocumentName: string | null
  pendingDocumentUpload: boolean
  viewingDocument: boolean
  onChange: (next: PolicyDraft) => void
  onToggleCategory: (category: string) => void
  onCreateCategory: (category: string) => void
  onRemoveCategory: (category: string) => void
  onSelectDocument: (file: File) => void
  onClearPendingDocument: () => void
  onRemoveExistingDocument: () => void
  onViewDocument: () => void
  onSave: () => void
}
