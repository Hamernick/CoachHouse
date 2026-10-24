import { particlePlanningPermissionError, type PlanningActor } from "./particle-plan-authority"
import type { Json } from "@/lib/supabase"
import type {
  ParticleCommit,
  ParticleFailureCode,
  ParticleResult,
} from "../types"
import {
  prepareParticleBatch,
  applyPreparedParticleBatch,
} from "./graph-operations"
import { readParticleGraph } from "./graph-validation"

export class ParticleMutationError extends Error {
  constructor(
    public readonly code: ParticleFailureCode,
    message: string
  ) {
    super(message)
    this.name = "ParticleMutationError"
  }
}

// The authenticated route supplies the actor and existing board writer. This
// service deliberately cannot import route-private modules or receive a DB ID
// selected by the model/client as authority.
export async function prepareAuthorizedParticleMutation({
  input,
  workspaceId,
  canEdit,
  now,
  planningActor,
  authorizedResearch,
}: {
  input: unknown
  workspaceId: string
  canEdit: boolean
  now: string
  planningActor?: PlanningActor
  authorizedResearch?: { runId: string; objectiveId: string }
}): Promise<ParticleResult<(stored: Json | undefined) => ParticleCommit>> {
  if (!canEdit)
    return {
      ok: false,
      code: "scope",
      error: "You do not have permission to edit this workspace.",
    }
  const prepared = await prepareParticleBatch(input)
  if (!prepared.ok) return prepared
  if (prepared.value.batch.workspaceId !== workspaceId)
    return {
      ok: false,
      code: "scope",
      error: "Particle operation belongs to another workspace.",
    }
  return {
    ok: true,
    value: (stored) => {
      const graph = readParticleGraph(stored, workspaceId)
      if (!graph.ok) throw new ParticleMutationError(graph.code, graph.error)
      const result = applyPreparedParticleBatch(
        graph.value,
        prepared.value,
        now
      )
      if (!result.ok) throw new ParticleMutationError(result.code, result.error)
      if (!result.value.replayed) {
        for (const item of result.value.graph.particles) {
          if (item.type !== "objective") continue
          const previous = graph.value.particles.find(value => value.id === item.id)
          const old = previous?.type === "objective" ? previous.data.planning : undefined
          const known = new Set([...(old?.plans ?? []), ...(old?.proposals ?? [])].map(value => value.researchRunId).filter(Boolean))
          for (const value of [...(item.data.planning?.plans ?? []), ...(item.data.planning?.proposals ?? [])]) {
            if (value.researchRunId && !known.has(value.researchRunId) &&
                (authorizedResearch?.runId !== value.researchRunId || authorizedResearch.objectiveId !== item.id))
              throw new ParticleMutationError("scope", "Add research through its saved proposal.")
          }
        }
        // Review metadata is server-owned; client timestamps are never authority.
        for (const item of result.value.graph.particles) {
          if (item.type !== "objective" || !item.data.planning) continue
          const previous = graph.value.particles.find(value => value.id === item.id)
          const old = previous?.type === "objective" ? previous.data.planning?.proposals ?? [] : []
          item.data.planning.proposals = item.data.planning.proposals.map(proposal => {
            const prior = old.find(value => value.id === proposal.id)
            return proposal.status !== "pending" && prior?.status === "pending"
              ? { ...proposal, reviewedAt: now, reviewedBy: planningActor?.userId ?? proposal.reviewedBy }
              : !prior ? { ...proposal, createdAt: now } : proposal
          })
        }
        const error = particlePlanningPermissionError(graph.value, result.value.graph, planningActor, now)
        if (error) throw new ParticleMutationError("scope", error)
      }
      return result.value
    },
  }
}
