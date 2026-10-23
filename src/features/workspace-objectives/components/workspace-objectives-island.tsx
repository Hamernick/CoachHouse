"use client"
import type { ObjectiveScope } from "../island-types"
import type { PlanningControls } from "../hooks/use-particle-plans"
import { ParticleObjectivesIsland } from "./particle-objectives-island"
import type { WorkspaceFinanceInput } from "@/features/workspace-finance"

export function WorkspaceObjectivesIsland({ scope, particles, finance }: {
  scope: ObjectiveScope; particles: PlanningControls; finance?: WorkspaceFinanceInput
}) {
  return <ParticleObjectivesIsland key={`${scope.userId}:${scope.organizationId}`} scope={scope} controls={particles} finance={finance} />
}
