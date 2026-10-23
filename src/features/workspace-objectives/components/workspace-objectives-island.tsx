"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ParticleObjectivesIsland } from "./particle-objectives-island"
import type { PlanningControls } from "../hooks/use-particle-plans"
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
export function WorkspaceObjectivesIsland({ scope, canEdit, onProjection, particles }: { scope: ObjectiveScope; canEdit: boolean; onProjection?: (projection: ObjectivePlanProjection) => void; particles?: PlanningControls }) {
  const [earlier, setEarlier] = useState(false)
  if (particles && !earlier) return <ParticleObjectivesIsland scope={scope} controls={particles} onEarlier={() => setEarlier(true)} />
  return <div className="flex flex-col items-center gap-1">{particles && <Button size="sm" variant="secondary" className="pointer-events-auto rounded-full" onClick={() => setEarlier(false)}>Back to workspace objectives</Button>}<ObjectivesIsland scope={scope} canEdit={canEdit} transport={transport} onProjection={onProjection} /></div>
}
