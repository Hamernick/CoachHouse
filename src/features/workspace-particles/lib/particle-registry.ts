import {
  PARTICLE_SIZE_SUPPORT,
  PARTICLE_SIZE_LAYOUTS,
  type ParticleSize,
} from "./particle-size"
import { z } from "zod"
import { planCapability, workspaceNoteCapability, workspaceFormCapability, particleCommitSchema, type ParticleCapability, type ParticleSourceBinding } from "./particle-capability-contract"
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
  capabilities?: Readonly<Record<string, ParticleCapability>>
}
// Rendering definitions compose this domain registry at the canvas boundary.
export const particleRegistry = {
  objective: {
    capabilities: { plan: planCapability },
    ...PARTICLE_SIZE_SUPPORT.objective,
    layouts: PARTICLE_SIZE_LAYOUTS,
    label: "Objective",
    width: 280,
    schema: particleDataSchemas.objective,
    defaults: () => ({ target: null, current: null, unit: "" }),
  },
  activity: {
    capabilities: { workspace_note: workspaceNoteCapability, workspace_form: workspaceFormCapability },
    ...PARTICLE_SIZE_SUPPORT.activity,
    layouts: PARTICLE_SIZE_LAYOUTS,
    label: "Resource",
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

/** Availability describes implemented UI, never permission to read or write. */
export function getParticleCapabilities(particle: Particle): readonly ParticleCapability[] {
  const definition: Definition<ParticleType> = particleRegistry[particle.type]
  return Object.values(definition.capabilities ?? {}).filter(capability => capability.matches(particle))
}

export function bindParticleSource(particle: Particle): ParticleSourceBinding | null {
  const capability = getParticleCapabilities(particle)[0]
  if (!capability) return null
  return capability.sourceSchema.parse({ kind: capability.sourceKind,
    organizationId: particle.workspaceId, id: particle.id, revision: particle.revision })
}

/** No handlers, credentials, record contents or inferred permissions cross this boundary.
 * Called on demand; catalog generation does not run during ordinary rendering.
 * JSON schema covers shape. Canonical writers still enforce refinements and authority.
 */
export function getParticleCapabilityCatalog({ includeSchemas = false }: { includeSchemas?: boolean } = {}) {
  const registered = Object.entries(particleRegistry).flatMap(([particleType, definition]) => {
    const capabilities = "capabilities" in definition ? Object.values(definition.capabilities) : []
    return capabilities.map(capability => ({ particleType, capability }))
  })
  const schemas: Record<string, z.core.JSONSchema.JSONSchema> | undefined = includeSchemas ? {
    ...Object.fromEntries(registered.flatMap(({ capability }) => [
      [`${capability.id}.source`, z.toJSONSchema(capability.sourceSchema)],
      [`${capability.id}.input`, z.toJSONSchema(capability.inputSchema, { io: "input" })],
    ])),
    particle_commit: z.toJSONSchema(particleCommitSchema),
  } : undefined
  return {
    version: 1 as const,
    entries: registered.map(({ particleType, capability }) => ({
      id: capability.id, particleType, label: capability.label, sourceKind: capability.sourceKind,
      views: [...capability.views], action: capability.action, editScope: capability.editScope,
      permission: capability.permission, availability: "manual" as const,
      sourceSchema: `${capability.id}.source`, inputSchema: `${capability.id}.input`,
      resultSchema: "particle_commit" as const,
    })),
    ...(schemas ? { schemas } : {}),
  }
}

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
