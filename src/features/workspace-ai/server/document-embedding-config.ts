import "server-only"
import { documentEmbeddingDisclosureSchema, type DocumentEmbeddingDisclosure } from "../lib/document-embedding-policy"
import { withDocumentEmbeddingBudget, type DocumentEmbeddingConfig, type DocumentEmbeddingTransport } from "./document-embedding"
import type { researchConfig } from "./research-config"
import { OPENAI_DOCUMENT_EMBEDDING_MODEL } from "./document-embedding-openai"
import { z } from "zod"
import type { DocumentRetrievalOptions } from "./document-retrieval"

const scopeSchema = z.strictObject({ organizationId: z.uuid(), actorId: z.uuid(), canvasId: z.uuid().nullable() })

export type DocumentEmbeddingRegistration = {
  policy: DocumentEmbeddingDisclosure
  qualifiedSourceIds: ReadonlySet<string>
  qualifiedScope?: DocumentRetrievalOptions["qualifiedScope"]
  transport: DocumentEmbeddingTransport
}

/** Deliberately unconfigured. A future qualified provider must supply its exact
 * processing terms, tokenizer evidence, price, source allowlist and transport.
 * Environment flags and browser payloads cannot activate indexing or spending.
 */
export function configuredDocumentEmbedding(): DocumentEmbeddingRegistration | undefined {
  return undefined
}

/** The quote and admission share this resolver. No source read or transport
 * occurs here; indexing can only happen inside the claimed research run.
 */
export function resolveDocumentEmbeddingConfig(base: ReturnType<typeof researchConfig>, registration = configuredDocumentEmbedding()): {
  config: DocumentEmbeddingConfig; documentEmbedding?: Omit<DocumentEmbeddingRegistration, "policy">
} {
  if (!registration) return { config: base }
  const policy = documentEmbeddingDisclosureSchema.parse(registration.policy)
  const qualifiedScope = policy.model === OPENAI_DOCUMENT_EMBEDDING_MODEL ? scopeSchema.parse(registration.qualifiedScope) : undefined
  if (policy.model === OPENAI_DOCUMENT_EMBEDDING_MODEL && (policy.dimensions !== 1536 || policy.microdollarsPerMillion !== 20000
    || policy.maxInputBytes > 180000 || policy.maxInputTokens > 200000 || policy.maxCalls > 8))
    throw new Error("Document search configuration is unavailable.")
  if (!(registration.qualifiedSourceIds instanceof Set) || registration.qualifiedSourceIds.size > 5
    || [...registration.qualifiedSourceIds].some(id => typeof id !== "string" || !/^document:[^:\s]+$/.test(id) || id.length > 200)
    || typeof registration.transport !== "function") throw new Error("Document search configuration is unavailable.")
  return { config: withDocumentEmbeddingBudget(base, policy), documentEmbedding: {
    qualifiedSourceIds: new Set(registration.qualifiedSourceIds), qualifiedScope, transport: registration.transport,
  } }
}
