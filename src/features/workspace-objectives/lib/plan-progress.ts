import type { ObjectiveStep } from "../island-types"
import type { ObjectivePlan, PlanEdge } from "../plan-types"

export type PlanApplicability = "active" | "waiting" | "inactive"
// Evaluate explicit choices only. Completing an action never guesses an outcome.
// Multiple incoming branches converge with OR semantics; unselected alternatives
// remain saved but do not count as applicable work.
export function planApplicability(plans: ObjectivePlan[]) {
  const ids = new Set(plans.flatMap(plan => plan.stepIds))
  const links = plans.flatMap(plan => plan.edges.map(edge => ({ edge, decision: plan.decisions?.find(item => item.stepId === edge.source) })))
    .filter(({ edge }) => ids.has(edge.source) && ids.has(edge.target))
  const states = new Map<string, PlanApplicability>()
  const edgeStates = new Map<string, PlanApplicability>()
  const visiting = new Set<string>()
  const visit = (id: string): PlanApplicability => {
    if (states.has(id)) return states.get(id)!
    if (visiting.has(id)) return "waiting" // Persisted writes reject cycles; fail closed for stale input.
    visiting.add(id)
    const incoming = links.filter(({ edge }) => edge.target === id)
    const paths = incoming.map(({ edge, decision }) => {
      const parent = visit(edge.source)
      const state: PlanApplicability = parent === "inactive" ? "inactive" : decision && decision.selectedEdgeId !== null && decision.selectedEdgeId !== edge.id
        ? "inactive" : parent === "waiting" || (decision && decision.selectedEdgeId === null) ? "waiting" : "active"
      edgeStates.set(edge.id, state)
      return state
    })
    const state = !incoming.length || paths.includes("active") ? "active" : paths.includes("waiting") ? "waiting" : "inactive"
    visiting.delete(id); states.set(id, state)
    return state
  }
  ids.forEach(visit)
  return { steps: states, edges: edgeStates }
}

export function planProgress(plans: ObjectivePlan[], members: ObjectiveStep[]) {
  const applicability = planApplicability(plans)
  const decisions = plans.flatMap(plan => plan.decisions ?? [])
  const active = members.filter(step => (applicability.steps.get(step.id) ?? "active") === "active")
  const completed = active.filter(step => {
    const choices = decisions.filter(decision => decision.stepId === step.id)
    return choices.length ? choices.every(choice => choice.selectedEdgeId !== null) : step.status === "done"
  })
  return { ...applicability, active, completed, waiting: members.filter(step => applicability.steps.get(step.id) === "waiting").length }
}

export function clearRemovedChoices<T extends { edges: PlanEdge[]; decisions?: ObjectivePlan["decisions"] }>(draft: T): T {
  return { ...draft, decisions: draft.decisions?.map(decision => ({ ...decision,
    selectedEdgeId: draft.edges.some(edge => edge.id === decision.selectedEdgeId && edge.source === decision.stepId) ? decision.selectedEdgeId : null,
  })) }
}
