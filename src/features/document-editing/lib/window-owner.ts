import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import type { DocumentSource } from "../types"
import { createAccountScopedFileReader } from "./file-owner"
import type { DocumentReadState } from "./file-reader"
import { createDocumentEditorSession, type DocumentEditorSession } from "./editor-session"
import { createSupabaseDocumentTransport } from "./room-realtime"
import { documentWindowSchema, type DocumentWindowView } from "./window-contracts"

/** Read-only integration first. No room creation, IDB record, local recovery
 * replay or canonical/native write is permitted by this owner. */
export function createDocumentWindowOwner({ source, client, load }: {
  source: DocumentSource
  client: SupabaseClient<Database>
  load: (source: DocumentSource) => Promise<DocumentWindowView>
}) {
  let loaded: DocumentWindowView | null = null
  let session: DocumentEditorSession | null = null
  let detachSession: (() => void) | null = null
  let sharedReady = false
  let fallback = false
  let active = true
  let closed = false
  let owners = 0
  let releaseVersion = 0
  let cleanupError: unknown
  const listeners = new Set<() => void>()
  const reader = createAccountScopedFileReader({ source, client, load: async source => {
    const result = documentWindowSchema.parse(await load(source))
    if (!closed) loaded = result
    return result
  } })
  let state: DocumentReadState & { session: DocumentEditorSession | null; sharedUnavailable: boolean } = {
    ...reader.getSnapshot(), session: null, sharedUnavailable: false,
  }

  function releaseSession() {
    detachSession?.(); detachSession = null
    const current = session
    session = null
    if (current) void current.close().catch(error => {
      // Retain the failed owner for recovery rather than destroying its replica.
      cleanupError = { session: current, error }
    })
  }
  function update() {
    const next = reader.getSnapshot()
    if (next.status === "locked") { loaded = null; releaseSession() }
    if (next.status === "ready" && !session && loaded?.shared.state === "ready" && source.provider === "coach_house") {
      session = createDocumentEditorSession({
        expected: loaded.shared.room,
        transport: createSupabaseDocumentTransport({ client, source, room: loaded.shared.room, actorId: loaded.viewerId, watchVersions: true }),
        store: null,
        allowEditing: false,
        commit: async () => { throw new Error("This document window is read only.") },
      })
      detachSession = session.subscribe(update)
      session.setActive(active)
    }
    const sharedState = session?.getSnapshot()
    // Once direct shared access was established, revocation must also remove
    // saved-source Copy/Download capability, not merely hide the live editor.
    if (sharedReady && sharedState?.locked) { reader.lock(); return }
    if (sharedState?.status === "ready") { sharedReady = true; fallback = false }
    else if (!sharedReady && (sharedState?.status === "blocked" || sharedState?.status === "offline")) fallback = true
    const sharedUnavailable = next.status === "ready" && (loaded?.shared.state === "unavailable" || fallback)
    if (state.status === next.status && state.snapshot === next.snapshot && state.session === session && state.sharedUnavailable === sharedUnavailable) return
    state = { ...next, session, sharedUnavailable }
    for (const listener of listeners) listener()
  }
  const detach = reader.subscribe(update)
  function close() {
    if (closed) return
    closed = true
    releaseSession()
    loaded = null
    reader.close()
    state = { ...reader.getSnapshot(), session: null, sharedUnavailable: false }
    detach()
    listeners.clear()
  }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    getSnapshot: () => state,
    get cleanupError() { return cleanupError },
    open: () => reader.open(),
    retry() {
      if (session?.getSnapshot().locked) {
        releaseSession(); sharedReady = false; fallback = false; loaded = null
        return reader.retry()
      }
      return session ? session.retry() : reader.retry()
    },
    setActive(value: boolean) { active = value; session?.setActive(value) },
    retain() {
      owners++; releaseVersion++
      const releaseReader = reader.retain()
      let released = false
      return () => {
        if (released) return
        released = true; owners--; releaseReader()
        const ticket = ++releaseVersion
        queueMicrotask(() => { if (!owners && ticket === releaseVersion) close() })
      }
    },
    close,
  }
}
