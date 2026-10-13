import type { z } from "zod"
import type { Particle, ParticleType } from "../types"
import { particleDataSchemas, particleSchema } from "./particle-schema"

type Definition<K extends ParticleType> = {
  label: string
  width: number
  schema: z.ZodType<Extract<Particle, { type: K }>["data"]>
  defaults: () => Extract<Particle, { type: K }>["data"]
}
// Rendering definitions compose this domain registry at the canvas boundary.
export const particleRegistry = {
  objective: {
    label: "Objective",
    width: 280,
    schema: particleDataSchemas.objective,
    defaults: () => ({ target: null, current: null, unit: "" }),
  },
  activity: {
    label: "Activity",
    width: 280,
    schema: particleDataSchemas.activity,
    defaults: () => ({ template: "task", steps: [] }),
  },
  calendar: {
    label: "Content Calendar",
    width: 340,
    schema: particleDataSchemas.calendar,
    defaults: () => ({ entries: [] }),
  },
  people: {
    label: "People",
    width: 280,
    schema: particleDataSchemas.people,
    defaults: () => ({ personIds: [], segment: "" }),
  },
  decision: {
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
    label: "Metric",
    width: 280,
    schema: particleDataSchemas.metric,
    defaults: () => ({ unit: "", target: null, observations: [], demo: false }),
  },
  workflow: {
    label: "Workflow",
    width: 340,
    schema: particleDataSchemas.workflow,
    defaults: () => ({ steps: [] }),
  },
  finance: {
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
