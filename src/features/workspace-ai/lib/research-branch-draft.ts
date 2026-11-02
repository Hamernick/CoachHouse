import { z } from "zod"
import { researchResultSchema, type ResearchResult } from "../research-types"

/** Reuse the output bounds; only generated decision labels and destinations are editable. */
export const researchBranchDraftSchema = researchResultSchema.shape.decisions.unwrap()
type Decisions = z.infer<typeof researchBranchDraftSchema>

export function mergeResearchBranches(result: ResearchResult, edits: Decisions, allowIncompleteLabels = false): ResearchResult["decisions"] {
  const editable = (result.decisions ?? []).filter(decision => result.items.some(item => item.key === decision.itemKey && item.kind === "decision"))
  if (edits.length !== editable.length || new Set(edits.map(value => value.itemKey)).size !== edits.length ||
    edits.some(edit => !editable.some(value => value.itemKey === edit.itemKey)))
    throw new Error("Keep the generated decision identities in this preview.")
  for (const edit of edits) {
    const original = editable.find(value => value.itemKey === edit.itemKey)!
    if (edit.outcomes.length !== original.outcomes.length || new Set(edit.outcomes.map(value => value.key)).size !== edit.outcomes.length ||
      edit.outcomes.some(outcome => !original.outcomes.some(value => value.key === outcome.key)))
      throw new Error("Keep the generated outcome identities in this preview.")
    const labels = edit.outcomes.map(value => value.label.trim().toLocaleLowerCase()).filter(label => !allowIncompleteLabels || label.length > 0)
    if (new Set(labels).size !== labels.length)
      throw new Error("Give each outcome a distinct label.")
  }
  // Preserve original order and fixed reference decisions; no model-authored identity replacement.
  return result.decisions?.map(decision => {
    const edit = edits.find(value => value.itemKey === decision.itemKey)
    return edit ? { ...decision, outcomes: decision.outcomes.map(outcome => ({ ...outcome, ...edit.outcomes.find(value => value.key === outcome.key)! })) } : decision
  })
}
