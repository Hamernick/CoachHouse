import "server-only"
import { randomUUID } from "node:crypto"
import { EventEncoder } from "@ag-ui/encoder"
import { researchProgressSchema, researchProgressWire, type ResearchPhase, type ResearchProgressIdentity } from "../lib/research-progress"
import { researchTargetSchema, type ResearchResult } from "../research-types"
import { researchSnapshotSchema } from "../lib/research-snapshot"
import type { ResearchItemPreview } from "../lib/research-item-preview"

export function researchProgressStream(identity: Omit<ResearchProgressIdentity, "streamId">,
  execute: (onPhase: (phase: ResearchPhase) => void, onPreview: (result: ResearchResult) => void, onPartial: (item: ResearchItemPreview | null) => void) => Promise<Response>) {
  const streamId = randomUUID(), encoder = new EventEncoder({ accept: "text/event-stream" }), text = new TextEncoder()
  let connected = true, sequence = 0, bytes = 0
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        if (!connected) return
        const value = researchProgressSchema.parse({ ...identity, streamId, version: 1, sequence: sequence + 1, emittedAt: new Date().toISOString(), ...event })
        const chunk = text.encode(encoder.encode(researchProgressWire(value)))
        // Optional presentation must fit the existing transport budget. Preserve
        // room for phases/terminal events; oversized candidates use saved readback.
        if (["preview.updated", "preview.item", "run.snapshot"].includes(String(event.kind)) && (chunk.byteLength > 32768 || bytes + chunk.byteLength > 62500)) return
        if (bytes + chunk.byteLength > 65536) return
        controller.enqueue(chunk); sequence += 1; bytes += chunk.byteLength
      }
      try {
        send({ kind: "run.started", payload: {} })
        const response = await execute(phase => send({ kind: "phase.changed", payload: { phase } }), result => {
          const { dependencies: _dependencies, ...preview } = result
          send({ kind: "preview.updated", resultRevision: 0, payload: { result: preview } })
        }, item => send(item ? { kind: "preview.item", resultRevision: 0, payload: { item } } : { kind: "preview.cleared", resultRevision: 0, payload: {} }))
        const value = await response.json()
        const snapshot = researchSnapshotSchema.safeParse(value.run)
        if (response.ok && snapshot.success && snapshot.data.id === identity.runId && ["succeeded", "failed", "canceled"].includes(snapshot.data.status)) {
          const run = snapshot.data
          if (run.appliedObjectiveId && identity.target.mode !== "new_objective") throw new Error("Unexpected research receipt.")
          if (run.result) {
            if (JSON.stringify(run.result.target) !== JSON.stringify(researchTargetSchema.parse(identity.target))) throw new Error("Research result scope changed.")
            send({ kind: "result.ready", resultRevision: run.resultRevision, payload: { resultId: run.id, applicability: run.applicability } })
          }
          // This is the same authorized saved readback returned by JSON. Keep
          // its exact draft base; unlike previews, it includes source revisions.
          send({ kind: "run.snapshot", payload: { watermark: sequence + 1, run } })
          send({ kind: "run.terminal", payload: { status: run.status } })
        } else send({ kind: "phase.changed", payload: { phase: "recovering" } })
      } catch {
        // No private exception or unvalidated result crosses this channel.
        // The caller recovers the existing run; a lost connection is not a stop.
      } finally {
        if (connected) { connected = false; controller.close() }
      }
    },
    cancel() { connected = false },
  })
  return new Response(body, { headers: { "Content-Type": encoder.getContentType(), "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } })
}
