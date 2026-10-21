import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { z } from "zod"
import { decodeDocumentRecovery, encodeDocumentRecovery, recoveryScopeSchema, type DocumentRecoveryScope, type DocumentRecoveryState } from "./document-recovery"

const DATABASE = "coach-house-document-recovery"
const OUTBOX = "outboxes"
const KEYS = "account-keys"
const storedSchema = recoveryScopeSchema.extend({
  iv: z.instanceof(Uint8Array).refine(value => value.byteLength === 12),
  ciphertext: z.instanceof(ArrayBuffer).refine(value => value.byteLength <= 6 * 1024 * 1024),
  updatedAt: z.iso.datetime(),
}).strict()
type StoredRecovery = z.infer<typeof storedSchema>
export interface DocumentRecoveryStore {
  save(value: DocumentRecoveryState): Promise<void>
  close(): void
}
function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    let blocked = false
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      database.createObjectStore(KEYS, { keyPath: "actorId" })
      const outbox = database.createObjectStore(OUTBOX, { keyPath: ["actorId", "sessionId"] })
      outbox.createIndex("document", ["actorId", "organizationId", "fileId", "generation"])
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => { blocked = true; reject(new Error("Close older document sessions before upgrading draft recovery.")) }
    request.onsuccess = () => { if (blocked) request.result.close(); else resolve(request.result) }
  })
}
function transact<T>(database: IDBDatabase, stores: string | string[], mode: IDBTransactionMode, operation: (transaction: IDBTransaction, result: (value: T) => void) => void) {
  return new Promise<T>((resolve, reject) => {
    let value: T
    let failure: unknown
    const transaction = database.transaction(stores, mode)
    transaction.oncomplete = () => resolve(value)
    transaction.onabort = transaction.onerror = () => reject(failure ?? transaction.error ?? new Error("Draft recovery storage failed."))
    try { operation(transaction, next => { value = next }) }
    catch (error) { failure = error; transaction.abort() }
  })
}
async function accountKey(database: IDBDatabase, actorId: string) {
  const candidate = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
  // One transaction chooses the winning key when tabs initialize concurrently.
  return transact<CryptoKey>(database, KEYS, "readwrite", (transaction, result) => {
    const store = transaction.objectStore(KEYS)
    const get = store.get(actorId)
    get.onsuccess = () => {
      const row: unknown = get.result
      if (row) {
        const parsed = z.object({ actorId: z.literal(actorId), key: z.custom<CryptoKey>(value =>
          typeof CryptoKey !== "undefined" && value instanceof CryptoKey && !value.extractable && value.type === "secret" && value.algorithm.name === "AES-GCM"
        ) }).safeParse(row)
        if (!parsed.success) { transaction.abort(); return }
        result(parsed.data.key)
      } else { store.put({ actorId, key: candidate }); result(candidate) }
    }
  })
}
function additionalData(scope: DocumentRecoveryScope) {
  const { actorId, organizationId, fileId, generation, sessionId, baseRevision } = scope
  return new TextEncoder().encode(JSON.stringify(recoveryScopeSchema.parse({ actorId, organizationId, fileId, generation, sessionId, baseRevision })))
}

/** Local cache of unacknowledged native updates, never the canonical source.
 * Verified account + generation scope; no plaintext source/title in storage.
 * Encryption does not make same-origin browser storage an XSS boundary. */
