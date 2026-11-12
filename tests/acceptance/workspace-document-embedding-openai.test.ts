import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { createOpenAiDocumentEmbeddingTransport, OPENAI_DOCUMENT_EMBEDDING_MODEL as model } from "@/features/workspace-ai/server/document-embedding-openai"
import { createDocumentEmbedding, withDocumentEmbeddingBudget } from "@/features/workspace-ai/server/document-embedding"
import { configuredDocumentEmbedding, resolveDocumentEmbeddingConfig } from "@/features/workspace-ai/server/document-embedding-config"
import { createDocumentRetrieval } from "@/features/workspace-ai/server/document-retrieval"
import type { ResearchContext } from "@/features/workspace-ai/server/research-context"
import type { AiUsage } from "@/features/ai-credits"
import { embeddingDisclosureFixture } from "./fixtures/document-embedding-fixtures"

const base = { tariff: { version: "fixture", model: "answer-fixture", inputMicrodollarsPerMillion: 1, cachedMicrodollarsPerMillion: 0,
  outputMicrodollarsPerMillion: 1, microdollarsPerCredit: 2000 }, maxSearchCalls: 0, maxRounds: 3, maxInputBytes: 20000, maxOutputTokens: 3000, maxCost: 69000, maxCredits: 35 }
const policy = { ...embeddingDisclosureFixture, model, dimensions: 1536, microdollarsPerMillion: 20000, maxInputBytes: 180000, maxInputTokens: 200000, maxCalls: 8 }
const scope = { organizationId: "00000000-0000-4000-8000-000000000001", actorId: "00000000-0000-4000-8000-000000000002", canvasId: null }
const vector = (value = 1) => [value, ...Array<number>(1535).fill(0)]
const wire = (count = 1) => ({ object: "list", model, usage: { prompt_tokens: count, total_tokens: count },
  data: Array.from({ length: count }, (_, index) => ({ object: "embedding", index, embedding: vector(index + 1) })) })
const dispatch = vi.fn<typeof fetch>()
const unexpectedNetwork = vi.fn(() => { throw Error("Network forbidden") })
const request = () => ({ model, dimensions: 1536, input: ["source"], requestId: "run:embedding:1", signal: new AbortController().signal })
function controller() {
  const usage: AiUsage = { input: 0, cachedInput: 0, output: 0 }
  const embedding = createDocumentEmbedding({ runId: "run", config: withDocumentEmbeddingBudget(base, policy), usage,
    signal: new AbortController().signal, isCanceled: async () => false, transport: createOpenAiDocumentEmbeddingTransport("synthetic-test-credential", dispatch) })
  return { usage, ...embedding }
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("fetch", unexpectedNetwork)
  dispatch.mockImplementation(async () => Response.json(wire()))
})
afterEach(() => { expect(unexpectedNetwork).not.toHaveBeenCalled(); vi.unstubAllGlobals() })

