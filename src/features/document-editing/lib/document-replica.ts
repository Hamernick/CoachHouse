import * as Y from "yjs"
import { validateDocumentRecovery, type DocumentRecoveryState } from "./document-recovery"

const REMOTE_ORIGIN = Symbol("document-remote")
export const MAX_DOCUMENT_UPDATE_BYTES = 2 * 1024 * 1024
export type DocumentUpdateBatch = { id: string; update: Uint8Array }
type PendingChange = "edit" | "prepared" | "acknowledged"
function sameBytes(left: Uint8Array | null, right: Uint8Array | null) {
  return left === right || Boolean(left && right && left.length === right.length && left.every((byte, index) => byte === right[index]))
}

/** CRDT + acknowledged outbox only. Transport auth/durability belongs to the
 * room service. A broadcast success must never be treated as a durable ack. */
export function createDocumentReplica(initialState: Uint8Array, recovery?: DocumentRecoveryState) {
  validateUpdate(initialState)
  if (recovery) validateDocumentRecovery(recovery)
  const document = new Y.Doc()
  try {
    Y.applyUpdate(document, initialState, REMOTE_ORIGIN)
    if (recovery?.batch) Y.applyUpdate(document, recovery.batch.update, REMOTE_ORIGIN)
    if (recovery?.tail) Y.applyUpdate(document, recovery.tail, REMOTE_ORIGIN)
  }
  catch { document.destroy(); throw new Error("The shared document checkpoint is invalid.") }
  let pending: Uint8Array[] = [recovery?.batch?.update, recovery?.tail].filter((update): update is Uint8Array => Boolean(update)).map(update => update.slice())
  let prepared: (DocumentUpdateBatch & { count: number }) | null = recovery?.batch ? { id: recovery.batch.id, update: recovery.batch.update.slice(), count: 1 } : null
  const observers = new Set<(change: PendingChange) => void>()
  let disposed = false
  function captureRecovery(): DocumentRecoveryState {
    if (disposed) throw new Error("This document session is closed.")
    const remaining = pending.slice(prepared?.count ?? 0)
    return { batch: prepared ? { id: prepared.id, update: prepared.update.slice() } : null,
      tail: remaining.length ? Y.mergeUpdates(remaining) : null }
  }
  function destroy() {
    disposed = true; pending = []; prepared = null; observers.clear(); document.destroy()
  }
  document.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin !== REMOTE_ORIGIN && !disposed) {
      pending.push(update)
      for (const observer of observers) observer("edit")
    }
  })
  return {
    document,
    onPendingChange(callback: (change: PendingChange) => void) {
      observers.add(callback)
      return () => { observers.delete(callback) }
    },
    captureRecovery,
    get pendingBytes() { return pending.reduce((total, update) => total + update.byteLength, 0) },
    receive(update: Uint8Array) {
      if (disposed) throw new Error("This document session is closed.")
      validateUpdate(update)
      Y.applyUpdate(document, update, REMOTE_ORIGIN)
    },
    prepare(): DocumentUpdateBatch | null {
      if (disposed) throw new Error("This document session is closed.")
      if (prepared) return { id: prepared.id, update: prepared.update.slice() }
      if (!pending.length) return null
      const update = Y.mergeUpdates(pending)
      validateUpdate(update)
      prepared = { id: crypto.randomUUID(), update, count: pending.length }
      for (const observer of observers) observer("prepared")
      return { id: prepared.id, update: prepared.update.slice() }
    },
    acknowledge(id: string) {
      if (disposed) return false
      if (prepared?.id !== id) return false
      pending = pending.slice(prepared.count)
      prepared = null
      for (const observer of observers) observer("acknowledged")
      return true
    },
    dispose() {
      if (pending.length) throw new Error("Persist or recover pending document edits before closing the session.")
      destroy()
    },
    /** Owner must persist this exact snapshot first. A newer edit or changed
     * retry identity refuses the handoff; this is not a network acknowledgement. */
    releaseAfterRecovery(recovered: DocumentRecoveryState) {
      validateDocumentRecovery(recovered)
      const current = captureRecovery()
      if (current.batch?.id !== recovered.batch?.id ||
        !sameBytes(current.batch?.update ?? null, recovered.batch?.update ?? null) || !sameBytes(current.tail, recovered.tail))
        throw new Error("The draft changed after recovery. Preserve the newer edits before closing.")
      destroy()
    },
  }
}

function validateUpdate(update: Uint8Array) {
  if (!update.byteLength || update.byteLength > MAX_DOCUMENT_UPDATE_BYTES)
    throw new Error("The document update exceeds the supported transport budget.")
  try { Y.decodeUpdate(update) }
  catch { throw new Error("The shared document update is invalid.") }
}
