import "server-only"
import { researchTargetSchema, type ResearchTarget } from "../research-types"
import type { ResearchContext } from "./research-context"
import { ResearchRecoveryError } from "./research-recovery"

/** A chat may revise only the saved plan descended from its own applied run. */
export function savedConversationPlan(context: ResearchContext, runId: string) {
  for (const objective of context.graph.particles) {
    if (objective.type !== "objective") continue
    const planning = objective.data.planning
    const origin = planning?.proposals.find(proposal => proposal.researchRunId === runId)
    if (origin && origin.status !== "accepted") return { objective, plan: null }
    const plan = planning?.plans.find(plan => plan.researchRunId === runId || plan.id === origin?.planId)
    if (plan) return { objective, plan }
    if (origin) return { objective, plan: null }
  }
  return null
}

export function storedConversationTarget(context: ResearchContext, raw: {
  target: ResearchTarget & { userId?: string; canvasId?: string | null; conversation?: unknown }
}) {
  if (!raw.target.conversation || raw.target.organizationId !== context.target.organizationId ||
      raw.target.userId !== context.user.id || raw.target.canvasId !== context.canvasId)
    throw new ResearchRecoveryError("scope_mismatch")
  const { organizationId, revision, objectiveId, plan } = raw.target
  return researchTargetSchema.parse(raw.target.mode === "new_objective"
    ? { mode: "new_objective", organizationId, canvasId: raw.target.canvasId, revision }
    : { organizationId, objectiveId, revision, ...(plan ? { plan } : {}) })
}

export function nextConversationTarget(context: ResearchContext, runId: string, target: ResearchTarget): ResearchTarget {
  const saved = savedConversationPlan(context, runId)
  if (!saved) return target
  if (!saved.plan) {
    if (saved.objective.data.planning?.proposals.find(proposal => proposal.researchRunId === runId)?.status === "pending")
      throw new Error("Accept the proposed plan on the board before revising it in chat.")
    throw new ResearchRecoveryError("conversation_changed")
  }
  return { organizationId: context.target.organizationId, objectiveId: saved.objective.id,
    revision: saved.objective.revision, plan: { id: saved.plan.id, revision: saved.plan.revision } }
}
