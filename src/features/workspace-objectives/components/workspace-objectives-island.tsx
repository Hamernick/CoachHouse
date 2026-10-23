"use client"
import type { ObjectiveScope } from "../island-types"
import type { PlanningControls } from "../hooks/use-particle-plans"
import { ParticleObjectivesIsland } from "./particle-objectives-island"

export function WorkspaceObjectivesIsland({ scope, particles }: {
  scope: ObjectiveScope; particles: PlanningControls
}) {
  return <ParticleObjectivesIsland scope={scope} controls={particles} />
}
