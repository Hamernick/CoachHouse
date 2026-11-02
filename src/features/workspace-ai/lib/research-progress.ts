import { EventType, type BaseEvent } from "@ag-ui/core"
import { EventSchema } from "@ag-ui/core/schemas"
import { z } from "zod"
import { researchResultSchema, researchTargetSchema } from "../research-types"
import { validateResearchRelationships } from "./research-relationships"

import { researchSnapshotSchema } from "./research-snapshot"
import { researchPhaseSchema } from "./research-phase"
import { researchItemPreviewSchema } from "./research-item-preview"
export type { ResearchPhase } from "./research-phase"
// Presentation only: do not disclose internal dependency fingerprints. One
// complete candidate follows optional typed items; raw fragments never cross.
export const researchPreviewSchema = researchResultSchema.omit({ dependencies: true }).superRefine((result, context) => {
  try {
    if (new Set(result.items.map(item => item.key)).size !== result.items.length) throw new Error("Duplicate item.")
    validateResearchRelationships(result)
  } catch { context.addIssue({ code: "custom", message: "Invalid preview relationships." }) }
})
const identity = {
  version: z.literal(1), streamId: z.uuid(), runId: z.uuid(), requestId: z.uuid(),
  scope: z.strictObject({ organizationId: z.uuid(), canvasId: z.string().min(1).max(200).nullable(), userId: z.uuid() }),
  target: researchTargetSchema, sequence: z.number().int().positive().max(128), emittedAt: z.iso.datetime(),
}
export const researchProgressSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...identity, kind: z.literal("run.started"), payload: z.strictObject({}) }),
  z.strictObject({ ...identity, kind: z.literal("phase.changed"), payload: z.strictObject({ phase: researchPhaseSchema }) }),
  z.strictObject({ ...identity, kind: z.literal("preview.item"), resultRevision: z.literal(0), payload: z.strictObject({ item: researchItemPreviewSchema }) }),
  z.strictObject({ ...identity, kind: z.literal("preview.cleared"), resultRevision: z.literal(0), payload: z.strictObject({}) }),
  z.strictObject({ ...identity, kind: z.literal("preview.updated"), resultRevision: z.literal(0), payload: z.strictObject({ result: researchPreviewSchema }) }),
  z.strictObject({ ...identity, kind: z.literal("run.snapshot"), payload: z.strictObject({ watermark: z.number().int().positive().max(128), run: researchSnapshotSchema }) }),
  z.strictObject({ ...identity, kind: z.literal("result.ready"), resultRevision: z.literal(1), payload: z.strictObject({ resultId: z.uuid(), applicability: z.literal("review_required") }) }),
  z.strictObject({ ...identity, kind: z.literal("run.terminal"), payload: z.strictObject({ status: z.enum(["succeeded", "failed", "canceled"]) }) }),
])
export type ResearchProgress = z.infer<typeof researchProgressSchema>
export type ResearchProgressIdentity = Pick<ResearchProgress, "runId" | "requestId" | "scope" | "target" | "streamId">
const name = "coach-house.research.v1"

export function researchProgressWire(event: ResearchProgress): BaseEvent {
  const metadata = { coachHouse: event }
  if (event.kind === "run.started") return { type: EventType.RUN_STARTED, threadId: event.streamId, runId: event.runId, metadata }
  if (event.kind === "run.terminal") {
    if (event.payload.status === "failed") return { type: EventType.RUN_ERROR, message: "Research did not produce a valid proposal.", metadata }
    return { type: EventType.RUN_FINISHED, threadId: event.streamId, runId: event.runId, metadata,
      ...(event.payload.status === "canceled" ? { outcome: { type: "cancelled" } } : {}) }
  }
  return { type: EventType.CUSTOM, name, value: event }
}

/** Progress is local presentation only. A gap ends this subscription; the caller
 * reads one authorized durable snapshot instead of replaying or generating again. */