it("sends one exact request and maps out-of-order indices before returning vectors", async () => {
  const response = wire(2); response.data.reverse(); dispatch.mockResolvedValueOnce(Response.json(response))
  const transport = createOpenAiDocumentEmbeddingTransport("synthetic-test-credential", dispatch)
  expect(await transport({ ...request(), input: ["first", "second"] })).toEqual({ model, inputTokens: 2, vectors: [vector(1), vector(2)] })
  expect(dispatch).toHaveBeenCalledOnce()
  const [url, init] = dispatch.mock.calls[0]
  expect(url).toBe("https://api.openai.com/v1/embeddings")
  expect(init).toMatchObject({ method: "POST", redirect: "error", cache: "no-store" })
  expect([...new Headers(init?.headers).keys()].sort()).toEqual(["authorization", "content-type", "x-client-request-id"])
  expect(new Headers(init?.headers).get("x-client-request-id")).toBe("run:embedding:1")
  expect(JSON.parse(String(init?.body))).toEqual({ model, dimensions: 1536, input: ["first", "second"], encoding_format: "float" })
})
it.each([[], [" "], ["x".repeat(1441)], ["\uD800"], ["\uDC00"], Array<string>(121).fill("x")].map(input => ({ input })))("rejects inadmissible input before any HTTP dispatch (%#)", async ({ input }) => {
  const c = controller()
  await expect(c.embed(input)).rejects.toThrow()
  expect(dispatch).not.toHaveBeenCalled(); expect(c.usage.embeddingInput).toBeUndefined(); expect(() => c.assertHealthy()).not.toThrow()
})
it.each([{ model: "alternate" }, { dimensions: 2 }, { requestId: "bad\r\nheader" }])("rejects changed wire configuration before dispatch (%#)", async change => {
  await expect(createOpenAiDocumentEmbeddingTransport("synthetic", dispatch)({ ...request(), ...change })).rejects.toThrow("not dispatched")
  expect(dispatch).not.toHaveBeenCalled()
})
it.each(["", "invalid\ncredential"])("rejects missing/invalid credentials locally (%#)", async key => {
  await expect(createOpenAiDocumentEmbeddingTransport(key, dispatch)(request())).rejects.toThrow("not dispatched")
  expect(dispatch).not.toHaveBeenCalled()
})
it("preserves exact Unicode/special-looking text and accepts the five-source maximum batch", async () => {
  const texts = Array<string>(120).fill("界".repeat(480))
  dispatch.mockResolvedValueOnce(Response.json(wire(120)))
  const c = controller(); expect(await c.embed(texts)).toHaveLength(120)
  expect(c.usage.embeddingInput).toBe(120)
  dispatch.mockResolvedValueOnce(Response.json(wire()))
  const special = "😀<|endoftext|>\n\"quoted\""
  await c.embed([special])
  expect(JSON.parse(String(dispatch.mock.calls[1][1]?.body)).input).toEqual([special])
})
it.each(["duplicate", "missing", "out of range", "wrong dimension", "zero", "nonfinite", "not a list", "not a vector"])("retains known expense while rejecting %s output", async kind => {
  const response = wire(2)
  if (kind === "duplicate") response.data[1].index = 0
  if (kind === "missing") response.data.pop()
  if (kind === "out of range") response.data[1].index = 2
  if (kind === "wrong dimension") response.data[0].embedding.pop()
  if (kind === "zero") response.data[0].embedding.fill(0)
  if (kind === "nonfinite") response.data[0].embedding[0] = Infinity
  if (kind === "not a list") response.object = "error"
  if (kind === "not a vector") response.data[0].object = "other"
  dispatch.mockResolvedValueOnce(Response.json(response))
  const c = controller(); await expect(c.embed(["one", "two"])).rejects.toThrow("Invalid document embeddings")
  expect(c.usage.embeddingInput).toBe(2); expect(() => c.assertHealthy()).not.toThrow(); expect(dispatch).toHaveBeenCalledOnce()
})
it.each(["wrong model", "missing", "fractional", "inconsistent", "negative", "zero", "excess"])("holds uncertain %s usage without retry or leaked response", async kind => {
  const response = wire()
  if (kind === "wrong model") response.model = "private-other-model"
  if (kind === "missing") Reflect.deleteProperty(response, "usage")
  if (kind === "fractional") response.usage.prompt_tokens = 1.5
  if (kind === "inconsistent") response.usage.total_tokens = 2
  if (kind === "negative") response.usage.prompt_tokens = -1
  if (kind === "zero") response.usage = { prompt_tokens: 0, total_tokens: 0 }
  if (kind === "excess") response.usage = { prompt_tokens: 100, total_tokens: 100 }
  dispatch.mockResolvedValueOnce(Response.json(response))
  const c = controller(); await expect(c.embed(["source"])).rejects.toThrow("requires reconciliation")
  await expect(c.embed(["source"])).rejects.toThrow("requires reconciliation")
  expect(c.usage.embeddingInput).toBeUndefined(); expect(dispatch).toHaveBeenCalledOnce()
})
it.each([302, 401, 429, 500])("does not follow or retry HTTP %i", async status => {
  dispatch.mockResolvedValueOnce(new Response("private provider detail", { status, headers: { Location: "https://unreviewed.invalid", "Retry-After": "0" } }))
  const c = controller(); await expect(c.embed(["source"])).rejects.toThrow("requires reconciliation")
  await expect(c.embed(["source"])).rejects.toThrow("requires reconciliation"); expect(dispatch).toHaveBeenCalledOnce()
})
it.each(["lost reply", "truncated JSON", "oversized stream", "invalid UTF8"])("holds ambiguous %s with no fallback", async kind => {
  if (kind === "lost reply") dispatch.mockRejectedValueOnce(Error("private provider detail"))
  if (kind === "truncated JSON") dispatch.mockResolvedValueOnce(new Response('{"usage":'))
  if (kind === "oversized stream") dispatch.mockResolvedValueOnce(new Response(new Uint8Array(8_000_001)))
  if (kind === "invalid UTF8") dispatch.mockResolvedValueOnce(new Response(new Uint8Array([255])))
  const c = controller(); await expect(c.embed(["source"])).rejects.toThrow("requires reconciliation")
  expect(() => c.assertHealthy()).toThrow("requires reconciliation"); expect(dispatch).toHaveBeenCalledOnce()
})
it("checks abort before dispatch and retains ambiguity after dispatch", async () => {
  const abort = new AbortController(); abort.abort()
  await expect(createOpenAiDocumentEmbeddingTransport("synthetic", dispatch)({ ...request(), signal: abort.signal })).rejects.toThrow("not dispatched")
  expect(dispatch).not.toHaveBeenCalled()
  dispatch.mockImplementationOnce(async (_url, init) => { expect(init?.signal).toBeInstanceOf(AbortSignal); throw new DOMException("private", "AbortError") })
  const c = controller(); await expect(c.embed(["source"])).rejects.toThrow("requires reconciliation")
})
it("keeps registration empty and rejects non-native, excessive and unapproved configuration", () => {
  expect(configuredDocumentEmbedding()).toBeUndefined()
  const registration = { policy, qualifiedScope: scope, transport: createOpenAiDocumentEmbeddingTransport("synthetic", dispatch), qualifiedSourceIds: new Set(["document:mission"]) }
  expect(resolveDocumentEmbeddingConfig(base, registration).config.maxCost).toBe(73000)
  for (const ids of [["file:upload"], ["document:part:copy"], Array.from({ length: 6 }, (_, i) => `document:${i}`)]) {
    expect(() => resolveDocumentEmbeddingConfig(base, { ...registration, qualifiedSourceIds: new Set(ids) })).toThrow()
    expect(() => createDocumentRetrieval({} as ResearchContext, { model, dimensions: 1536, qualifiedSourceIds: new Set(ids), embed: async () => [] })).toThrow("qualification")
  }
  for (const changed of [{ dimensions: 1 }, { microdollarsPerMillion: 1 }, { maxCalls: 9 }, { maxInputBytes: 180001 }, { maxInputTokens: 200001 }])
    expect(() => resolveDocumentEmbeddingConfig(base, { ...registration, policy: { ...policy, ...changed } })).toThrow()
  expect(dispatch).not.toHaveBeenCalled()
})

