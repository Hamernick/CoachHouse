import { afterEach, describe, expect, it, vi } from "vitest"
import * as Y from "yjs"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import type { DocumentRoomTransport } from "@/features/document-editing/lib/room-sync"
import type { DocumentWindowView } from "@/features/document-editing/lib/window-contracts"
import { documentWindowSchema } from "@/features/document-editing/lib/window-contracts"
import { createDocumentWindowOwner } from "@/features/document-editing/lib/window-owner"
import { DocumentRoomError } from "@/features/document-editing/lib/room-client"

const mocks = vi.hoisted(() => ({ transport: vi.fn() }))
vi.mock("@/features/document-editing/lib/room-realtime", () => ({ createSupabaseDocumentTransport: mocks.transport }))
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const source = { provider: "coach_house" as const, organizationId: id(1), fileId: id(2) }
const snapshot = {
  source, name: "notes.md", format: "markdown" as const, revision: "r1",
  updatedAt: "2026-10-14T00:00:00Z", content: "Complete original",
  collaboration: { state: "unavailable" as const, canCommit: false as const },
}
const cleanups: (() => void)[] = []
async function settle() { for (let i = 0; i < 40; i++) await Promise.resolve() }
afterEach(async () => { for (const cleanup of cleanups.splice(0)) cleanup(); await settle(); vi.clearAllMocks() })

function fixture(shared = true) {
  const document = new Y.Doc()
  document.getText("content").insert(0, "Shared draft")
  const room = {
    id: id(4), org_id: source.organizationId, file_id: source.fileId, generation: id(5),
    base_revision: "r1", base_updated_at: snapshot.updatedAt,
    checkpoint: "\\x" + Buffer.from(Y.encodeStateAsUpdate(document)).toString("hex"),
    checkpoint_sequence: 0, last_sequence: 0, canonical_sequence: 0, recovery_bytes: 0,
  }
  let onAuth!: (event: string, session: { user: { id: string } } | null) => void
  const unsubscribe = vi.fn()
  const client = { auth: {
    getSession: vi.fn(async () => ({ data: { session: { user: { id: id(3) } } }, error: null })),
    onAuthStateChange: (callback: typeof onAuth) => { onAuth = callback; return { data: { subscription: { unsubscribe } } } },
  } } as unknown as SupabaseClient<Database>
  const stop = vi.fn()
  let handlers!: Parameters<DocumentRoomTransport["subscribe"]>[0]
  const transport: DocumentRoomTransport = {
    subscribe: vi.fn(value => { handlers = value; queueMicrotask(value.connected); return stop }),
    read: vi.fn(async () => ({ room, editable: true })), tail: vi.fn(async () => []),
  }
  mocks.transport.mockReturnValue(transport)
  const view: DocumentWindowView = { viewerId: id(3), snapshot, shared: shared ? { state: "ready", room } : { state: "absent" } }
  const load = vi.fn(async (): Promise<DocumentWindowView> => view)
  const owner = createDocumentWindowOwner({ source, client, load })
  cleanups.push(() => { owner.close(); document.destroy() })
  return { owner, load, view, room, transport, stop, unsubscribe, revoke: () => handlers.locked(), change: (actor: string | null) => onAuth("SIGNED_IN", actor ? { user: { id: actor } } : null) }
}

