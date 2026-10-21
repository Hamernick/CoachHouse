import { PARTICLE_SIZE_NAMES, PARTICLE_SIZE_SUPPORT } from "./particle-size"
import { particleWidgetSchema } from "./particle-widget-schema"
import { z } from "zod"
import {
  workspaceToolIdSchema,
  workspaceToolTargetHandleSchema,
} from "./workspace-tool-contract"

export const particleIdSchema = z.uuid()
export const particleRevisionSchema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER - 1)
export const particlePositionSchema = z.strictObject({
  x: z.number().finite().min(-1_000_000).max(1_000_000),
  y: z.number().finite().min(-1_000_000).max(1_000_000),
})
export const particleStatusSchema = z.enum([
  "backlog",
  "in_progress",
  "done",
  "blocked",
])
const title = z.string().trim().min(1).max(240)
const description = z.string().max(10_000)
const instant = z.iso.datetime()
const amount = z.number().finite().min(0).max(1_000_000_000_000)
const key = z.string().regex(/^[a-z][a-z0-9_-]{0,47}$/)
const source = z.strictObject({
  kind: z.enum([
    "objective",
    "activity",
    "person",
    "document",
    "calendar_event",
    "finance",
  ]),
  id: particleIdSchema,
})
const checklistItem = z.strictObject({
  id: particleIdSchema,
  title,
  status: particleStatusSchema,
  order: z.number().int().min(0).max(10_000),
  particleId: particleIdSchema.optional(),
  source: source.optional(),
})
const checklist = z
  .array(checklistItem)
  .max(200)
  .refine(
    (items) => new Set(items.map((item) => item.id)).size === items.length,
    "Checklist IDs must be unique."
  )
const observation = z.strictObject({ at: instant, value: z.number().finite() })
const outcome = z.strictObject({ id: key, label: title })
export const particleCalendarEntrySchema = z
  .strictObject({
    id: particleIdSchema,
    title,
    channels: z
      .array(z.enum(["email", "linkedin", "website", "instagram", "other"]))
      .min(1)
      .max(5),
    contentType: z.enum(["post", "newsletter", "article", "email"]),
    delivery: z.enum(["manual", "automatic"]),
    scheduledAt: instant.nullable(),
    publishedAt: instant.nullable(),
    content: description,
    cta: z.string().max(500),
    status: z.enum(["draft", "scheduled", "published", "cancelled"]),
    externalUrl: z.url({ protocol: /^https?$/ }).optional(),
    activityId: particleIdSchema.optional(),
    order: z.number().int().min(0).max(10_000),
  })
  .refine(
    (entry) => entry.status !== "published" || entry.publishedAt !== null,
    {
      message: "Published content requires an actual publish timestamp.",
      path: ["publishedAt"],
    }
  )
