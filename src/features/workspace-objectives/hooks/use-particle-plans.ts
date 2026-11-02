"use client"
import { planCommand, particleRegistry } from "@/features/workspace-particles/client"
import { createParticle, newlyAttachedParticles, prepareParticlePlacementReveal, particlePlacementMeasurements, buildParticlePreset, DEFAULT_PRESET_FIELDS, type Particle, type ParticlePlan, type ParticlePlanning, type ParticlePreset, type useParticleFlow } from "@/features/workspace-particles/client"
import { useObjectivePlanningAccess } from "./use-objective-planning-access"
import type { ObjectiveScope } from "../island-types"

export type PlanningControls = ReturnType<typeof useParticleFlow>["controls"]
export type ObjectiveParticle = Extract<Particle, { type: "objective" }>
export function planningOf(objective: ObjectiveParticle): ParticlePlanning { return objective.data.planning ?? { plans: [], proposals: [] } }
export function useParticlePlans(scope: ObjectiveScope, controls: PlanningControls) {
  const access = useObjectivePlanningAccess(scope, controls.planningAccess)
  const owner = access?.isOrganizationOwner ?? false
  const accessError = access?.error ?? null
  const update = async (objective: ObjectiveParticle, planning: ParticlePlanning, created?: Particle) => {
    const graph = controls.getCurrentGraph()
    if (!graph) return Promise.resolve(false)
    const placed = newlyAttachedParticles(graph, objective, planning, created, particlePlacementMeasurements(controls.flow.current))
    const reveal = prepareParticlePlacementReveal(controls.flow)
    const saved = await controls.commit([
      ...placed.map(particle => ({ kind: "put_particle" as const, particle, expectedRevision: graph.particles.find(item => item.id === particle.id)?.revision ?? null })),
      { kind: "put_particle", particle: { ...objective, data: { ...objective.data, planning } }, expectedRevision: objective.revision },
    ], { optimistic: true })
    if (saved && placed[0]) reveal(placed[0])
    return saved
  }
  const savePlan = async (objective: ObjectiveParticle, plan: ParticlePlan, created?: Particle) => {
    const graph = controls.getCurrentGraph()
    if (!graph) return false
    const planning = planningOf(objective)
    const next = { ...planning, plans: planning.plans.some(item => item.id === plan.id) ? planning.plans.map(item => item.id === plan.id ? plan : item) : [...planning.plans, plan] }
    const placed = newlyAttachedParticles(graph, objective, next, created, particlePlacementMeasurements(controls.flow.current))
    const reveal = prepareParticlePlacementReveal(controls.flow)
    const saved = await controls.commit([
      ...placed.map(particle => ({ kind: "put_particle" as const, particle, expectedRevision: graph.particles.find(item => item.id === particle.id)?.revision ?? null })),
      particleRegistry.objective.capabilities.plan.inputSchema.parse(planCommand(objective, plan)),
    ], { optimistic: true })
    if (saved && placed[0]) reveal(placed[0])
    return saved
  }
  const propose = (objective: ObjectiveParticle, plan: ParticlePlan) => {
    const planning = planningOf(objective)
    return update(objective, { ...planning, proposals: [...planning.proposals, {
      id: crypto.randomUUID(), planId: plan.id, baseRevision: planning.plans.find(item => item.id === plan.id)?.revision ?? null,
      title: plan.title, particleIds: plan.particleIds, assignments: plan.assignments, optionalParticleIds: plan.optionalParticleIds, links: plan.links, summary: plan.summary, sources: plan.sources, researchRunId: plan.researchRunId, authorId: scope.userId, createdAt: new Date().toISOString(), status: "pending",
    }] })
  }
  const create = (objective: ObjectiveParticle, preset: ParticlePreset): Particle => ({
    ...buildParticlePreset(preset, { id: crypto.randomUUID(), workspaceId: scope.organizationId, now: new Date().toISOString(), title: preset.label, description: "", fields: DEFAULT_PRESET_FIELDS }),
    position: objective.position, positionMode: "managed",
  })
  const createObjective = async (title: string) => {
    const particle = createParticle("objective", { id: crypto.randomUUID(), workspaceId: scope.organizationId, now: new Date().toISOString(), title })
    return controls.create("objective", title, particle, { inspect: false })
  }
  return { owner, accessError, update, savePlan, propose, create, createObjective }
}
