import { afterEach, describe, expect, it, vi } from "vitest"
import { readResearchProgress } from "@/features/workspace-ai/lib/research-progress-client"
import { researchProgressSchema, researchProgressWire } from "@/features/workspace-ai/lib/research-progress"
import { ID, WORKSPACE, NOW } from "./fixtures/particle-fixtures"

const target = { organizationId: WORKSPACE, objectiveId: ID(1), revision: 0 }
const expected = { runId: ID(2), target, userId: ID(90) }
function pendingStream() {
  let output!: ReadableStreamDefaultController<Uint8Array>
  const canceled = vi.fn(), phase = vi.fn(), done = vi.fn()
  const response = new Response(new ReadableStream<Uint8Array>({ start(controller) { output = controller }, cancel: canceled }))
  const controller = new AbortController()
  const pending = readResearchProgress(response, expected, phase, controller.signal).then(value => { done(value); return value })
  const send = (sequence: number, patch = {}) => {
    const event = researchProgressSchema.parse({ version: 1, streamId: ID(3), runId: ID(2), requestId: ID(2),
      scope: { organizationId: WORKSPACE, canvasId: null, userId: ID(90) }, target, sequence, emittedAt: NOW,
      kind: sequence === 1 ? "run.started" : "phase.changed", payload: sequence === 1 ? {} : { phase: "reading" }, ...patch })
    output.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(researchProgressWire(event))}\n\n`))
  }
  return { output, canceled, phase, done, pending, controller, send }
}
afterEach(() => { vi.useRealTimers() })

describe("bounded research stream recovery", () => {
  it("abandons a silent connection once and releases all timers", async () => {
    vi.useFakeTimers()
    const stream = pendingStream()
    await vi.advanceTimersByTimeAsync(29_999)
    expect(stream.done).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(await stream.pending).toBeUndefined()
    expect(stream.canceled).toHaveBeenCalledTimes(1)
    expect(stream.done).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
  it("extends idle time only for a new accepted event", async () => {
    vi.useFakeTimers()
    const stream = pendingStream()
    stream.send(1)
    await vi.advanceTimersByTimeAsync(20_000)
    stream.send(2)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(stream.phase).toHaveBeenCalledExactlyOnceWith("reading")
    expect(stream.done).not.toHaveBeenCalled()
    stream.send(2)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await stream.pending).toBeUndefined()
    expect(stream.phase).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
  it("does not extend idle time for partial bytes", async () => {
    vi.useFakeTimers()
    const stream = pendingStream()
    await vi.advanceTimersByTimeAsync(20_000)
    stream.output.enqueue(new TextEncoder().encode('data: {"type":'))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await stream.pending).toBeUndefined()
    expect(stream.phase).not.toHaveBeenCalled()
  })
  it("bounds total wait even while valid progress continues", async () => {
    vi.useFakeTimers()
    const stream = pendingStream()
    for (let sequence = 1; sequence <= 6; sequence++) {
      stream.send(sequence)
      await vi.advanceTimersByTimeAsync(20_000)
    }
    expect(await stream.pending).toBeUndefined()
    expect(stream.phase).toHaveBeenCalledTimes(5)
    expect(stream.canceled).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
  it("cannot accept a terminal snapshot whose connection never closes", async () => {
    vi.useFakeTimers()
    const stream = pendingStream()
    stream.send(1)
    stream.send(2, { kind: "run.snapshot", payload: { watermark: 2, run: {
      version: 1, id: ID(2), status: "failed", credits: 0, result: null, resultRevision: null, applicability: "unavailable",
    } } })
    stream.send(3, { kind: "run.terminal", payload: { status: "failed" } })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(await stream.pending).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })
  it("cleans up immediately on cancellation without waiting for a timeout", async () => {
    vi.useFakeTimers()
    const stream = pendingStream()
    stream.controller.abort()
    expect(await stream.pending).toBeUndefined()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(stream.done).toHaveBeenCalledTimes(1)
    expect(stream.phase).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it("clears timeout handles after a clean stream closes", async () => {
    vi.useFakeTimers()
    const stream = pendingStream()
    stream.send(1)
    stream.send(2, { kind: "run.terminal", payload: { status: "failed" } })
    stream.output.close()
    await stream.pending
    expect(vi.getTimerCount()).toBe(0)
    expect(stream.done).toHaveBeenCalledTimes(1)
  })
  it("does not subscribe to an already aborted response", async () => {
    vi.useFakeTimers()
    const canceled = vi.fn(), phase = vi.fn(), controller = new AbortController()
    controller.abort()
    const response = new Response(new ReadableStream({ cancel: canceled }))
    expect(await readResearchProgress(response, expected, phase, controller.signal)).toBeUndefined()
    expect(canceled).toHaveBeenCalledTimes(1)
    expect(phase).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
