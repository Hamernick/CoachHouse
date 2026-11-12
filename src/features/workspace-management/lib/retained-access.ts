import { z } from "zod"
const canvas = z.union([z.string().uuid(), z.literal("default")])
export const retainedAccessQuerySchema = z.strictObject({ orgId: z.string().uuid(), after: canvas.nullable().default(null) })
export const retainedAccessPageSchema = z.strictObject({
  items: z.array(z.strictObject({ canvasId: canvas })).max(50), nextAfter: canvas.nullable(),
})
export type RetainedAccessPage = z.infer<typeof retainedAccessPageSchema>
