import { z } from "zod"
import type { Particle } from "../types"
import type { ParticlePlan } from "./particle-plan-schema"
import { particlePlanBranchStates } from "./particle-plan-branches"

export const particleProgressConfigSchema = z.strictObject({
  version: z.literal(1),
  mode: z.enum(["work", "time", "both", "ongoing"]),
  startsAt: z.iso.datetime().nullable(),
  endsAt: z.iso.datetime().nullable(),
}).refine(value => !value.startsAt || !value.endsAt || Date.parse(value.endsAt) > Date.parse(value.startsAt), "End must be after start.")
export const particleOutcomeConfirmationSchema = z.strictObject({
  version: z.literal(1), at: z.iso.datetime(), actorId: z.uuid(),
  progress: particleProgressConfigSchema,
  outcome: z.strictObject({ title: z.string().max(240), description: z.string().max(10_000).optional() }),
  workIds: z.array(z.string().min(1).max(128)).max(250),
})
export type ParticleProgressConfig = z.infer<typeof particleProgressConfigSchema>
export const DEFAULT_PROGRESS: ParticleProgressConfig = { version: 1, mode: "work", startsAt: null, endsAt: null }

/** Widgets are supporting information. An explicit task about a widget counts. */
export function isParticleWork(particle: Particle) {
  return particle.type === "decision" || particle.type === "workflow" ||
    (particle.type === "activity" && (!particle.data.source || ["activity", "calendar_event"].includes(particle.data.source.kind)) && (!particle.data.widget || particle.data.widget.kind === "event"))
}

function workIdentity(particle: Particle) {
  const source = "source" in particle.data ? particle.data.source : undefined
  return source ? `source:${source.kind}:${source.id}` : particle.id
}

/** The caller supplies its authorized graph. Missing members never become hidden counts. */
export function requiredPlanWork(plans: readonly ParticlePlan[], particles: readonly Particle[]) {
  const byId = new Map(particles.map(particle => [particle.id, particle]))
  const selected = new Map<string, Particle>()
  for (const plan of plans) {
    const states = particlePlanBranchStates(plan, particles)
    for (const id of plan.particleIds) {
      const particle = byId.get(id)
      if (particle && isParticleWork(particle) && states.get(id) === "active" && !plan.optionalParticleIds?.includes(id)) selected.set(id, particle)
    }
  }
  // A container whose referenced work is already counted is not another unit.
  return [...selected.values()].filter(particle => !(particle.type === "workflow" || particle.type === "activity") ||
    !particle.data.steps.some(step => step.particleId && step.particleId !== particle.id && selected.has(step.particleId)))
    .sort((a, b) => a.id.localeCompare(b.id))
}

export function summarizePlanWork(plans: readonly ParticlePlan[], particles: readonly Particle[]) {
  const byIdentity = new Map<string, Particle>()
  for (const item of requiredPlanWork(plans, particles)) {
    const key = workIdentity(item), previous = byIdentity.get(key)
    // Conflicting projections cannot manufacture completion of one source record.
    byIdentity.set(key, previous && previous.status !== "done" ? previous : item)
  }
  const work = [...byIdentity.values()]
  const completed = work.filter(item => item.status === "done").length
  const total = work.length
  const missing = plans.some(plan => plan.particleIds.some(id => !particles.some(item => item.id === id)))
  return { ids: work.map(workIdentity).sort(), completed, total, visibleScope: missing,
    percent: total ? completed === total ? 100 : Math.min(99, Math.round(completed / total * 100)) : null }
}

export function summarizeObjectiveProgress(objective: Extract<Particle, { type: "objective" }>, particles: readonly Particle[], now: number) {
  const config = objective.data.progress ?? DEFAULT_PROGRESS
  const work = summarizePlanWork(objective.data.planning?.plans ?? [], particles)
  const start = config.startsAt ? Date.parse(config.startsAt) : null
  const end = config.endsAt ? Date.parse(config.endsAt) : null
  const time = start === null || end === null || end <= start || !Number.isFinite(now) ? null : {
    percent: Math.max(0, Math.min(100, (now - start) / (end - start) * 100)),
    state: now < start ? "upcoming" as const : now >= end ? "elapsed" as const : "active" as const,
    remainingMs: Math.max(0, end - now),
  }
  const confirmed = objective.data.outcomeConfirmation
  const scopeChanged = objective.status === "done" && (!confirmed || JSON.stringify(confirmed.workIds) !== JSON.stringify(work.ids) ||
    JSON.stringify(confirmed.progress) !== JSON.stringify(config) || confirmed.outcome.title !== objective.title || confirmed.outcome.description !== objective.description)
  const label = objective.status === "done" ? scopeChanged ? "Complete · Review scope" : "Complete"
    : config.mode === "ongoing" ? "Ongoing" : objective.status === "blocked" ? "Blocked"
    : config.mode === "time" ? time ? time.state === "upcoming" ? "Not started" : time.state === "elapsed" ? "Period ended" : "In progress" : "Dates not set"
    : work.percent === null ? "Not started" : `${work.percent}% work${work.visibleScope ? " · Visible scope" : ""}`
  return { config, work, time, scopeChanged, label,
    percent: config.mode === "work" || config.mode === "both" ? work.percent : null,
    awaitingConfirmation: objective.status !== "done" && work.percent === 100 && config.mode !== "ongoing" }
}
export type ObjectiveProgress = ReturnType<typeof summarizeObjectiveProgress>
