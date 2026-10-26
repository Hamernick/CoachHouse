import type { CompanionSnapshot } from "../types"

function receiptClock(snapshot: CompanionSnapshot) {
  return Math.max(0, ...snapshot.receipts.map((receipt) => Date.parse(receipt.at) || 0))
}

/** Model pushes and tool responses cannot roll saved state back. New sessions mount a new card. */
export function reconcileCompanionSnapshot(current: CompanionSnapshot, incoming: CompanionSnapshot): CompanionSnapshot {
  if (incoming.organization.id !== current.organization.id || incoming.lesson.id !== current.lesson.id || incoming.document.id !== current.document.id) return current
  const draft = incoming.draft.revision > current.draft.revision ? incoming.draft : current.draft
  const document = incoming.document.revision > current.document.revision ? incoming.document : current.document
  const currentReceipt = current.receipts.at(-1)?.id
  const receiptAdvanced = currentReceipt && incoming.receipts.at(-1)?.id !== currentReceipt && incoming.receipts.slice(0, -1).some(receipt => receipt.id === currentReceipt)
  const newer = receiptClock(incoming) > receiptClock(current) || (receiptClock(incoming) === receiptClock(current) && (receiptAdvanced || incoming.receipts.length > current.receipts.length || incoming.draft.revision > current.draft.revision || incoming.document.revision > current.document.revision))
  return { ...(newer ? incoming : current), draft, document }
}
