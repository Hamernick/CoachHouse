import type { CompanionSnapshot, CompanionToolArguments, CompanionToolName } from "../types"

export type CompanionLocalState = { snapshot: CompanionSnapshot; answers: Record<string, string>; content: string }
export type CompanionOperation = { name: CompanionToolName; args: CompanionToolArguments }

function answersMatch(snapshot: CompanionSnapshot, a: Record<string, string>, b: Record<string, string>) {
  return snapshot.lesson.fields.every((field) => (a[field.name] ?? "") === (b[field.name] ?? ""))
}

function receiptClock(snapshot: CompanionSnapshot) {
  return Math.max(0, ...snapshot.receipts.map((receipt) => Date.parse(receipt.at) || 0))
}

/** Reconcile either a host push or a tool response without rolling back saved revisions or local edits. */
export function reconcileCompanionState(current: CompanionLocalState, incoming: CompanionSnapshot, acknowledged?: CompanionOperation): CompanionLocalState {
  const previous = current.snapshot
  // A different workspace must mount a new panel; never carry private edits across identities.
  if (incoming.organization.id !== previous.organization.id || incoming.lesson.id !== previous.lesson.id || incoming.document.id !== previous.document.id) return current
  const draft = incoming.draft.revision > previous.draft.revision ? incoming.draft : previous.draft
  const document = incoming.document.revision > previous.document.revision ? incoming.document : previous.document
  const isNewer = receiptClock(incoming) > receiptClock(previous) || (receiptClock(incoming) === receiptClock(previous) && (incoming.receipts.length > previous.receipts.length || incoming.draft.revision > previous.draft.revision || incoming.document.revision > previous.document.revision))
  const snapshot = { ...(isNewer ? incoming : previous), draft, document }
  const answersDirty = !answersMatch(previous, current.answers, previous.draft.answers)
  const documentDirty = current.content !== previous.document.content
  const acceptedAnswers = acknowledged?.name === "companion_save_draft" && incoming.draft.revision >= previous.draft.revision && answersMatch(previous, current.answers, acknowledged.args.answers ?? {})
  const acceptedDocument = acknowledged?.name === "companion_save_document" && incoming.document.revision >= previous.document.revision && current.content === acknowledged.args.content
  return {
    snapshot,
    answers: !answersDirty || acceptedAnswers ? draft.answers : current.answers,
    content: !documentDirty || acceptedDocument ? document.content : current.content,
  }
}
