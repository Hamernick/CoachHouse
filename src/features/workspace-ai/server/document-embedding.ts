import "server-only"
import { createHash } from "node:crypto"
import type { z } from "zod"
import { documentEmbeddingPolicySchema as policySchema } from "../lib/document-embedding-policy"
import { priceAiUsage, type AiUsage, type AiRateCard } from "@/features/ai-credits"
import type { researchConfig } from "./research-config"

export type DocumentEmbeddingPolicy = z.infer<typeof policySchema>
export type DocumentEmbeddingConfig = Omit<ReturnType<typeof researchConfig>, "tariff"> & { tariff: AiRateCard; embedding?: DocumentEmbeddingPolicy }
export type DocumentEmbeddingTransport = (request: {
  model: string; dimensions: number; input: readonly string[]; requestId: string; signal: AbortSignal
}) => Promise<{ model: string; inputTokens: number; vectors: number[][] }>

/** Only a transport's synchronous checks before HTTP dispatch may use this. */
export class DocumentEmbeddingNotDispatched extends Error {
  constructor() { super("Embedding request was not dispatched.") }
}

/** Called before the existing reservation. Both models, price and finite limits
 * change the approved quote identity; embeddings share its provider exposure.
 */
export function withDocumentEmbeddingBudget(base: ReturnType<typeof researchConfig>, input: DocumentEmbeddingPolicy): DocumentEmbeddingConfig {
  const embedding = policySchema.parse(input)
  const { microdollarsPerMillion, ...processing } = embedding
  const tariff = { ...base.tariff, embeddingMicrodollarsPerMillion: microdollarsPerMillion, embedding: processing,
    version: `embedding-${createHash("sha256").update(JSON.stringify({ base: base.tariff, embedding })).digest("hex").slice(0,40)}` }
  const extra = priceAiUsage({ input: 0, cachedInput: 0, output: 0, embeddingInput: embedding.maxInputTokens },tariff)
  const maxCost = base.maxCost + extra.microdollars
  const maxCredits = Math.ceil(maxCost / tariff.microdollarsPerCredit)
  if (maxCost > 250000 || maxCredits > 125) throw new Error("Research pricing exceeds the configured run limit.")
  return { ...base, tariff, maxCost, maxCredits, embedding }
}

/** One controller per claimed run, sharing the caller's measured usage. A lost
 * reply poisons the run even if a knowledge tool converts failures to unavailable.
 * The existing run catch/reconcile path retains the original worst-case hold.
 */
export function createDocumentEmbedding(input: {
  runId: string; config: DocumentEmbeddingConfig; usage: AiUsage; signal: AbortSignal;
  isCanceled: () => Promise<boolean>; transport: DocumentEmbeddingTransport
}) {
  const policy = policySchema.parse(input.config.embedding)
  const { microdollarsPerMillion, ...processing } = policy
  if (input.config.tariff.embeddingMicrodollarsPerMillion !== microdollarsPerMillion
    || JSON.stringify(input.config.tariff.embedding) !== JSON.stringify(processing))
    throw new Error("Embedding tariff changed.")
  let calls = 0, pending = false, uncertain = false
  const assertHealthy = () => { if (uncertain) throw new Error("Embedding usage requires reconciliation.") }
  const check = async (signal: AbortSignal) => {
    assertHealthy(); signal.throwIfAborted()
    if (await input.isCanceled()) throw new Error("Research canceled.")
    signal.throwIfAborted()
  }
  return {
    processingIdentity: createHash("sha256").update(JSON.stringify({model:policy.model,dimensions:policy.dimensions,processing:policy.processing})).digest("hex"),
    assertHealthy,
    async embed(texts: readonly string[], signal?: AbortSignal) {
      const abort = signal ? AbortSignal.any([input.signal, signal]) : input.signal
      await check(abort)
      // Serialize dispatches; overlapping calls must not overspend the same run.
      if (pending) throw new Error("Embedding already in progress.")
      const bytes = texts.reduce((sum,text) => sum + Buffer.byteLength(text,"utf8"),0)
      const used = input.usage.embeddingInput ?? 0
      if (!texts.length || texts.length > 480 || texts.some(text => !text.trim()) || !bytes || bytes > policy.maxInputBytes
        || calls >= policy.maxCalls || used + bytes > policy.maxInputTokens)
        throw new Error("Embedding input limit reached.")
      const estimate = priceAiUsage({ ...input.usage, embeddingInput: used + bytes },input.config.tariff)
      if (estimate.microdollars > input.config.maxCost || estimate.credits > input.config.maxCredits)
        throw new Error("Embedding reservation limit reached.")
      // UTF-8 bytes bound tokens for a qualified provider tokenizer. That provider
      // guarantee is an activation prerequisite, never a fabricated usage receipt.
      pending = true
      const requestId = `${input.runId}:embedding:${++calls}`
      try {
        let result: Awaited<ReturnType<DocumentEmbeddingTransport>>
        try {
          result = await input.transport({ model: policy.model, dimensions: policy.dimensions, input: [...texts], requestId, signal: abort })
          if (result.model !== policy.model || !Number.isSafeInteger(result.inputTokens) || result.inputTokens < 0 || result.inputTokens > bytes)
            throw new Error("Unconfirmed embedding usage.")
        } catch (error) {
          if (error instanceof DocumentEmbeddingNotDispatched) throw error
          uncertain = true; assertHealthy(); throw new Error("Unreachable")
        }
        input.usage.embeddingInput = used + result.inputTokens
        // Keep measured cost even when the result is canceled or unusable.
        await check(abort)
        if (result.vectors.length !== texts.length || result.vectors.some(vector => vector.length !== policy.dimensions
          || vector.some(value => !Number.isFinite(value)) || !vector.some(value => value !== 0)))
          throw new Error("Invalid document embeddings.")
        return result.vectors
      } finally { pending = false }
    },
  }
}