export const particleDataSchemas = {
  objective: z.strictObject({
    target: amount.nullable(),
    current: amount.nullable(),
    unit: z.string().max(80),
    source: source.optional(),
  }),
  activity: z.strictObject({
    template: z.enum(["task", "event"]),
    widget: particleWidgetSchema.optional(),
    steps: checklist,
    source: source.optional(),
  }),
  calendar: z.strictObject({
    entries: z
      .array(particleCalendarEntrySchema)
      .max(250)
      .refine(
        (entries) =>
          new Set(entries.map((entry) => entry.id)).size === entries.length,
        "Calendar IDs must be unique."
      ),
  }),
  people: z.strictObject({
    presentation: z.literal("person").optional(),
    personIds: z
      .array(particleIdSchema)
      .max(250)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Person references must be unique."
      ),
    segment: z.string().max(240),
  }).refine(
    (data) => data.presentation !== "person" || data.personIds.length === 1,
    "A person placement must reference exactly one person."
  ),
  decision: z
    .strictObject({
      criteria: checklist,
      outcomes: z
        .array(outcome)
        .min(2)
        .max(12)
        .refine(
          (items) =>
            new Set(items.map((item) => item.id)).size === items.length,
          "Outcome IDs must be unique."
        ),
      selectedOutcome: key.nullable(),
    })
    .refine(
      (data) =>
        data.selectedOutcome === null ||
        data.outcomes.some((item) => item.id === data.selectedOutcome),
      "Select a declared outcome."
    ),
  metric: z.strictObject({
    unit: z.string().max(80),
    target: amount.nullable(),
    observations: z.array(observation).max(250),
    demo: z.boolean(),
  }),
  workflow: z.strictObject({ steps: checklist }),
  finance: z.strictObject({
    currency: z.string().regex(/^[A-Z]{3}$/),
    target: amount.nullable(),
    committed: amount.nullable(),
    observations: z.array(observation).max(250),
    demo: z.boolean(),
    source: source.optional(),
  }),
}
const base = {
  id: particleIdSchema,
  workspaceId: particleIdSchema,
  title,
  description: description.optional(),
  status: particleStatusSchema,
  position: particlePositionSchema,
  positionMode: z.enum(["managed", "manual"]),
  locked: z.boolean(),
  canvasHidden: z.boolean().optional(),
  revision: particleRevisionSchema,
  width: z.number().finite().min(240).max(960).optional(),
  size: z.enum(PARTICLE_SIZE_NAMES).optional(),
  createdAt: instant,
  updatedAt: instant,
}
export const particleSchema = z.discriminatedUnion("type", [
  z.strictObject({
    ...base,
    type: z.literal("objective"),
    size: z.enum(PARTICLE_SIZE_SUPPORT.objective.supportedSizes).optional(),
    data: particleDataSchemas.objective,
  }),
  z.strictObject({
    ...base,
    type: z.literal("activity"),
    size: z.enum(PARTICLE_SIZE_SUPPORT.activity.supportedSizes).optional(),
    data: particleDataSchemas.activity,
  }),
  z.strictObject({
    ...base,
    type: z.literal("calendar"),
    size: z.enum(PARTICLE_SIZE_SUPPORT.calendar.supportedSizes).optional(),
    data: particleDataSchemas.calendar,
  }),
  z.strictObject({
    ...base,
    type: z.literal("people"),
    size: z.enum(PARTICLE_SIZE_SUPPORT.people.supportedSizes).optional(),
    data: particleDataSchemas.people,
  }),
  z.strictObject({
    ...base,
    type: z.literal("decision"),
    size: z.enum(PARTICLE_SIZE_SUPPORT.decision.supportedSizes).optional(),
    data: particleDataSchemas.decision,
  }),
  z.strictObject({
    ...base,
    type: z.literal("metric"),
    size: z.enum(PARTICLE_SIZE_SUPPORT.metric.supportedSizes).optional(),
    data: particleDataSchemas.metric,
  }),
  z.strictObject({
    ...base,
    type: z.literal("workflow"),
    size: z.enum(PARTICLE_SIZE_SUPPORT.workflow.supportedSizes).optional(),
    data: particleDataSchemas.workflow,
  }),
  z.strictObject({
    ...base,
    type: z.literal("finance"),
    size: z.enum(PARTICLE_SIZE_SUPPORT.finance.supportedSizes).optional(),
    data: particleDataSchemas.finance,
  }),
])
export const particleConnectionSchema = z.strictObject({
  id: particleIdSchema,
  source: z.union([particleIdSchema, workspaceToolIdSchema]),
  target: z.union([particleIdSchema, workspaceToolIdSchema]),
  relationship: z.enum([
    "dependency",
    "sequence",
    "decision_outcome",
    "related_resource",
    "feedback",
  ]),
  sourceHandle: z.string().min(1).max(64),
  targetHandle: z.union([z.literal("in"), workspaceToolTargetHandleSchema]),
  outcome: key.optional(),
  revision: particleRevisionSchema,
})
export const particleGraphSchema = z.strictObject({
  schemaVersion: z.literal(1),
  workspaceId: particleIdSchema,
  revision: particleRevisionSchema,
  minimumBaseRevision: particleRevisionSchema,
  rootId: particleIdSchema.nullable(),
  particles: z.array(particleSchema).max(250),
  connections: z.array(particleConnectionSchema).max(500),
  receipts: z
    .array(
      z.strictObject({
        id: particleIdSchema,
        fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
        revision: particleRevisionSchema,
      })
    )
    .max(64),
})
