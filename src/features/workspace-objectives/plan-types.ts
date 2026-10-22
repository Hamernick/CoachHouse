import { z } from "zod"
import type { ObjectiveStep } from "./island-types"

export const planEdgeSchema = z.object({ id: z.uuid(), source: z.uuid(), target: z.uuid(), label: z.string().trim().max(120) })
export const planDraftSchema = z.object({
  id: z.uuid(), objectiveId: z.uuid(), revision: z.number().int().nonnegative(),
  title: z.string().trim().min(1).max(240),
  steps: z.array(z.object({
    id: z.uuid(), title: z.string().trim().min(1).max(240),
    status: z.enum(["todo", "in_progress", "blocked", "done"]), expectedUpdatedAt: z.string().nullable(),
  })).max(80),
  edges: z.array(planEdgeSchema).max(160),
})
export type PlanDraft = z.infer<typeof planDraftSchema>
export type PlanEdge = z.infer<typeof planEdgeSchema>
export type ObjectivePlan = { id: string; objectiveId: string; title: string; revision: number; stepIds: string[]; edges: PlanEdge[] }
export type ObjectivePlans = { available: boolean; plans: ObjectivePlan[] }
export function draftFromPlan(plan: ObjectivePlan, steps: ObjectiveStep[]): PlanDraft {
  return { ...plan, steps: plan.stepIds.flatMap(id => {
    const step = steps.find(item => item.id === id)
    return step ? [{ id, title: step.title, status: step.status, expectedUpdatedAt: step.updatedAt }] : []
  }) }
}
