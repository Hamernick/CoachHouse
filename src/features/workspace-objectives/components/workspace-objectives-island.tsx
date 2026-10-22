"use client"
import { saveObjectivePlanAction, createIslandObjectiveAction, editIslandObjectiveAction, loadObjectiveIslandAction, setIslandStepAction } from "../actions"
import type { ObjectiveIslandTransport, ObjectiveScope } from "../island-types"
import type { ObjectivePlanProjection } from "./objective-plan-node"
import { quotePlanAssistance, readPlanAssistance, stopPlanAssistance, applyPlanAssistance, undoPlanAssistance } from "../ai-actions"
import { ObjectivesIsland } from "./objectives-island"

const transport: ObjectiveIslandTransport = {
  ai: process.env.NEXT_PUBLIC_WORKSPACE_AI_ENABLED === "true" ? {
    quote: quotePlanAssistance, read: readPlanAssistance, stop: stopPlanAssistance,
    apply: applyPlanAssistance, undo: undoPlanAssistance,
    generate: async input => {
      const response = await fetch("/api/workspace/ai/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) })
      return response.json()
    },
  } : undefined,
  savePlan: saveObjectivePlanAction, load: loadObjectiveIslandAction, create: createIslandObjectiveAction,
  edit: editIslandObjectiveAction, step: setIslandStepAction,
}
export function WorkspaceObjectivesIsland({ scope, canEdit, onProjection }: { scope: ObjectiveScope; canEdit: boolean; onProjection?: (projection: ObjectivePlanProjection) => void }) {
  return <ObjectivesIsland scope={scope} canEdit={canEdit} transport={transport} onProjection={onProjection} />
}
