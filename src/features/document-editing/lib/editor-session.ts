import type { createDocumentReplica, DocumentUpdateBatch } from "./document-replica"
import type { DocumentRecoveryState } from "./document-recovery"
import type { DocumentRecoveryStore } from "./recovery-storage"
import { createDocumentRecoveryJournal, type RecoveryWriteState } from "./recovery-journal"
import { createDocumentRoomSync, type DocumentRoomTransport, type RoomSyncState } from "./room-sync"
import { createDocumentRoomWriter, type RoomWriteState } from "./room-writer"
import type { DocumentRoom, DocumentRoomReceipt } from "./room-contracts"
import { DocumentRoomError } from "./room-client"

export type DocumentEditorSessionState = {
  status: "loading" | "ready" | "offline" | "blocked" | "paused" | "closing" | "closed"
  replica: ReturnType<typeof createDocumentReplica> | null
  editable: boolean
  dirty: boolean
  pending: boolean
  recovery: RecoveryWriteState | null
  locked: boolean
  error?: unknown
}

/** One owner per mounted file window. UI subscriptions are status-only;
 * native editing/undo remains inside the existing Tiptap/Yjs binding. */
export function createDocumentEditorSession({ expected, transport, store, recovery, commit, allowEditing = false }: {
  expected: DocumentRoom
  transport: DocumentRoomTransport
  store: DocumentRecoveryStore | null
  recovery?: DocumentRecoveryState
  commit: (batch: DocumentUpdateBatch) => Promise<DocumentRoomReceipt>
  // Production enablement waits for canonical versioned Save, not draft acks.
  allowEditing?: boolean
}) {
  let state: DocumentEditorSessionState = {status:"loading",replica:null,editable:false,dirty:false,pending:false,recovery:null,locked:false}
  const listeners = new Set<() => void>()
  let journal: ReturnType<typeof createDocumentRecoveryJournal> | null = null
  let writer: ReturnType<typeof createDocumentRoomWriter> | null = null
  let detach: (() => void) | null = null
  let initialRecovery: Promise<void> | null = null
  let recoveryState: RecoveryWriteState | null = null
  let writeState: RoomWriteState = "idle"
  let writerActive = false
  let failure: unknown
  let active = true
  let closing = false
  let closed = false
  let locked = false
  let closeFlight: Promise<void> | null = null
  let syncState: RoomSyncState = {status:"loading",sequence:0,editable:false}
  function notify() {
    const replica = sync.replica
    const editable = allowEditing && active && !closing && !closed && !locked && !failure && syncState.status === "ready" && syncState.editable && Boolean(writer && journal && initialRecovery === null) && recoveryState !== "blocked" && recoveryState !== "locked"
    if (writer && writerActive !== editable) {writerActive=editable;writer.setActive(editable)}
    const next: DocumentEditorSessionState = {
      status: closed ? "closed" : closing ? "closing" : failure ? "blocked" : syncState.status,
      replica: closed ? null : replica,
      editable,
      dirty: !closed && Boolean((replica?.pendingBytes ?? 0) > 0 || sync.room.last_sequence > sync.room.canonical_sequence),
      pending: !closed && (writeState === "syncing" || recoveryState === "writing"),
      recovery: recoveryState,
      locked,
      ...(failure || syncState.error ? {error:failure || syncState.error} : {}),
    }
    if (next.status === state.status && next.replica === state.replica && next.editable === state.editable && next.dirty === state.dirty && next.pending === state.pending && next.recovery === state.recovery && next.locked === state.locked && next.error === state.error) return
    state = next
    for (const listener of listeners) listener()
  }
  function initializeWriter() {
    const replica = sync.replica
    if (!replica || !journal || writer || closed || locked) return
    writer = createDocumentRoomWriter({replica,room:sync.room,onState:(next,error) => {
      writeState = next; if (error) failure = error; notify()
    },commit:async batch => { await journal!.flush(); return commit(batch) }})
    writer.setActive(false)
  }
  function initialize() {
    const replica = sync.replica
    if (!replica || detach || closed) return
    detach = replica.onPendingChange(() => notify())
    if (!store) return
    journal = createDocumentRecoveryJournal({replica,store,onState:(next,error) => {
      recoveryState = next
      if (error) failure = error
      notify()
    }})
    // Even a recovered outbox must be durable in this owner's journal before
    // accepting another edit or sending a batch to the shared room.
    initialRecovery = Promise.resolve().then(() => journal!.flush()).then(() => {
      if (closed) return
      initializeWriter()
    }).catch((error:unknown) => { failure = error }).finally(() => {initialRecovery=null;notify()})
  }
  const sync = createDocumentRoomSync({expected,transport,recovery,onState:next => {
    syncState = next
    if (next.status === "ready") initialize()
    if (next.status === "blocked") {
      failure = next.error ?? new Error("Shared editing needs attention.")
      if (next.error instanceof DocumentRoomError && next.error.code === "access") locked = true
    }
    notify()
  }})
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => {listeners.delete(listener)} },
    getSnapshot: () => state,
    get room() { return sync.room },
    refresh: () => sync.refresh(),
    start() { if (!closed && !closing) sync.resume() },
    setActive(enabled: boolean) {
      if (closed || closing || locked) return
      active = enabled
      if (enabled) sync.resume()
      else sync.pause()
      notify()
    },
    async retry() {
      if (closed || closing || locked) return
      try {
        failure = undefined
        if (journal && recoveryState === "blocked") await journal.retry()
        initializeWriter()
        sync.retry()
        if (writer && writeState === "blocked") await writer.retry()
      } catch (error) { failure = error }
      notify()
    },
    async flush() {
      if (closed) throw new Error("This document session is closed.")
      await initialRecovery
      await writer?.flush()
      await journal?.flush()
      notify()
      if (failure) throw failure
    },
    close(): Promise<void> {
      if (closed) return Promise.resolve()
      if (closeFlight) return closeFlight
      closing = true; writerActive=false; writer?.setActive(false); sync.pause(); notify()
      closeFlight = (async () => {
        await initialRecovery
        if (journal) {
          await journal.flush()
          if (!journal.ready) throw new Error("The draft changed while closing. Finish recovery before closing this editor.")
        }
        const replica = sync.replica
        const recovered = replica?.captureRecovery()
        if (replica?.pendingBytes && !journal) throw new Error("Recover pending edits before closing this document.")
        // No await between the durable-state check and release: a later edit
        // cannot be erased by this handoff. An in-flight receipt may finish later.
        detach?.(); detach = null; writer?.dispose()
        if (journal) journal.lock()
        else store?.close()
        if (replica && recovered) replica.releaseAfterRecovery(recovered)
        closed = true; closing = false; notify(); listeners.clear()
      })().catch((error:unknown) => {
        closing = false; failure = error; notify(); throw error
      }).finally(() => {closeFlight=null})
      return closeFlight
    },
  }
}
export type DocumentEditorSession = ReturnType<typeof createDocumentEditorSession>
