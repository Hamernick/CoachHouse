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
}: {
  input: unknown
  workspaceId: string
  canEdit: boolean
  now: string
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
      return result.value
    },
  }
}
