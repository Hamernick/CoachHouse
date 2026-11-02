import { z } from "zod"

/** Public receipt fields from this route's immutable run tariff/reservation.
 * Never replace a historical model or maximum with today's configuration. */
export const researchProcessingSchema = z.strictObject({
  provider: z.literal("OpenAI"),
  model: z.string().trim().min(1).max(80),
  tariffVersion: z.string().min(1).max(80),
  maximumCredits: z.number().int().positive().max(125),
})

export function savedResearchProcessing(tariff: unknown, maximumCredits: unknown) {
  const saved = z.object({ model: researchProcessingSchema.shape.model, version: researchProcessingSchema.shape.tariffVersion }).safeParse(tariff)
  if (!saved.success) return undefined
  const result = researchProcessingSchema.safeParse({ provider: "OpenAI", model: saved.data.model, tariffVersion: saved.data.version, maximumCredits })
  return result.success ? result.data : undefined
}
