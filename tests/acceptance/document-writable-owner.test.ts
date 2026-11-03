import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as Y from "yjs"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import type { DocumentRoomTransport } from "@/features/document-editing/lib/room-sync"
import { createWritableDocumentOwner } from "@/features/document-editing/lib/writable-owner"

const mocks = vi.hoisted(() => ({ open: vi.fn(), save: vi.fn(), store: vi.fn(), transport: vi.fn() }))
vi.mock("@/features/document-editing/actions", () => ({ openWritableDocument: mocks.open, saveUploadedDocument: mocks.save }))
vi.mock("@/features/document-editing/lib/recovery-storage", () => ({ openDocumentRecoveryStore: mocks.store }))
vi.mock("@/features/document-editing/lib/room-realtime", () => ({ createSupabaseDocumentTransport: mocks.transport }))
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const source = { provider: "coach_house" as const, organizationId: id(1), fileId: id(2) }
const cleanup: (() => Promise<void>)[] = []
async function settle() { for (let i = 0; i < 80; i++) await Promise.resolve() }
beforeEach(() => vi.clearAllMocks())
afterEach(async () => { for (const close of cleanup.splice(0)) await close().catch(() => undefined) })
function fixture() {
  const seed = new Y.Doc(); seed.getText("content").insert(0, "Original")
  const room = { id: id(3), org_id: id(1), file_id: id(2), generation: id(4), base_revision: "original",
    base_updated_at: "2026-10-14T00:00:00Z", checkpoint: "\\x" + Buffer.from(Y.encodeStateAsUpdate(seed)).toString("hex"),
    checkpoint_sequence: 0, last_sequence: 0, canonical_sequence: 0, recovery_bytes: 0 }
  seed.destroy()
  let auth!: (event: string, session: { user: { id: string } } | null) => void
  const client = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: id(5) } }, error: null })),
    onAuthStateChange: vi.fn(callback => { auth = callback; return { data: { subscription: { unsubscribe: vi.fn() } } } }),
  } } as unknown as SupabaseClient<Database>
  const store = { close: vi.fn(), listOtherGenerations: vi.fn(async () => [] as { sessionId: string; updatedAt: string; recovery: { batch: null; tail: Uint8Array | null; snapshot?: Uint8Array } }[]), list: vi.fn(async () => [] as { sessionId: string; updatedAt: string; recovery: { batch: null; tail: Uint8Array | null } }[]), save: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) }
  const transport: DocumentRoomTransport = { subscribe: vi.fn(handlers => { queueMicrotask(handlers.connected); return vi.fn() }),
    read: vi.fn(async () => ({ room, editable: true })), tail: vi.fn(async () => []) }
  mocks.open.mockResolvedValue({ source, room, actorId: id(5), editable: true, recoveryRevision: "original" })
  mocks.store.mockResolvedValue(store); mocks.transport.mockReturnValue(transport)
  const owner = createWritableDocumentOwner(source, client)
  cleanup.push(() => owner.close())
  return { owner, store, client, changeAccount: () => auth("SIGNED_IN", { user: { id: id(9) } }) }
}

describe("explicit uploaded-file writable owner", () => {
  it("does not bootstrap or write while merely viewing and survives Strict Mode retain replay", async () => {
    const f = fixture(); const release = f.owner.retain(); release(); const releaseAgain = f.owner.retain()
    await settle()
    expect(mocks.open).not.toHaveBeenCalled(); expect(mocks.store).not.toHaveBeenCalled()
    await f.owner.open(); await settle()
    expect(f.owner.getSnapshot().session?.getSnapshot().editable).toBe(true)
    expect(mocks.save).not.toHaveBeenCalled()
    releaseAgain()
  })
  it("requires a recovery choice and keeps the old encrypted record until replay is durable", async () => {
    const f = fixture()
    const draft = new Y.Doc(); draft.getText("recovered").insert(0, "Local draft")
    f.store.list.mockResolvedValue([{ sessionId: id(7), updatedAt: "2026-11-02T00:00:00Z", recovery: { batch: null, tail: Y.encodeStateAsUpdate(draft) } }]); draft.destroy()
    await f.owner.open(); await settle()
    expect(f.owner.getSnapshot().status).toBe("recovery")
    expect(mocks.transport).not.toHaveBeenCalled(); expect(f.store.remove).not.toHaveBeenCalled()
    await f.owner.recover(id(7)); await settle()
    expect(f.owner.getSnapshot().session?.getSnapshot().replica?.document.getText("recovered").toString()).toBe("Local draft")
    expect(f.store.save).toHaveBeenCalled(); expect(f.store.remove).toHaveBeenCalledWith(id(7))
    expect(f.store.save.mock.invocationCallOrder[0]).toBeLessThan(f.store.remove.mock.invocationCallOrder[0])
  })
  it("locks old content and refuses reopening/recovery after account change", async () => {
    const f = fixture(); await f.owner.open(); await settle(); f.changeAccount()
    expect(f.owner.getSnapshot().status).toBe("locked")
    expect(f.store.close).toHaveBeenCalled()
    await f.owner.open(); await f.owner.recover(); expect(mocks.open).toHaveBeenCalledOnce()
    expect(f.owner.getSnapshot().session?.getSnapshot().editable).toBe(false)
  })
  it("does not destroy a draft when the close durability barrier fails", async () => {
    const f = fixture(); await f.owner.open(); await settle()
    const session = f.owner.getSnapshot().session!
    f.store.save.mockRejectedValue(new Error("Storage full"))
    session.getSnapshot().replica!.document.getText("content").insert(0, "Retain me ")
    await expect(f.owner.close()).rejects.toThrow("Storage full")
    expect(session.getSnapshot().replica!.document.getText("content").toString()).toContain("Retain me")
    expect(session.getSnapshot().status).not.toBe("closed")
    f.store.save.mockResolvedValue(undefined)
  })
  it("offers old-generation data for export without replay and rejects another account", async () => {
    const f = fixture()
    const legacy = new Y.Doc(); legacy.getText("legacy").insert(0, "Keep old edits")
    f.store.listOtherGenerations.mockResolvedValue([{ sessionId: id(8), updatedAt: "2026-11-01T00:00:00Z", recovery: { batch: null, tail: Y.encodeStateAsUpdate(legacy) } }]); legacy.destroy()
    await f.owner.open()
    expect(f.owner.getSnapshot().choices).toEqual([{ sessionId: id(8), updatedAt: "2026-11-01T00:00:00Z", previousGeneration: true, complete: false }])
    await expect(f.owner.recover(id(8))).rejects.toThrow("unavailable")
    expect(mocks.transport).not.toHaveBeenCalled()
    const exported = await f.owner.exportRecovery(id(8))
    expect(exported.name).toBe("document-recovery-data.json")
    expect(JSON.parse(exported.content).tail).toBeTruthy()
    expect(f.store.remove).not.toHaveBeenCalled()
    f.changeAccount()
    await expect(f.owner.exportRecovery(id(8))).rejects.toThrow("original account")
  })

})
