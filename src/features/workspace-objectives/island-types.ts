import type { ObjectivePlans, PlanDraft } from "./plan-types"
import type { WorkspaceObjectiveCollection, WorkspaceObjectiveStatus } from "./types"

export type ObjectiveScope = { userId: string; organizationId: string }
export type ObjectiveStep = {
  id: string
  objectiveId: string
  title: string
  status: Exclude<WorkspaceObjectiveStatus, "archived">
  editable: boolean
  order: number
  updatedAt: string
}
export type ObjectiveIslandData = WorkspaceObjectiveCollection & { steps: ObjectiveStep[]; planning?: ObjectivePlans }
export type ObjectiveEdit = {
  id: string
  expectedUpdatedAt: string
  title: string
  description: string
  status: WorkspaceObjectiveStatus
}
export type ObjectiveMutationResult = { ok: true } | { ok: false; error: string }
export type ObjectiveIslandTransport = {
  savePlan?: (scope: ObjectiveScope, input: PlanDraft) => Promise<ObjectiveMutationResult>
  load: (scope: ObjectiveScope) => Promise<{ ok: true; data: ObjectiveIslandData } | { ok: false; error: string }>
  create: (scope: ObjectiveScope, title: string) => Promise<ObjectiveMutationResult>
  edit: (scope: ObjectiveScope, input: ObjectiveEdit) => Promise<ObjectiveMutationResult>
  step: (scope: ObjectiveScope, input: { id: string; objectiveId: string; expectedUpdatedAt: string; done: boolean }) => Promise<ObjectiveMutationResult>
}
