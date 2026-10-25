import type { AiDocumentTarget } from "../types"

type Scope = Pick<AiDocumentTarget, "userId" | "organizationId">
export type SelectionRecovery = { id: string; target: AiDocumentTarget }
const key = (scope: Scope) => `workspace-ai:selection:${scope.userId}:${scope.organizationId}`

// Only an opaque request pointer survives reload. Text remains on the authorized
// server; an old range is never persisted as an editor attachment.
export function readSelectionRecovery(scope: Scope): SelectionRecovery | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key(scope)) ?? "null")
    if (typeof value?.id !== "string" || value?.target?.userId !== scope.userId ||
        value?.target?.organizationId !== scope.organizationId ||
        typeof value.target.sectionId !== "string" || !value.target.sectionId.startsWith("selection:")) return null
    return { id: value.id, target: value.target }
  } catch { return null }
}
export function writeSelectionRecovery(value: SelectionRecovery) {
  try { sessionStorage.setItem(key(value.target), JSON.stringify(value)) } catch { /* Current request remains in memory. */ }
}
export function clearSelectionRecovery(value: SelectionRecovery) {
  try {
    // Another editor may have started a newer request in this tab.
    if (readSelectionRecovery(value.target)?.id === value.id) sessionStorage.removeItem(key(value.target))
  } catch { /* Optional browser storage. */ }
}