export function createResearchProgressReceiver(expected: Pick<ResearchProgressIdentity, "runId" | "target"> & { userId: string }) {
  let streamId: string | undefined, canvasId: string | null | undefined, sequence = 0, terminal = false, previewed = false, ready = false
  let savedStatus: string | undefined
  const partialKeys = new Set<string>()
  // Bounded by the 128-event/64 KiB subscription. Only exact accepted events
  // are duplicates; reused sequences cannot conceal a restarted producer.
  const accepted = new Map<number, string>()
  return (raw: unknown): ResearchProgress | null => {
    const wire = EventSchema.parse(raw)
    const envelope = wire.type === EventType.CUSTOM && wire.name === name ? wire.value : wire.metadata?.coachHouse
    const event = researchProgressSchema.parse(envelope)
    if (event.runId !== expected.runId || event.requestId !== expected.runId || event.scope.userId !== expected.userId ||
      event.scope.organizationId !== expected.target.organizationId ||
      (expected.target.mode === "new_objective" && event.scope.canvasId !== expected.target.canvasId) || JSON.stringify(event.target) !== JSON.stringify(researchTargetSchema.parse(expected.target))) throw new Error("Research stream scope changed.")
    const wanted = researchProgressWire(event)
    if (wire.type !== wanted.type || ("runId" in wire && wire.runId !== event.runId) || ("threadId" in wire && wire.threadId !== event.streamId)) throw new Error("Invalid research event.")
    if (!streamId) {
      if (event.kind !== "run.started" || event.sequence !== 1) throw new Error("Research snapshot required.")
      streamId = event.streamId; canvasId = event.scope.canvasId
    }
    if (event.streamId !== streamId || event.scope.canvasId !== canvasId) throw new Error("Research stream changed.")
    const serialized = JSON.stringify(event)
    if (event.sequence <= sequence) {
      if (accepted.get(event.sequence) !== serialized) throw new Error("Research sequence changed. Snapshot required.")
      return null
    }
    if (terminal || event.sequence !== sequence + 1 || (sequence > 0 && event.kind === "run.started")) throw new Error("Research snapshot required.")
    if (savedStatus && event.kind !== "run.terminal") throw new Error("Research snapshot required.")
    if (event.kind === "preview.item" || event.kind === "preview.cleared") {
      if (previewed || ready) throw new Error("Research preview already complete.")
      if (event.kind === "preview.cleared") partialKeys.clear()
      else {
        if (partialKeys.has(event.payload.item.key) || partialKeys.size >= 12) throw new Error("Invalid preview item.")
        partialKeys.add(event.payload.item.key)
      }
    }
    if (event.kind === "run.snapshot") {
      const { run, watermark } = event.payload
      if (watermark !== event.sequence || run.id !== expected.runId || !["succeeded", "failed", "canceled"].includes(run.status) ||
        (ready && run.applicability !== "review_required") ||
        (run.appliedObjectiveId && expected.target.mode !== "new_objective") ||
        (run.result && JSON.stringify(run.result.target) !== JSON.stringify(event.target))) throw new Error("Invalid research snapshot.")
      if (run.result) {
        const { dependencies: _dependencies, ...preview } = run.result
        researchPreviewSchema.parse(preview)
      }
      savedStatus = run.status
    }
    if (event.kind === "run.terminal" && savedStatus && event.payload.status !== savedStatus) throw new Error("Inconsistent research snapshot completion.")
    if (event.kind === "result.ready" && (ready || event.payload.resultId !== expected.runId)) throw new Error("Invalid research result.")
    if (event.kind === "run.terminal" && ready && event.payload.status !== "succeeded") throw new Error("Inconsistent research completion.")
    if (event.kind === "preview.updated") {
      if (previewed || ready || event.payload.result.runId !== expected.runId || JSON.stringify(event.payload.result.target) !== JSON.stringify(event.target))
        throw new Error("Invalid research preview.")
      previewed = true
    }
    if (event.kind === "result.ready") ready = true
    accepted.set(event.sequence, serialized)
    sequence = event.sequence; terminal = event.kind === "run.terminal"
    return event
  }
}
