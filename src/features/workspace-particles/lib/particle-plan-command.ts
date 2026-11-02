import { z } from "zod"
import type { Particle, ParticleResult } from "../types"
import { particlePlanSchema, type ParticlePlan } from "./particle-plan-schema"

const ids = z.array(z.uuid()).max(250).refine(value => new Set(value).size === value.length)
export const particlePlanChangeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("create_plan"), plan: particlePlanSchema }),
  z.strictObject({ kind: z.literal("edit_plan"), plan: particlePlanSchema }),
  z.strictObject({ kind: z.literal("reuse_particle"), particleId: z.uuid(), index: z.number().int().min(0).max(249) }),
  z.strictObject({ kind: z.literal("detach_particle"), particleId: z.uuid() }),
  z.strictObject({ kind: z.literal("reorder_plan"), particleIds: ids }),
])
export const particlePlanCommandSchema = z.strictObject({
  kind: z.literal("change_plan"),
  objectiveId: z.uuid(),
  expectedRevision: z.number().int().nonnegative(),
  planId: z.uuid(),
  expectedPlanRevision: z.number().int().nonnegative().nullable(),
  change: particlePlanChangeSchema,
})
export type ParticlePlanCommand = z.infer<typeof particlePlanCommandSchema>
type Objective = Extract<Particle, { type: "objective" }>
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Derive explicit intent from the existing editor without changing stored plans. */
export function planCommand(objective: Objective, plan: ParticlePlan): ParticlePlanCommand {
  const before = objective.data.planning?.plans.find(item => item.id === plan.id)
  let change: ParticlePlanCommand["change"] = { kind: before ? "edit_plan" : "create_plan", plan }
  if (before) {
    const added = plan.particleIds.filter(id => !before.particleIds.includes(id))
    const removed = before.particleIds.filter(id => !plan.particleIds.includes(id))
    const restUnchanged = same({ ...before, particleIds: [], links: [] }, { ...plan, particleIds: [], links: [] })
    if (restUnchanged && same(before.links, plan.links)) {
      if (!added.length && !removed.length) change = { kind: "reorder_plan", particleIds: plan.particleIds }
      if (added.length === 1 && !removed.length && same(before.particleIds, plan.particleIds.filter(id => id !== added[0])))
        change = { kind: "reuse_particle", particleId: added[0], index: plan.particleIds.indexOf(added[0]) }
    }
    if (restUnchanged && removed.length === 1 && !added.length &&
      same(plan.particleIds, before.particleIds.filter(id => id !== removed[0])) &&
      same(plan.links, before.links?.filter(link => link.source !== removed[0] && link.target !== removed[0])))
      change = { kind: "detach_particle", particleId: removed[0] }
  }
  return { kind: "change_plan", objectiveId: objective.id, expectedRevision: objective.revision,
    planId: plan.id, expectedPlanRevision: before?.revision ?? null, change }
}

/** Called against the current canonical graph on each writer attempt, and for optimistic preview. */
export function resolvePlanCommand(command: ParticlePlanCommand, particles: readonly Particle[]): ParticleResult<Objective> {
  const objective = particles.find(item => item.id === command.objectiveId)
  if (objective?.type !== "objective") return { ok: false, code: "invalid", error: "Objective is no longer available." }
  const planning = objective.data.planning ?? { plans: [], proposals: [] }
  const before = planning.plans.find(item => item.id === command.planId)
  if (objective.revision !== command.expectedRevision || (before?.revision ?? null) !== command.expectedPlanRevision)
    return { ok: false, code: "conflict", error: "Plan changed. Refresh before applying this edit." }
  const invalid = (): ParticleResult<Objective> => ({ ok: false, code: "invalid", error: "Invalid plan change. Refresh before trying again." })
  const { change } = command
  let plan: ParticlePlan
  if (change.kind === "create_plan" || change.kind === "edit_plan") {
    if ((change.kind === "create_plan") !== !before || change.plan.id !== command.planId ||
      change.plan.revision !== (before?.revision ?? 0)) return invalid()
    plan = change.plan
  } else {
    if (!before) return invalid()
    if (change.kind === "reuse_particle") {
      if (before.particleIds.includes(change.particleId) || change.index > before.particleIds.length) return invalid()
      const members = [...before.particleIds]
      members.splice(change.index, 0, change.particleId)
      plan = { ...before, particleIds: members }
    } else if (change.kind === "detach_particle") {
      if (!before.particleIds.includes(change.particleId)) return invalid()
      plan = { ...before, particleIds: before.particleIds.filter(id => id !== change.particleId),
        ...(before.optionalParticleIds ? { optionalParticleIds: before.optionalParticleIds.filter(id => id !== change.particleId) } : {}),
        ...(before.assignments ? { assignments: before.assignments.filter(item => item.particleId !== change.particleId) } : {}),
        ...(before.links ? { links: before.links.filter(link => link.source !== change.particleId && link.target !== change.particleId) } : {}) }
    } else {
      if (change.particleIds.length !== before.particleIds.length || change.particleIds.some(id => !before.particleIds.includes(id))) return invalid()
      plan = { ...before, particleIds: change.particleIds }
    }
  }
  if (plan.particleIds.some(id => !particles.some(item => item.id === id && item.type !== "objective" && item.workspaceId === objective.workspaceId)))
    return { ok: false, code: "invalid", error: "Choose an existing item from this workspace." }
  return { ok: true, value: { ...objective, data: { ...objective.data, planning: { ...planning,
    plans: before ? planning.plans.map(item => item.id === plan.id ? plan : item) : [...planning.plans, plan],
  } } } }
}
