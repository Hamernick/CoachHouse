import "server-only"
import { createUIMessageStream, createUIMessageStreamResponse } from "ai"
import type { ResearchPhase } from "../lib/research-phase"
import type { ResearchItemPreview } from "../lib/research-item-preview"
import { researchTargetSchema, type ResearchResult } from "../research-types"
import { researchProgressSchema, type ResearchProgressIdentity } from "../lib/research-progress"
import { researchSnapshotSchema } from "../lib/research-snapshot"

/** Chat presentation only. Execution, settlement and saved readback remain with
 * handleWorkspaceResearch; dropping this connection never cancels the run. */
export function researchChatStream(identity: Omit<ResearchProgressIdentity, "streamId">,
  execute: (phase: (value: ResearchPhase) => void, preview: (value: ResearchResult) => void,
    partial: (value: ResearchItemPreview | null) => void) => Promise<Response>) {
  return createUIMessageStreamResponse({ stream: createUIMessageStream({
    execute: async ({ writer }) => {
      const streamId = crypto.randomUUID()
      let sequence = 0, bytes = 0
      writer.write({ type: "start", messageId: identity.runId })
      const send = (input: Record<string, unknown>) => {
        const event = researchProgressSchema.parse({ ...identity, streamId, version: 1, sequence: sequence + 1, emittedAt: new Date().toISOString(), ...input })
        const chunk = { type: "data-research" as const, data: event, transient: true }
        const size = new TextEncoder().encode(JSON.stringify(chunk)).byteLength + 8
        if (["preview.updated", "preview.item", "run.snapshot"].includes(event.kind) && (size > 32768 || bytes + size > 62500)) return
        if (bytes + size > 64000 || sequence >= 128) return
        writer.write(chunk); sequence += 1; bytes += size
      }
      send({ kind: "run.started", payload: {} })
      const response = await execute(
        phase => send({ kind: "phase.changed", payload: { phase } }),
        result => {
          const { dependencies: _dependencies, outputBindings: _bindings, ...preview } = result
          send({ kind: "preview.updated", resultRevision: 0, payload: { result: preview } })
        },
        item => send(item ? { kind: "preview.item", resultRevision: 0, payload: { item } } : { kind: "preview.cleared", resultRevision: 0, payload: {} }),
      )
      const value = await response.json()
      const snapshot = researchSnapshotSchema.safeParse(value.run)
      if (response.ok && snapshot.success && snapshot.data.id === identity.runId && ["succeeded", "failed", "canceled"].includes(snapshot.data.status)) {
        if ((snapshot.data.appliedObjectiveId && identity.target.mode !== "new_objective") ||
          (snapshot.data.result && JSON.stringify(snapshot.data.result.target) !== JSON.stringify(researchTargetSchema.parse(identity.target)))) return
        send({ kind: "run.snapshot", payload: { watermark: sequence + 1, run: snapshot.data } })
        send({ kind: "run.terminal", payload: { status: snapshot.data.status } })
      }
      writer.write({ type: "finish" })
    },
    onError: () => "Connection interrupted. Check status to recover this run.",
  }), headers: { "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } })
}
