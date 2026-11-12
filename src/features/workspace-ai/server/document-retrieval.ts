import "server-only"
import { createHash } from "node:crypto"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/supabase/types"
import type { KnowledgeRecord } from "../research-types"
import type { ResearchContext } from "./research-context"
import { knowledgeFingerprint } from "./research-dependencies"
import { documentPassages } from "./document-passages"
import { OPENAI_DOCUMENT_EMBEDDING_MODEL } from "./document-embedding-openai"

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex")
const stateSchema = z.strictObject({ revision: z.number().int().nonnegative(), signature: z.string(), keys: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(512).default([]) })
const hitSchema = z.strictObject({ key: z.string().regex(/^[a-f0-9]{64}$/), id: z.string(), fingerprint: z.string(), revision: z.string(),
  start: z.number().int().nonnegative(), end: z.number().int().positive() })
export type DocumentRetrievalMode = "keyword" | "semantic" | "hybrid"
type Rpc = (operation: "state" | "replace" | "search", payload: Json) => Promise<unknown>
/** Server-only qualification seam. No runtime provider is enabled by this slice.
 * A production embedder must use the existing admitted budget/accounting owner.
 * IDs are explicitly qualified by that owner, never accepted from model args.
 */
export type DocumentRetrievalOptions = {
  qualifiedSourceIds: ReadonlySet<string>
  qualifiedScope?: { organizationId: string; actorId: string; canvasId: string | null }
  model: string
  dimensions: number
  processingIdentity?: string
  embed: (texts: readonly string[], signal?: AbortSignal) => Promise<number[][]>
}
export type DocumentRetrieval = ReturnType<typeof createDocumentRetrieval>
export function createDocumentRetrieval(context: ResearchContext, options: DocumentRetrievalOptions, transport?: Rpc) {
  if (!options.model.trim() || options.model.length > 120 || !Number.isInteger(options.dimensions) || options.dimensions < 1 || options.dimensions > 2000)
    throw new Error("Invalid retrieval configuration.")
  if (options.qualifiedSourceIds.size > 5 || [...options.qualifiedSourceIds].some(id => !/^document:[^:\s]+$/.test(id)))
    throw new Error("Invalid retrieval source qualification.")
  const scope = { organizationId: context.target.organizationId, actorId: context.user.id, canvasId: context.canvasId }
  if (options.model === OPENAI_DOCUMENT_EMBEDDING_MODEL && (!options.qualifiedScope
    || options.qualifiedScope.organizationId !== scope.organizationId || options.qualifiedScope.actorId !== scope.actorId
    || options.qualifiedScope.canvasId !== scope.canvasId)) throw new Error("Document retrieval scope is not qualified.")
  const qualified = new Set(options.qualifiedSourceIds)
  const rpc: Rpc = transport ?? (async (operation, payload) => {
    const { data, error } = await createSupabaseAdminClient({ actorId: scope.actorId, requestTimeoutMs: 10000 }).rpc("workspace_document_retrieval", {
      p_org_id: scope.organizationId, p_actor_id: scope.actorId, p_canvas_id: scope.canvasId, p_operation: operation, p_payload: payload,
    })
    if (error) throw new Error("Document retrieval unavailable.")
    return data
  })
  const vectors = async (texts: string[], signal?: AbortSignal, recheckSources?: () => Promise<void>) => {
    const values: number[][] = []
    // Keep the qualified transport's 120-input ceiling. Each batch still passes
    // the same per-run admission, measured usage, call and cost accounting.
    for (let index = 0; index < texts.length; index += 120) {
      signal?.throwIfAborted()
      await recheckSources?.()
      const batch = texts.slice(index,index + 120)
      const embedded = await options.embed(batch, signal)
      if (embedded.length !== batch.length || embedded.some(vector => vector.length !== options.dimensions
        || vector.some(value => !Number.isFinite(value)) || !vector.some(value => value !== 0)))
        throw new Error("Invalid document embeddings.")
      values.push(...embedded)
      signal?.throwIfAborted()
    }
    return values
  }
  return {
    scope,
    accepts(record: KnowledgeRecord) {
      return qualified.has(record.id) && record.kind === "document" && /^document:[^:\s]+$/.test(record.id)
    },
    eligible(record: KnowledgeRecord) {
      return this.accepts(record) && record.contentAvailable && Boolean(record.revision) && Boolean(record.content.trim())
    },
    async search(records: KnowledgeRecord[], query: string, mode: DocumentRetrievalMode = "hybrid", signal?: AbortSignal, recheckSources?: () => Promise<void>) {
      if (!query.trim() || query.length > 160 || !["keyword", "semantic", "hybrid"].includes(mode)) throw new Error("Invalid document query.")
      const selected = records.filter(record => this.eligible(record)).sort((a,b) => a.id.localeCompare(b.id))
      if (new Set(selected.map(record => record.id)).size !== selected.length) throw new Error("Duplicate document identity.")
      const chunks = selected.flatMap(record => {
        const fingerprint = knowledgeFingerprint(record)
        return documentPassages(record, query).map(({ start, end, occurrence }) => {
          const text = record.content.slice(start,end)
          const digest = hash(text)
          // Vector identity follows exact passage content/processor, independently
          // of the current source revision and location. Authority never comes
          // from this key: every hit still binds the full canonical fingerprint.
          return { id: record.id, fingerprint, revision: record.revision!, start, end, text,
            key: hash([record.id,"paragraph-text-v2",digest,occurrence,options.processingIdentity ?? null]) }
        })
      })
      const signature = hash([scope,options.model,options.dimensions,"paragraph-text-v2",chunks])
      let state = stateSchema.parse(await rpc("state", { model: options.model, dimensions: options.dimensions }))
      const existing = new Set(state.keys)
      const changed = mode === "keyword" ? [] : chunks.filter(chunk => !existing.has(chunk.key))
      if (state.signature !== signature || changed.length) {
        await recheckSources?.()
        const embeddings = changed.length ? await vectors(changed.map(chunk => chunk.text),signal,recheckSources) : []
        await recheckSources?.()
        const byKey = new Map(changed.map((chunk,index) => [chunk.key,JSON.stringify(embeddings[index])]))
        signal?.throwIfAborted()
        state = stateSchema.parse(await rpc("replace", { expectedRevision: state.revision, signature, model: options.model, dimensions: options.dimensions, mode,
          chunks: chunks.map(chunk => ({ ...chunk, embedding: byKey.get(chunk.key) ?? null })) }))
        if (state.signature !== signature) throw new Error("Index changed.")
      }
      await recheckSources?.()
      const embedding = mode === "keyword" || !chunks.length ? null : JSON.stringify((await vectors([query],signal,recheckSources))[0])
      await recheckSources?.()
      if (!chunks.length) return []
      signal?.throwIfAborted()
      const hits = z.array(hitSchema).max(8).parse(await rpc("search", { revision: state.revision, model: options.model, dimensions: options.dimensions,
        query, mode, embedding, passagesPerSource: 3, allowed: selected.map(record => ({ id: record.id, fingerprint: knowledgeFingerprint(record) })) }))
      signal?.throwIfAborted()
      if (new Set(hits.map(hit => hit.key)).size !== hits.length) throw new Error("Duplicate search identity.")
      return hits.map(hit => {
        const chunk = chunks.find(chunk => chunk.key === hit.key)
        if (!chunk || chunk.id !== hit.id || chunk.fingerprint !== hit.fingerprint || chunk.revision !== hit.revision || chunk.start !== hit.start || chunk.end !== hit.end)
          throw new Error("Index source changed.")
        return { record: selected.find(record => record.id === hit.id)!, start: hit.start, end: hit.end }
      })
    },
  }
}
