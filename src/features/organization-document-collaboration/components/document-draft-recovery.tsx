"use client"
import { Button } from "@/components/ui/button"
import type { BudgetTableRow } from "@/lib/modules"
export type RecoverableDocumentDraft = { content: string; budgetRows?: BudgetTableRow[] }

export function DocumentDraftRecovery({ draft, disabled, restore, discard }: {
  draft: RecoverableDocumentDraft; disabled: boolean; restore: () => void; discard: () => void
}) {
  return <div role="status" className="space-y-2 text-sm">
    <p>An earlier unsaved draft is available on this device. Choose whether to restore its text and budget rows or keep the saved document.</p>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={disabled} onClick={restore}>Restore earlier draft</Button>
      <Button size="sm" variant="outline" onClick={discard}>Keep saved document</Button>
      <Button size="sm" variant="ghost" onClick={() => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" }))
        const link = document.createElement("a"); link.href = url; link.download = "earlier-document-draft.json"; link.click(); URL.revokeObjectURL(url)
      }}>Download earlier draft</Button>
    </div>
  </div>
}
