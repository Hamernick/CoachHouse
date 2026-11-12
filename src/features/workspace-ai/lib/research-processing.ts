import { z } from "zod"
import { documentEmbeddingDisclosureSchema } from "./document-embedding-policy"

/** Public receipt fields from this route's immutable run tariff/reservation.
 * Never replace a historical model or maximum with today's configuration. */
export const researchProcessingSchema = z.strictObject({
  provider: z.literal("OpenAI"),
  model: z.string().trim().min(1).max(80),
  tariffVersion: z.string().min(1).max(80),
  embedding: documentEmbeddingDisclosureSchema.optional(),
  embeddingUnavailable: z.literal(true).optional(),
  maximumCredits: z.number().int().positive().max(125),
})

export function savedResearchProcessing(tariff: unknown, maximumCredits: unknown) {
  const saved = z.object({ model: researchProcessingSchema.shape.model, version: researchProcessingSchema.shape.tariffVersion }).safeParse(tariff)
  if (!saved.success) return undefined
  const stored = z.object({ embedding: z.unknown().optional(), embeddingMicrodollarsPerMillion: z.unknown().optional() }).parse(tariff)
  const embedding = documentEmbeddingDisclosureSchema.safeParse({
    ...(typeof stored.embedding === "object" && stored.embedding !== null ? stored.embedding : {}),
    microdollarsPerMillion: stored.embeddingMicrodollarsPerMillion,
  })
  const disclosure = stored.embedding !== undefined || stored.embeddingMicrodollarsPerMillion !== undefined
    ? embedding.success ? { embedding: embedding.data } : { embeddingUnavailable: true as const } : {}
  const result = researchProcessingSchema.safeParse({ provider: "OpenAI", model: saved.data.model, tariffVersion: saved.data.version, maximumCredits, ...disclosure })
  return result.success ? result.data : undefined
}
