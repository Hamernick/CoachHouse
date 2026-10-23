import type { BudgetTableRow } from "@/lib/modules"
import type { DocumentScope } from "../types"

export type StoredDocumentDraft = {
  schema: 1; actorId: string; organizationId: string; sectionId: string; clientId: string;
  generation: string | null; version: number; savedAt: number; content: string; budgetRows: BudgetTableRow[]
}
export function draftPrefix(actorId: string, scope: DocumentScope) {
  return `coachhouse:document-draft:v1:${encodeURIComponent(actorId)}:${encodeURIComponent(scope.organizationId)}:${encodeURIComponent(scope.sectionId)}:`
}
export function draftKey(draft: Pick<StoredDocumentDraft, "actorId" | "organizationId" | "sectionId" | "clientId">) {
  return draftPrefix(draft.actorId, draft) + encodeURIComponent(draft.clientId)
}
export function storeDocumentDraft(storage: Storage, draft: StoredDocumentDraft): boolean {
  try { storage.setItem(draftKey(draft), JSON.stringify(draft)); return true } catch { return false }
}
export function removeDocumentDraft(storage: Storage, draft: Parameters<typeof draftKey>[0]): boolean {
  try { storage.removeItem(draftKey(draft)); return true } catch { return false }
}
export function readDocumentDraft(storage: Storage, actorId: string, scope: DocumentScope, currentClientId: string): StoredDocumentDraft | null {
  try {
    const prefix = draftPrefix(actorId, scope)
    let newest: StoredDocumentDraft | null = null
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (!key?.startsWith(prefix)) continue
      try {
        const value = JSON.parse(storage.getItem(key) ?? "null") as StoredDocumentDraft | null
        if (!value || value.schema !== 1 || value.actorId !== actorId || value.organizationId !== scope.organizationId
          || value.sectionId !== scope.sectionId || value.clientId === currentClientId || typeof value.clientId !== "string"
          || typeof value.content !== "string" || !Array.isArray(value.budgetRows) || !Number.isFinite(value.savedAt)) continue
        if (!newest || newest.savedAt < value.savedAt) newest = value
      } catch { /* Ignore malformed entries without deleting another tab's work. */ }
    }
    return newest
  } catch { return null }
}
