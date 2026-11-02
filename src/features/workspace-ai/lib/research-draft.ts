import { z } from "zod"
import { formDefinitionSchema } from "@/features/organization-forms"
import type { ResearchResult } from "../research-types"

import { mergeResearchBranches, researchBranchDraftSchema } from "./research-branch-draft"
import { validateResearchRelationships } from "./research-relationships"
import { validateResearchForms } from "./research-form"

const copyItem = z.strictObject({
  key: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
  title: z.string().trim().min(1).max(240), description: z.string().max(1800),
})
const copy = { title: z.string().trim().min(1).max(240), summary: z.string().max(1500) }
const linkedItem = copyItem.extend({ dependsOn: z.array(z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/)).max(8), form: formDefinitionSchema.optional() })
/** Older clients remain compatible; additions never carry evidence or canonical IDs. */
export const researchDraftSchema = z.discriminatedUnion("version", [
  z.strictObject({ version: z.literal(1), ...copy, items: z.array(copyItem).max(12) }),
  z.strictObject({ version: z.literal(2), ...copy, items: z.array(linkedItem).max(12) }),
  z.strictObject({ version: z.literal(3), ...copy, items: z.array(linkedItem).max(12),
    addedItems: z.array(linkedItem).max(12), removedKeys: z.array(copyItem.shape.key).max(12) }),
  z.strictObject({ version: z.literal(4), ...copy, items: z.array(linkedItem).max(12),
    addedItems: z.array(linkedItem).max(12), removedKeys: z.array(copyItem.shape.key).max(12), decisions: researchBranchDraftSchema }),
])
// Recovery preserves unfinished copy exactly. It never becomes an applicable
// proposal until the strict draft schema and semantic checks pass again.
const recoveryTitle = z.string().max(240)
const recoveryItem = linkedItem.extend({ title: recoveryTitle })
const recoveryDecision = researchBranchDraftSchema.element
export const researchRecoveryDraftSchema = researchDraftSchema.options[3].extend({
  title: recoveryTitle, items: z.array(recoveryItem).max(12), addedItems: z.array(recoveryItem).max(12),
  decisions: z.array(recoveryDecision.extend({ outcomes: z.array(
    recoveryDecision.shape.outcomes.element.extend({ label: recoveryTitle }),
  ).min(2).max(12) })).max(6),
})
export type ResearchDraft = z.infer<typeof researchDraftSchema>
export function createResearchDraft(result: ResearchResult): Extract<ResearchDraft, { version: 4 }> {
  return { version: 4, decisions: structuredClone((result.decisions ?? []).filter(decision => result.items.some(item => item.key === decision.itemKey && item.kind === "decision"))), title: result.title, summary: result.summary, addedItems: [], removedKeys: [],
    items: result.items.filter(item => item.kind !== "reference").map(({ key, title, description, dependsOn, form }) => ({ key, title, description, dependsOn: [...dependsOn], ...(form ? { form: structuredClone(form) } : {}) })) }
}
export function applyResearchDraft(result: ResearchResult, input?: ResearchDraft): ResearchResult {
  if (!input) return result
  return materializeResearchDraft(result, researchDraftSchema.parse(input))
}

/** Validate private recovery without returning an applicable result. */
export function validateResearchRecoveryDraft(result: ResearchResult, input: unknown, attempted = false): void {
  const draft = researchRecoveryDraftSchema.parse(input)
  if (attempted) applyResearchDraft(result, draft)
  else materializeResearchDraft(result, draft, true)
}

function materializeResearchDraft(result: ResearchResult, draft: ResearchDraft, allowIncompleteLabels = false): ResearchResult {
  const keys = new Set(draft.items.map(item => item.key))
  const editable = result.items.filter(item => item.kind !== "reference")
  if (keys.size !== draft.items.length || keys.size !== editable.length || editable.some(item => !keys.has(item.key)))
    throw new Error("Preview items changed. Reopen the saved research.")
  const prerequisites = new Map(draft.version !== 1 ? draft.items.map(item => [item.key, item.dependsOn] as const) : [])
  const decisions = draft.version === 4 ? mergeResearchBranches(result, draft.decisions, allowIncompleteLabels) : result.decisions
  const removed = new Set((draft.version === 3 || draft.version === 4) ? draft.removedKeys : [])
  const added = (draft.version === 3 || draft.version === 4) ? draft.addedItems : []
  if (draft.version !== 1 && (draft.items.some(edit => edit.form && result.items.find(item => item.key === edit.key)?.kind !== "form") || added.some(item => item.form)))
    throw new Error("Form edits require an existing form preview.")
  if ((draft.version === 3 || draft.version === 4)) {
    if (removed.size !== draft.removedKeys.length || [...removed].some(key => !keys.has(key)))
      throw new Error("Only generated preview items can be removed.")
    for (const key of removed) {
      const reason = researchRemovalError({ ...result, decisions }, key)
      if (reason) throw new Error(reason)
    }
    const originalKeys = new Set(result.items.map(item => item.key))
    if (new Set(added.map(item => item.key)).size !== added.length || added.some(item => originalKeys.has(item.key)))
      throw new Error("Added items must have distinct preview keys.")
    const count = result.items.length - removed.size + added.length
    if (count > 12) throw new Error("Keep at most twelve items in this preview.")
    if (!count && !result.removeReferences?.length) throw new Error("Keep at least one item in this preview.")
  }
  const edited = { ...result, decisions, title: draft.title, summary: draft.summary,
    items: [...result.items.filter(item => !removed.has(item.key)).map(item => {
      const edit = draft.items.find(edit => edit.key === item.key)
      return edit ? { ...item, title: edit.title, description: edit.description, dependsOn: prerequisites.get(item.key) ?? item.dependsOn,
        ...("form" in edit && edit.form ? { form: formDefinitionSchema.parse(edit.form) } : {}) } : item
    }), ...added.map(item => ({ ...item, kind: "note" as const, referenceId: null, evidenceIds: [] }))] }
  validateResearchRelationships(edited)
  validateResearchForms(edited.items, allowIncompleteLabels)
  return edited
}

/** Fixed references and branch definitions cannot be silently rewritten by removal. */
export function researchRemovalError(result: ResearchResult, key: string): string | null {
  const item = result.items.find(item => item.key === key)
  if (item?.kind === "reference") return "Existing workspace items stay in this preview."
  if (item?.kind === "decision" || result.decisions?.some(decision => decision.itemKey === key || decision.outcomes.some(outcome => outcome.next.includes(key))))
    return "Keep decisions and connected branch items. Disconnect a branch before removing its item."
  if (result.items.some(item => item.kind === "reference" && item.dependsOn.includes(key)))
    return "An existing workspace item depends on this item."
  return null
}

export function researchDraftError(result: ResearchResult, draft: ResearchDraft): string | null {
  const active = (draft.version === 3 || draft.version === 4) ? [...draft.items.filter(item => !draft.removedKeys.includes(item.key)), ...draft.addedItems] : draft.items
  if (!draft.title.trim() || active.some(item => !item.title.trim())) return "Give the plan and each item a title."
  if (draft.version === 4 && draft.decisions.some(decision => decision.outcomes.some(outcome => !outcome.label.trim()))) return "Give each outcome a label."
  if (!researchDraftSchema.safeParse(draft).success) return "Check text limits and keep at most eight prerequisites per item."
  try { applyResearchDraft(result, draft); return null }
  catch (error) { return error instanceof Error ? error.message : "Check this preview’s connections." }
}