it("binds native qualification to one organization, actor and canvas before any read", () => {
  const context = { target: { organizationId: scope.organizationId }, user: { id: scope.actorId }, canvasId: null } as ResearchContext
  const options = { model, dimensions: 1536, qualifiedSourceIds: new Set(["document:mission"]), qualifiedScope: scope, embed: vi.fn(async () => []) }
  expect(() => createDocumentRetrieval(context, options)).not.toThrow()
  for (const changed of [undefined, { ...scope, actorId: scope.organizationId }, { ...scope, organizationId: scope.actorId }, { ...scope, canvasId: scope.actorId }])
    expect(() => createDocumentRetrieval(context, { ...options, qualifiedScope: changed })).toThrow("scope")
  expect(() => resolveDocumentEmbeddingConfig(base, { policy, qualifiedSourceIds: options.qualifiedSourceIds, transport: createOpenAiDocumentEmbeddingTransport("synthetic", dispatch) })).toThrow()
  expect(options.embed).not.toHaveBeenCalled(); expect(dispatch).not.toHaveBeenCalled()
})
it("keeps astral characters whole and exact source offsets in bounded selected passages", async () => {
  const content = ("x".repeat(479) + "😀").repeat(20)
  const context = { target: { organizationId: scope.organizationId }, user: { id: scope.actorId }, canvasId: null } as ResearchContext
  const c = controller()
  dispatch.mockImplementation(async (_url, init) => Response.json(wire(JSON.parse(String(init?.body)).input.length)))
  type Chunk = { key: string; text: string; start: number; end: number }
  const rpc = vi.fn<NonNullable<Parameters<typeof createDocumentRetrieval>[2]>>(async (operation, payload) => {
    const data = payload as { signature: string; chunks: Chunk[] }
    if (operation === "state") return { revision: 0, signature: "", keys: [] }
    if (operation === "replace") return { revision: 1, signature: data.signature, keys: data.chunks.map((chunk) => chunk.key) }
    return []
  })
  const retrieval = createDocumentRetrieval(context, { model, dimensions: 1536, qualifiedSourceIds: new Set(["document:mission"]), qualifiedScope: scope, embed: c.embed }, rpc)
  await retrieval.search([{ id: "document:mission", kind: "document", title: "Mission", content, revision: "r1", contentAvailable: true, href: "/workspace" }], "mission", "hybrid")
  const { chunks } = rpc.mock.calls.find(([operation]) => operation === "replace")![1] as { chunks: Chunk[] }
  expect(chunks.length).toBeLessThanOrEqual(96)
  const characters=chunks.reduce((sum,chunk)=>sum+chunk.end-chunk.start,0)
  expect(characters).toBeGreaterThan(9000)
  expect(characters).toBeLessThanOrEqual(9600)
  expect(chunks.every((chunk,index)=>chunk.end<=content.length&&(!index||chunks[index-1].end<=chunk.start))).toBe(true)
  for (const chunk of chunks) {
    expect(chunk.text).toBe(content.slice(chunk.start, chunk.end))
    expect(/[\uD800-\uDFFF]/u.test(chunk.text)).toBe(false)
    expect(chunk.end - chunk.start).toBeLessThanOrEqual(480)
  }
  expect(dispatch).toHaveBeenCalledTimes(2)
})
