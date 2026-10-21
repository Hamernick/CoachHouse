import {
  PARTICLE_SIZE_SUPPORT,
  PARTICLE_SIZE_LAYOUTS,
  type ParticleSize,
} from "./particle-size"
import type { z } from "zod"
import type { Particle, ParticleType } from "../types"
import { particleDataSchemas, particleSchema } from "./particle-schema"

type Definition<K extends ParticleType> = {
  layouts: Readonly<
    Record<ParticleSize, { variant: string; previewLimit: number }>
  >
  supportedSizes: readonly ParticleSize[]
  defaultSize: ParticleSize
  label: string
  width: number
  schema: z.ZodType<Extract<Particle, { type: K }>["data"]>
  defaults: () => Extract<Particle, { type: K }>["data"]
}
// Rendering definitions compose this domain registry at the canvas boundary.
export const particleRegistry = {
  objective: {
    ...PARTICLE_SIZE_SUPPORT.objective,
    layouts: PARTICLE_SIZE_LAYOUTS,
    label: "Objective",
    width: 280,
    schema: particleDataSchemas.objective,
    defaults: () => ({ target: null, current: null, unit: "" }),
  },
  activity: {
    ...PARTICLE_SIZE_SUPPORT.activity,
    layouts: PARTICLE_SIZE_LAYOUTS,
    label: "Activity",
    width: 280,
    schema: particleDataSchemas.activity,
    defaults: () => ({ template: "task", steps: [] }),
  },
  calendar: {
    ...PARTICLE_SIZE_SUPPORT.calendar,
    layouts: PARTICLE_SIZE_LAYOUTS,
    label: "Content Calendar",
    width: 340,
    schema: particleDataSchemas.calendar,
    defaults: () => ({ entries: [] }),
  },
  people: {
    ...PARTICLE_SIZE_SUPPORT.people,
    layouts: PARTICLE_SIZE_LAYOUTS,
    label: "People",
    width: 280,
    schema: particleDataSchemas.people,
    defaults: () => ({ personIds: [], segment: "" }),
  },
  decision: {
    ...PARTICLE_SIZE_SUPPORT.decision,
    layouts: PARTICLE_SIZE_LAYOUTS,
    label: "Decision",
    width: 280,
    schema: particleDataSchemas.decision,
    defaults: () => ({
      criteria: [],
      outcomes: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "Not yet" },
      ],
      selectedOutcome: null,
    }),
  },
  metric: {
    ...PARTICLE_SIZE_SUPPORT.metric,
    layouts: PARTICLE_SIZE_LAYOUTS,
    label: "Metric",
    width: 280,
    schema: particleDataSchemas.metric,
    defaults: () => ({ unit: "", target: null, observations: [], demo: false }),
  },
  workflow: {
    ...PARTICLE_SIZE_SUPPORT.workflow,
    layouts: PARTICLE_SIZE_LAYOUTS,
    label: "Workflow",
    width: 340,
    schema: particleDataSchemas.workflow,
    defaults: () => ({ steps: [] }),
  },
  finance: {
    ...PARTICLE_SIZE_SUPPORT.finance,
    layouts: PARTICLE_SIZE_LAYOUTS,
    label: "Finance",
    width: 280,
    schema: particleDataSchemas.finance,
    defaults: () => ({
      currency: "USD",
      target: null,
      committed: null,
      observations: [],
      demo: false,
    }),
  },
} satisfies { [K in ParticleType]: Definition<K> }

export function createParticle(
  type: ParticleType,
  input: { id: string; workspaceId: string; now: string; title?: string }
): Particle {
  const definition = particleRegistry[type]
  return particleSchema.parse({
    id: input.id,
    workspaceId: input.workspaceId,
    type,
    title: input.title ?? definition.label,
    data: definition.defaults(),
    size: definition.defaultSize,
    status: "backlog",
    locked: false,
    revision: 0,
    position: { x: 0, y: 0 },
    positionMode: "managed",
    createdAt: input.now,
    updatedAt: input.now,
  })
}
export function getParticleHandles(particle: Particle) {
  return {
    inputs: ["in"],
    outputs: [
      "out",
      ...(particle.type === "decision"
        ? particle.data.outcomes.map((outcome) => `outcome:${outcome.id}`)
        : []),
    ],
  }
}
export function getParticleProgress(particle: Particle) {
  const items =
    particle.type === "activity" || particle.type === "workflow"
      ? particle.data.steps
      : particle.type === "decision"
        ? particle.data.criteria
        : []
  const completed = items.filter((item) => item.status === "done").length
  return {
    completed,
    total: items.length,
    percent: items.length ? (completed / items.length) * 100 : 0,
  }
}

export function particlePreviewLimit(particle: Particle) {
  return particle.size
    ? particleRegistry[particle.type].layouts[particle.size].previewLimit
    : 4
}
