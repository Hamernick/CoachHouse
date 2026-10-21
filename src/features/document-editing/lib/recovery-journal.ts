import type { createDocumentReplica } from "./document-replica"
import type { DocumentRecoveryStore } from "./recovery-storage"

export type RecoveryWriteState = "pending" | "writing" | "ready" | "blocked" | "locked"
/** Event-driven local durability. Explicit close/Save must await flush; a
 * crash before the 100ms journal commit can still lose the newest keystrokes. */
export function createDocumentRecoveryJournal({ replica, store, onState }: {
  replica: ReturnType<typeof createDocumentReplica>
  store: DocumentRecoveryStore
  onState: (state: RecoveryWriteState, error?: unknown) => void
}) {
  let version = 0
  let durableVersion = -1
  let blocked = false
  let locked = false
  let flight: Promise<void> | null = null
  let pauseTimer: ReturnType<typeof setTimeout> | undefined
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined
  let reported: RecoveryWriteState | undefined
  function report(state: RecoveryWriteState, error?: unknown) {
    if (reported === state && !error) return
    reported = state; onState(state, error)
  }
  function clearTimers() { clearTimeout(pauseTimer); clearTimeout(deadlineTimer); pauseTimer = undefined; deadlineTimer = undefined }
  function schedule() {
    if (locked || blocked) return
    report(flight ? "writing" : "pending")
    clearTimeout(pauseTimer)
    pauseTimer = setTimeout(() => { void flush().catch(() => {}) }, 100)
    if (!deadlineTimer) deadlineTimer = setTimeout(() => { void flush().catch(() => {}) }, 250)
  }
  async function flush(): Promise<void> {
    const requiredVersion = version
    clearTimers()
    if (locked) throw new Error("This draft journal is locked.")
    if (blocked) throw new Error("Draft recovery is blocked. Preserve the in-memory draft and retry.")
    if (flight) { await flight; if (durableVersion < requiredVersion) return flush(); return }
    const captured = version
    // Native edits, prepared receipt identity and acknowledgements each advance
    // the journal version. Network commits await this durability barrier.
    let recovery: ReturnType<typeof replica.captureRecovery>
    try { recovery = replica.captureRecovery() }
    catch (error) { blocked = true; report("blocked", error); throw error }
    report("writing")
    flight = Promise.resolve().then(() => store.save(recovery)).then(() => {
      durableVersion = captured
      if (!locked) report(version === captured ? "ready" : "pending")
    }).catch((error: unknown) => { blocked = true; if (!locked) report("blocked", error); throw error }).finally(() => { flight = null })
    await flight
    if (locked) throw new Error("This draft journal is locked.")
    if (version !== captured && !pauseTimer) schedule()
  }
  const unsubscribe = replica.onPendingChange(() => { version++; schedule() })
  if (replica.pendingBytes) schedule()
  return {
    flush,
    retry() { blocked = false; return flush() },
    get ready() { return !locked && !blocked && durableVersion === version },
    lock() { locked = true; clearTimers(); unsubscribe(); store.close(); report("locked") },
    async close() {
      await flush()
      if (durableVersion !== version) throw new Error("The draft changed while closing. Finish recovery before closing this editor.")
      this.lock()
    },
  }
}
