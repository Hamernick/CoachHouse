import { z } from "zod"

// Server-supplied qualification descriptions, never model output or browser input.
export const documentEmbeddingProcessingSchema = z.strictObject({
  provider: z.string().trim().min(1).max(120),
  destination: z.string().trim().min(1).max(240),
  retention: z.string().trim().min(1).max(500),
  training: z.string().trim().min(1).max(500),
  qualification: z.string().trim().min(1).max(160),
  tokenizerQualification: z.string().trim().min(1).max(160),
  tokenBound: z.literal("utf8_bytes"),
  costPolicy: z.literal("on_demand_shared_run"),
})
export const documentEmbeddingPolicySchema = z.strictObject({
  model: z.string().trim().min(1).max(120), dimensions: z.number().int().min(1).max(2000),
  microdollarsPerMillion: z.number().int().positive().max(1_000_000),
  maxInputBytes: z.number().int().positive().max(1_000_000),
  maxInputTokens: z.number().int().positive().max(1_000_000),
  maxCalls: z.number().int().positive().max(16),
  processing: documentEmbeddingProcessingSchema.optional(),
})
// The lower-level budget supports existing controlled accounting fixtures. Run
// admission additionally requires every disclosure/qualification field.
export const documentEmbeddingDisclosureSchema = documentEmbeddingPolicySchema.extend({ processing: documentEmbeddingProcessingSchema })
export type DocumentEmbeddingDisclosure = z.infer<typeof documentEmbeddingDisclosureSchema>
