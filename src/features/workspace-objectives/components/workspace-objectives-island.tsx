"use client"
import { createIslandObjectiveAction, editIslandObjectiveAction, loadObjectiveIslandAction, setIslandStepAction } from "../actions"
import type { ObjectiveIslandTransport, ObjectiveScope } from "../island-types"
import { ObjectivesIsland } from "./objectives-island"

const transport: ObjectiveIslandTransport = {
  load: loadObjectiveIslandAction, create: createIslandObjectiveAction,
  edit: editIslandObjectiveAction, step: setIslandStepAction,
}
export function WorkspaceObjectivesIsland({ scope, canEdit }: { scope: ObjectiveScope; canEdit: boolean }) {
  return <ObjectivesIsland scope={scope} canEdit={canEdit} transport={transport} />
}
