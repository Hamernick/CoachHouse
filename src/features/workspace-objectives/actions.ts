"use server"
import type { ObjectiveEdit, ObjectiveScope } from "./island-types"
import { loadObjectiveIsland, createIslandObjective, editIslandObjective, setIslandStep } from "./server/island-actions"

export async function loadObjectiveIslandAction(scope: ObjectiveScope) { return loadObjectiveIsland(scope) }
export async function createIslandObjectiveAction(scope: ObjectiveScope, title: string) { return createIslandObjective(scope, title) }
export async function editIslandObjectiveAction(scope: ObjectiveScope, input: ObjectiveEdit) { return editIslandObjective(scope, input) }
export async function setIslandStepAction(scope: ObjectiveScope, input: Parameters<typeof setIslandStep>[1]) { return setIslandStep(scope, input) }

export async function saveObjectivePlanAction(scope: ObjectiveScope, input: import("./plan-types").PlanDraft) {
  const { saveObjectivePlan } = await import("./server/plan-actions")
  return saveObjectivePlan(scope, input)
}

export async function objectivePlanningAccessAction(scope: ObjectiveScope) {
  const { objectiveActor } = await import("./server/objective-actor")
  const actor = await objectiveActor(scope)
  return { isOrganizationOwner: actor.isOrganizationOwner }
}