describe("read-only retained shared file window", () => {
  it("opens existing shared state without enabling edits or duplicating the owner", async () => {
    const f = fixture()
    await Promise.all([f.owner.open(), f.owner.open()]); await settle()
    const session = f.owner.getSnapshot().session!
    expect(session.getSnapshot()).toMatchObject({ status: "ready", editable: false, pending: false })
    expect(session.getSnapshot().replica!.document.getText("content").toString()).toBe("Shared draft")
    expect(f.load).toHaveBeenCalledOnce()
    expect(mocks.transport).toHaveBeenCalledOnce()
    expect(mocks.transport).toHaveBeenCalledWith(expect.objectContaining({ actorId: id(3), watchVersions: true }))
    await session.flush()
    expect(session.getSnapshot().editable).toBe(false)
  })

  it("pauses hidden transport and resumes the same session and replica", async () => {
    const f = fixture(); await f.owner.open(); await settle()
    const session = f.owner.getSnapshot().session!, replica = session.getSnapshot().replica
    f.owner.setActive(false)
    expect(session.getSnapshot().status).toBe("paused"); expect(f.stop).toHaveBeenCalledOnce()
    f.owner.setActive(true); await settle()
    expect(f.owner.getSnapshot().session).toBe(session)
    expect(session.getSnapshot().replica).toBe(replica)
    expect(f.load).toHaveBeenCalledOnce()
  })

  it("retains the complete source without opening a transport when no shared room exists", async () => {
    const f = fixture(false); await f.owner.open()
    expect(f.owner.getSnapshot()).toMatchObject({ status: "ready", snapshot, session: null, sharedUnavailable: false })
    expect(mocks.transport).not.toHaveBeenCalled()
  })

  it("explicitly distinguishes saved-source fallback from an unavailable shared draft", async () => {
    const f = fixture(false); f.view.shared = { state: "unavailable" }; await f.owner.open()
    expect(f.owner.getSnapshot()).toMatchObject({ status: "ready", snapshot, session: null, sharedUnavailable: true })
    expect(mocks.transport).not.toHaveBeenCalled()
  })

  it("shows the saved-source fallback when browser authorization blocks initial shared loading", async () => {
    const f = fixture()
    vi.mocked(f.transport.read).mockRejectedValueOnce(new DocumentRoomError("access", "Forbidden"))
    await f.owner.open(); await settle()
    expect(f.owner.getSnapshot()).toMatchObject({ status: "ready", snapshot, sharedUnavailable: true })
    expect(f.owner.getSnapshot().session!.getSnapshot().editable).toBe(false)
  })

  it("retains saved fallback during a transient retry, then exposes the same recovered session", async () => {
    const f = fixture()
    vi.mocked(f.transport.read).mockRejectedValueOnce(new DocumentRoomError("unavailable", "Offline"))
    await f.owner.open(); await settle()
    const session = f.owner.getSnapshot().session
    expect(f.owner.getSnapshot().sharedUnavailable).toBe(true)
    const retry = f.owner.retry()
    expect(f.owner.getSnapshot().sharedUnavailable).toBe(true)
    await retry; await settle()
    expect(f.owner.getSnapshot()).toMatchObject({ session, sharedUnavailable: false })
    expect(f.load).toHaveBeenCalledOnce()
  })

  it("hides both source and shared session immediately on account change, even while minimized", async () => {
    const f = fixture(); await f.owner.open(); await settle()
    const session = f.owner.getSnapshot().session!
    f.owner.setActive(false); f.change(id(9))
    expect(f.owner.getSnapshot()).toMatchObject({ status: "locked", snapshot: null, session: null })
    await settle(); expect(session.getSnapshot().status).toBe("closed")
    await f.owner.retry(); expect(f.load).toHaveBeenCalledOnce()
  })

  it("never creates a shared session from a late response belonging to another viewer", async () => {
    const f = fixture(); f.view.viewerId = id(9)
    await f.owner.open()
    expect(f.owner.getSnapshot()).toMatchObject({ status: "locked", snapshot: null, session: null })
    expect(mocks.transport).not.toHaveBeenCalled()
  })

  it("clears saved-source actions too when an established shared session loses access", async () => {
    const f = fixture(); await f.owner.open(); await settle(); f.revoke()
    expect(f.owner.getSnapshot()).toMatchObject({ status: "locked", snapshot: null, session: null })
    await f.owner.retry(); expect(f.load).toHaveBeenCalledOnce()
  })

  it("survives Strict Mode retain/release replay and closes only after actual unmount", async () => {
    const f = fixture(); const releaseFirst = f.owner.retain(); const opening = f.owner.open()
    releaseFirst(); const release = f.owner.retain(); await opening; await settle()
    const session = f.owner.getSnapshot().session!
    expect(session.getSnapshot().status).toBe("ready")
    expect(f.load).toHaveBeenCalledOnce()
    release(); await settle()
    expect(session.getSnapshot().status).toBe("closed")
    expect(f.owner.getSnapshot().snapshot).toBeNull()
    expect(f.unsubscribe).toHaveBeenCalledOnce()
  })

  it("ignores a late server completion after unmount without starting a subscription", async () => {
    const f = fixture(); let finish!: (value: DocumentWindowView) => void
    f.load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const opening = f.owner.open(); await settle(); f.owner.close(); finish(f.view); await opening
    expect(f.owner.getSnapshot().snapshot).toBeNull(); expect(mocks.transport).not.toHaveBeenCalled()
  })

  it("rejects cross-file and stale-source shared envelopes instead of binding the wrong replica", () => {
    const f = fixture()
    expect(documentWindowSchema.safeParse(f.view).success).toBe(true)
    expect(documentWindowSchema.safeParse({ ...f.view, shared: { state: "ready", room: { ...f.room, file_id: id(8) } } }).success).toBe(false)
    expect(documentWindowSchema.safeParse({ ...f.view, shared: { state: "ready", room: { ...f.room, base_updated_at: "invalid" } } }).success).toBe(false)
  })
})
