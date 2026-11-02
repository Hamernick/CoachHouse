"use client"
import { memo } from "react"
import type { ObjectiveScope } from "../island-types"
import type { PlanningControls } from "../hooks/use-particle-plans"
import { ParticleObjectivesIsland } from "./particle-objectives-island"
import type { WorkspaceFinanceInput } from "@/features/workspace-finance"

// Position-only canvas updates must not render retained lists, editors, or their
// layout animations. Compare the scope values because callers may recreate it.
export const WorkspaceObjectivesIsland = memo(function WorkspaceObjectivesIsland({ scope, particles, finance }: {
  scope: ObjectiveScope; particles: PlanningControls; finance?: WorkspaceFinanceInput
}) {
  return <ParticleObjectivesIsland key={`${scope.userId}:${scope.organizationId}`} scope={scope} controls={particles} finance={finance} />
}, (previous, next) =>
  previous.particles === next.particles &&
  previous.finance === next.finance &&
  previous.scope.userId === next.scope.userId &&
  previous.scope.organizationId === next.scope.organizationId
)
