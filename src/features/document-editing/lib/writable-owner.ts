import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import type { DocumentSource } from "../types"
import { openWritableDocument, saveUploadedDocument } from "../actions"
import { openDocumentRecoveryStore } from "./recovery-storage"
import { createDocumentEditorSession, type DocumentEditorSession } from "./editor-session"
import { createDocumentCanonicalWriter, type DocumentCanonicalWriter } from "./canonical-writer"
import { createSupabaseDocumentTransport } from "./room-realtime"
import { appendDocumentRoomUpdate } from "./room-client"
import { documentRecoveryExport } from "./recovery-export"

type RecoveryStore = Awaited<ReturnType<typeof openDocumentRecoveryStore>>
type RecoveryChoice = Awaited<ReturnType<RecoveryStore["list"]>>[number]
export type WritableDocumentState = {
  status: "idle" | "opening" | "recovery" | "editing" | "error" | "locked"
  session: DocumentEditorSession | null
  writer: DocumentCanonicalWriter | null
  choices: { sessionId: string; updatedAt: string; previousGeneration?: boolean; complete?: boolean }[]
  message?: string
}

/** Explicit Edit owns the durable session; viewing never initializes a room or
 * replays a local draft. Recovery selection is scoped to the verified account. */
export function createWritableDocumentOwner(source: DocumentSource, client: SupabaseClient<Database>) {
  let state: WritableDocumentState = { status: "idle", session: null, writer: null, choices: [] }
  let opened: Awaited<ReturnType<typeof openWritableDocument>> | null = null
  let store: RecoveryStore | null = null
  let choices: RecoveryChoice[] = []
  let olderChoices: RecoveryChoice[] = []
  let stopped = false
  let owners = 0
  let releaseVersion = 0
  let stopAuth: (() => void) | null = null
  let flight: Promise<void> | null = null
  const listeners = new Set<() => void>()
  const emit = (patch: Partial<WritableDocumentState>) => {
    state = { ...state, ...patch }; listeners.forEach(listener => listener())
  }
  function observeAuth() {
    if (stopAuth) return
    const auth = client.auth.onAuthStateChange((_event, session) => {
      if (opened && session?.user.id !== opened.actorId) {
        stopped = true; store?.close(); state.session?.setActive(false)
        emit({ status: "locked", choices: [], message: "The account changed. Reopen this file with your current account." })
      }
    })
    stopAuth = () => auth.data.subscription.unsubscribe()
  }
  async function start(sessionId?: string) {
    if (!opened?.room || !opened.editable || !store || stopped) return
    const recovery = sessionId ? choices.find(choice => choice.sessionId === sessionId) : undefined
    if (sessionId && !recovery) throw new Error("This recovery draft is unavailable.")
    const room = opened.room
    const recoveryStore = store
    const session = createDocumentEditorSession({ expected: room,
      transport: createSupabaseDocumentTransport({ client, source: opened.source, room, actorId: opened.actorId, watchVersions: true }),
      store, recovery: recovery?.recovery, allowEditing: true,
      commit: batch => appendDocumentRoomUpdate(client, room, batch),
    })
    const writer = createDocumentCanonicalWriter({ session, commit: saveUploadedDocument,
      onRestored: () => { void reset().then(() => open()).catch(error => emit({ status: "error", message: String(error) })) },
    })
    emit({ status: "editing", session, writer, choices: [], message: undefined })
    // Keep the old recovery record until the new owner's durability barrier
    // succeeds; a failed replay never destroys the only retained draft.
    session.start()
    if (recovery) {
      const detach = session.subscribe(() => {
        if (session.getSnapshot().editable) {
          detach(); void recoveryStore.remove(recovery.sessionId).catch(() => undefined)
        }
      })
    }
  }
  async function reset() {
    await state.session?.close()
    store?.close(); store = null; opened = null; choices = []; olderChoices = []
    emit({ status: "idle", session: null, writer: null, choices: [] })
  }
  async function open() {
    if (flight || stopped) return flight
    observeAuth()
    emit({ status: "opening", message: undefined })
    flight = (async () => {
      try {
        const result = await openWritableDocument(source)
        const current = await client.auth.getUser()
        if (stopped || current.error || current.data.user?.id !== result.actorId) throw new Error("The account changed while opening this editor.")
        if (!result.editable || !result.room || !result.recoveryRevision) throw new Error("Editing is unavailable for this file.")
        opened = result
        store = await openDocumentRecoveryStore({ client, scope: { actorId: result.actorId,
          organizationId: result.source.organizationId, fileId: result.source.fileId,
          generation: result.room.generation, sessionId: crypto.randomUUID(), baseRevision: result.recoveryRevision } })
        if (stopped) { store.close(); return }
        choices = await store.list()
        olderChoices = await store.listOtherGenerations()
        if (choices.length || olderChoices.length) emit({ status: "recovery", choices: [
          ...choices.map(({ sessionId, updatedAt }) => ({ sessionId, updatedAt })),
          ...olderChoices.map(({ sessionId, updatedAt, recovery }) => ({ sessionId, updatedAt, previousGeneration: true, complete: Boolean(recovery.snapshot) })),
        ] })
        else await start()
      } catch (error) {
        if (!stopped) emit({ status: "error", message: error instanceof Error ? error.message : "Could not open the editor. The saved file is unchanged." })
      }
    })().finally(() => { flight = null })
    return flight
  }
  async function close() {
    stopped = true
    stopAuth?.(); stopAuth = null
    await flight
    await reset()
    listeners.clear()
  }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    getSnapshot: () => state,
    open, recover: start,
    async exportRecovery(sessionId: string) {
      const actor = await client.auth.getUser()
      if (stopped || !opened || actor.error || actor.data.user?.id !== opened.actorId) throw new Error("Sign in with the original account to export this draft.")
      const choice = olderChoices.find(choice => choice.sessionId === sessionId)
      if (!choice) throw new Error("This recovery draft is unavailable.")
      return documentRecoveryExport(choice.recovery)
    },
    setActive(active: boolean) { state.session?.setActive(active) },
    retain() {
      owners++; releaseVersion++
      let released = false
      return () => {
        if (released) return
        released = true; owners--
        const ticket = ++releaseVersion
        queueMicrotask(() => { if (!owners && ticket === releaseVersion) void close().catch(() => undefined) })
      }
    },
    close,
  }
}