export async function openDocumentRecoveryStore({ client, scope: input }: {
  client: SupabaseClient<Database>
  scope: DocumentRecoveryScope
}) {
  const scope = recoveryScopeSchema.parse(input)
  const actor = await client.auth.getUser()
  if (actor.error || actor.data.user?.id !== scope.actorId) throw new Error("Sign in with the original account to recover this draft.")
  if (typeof indexedDB === "undefined" || !crypto.subtle) throw new Error("Secure local draft recovery is unavailable.")
  let unlocked = true
  let database: IDBDatabase | null = null
  const auth = client.auth.onAuthStateChange((_event, session) => {
    if (session?.user.id !== scope.actorId) { unlocked = false; database?.close() }
  })
  function assertUnlocked() { if (!unlocked) throw new Error("This draft is locked to its original account.") }
  function close() { unlocked = false; database?.close(); auth.data.subscription.unsubscribe() }
  try {
    database = await openDatabase()
    database.onversionchange = close
    assertUnlocked()
    const opened = database
    const key = await accountKey(opened, scope.actorId)
    assertUnlocked()
    const documentKey = [scope.actorId, scope.organizationId, scope.fileId, scope.generation]
    return {
      close,
      async list() {
        assertUnlocked()
        const rows = await transact<unknown[]>(opened, OUTBOX, "readonly", (transaction, result) => {
          const request = transaction.objectStore(OUTBOX).index("document").getAll(IDBKeyRange.only(documentKey), 21)
          request.onsuccess = () => result(request.result)
        })
        assertUnlocked()
        if (rows.length > 20) throw new Error("Too many pending drafts. Recover existing sessions before opening another.")
        const recovered = []
        for (const row of rows) {
          const entry = storedSchema.parse(row)
          if (entry.actorId !== scope.actorId || entry.organizationId !== scope.organizationId || entry.fileId !== scope.fileId || entry.generation !== scope.generation || entry.baseRevision !== scope.baseRevision)
            throw new Error("This recovery record belongs to another source revision.")
          const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(entry.iv).buffer, additionalData: additionalData(entry) }, key, entry.ciphertext)
          assertUnlocked()
          recovered.push({ sessionId: entry.sessionId, updatedAt: entry.updatedAt, recovery: decodeDocumentRecovery(new Uint8Array(plaintext)) })
        }
        return recovered.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      },
      async save(recovery: DocumentRecoveryState) {
        assertUnlocked()
        if (!recovery.batch && !recovery.tail) {
          await transact<void>(opened, OUTBOX, "readwrite", transaction => { transaction.objectStore(OUTBOX).delete([scope.actorId, scope.sessionId]) })
          assertUnlocked(); return
        }
        const encoded = encodeDocumentRecovery(recovery)
        const iv = crypto.getRandomValues(new Uint8Array(12))
        const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: additionalData(scope) }, key, encoded)
        assertUnlocked()
        const entry: StoredRecovery = storedSchema.parse({ ...scope, iv, ciphertext, updatedAt: new Date().toISOString() })
        await transact<void>(opened, OUTBOX, "readwrite", transaction => {
          const store = transaction.objectStore(OUTBOX)
          const count = store.index("document").count(IDBKeyRange.only(documentKey))
          count.onsuccess = () => {
            const existing = store.get([scope.actorId, scope.sessionId])
            existing.onsuccess = () => {
              const previous = existing.result ? storedSchema.safeParse(existing.result) : null
              if ((count.result >= 20 && !existing.result) || (previous && (!previous.success ||
                previous.data.organizationId !== scope.organizationId || previous.data.fileId !== scope.fileId ||
                previous.data.generation !== scope.generation || previous.data.baseRevision !== scope.baseRevision))) transaction.abort()
              else store.put(entry)
            }
          }
        })
        assertUnlocked()
      },
      async remove(sessionId: string) {
        assertUnlocked(); z.uuid().parse(sessionId)
        await transact<void>(opened, OUTBOX, "readwrite", transaction => {
          const store = transaction.objectStore(OUTBOX)
          const request = store.get([scope.actorId, sessionId])
          request.onsuccess = () => {
            if (!request.result) return
            const entry = storedSchema.safeParse(request.result)
            if (!entry.success || entry.data.organizationId !== scope.organizationId || entry.data.fileId !== scope.fileId || entry.data.generation !== scope.generation) transaction.abort()
            else store.delete([scope.actorId, sessionId])
          }
        })
        assertUnlocked()
      },
    }
  } catch (error) { close(); throw error }
}
