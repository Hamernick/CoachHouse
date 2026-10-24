"use client"
import { useEffect, useState } from "react"
import { createParticle, buildParticlePreset, DEFAULT_PRESET_FIELDS, type Particle, type ParticlePlan, type ParticlePlanning, type ParticlePreset, type useParticleFlow } from "@/features/workspace-particles/client"
import { objectivePlanningAccessAction } from "../actions"
import type { ObjectiveScope } from "../island-types"

export type PlanningControls = ReturnType<typeof useParticleFlow>["controls"]
export type ObjectiveParticle = Extract<Particle, { type: "objective" }>
export function planningOf(objective: ObjectiveParticle): ParticlePlanning { return objective.data.planning ?? { plans: [], proposals: [] } }
export function useParticlePlans(scope: ObjectiveScope, controls: PlanningControls) {
  const [owner, setOwner] = useState(false)
  const [accessError, setAccessError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setOwner(false)
    void objectivePlanningAccessAction({ userId: scope.userId, organizationId: scope.organizationId }).then(access => { if (alive) setOwner(access.isOrganizationOwner) })
      .catch(() => { if (alive) setAccessError("Unable to check proposal review access.") })
    return () => { alive = false }
  }, [scope.userId, scope.organizationId]) // Primitive scope avoids refetching on canvas movement.
  const update = (objective: ObjectiveParticle, planning: ParticlePlanning, created?: Particle) => controls.commit([
    ...(created ? [{ kind: "put_particle" as const, particle: { ...created, canvasHidden: false }, expectedRevision: controls.graph?.particles.find(item => item.id === created.id)?.revision ?? null }] : []),
    { kind: "put_particle", particle: { ...objective, data: { ...objective.data, planning } }, expectedRevision: objective.revision },
  ], { optimistic: true })
  const savePlan = (objective: ObjectiveParticle, plan: ParticlePlan, created?: Particle) => {
    const planning = planningOf(objective)
    return update(objective, { ...planning, plans: planning.plans.some(item => item.id === plan.id) ? planning.plans.map(item => item.id === plan.id ? plan : item) : [...planning.plans, plan] }, created)
  }
  const propose = (objective: ObjectiveParticle, plan: ParticlePlan) => {
    const planning = planningOf(objective)
    return update(objective, { ...planning, proposals: [...planning.proposals, {
      id: crypto.randomUUID(), planId: plan.id, baseRevision: planning.plans.find(item => item.id === plan.id)?.revision ?? null,
      title: plan.title, particleIds: plan.particleIds, links: plan.links, summary: plan.summary, sources: plan.sources, researchRunId: plan.researchRunId, authorId: scope.userId, createdAt: new Date().toISOString(), status: "pending",
    }] })
  }
  const create = (objective: ObjectiveParticle, preset: ParticlePreset): Particle => ({
    ...buildParticlePreset(preset, { id: crypto.randomUUID(), workspaceId: scope.organizationId, now: new Date().toISOString(), title: preset.label, description: "", fields: DEFAULT_PRESET_FIELDS }),
    position: { x: objective.position.x + 360, y: objective.position.y + (planningOf(objective).plans.flatMap(plan => plan.particleIds).length * 240) }, positionMode: "manual",
  })
  const createObjective = async (title: string) => {
    const particle = createParticle("objective", { id: crypto.randomUUID(), workspaceId: scope.organizationId, now: new Date().toISOString(), title })
    const canvas = document.querySelector("[data-workspace-canvas-flow-frame]")?.getBoundingClientRect()
    const position = canvas && controls.flow.current ? controls.flow.current.screenToFlowPosition({ x: canvas.left + canvas.width / 2, y: canvas.top + 100 }) : { x: 100, y: 100 }
    return controls.add("objective", title, position, particle, { inspect: false, optimistic: true })
  }
  return { owner, accessError, update, savePlan, propose, create, createObjective }
}
