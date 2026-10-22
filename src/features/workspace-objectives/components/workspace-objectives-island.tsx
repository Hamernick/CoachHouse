"use client"
import { saveObjectivePlanAction, createIslandObjectiveAction, editIslandObjectiveAction, loadObjectiveIslandAction, setIslandStepAction } from "../actions"
import type { ObjectiveIslandTransport, ObjectiveScope } from "../island-types"
import type { ObjectivePlanProjection } from "./objective-plan-node"
import { ObjectivesIsland } from "./objectives-island"

const transport: ObjectiveIslandTransport = {
  savePlan: saveObjectivePlanAction, load: loadObjectiveIslandAction, create: createIslandObjectiveAction,
  edit: editIslandObjectiveAction, step: setIslandStepAction,
}
export function WorkspaceObjectivesIsland({ scope, canEdit, onProjection }: { scope: ObjectiveScope; canEdit: boolean; onProjection?: (projection: ObjectivePlanProjection) => void }) {
  return <ObjectivesIsland scope={scope} canEdit={canEdit} transport={transport} onProjection={onProjection} />
}
