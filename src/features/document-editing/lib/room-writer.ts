import type { createDocumentReplica } from "./document-replica"
import { ROOM_FLUSH_DELAY_MS, ROOM_FLUSH_MAX_WAIT_MS, type DocumentRoom, type DocumentRoomReceipt } from "./room-contracts"

export type RoomWriteState = "idle" | "pending" | "syncing" | "blocked"

/** Acknowledged working-draft persistence, not canonical file Save. No idle
 * timer or per-key server action; the caller provides its authenticated writer. */
export function createDocumentRoomWriter({ replica, room, commit, onState }: {
  replica: ReturnType<typeof createDocumentReplica>
  room: Pick<DocumentRoom, "generation">
  commit: (batch: NonNullable<ReturnType<typeof replica.prepare>>) => Promise<DocumentRoomReceipt>
  onState: (state: RoomWriteState, error?: unknown) => void
}) {
  let active = true
  let disposed = false
  let blocked = false
  let flight: Promise<void> | null = null
  let pauseTimer: ReturnType<typeof setTimeout> | undefined
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined
  let reported: RoomWriteState | undefined
  let reportedError: unknown
  function report(state: RoomWriteState, error?: unknown) {
    if (state === reported && error === reportedError) return
    reported = state; reportedError = error; onState(state, error)
  }
  function clearTimers() {
    clearTimeout(pauseTimer); clearTimeout(deadlineTimer)
    pauseTimer = undefined; deadlineTimer = undefined
  }
  function schedule() {
    if (!active || disposed || blocked || !replica.pendingBytes) return
    report(flight ? "syncing" : "pending")
    clearTimeout(pauseTimer)
    pauseTimer = setTimeout(() => void flush(), ROOM_FLUSH_DELAY_MS)
    if (!deadlineTimer) deadlineTimer = setTimeout(() => void flush(), ROOM_FLUSH_MAX_WAIT_MS)
  }
  function flush(): Promise<void> {
    clearTimers()
    if (flight) return flight
    if (!active || disposed || blocked) return Promise.resolve()
    let batch: ReturnType<typeof replica.prepare>
    try { batch = replica.prepare() }
    catch (error) { blocked = true; report("blocked", error); return Promise.resolve() }
    if (!batch) { report("idle"); return Promise.resolve() }
    report("syncing")
    flight = Promise.resolve().then(() => commit(batch)).then((receipt) => {
      if (receipt.batchId !== batch.id || receipt.generation !== room.generation)
        throw new Error("The durable receipt does not match pending edits.")
      replica.acknowledge(batch.id)
      if (!disposed) report(replica.pendingBytes ? "pending" : "idle")
    }).catch((error: unknown) => {
      blocked = true
      if (!disposed) report("blocked", error)
    }).finally(() => {
      flight = null
      if (!disposed && !blocked) schedule()
    })
    return flight
  }
  const unsubscribe = replica.onPendingChange(change => { if (change !== "prepared") schedule() })
  return {
    flush,
    setActive(enabled: boolean) {
      active = enabled
      if (!enabled) clearTimers()
      else schedule()
    },
    retry() { blocked = false; return flush() },
    dispose() {
      disposed = true
      clearTimers()
      unsubscribe()
      // The owner retains the replica/outbox until it is acknowledged or
      // securely journaled. Disposing this scheduler never discards edits.
    },
  }
}
