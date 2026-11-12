import "server-only"
import { z } from "zod"
import { DocumentEmbeddingNotDispatched, type DocumentEmbeddingTransport } from "./document-embedding"

const endpoint = "https://api.openai.com/v1/embeddings"
export const OPENAI_DOCUMENT_EMBEDDING_MODEL = "text-embedding-3-small"
const usageSchema = z.object({
  model: z.literal(OPENAI_DOCUMENT_EMBEDDING_MODEL),
  usage: z.object({ prompt_tokens: z.number().int().positive().safe(), total_tokens: z.number().int().positive().safe() }),
})
const vectorsSchema = z.object({ object: z.literal("list"), data: z.array(z.object({
  object: z.literal("embedding"), index: z.number().int().nonnegative(),
  embedding: z.array(z.number().finite()).length(1536).refine(values => values.some(value => value !== 0)),
})).max(120) })

function validate(request: Parameters<DocumentEmbeddingTransport>[0], apiKey: string) {
  const bytes = request.input.reduce((sum, text) => sum + Buffer.byteLength(text, "utf8"), 0)
  if (!apiKey || /[^\x21-\x7e]/.test(apiKey) || request.signal.aborted
    || request.model !== OPENAI_DOCUMENT_EMBEDDING_MODEL || request.dimensions !== 1536
    || !/^[a-zA-Z0-9:_-]{1,200}$/.test(request.requestId)
    || !request.input.length || request.input.length > 120 || bytes > 180000
    || request.input.some(text => !text.trim() || /[\uD800-\uDFFF]/u.test(text) || Buffer.byteLength(text, "utf8") > 1440))
    throw new DocumentEmbeddingNotDispatched()
}

// Bound the actual response stream, including chunked bodies without a declared
// length. Abort delivery conservatively retains the run's uncertain-usage hold.
async function readResponse(response: Response): Promise<unknown> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error("Embedding response unavailable.")
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > 8_000_000) throw new Error("Embedding response unavailable.")
      chunks.push(value)
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))) as unknown
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

/** Inert until explicitly constructed and registered by a qualified server owner.
 * No environment lookup, endpoint override, SDK retry, redirect or fallback.
 * Injected fetch supports offline wire qualification, not browser configuration.
 */
export function createOpenAiDocumentEmbeddingTransport(apiKey: string, dispatch: typeof fetch = fetch): DocumentEmbeddingTransport {
  return async request => {
    validate(request, apiKey)
    const body = JSON.stringify({ model: request.model, dimensions: request.dimensions, input: request.input, encoding_format: "float" })
    const headers = new Headers({ "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "X-Client-Request-Id": request.requestId })
    // Everything after this point may have reached the provider. Never translate
    // a network/HTTP/parse error into a confirmed zero-cost failure or replay.
    try {
      const response = await dispatch(endpoint, { method: "POST", headers, body, signal: request.signal, redirect: "error", cache: "no-store" })
      if (!response.ok || response.redirected) {
        await response.body?.cancel().catch(() => undefined)
        throw new Error("Embedding response unavailable.")
      }
      const raw = await readResponse(response)
      const { model, usage } = usageSchema.parse(raw)
      const bytes = request.input.reduce((sum, text) => sum + Buffer.byteLength(text, "utf8"), 0)
      if (usage.prompt_tokens !== usage.total_tokens || usage.prompt_tokens > bytes) throw new Error("Embedding usage unavailable.")
      const parsed = vectorsSchema.safeParse(raw)
      // Return confirmed usage even when output cannot be admitted. The existing
      // controller records expense before rejecting these unusable vectors.
      if (!parsed.success || parsed.data.data.length !== request.input.length) return { model, inputTokens: usage.prompt_tokens, vectors: [] }
      const rows = parsed.data.data
      const indices = new Set(rows.map(row => row.index))
      const complete = indices.size === request.input.length && rows.every(row => row.index < request.input.length)
      return { model, inputTokens: usage.prompt_tokens, vectors: complete ? rows.sort((a, b) => a.index - b.index).map(row => row.embedding) : [] }
    } catch {
      throw new Error("Embedding delivery requires reconciliation.")
    }
  }
}
