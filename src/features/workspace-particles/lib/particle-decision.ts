import type { Particle, ParticleConnection } from "../types"

export type DecisionBranchReference = Pick<ParticleConnection,"source"> & Partial<Pick<ParticleConnection,"outcome" | "sourceHandle">>

export type DecisionParticle = Extract<Particle, { type: "decision" }>
export type DecisionCriterion = DecisionParticle["data"]["criteria"][number]
export type DecisionOutcome = DecisionParticle["data"]["outcomes"][number]

export function decisionCriteriaOrder(criteria: readonly DecisionCriterion[]) {
  return [...criteria].sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id)
  )
}

export function replaceDecisionCriterion(
  particle: DecisionParticle,
  criterion: DecisionCriterion
): DecisionParticle {
  return {
    ...particle,
    data: {
      ...particle.data,
      criteria: particle.data.criteria.map((item) =>
        item.id === criterion.id ? criterion : item
      ),
    },
  }
}

export function moveDecisionItem(
  particle: DecisionParticle,
  collection: "criteria" | "outcomes",
  id: string,
  direction: -1 | 1
): DecisionParticle {
  const items =
    collection === "criteria"
      ? decisionCriteriaOrder(particle.data.criteria)
      : [...particle.data.outcomes]
  const index = items.findIndex((item) => item.id === id)
  const next = index + direction
  if (index < 0 || next < 0 || next >= items.length) return particle
  if (collection === "criteria") {
    const criteria = decisionCriteriaOrder(particle.data.criteria)
    ;[criteria[index], criteria[next]] = [criteria[next], criteria[index]]
    return {
      ...particle,
      data: {
        ...particle.data,
        criteria: criteria.map((item, order) => ({ ...item, order })),
      },
    }
  }
  const outcomes = [...particle.data.outcomes]
  ;[outcomes[index], outcomes[next]] = [outcomes[next], outcomes[index]]
  return { ...particle, data: { ...particle.data, outcomes } }
}

export function decisionOutcomeRemovalReason(
  particle: DecisionParticle,
  outcomeId: string,
  connections: readonly DecisionBranchReference[]
): string | null {
  if (
    connections.some(
      (edge) =>
        edge.source === particle.id &&
        (edge.outcome === outcomeId ||
          edge.sourceHandle === `outcome:${outcomeId}`)
    )
  )
    return "Disconnect this outcome’s branches before removing it."
  if (particle.data.outcomes.length <= 2) return "Keep at least two outcomes."
  return null
}

export function removeDecisionOutcome(
  particle: DecisionParticle,
  outcomeId: string,
  connections: readonly DecisionBranchReference[]
): DecisionParticle {
  if (
    decisionOutcomeRemovalReason(particle, outcomeId, connections) ||
    !particle.data.outcomes.some((item) => item.id === outcomeId)
  )
    return particle
  return {
    ...particle,
    data: {
      ...particle.data,
      outcomes: particle.data.outcomes.filter((item) => item.id !== outcomeId),
      selectedOutcome:
        particle.data.selectedOutcome === outcomeId
          ? null
          : particle.data.selectedOutcome,
    },
  }
}

export function selectDecisionOutcome(
  particle: DecisionParticle,
  outcomeId: string | null
): DecisionParticle {
  if (
    outcomeId !== null &&
    !particle.data.outcomes.some((item) => item.id === outcomeId)
  )
    return particle
  return { ...particle, data: { ...particle.data, selectedOutcome: outcomeId } }
}

export function createDecisionOutcome(uuid: string): DecisionOutcome {
  return { id: `outcome_${uuid}`, label: "New outcome" }
}
