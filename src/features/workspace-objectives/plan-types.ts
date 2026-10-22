import { z } from "zod"
import type { ObjectiveStep } from "./island-types"

export const planEdgeSchema = z.object({ id: z.uuid(), source: z.uuid(), target: z.uuid(), label: z.string().trim().max(120) })
export const planDecisionSchema = z.object({ stepId: z.uuid(), selectedEdgeId: z.uuid().nullable() })
export type PlanDecision = z.infer<typeof planDecisionSchema>
export const planDraftSchema = z.object({
  id: z.uuid(), objectiveId: z.uuid(), revision: z.number().int().nonnegative(),
  title: z.string().trim().min(1).max(240),
  steps: z.array(z.object({
    id: z.uuid(), title: z.string().trim().min(1).max(240),
    status: z.enum(["todo", "in_progress", "blocked", "done"]), expectedUpdatedAt: z.string().nullable(),
  })).max(80),
  edges: z.array(planEdgeSchema).max(160),
  decisions: z.array(planDecisionSchema).max(80).optional(),
}).superRefine((draft, context) => {
  const seen = new Set<string>()
  for (const decision of draft.decisions ?? []) {
    const outcomes = draft.edges.filter(edge => edge.source === decision.stepId)
    if (seen.has(decision.stepId) || !draft.steps.some(step => step.id === decision.stepId) || outcomes.length < 2 ||
      outcomes.some(edge => !edge.label.trim()) || new Set(outcomes.map(edge => edge.label.trim().toLowerCase())).size !== outcomes.length ||
      (decision.selectedEdgeId !== null && !outcomes.some(edge => edge.id === decision.selectedEdgeId))) {
      context.addIssue({ code: "custom", path: ["decisions"], message: "Each decision needs at least two uniquely named outcomes and a valid choice." })
    }
    seen.add(decision.stepId)
  }
})
export type PlanDraft = z.infer<typeof planDraftSchema>
export type PlanEdge = z.infer<typeof planEdgeSchema>
export type ObjectivePlan = { id: string; objectiveId: string; title: string; revision: number; stepIds: string[]; edges: PlanEdge[]; decisions?: PlanDecision[] }
export type ObjectivePlans = { available: boolean; decisionsAvailable?: boolean; plans: ObjectivePlan[] }
export function draftFromPlan(plan: ObjectivePlan, steps: ObjectiveStep[]): PlanDraft {
  return { ...plan, steps: plan.stepIds.flatMap(id => {
    const step = steps.find(item => item.id === id)
    return step ? [{ id, title: step.title, status: step.status, expectedUpdatedAt: step.updatedAt }] : []
  }) }
}
