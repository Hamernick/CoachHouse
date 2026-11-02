import { parseSSEStream, runHttpRequest } from "@ag-ui/client"
import { createResearchProgressReceiver, type ResearchPhase, type ResearchProgressIdentity, type ResearchProgress } from "./research-progress"
import type { ResearchResult } from "../research-types"
import type { ResearchItemPreview } from "./research-item-preview"

// Subscription limits, not execution deadlines. A quiet or restarted producer
// recovers through the existing saved-run reader, never another generation.
const idleMilliseconds = 30_000, maximumMilliseconds = 120_000

/** Use the SDK's UTF-8/SSE decoder, bounded before it can accumulate or parse.
 * Never use its general state/JSON-patch application machinery for the board. */
export async function readResearchProgress(response: Response,
  expected: Pick<ResearchProgressIdentity, "runId" | "target"> & { userId: string },
  onPhase: (phase: ResearchPhase) => void, signal?: AbortSignal, onPreview?: (result: ResearchResult) => void,
  onPartial?: (item: ResearchItemPreview | null) => void) {
  if (!response.body) return
  if (signal?.aborted) { await response.body.cancel().catch(() => {}); return }
  const controller = new AbortController()
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
  let bytes = 0, frames = 0, tail = "", terminal = false, complete = false
  let snapshot: Extract<ResearchProgress, { kind: "run.snapshot" }> | undefined
  const body = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, output) {
      bytes += chunk.byteLength
      if (bytes > 65536) throw new Error("Research progress exceeds its limit.")
      for (const byte of chunk) tail = (tail + String.fromCharCode(byte)).slice(-2)
      output.enqueue(chunk)
    },
    flush() { if (tail !== "\n\n") throw new Error("Research stream was interrupted.") },
  }), { signal: combined })
  const receive = createResearchProgressReceiver(expected)
  // The SDK does not propagate SSE-subscription teardown upstream. Explicitly
  // abort our bounded body on error/unmount; this does not cancel the saved run.
  await new Promise<void>(resolve => {
    let settled = false, subscription: { unsubscribe: () => void } | undefined
    let idle: ReturnType<typeof setTimeout>, maximum: ReturnType<typeof setTimeout>
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(idle); clearTimeout(maximum)
      combined.removeEventListener("abort", recover)
      controller.abort(); subscription?.unsubscribe(); resolve()
    }
    const recover = () => { if (!settled) { snapshot = undefined; finish() } }
    const resetIdle = () => { clearTimeout(idle); idle = setTimeout(recover, idleMilliseconds) }
    combined.addEventListener("abort", recover, { once: true })
    resetIdle(); maximum = setTimeout(recover, maximumMilliseconds)
    subscription = parseSSEStream(runHttpRequest(async () => new Response(body, { headers: response.headers })), false).subscribe({
      next(raw: unknown) {
        if (settled || combined.aborted) return
        try {
          if (++frames > 128) throw new Error("Research progress exceeds its limit.")
          const event = receive(raw)
          // Bytes, partial frames and duplicate sequences cannot prolong a wait.
          if (event) resetIdle()
          if (event?.kind === "phase.changed") onPhase(event.payload.phase)
          if (event?.kind === "preview.updated") onPreview?.(event.payload.result)
          if (event?.kind === "preview.item") onPartial?.(event.payload.item)
          if (event?.kind === "preview.cleared") onPartial?.(null)
          if (event?.kind === "run.snapshot") snapshot = event
          if (event?.kind === "run.terminal") terminal = true
        } catch { recover() }
      },
      error: recover,
      complete: () => { if (!settled) { complete = true; finish() } },
    })
    if (settled) subscription.unsubscribe()
  })
  // Only a complete, consistent stream can supply the authorized durable base.
  // Gaps, cancellation, truncation and older producers still require one read.
  if (complete && terminal && !signal?.aborted && snapshot) return snapshot
}
