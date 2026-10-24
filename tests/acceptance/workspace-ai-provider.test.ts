import { beforeEach, describe, expect, it, vi } from "vitest"
import { zodTextFormat } from "openai/helpers/zod"
import { generatedPlanShape } from "@/features/workspace-objectives/lib/ai-plan-proposal"
import { streamDocumentDraft, streamWorkspaceDraft } from "@/features/workspace-ai/server/provider"

const mocks = vi.hoisted(() => ({ create: vi.fn(), options: vi.fn() }))
vi.mock("openai", () => ({ default: class {
  constructor(options: unknown) { mocks.options(options) }
  responses = { create: mocks.create }
} }))
const input = () => ({ requestId: "test-request", model: "fixture", context: "Scoped context", maxOutputTokens: 6000,
  signal: new AbortController().signal, onResponse: vi.fn().mockResolvedValue(undefined), onText: vi.fn() })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.create.mockImplementation(async function* () {
    yield { type: "response.created", response: { id: "response-1" } }
    yield { type: "response.output_text.delta", delta: "Draft" }
    yield { type: "response.completed", response: { usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 20 }, output_tokens: 50 } } }
  })
})
describe("workspace provider boundary", () => {
  it("sends the strict plan schema and preserves correlation, measured usage and bounded settings", async () => {
    const request = input(); const format = zodTextFormat(generatedPlanShape, "workspace_plan")
    const result = await streamWorkspaceDraft({ ...request, instructions: "Plan", textFormat: format })
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ text: { format }, store: false, stream: true, service_tier: "default", max_output_tokens: 6000 }),
      { signal: request.signal, headers: { "X-Client-Request-Id": request.requestId } })
    expect(mocks.options).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 0, timeout: 90000 }))
    expect(request.onResponse.mock.invocationCallOrder[0]).toBeLessThan(request.onText.mock.invocationCallOrder[0])
    expect(result).toEqual({ text: "Draft", usage: { input: 100, cachedInput: 20, output: 50 }, completed: true })
  })
  it("keeps document generation in text mode", async () => {
    await streamDocumentDraft(input())
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty("text")
  })
  it("does not treat truncated structured output as complete", async () => {
    mocks.create.mockImplementation(async function* () {
      yield { type: "response.output_text.delta", delta: '{"title":' }
      yield { type: "response.incomplete", response: { usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 0 }, output_tokens: 6000 } } }
    })
    const result = await streamWorkspaceDraft({ ...input(), instructions: "Plan", textFormat: zodTextFormat(generatedPlanShape, "workspace_plan") })
    expect(result.completed).toBe(false)
    expect(result.usage?.output).toBe(6000)
  })
})
