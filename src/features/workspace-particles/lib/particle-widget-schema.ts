import { z } from "zod"

export const particleWidgetSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("event"),
    startsAt: z.iso.datetime().nullable(),
  }),
  z.strictObject({
    kind: z.literal("timer"),
    seconds: z.number().int().min(1).max(86400),
    endsAt: z.iso.datetime().nullable(),
  }),
  z.strictObject({
    kind: z.literal("split"),
    total: z.number().finite().min(0).max(1e12),
    people: z.number().int().min(1).max(10000),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }),
  z.strictObject({
    kind: z.literal("color"),
    hex: z.string().regex(/^#[\da-f]{6}$/i),
  }),
  z.strictObject({
    kind: z.literal("calculate"),
    expression: z.string().min(1).max(240),
    result: z.number().finite(),
  }),
])
