import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadDocumentEditing, loadDocumentFileView, loadDocumentWindowView } from "@/features/document-editing/server/actions"

const mocks = vi.hoisted(() => ({ client: vi.fn(), access: vi.fn(), read: vi.fn(), room: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }))
vi.mock("@/lib/organization/document-access", () => ({ resolveOrganizationDocumentAccess: mocks.access }))
vi.mock("@/features/document-editing/server/read-local-document", () => ({ readLocalDocument: mocks.read }))
vi.mock("@/features/document-editing/lib/room-client", () => ({ readDocumentRoom: mocks.room }))
const ORG = "00000000-0000-4000-8000-000000000001"
const FILE = "00000000-0000-4000-8000-000000000002"
const source = { provider: "coach_house" as const, organizationId: ORG, fileId: FILE }
let client: { auth: { getUser: ReturnType<typeof vi.fn> } }
beforeEach(() => {
  vi.clearAllMocks()
  client = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: ORG } }, error: null })) } }
  mocks.client.mockResolvedValue(client)
  mocks.access.mockResolvedValue({ orgId: ORG, supabase: client, role: "admin" })
  mocks.read.mockResolvedValue({ content: "Full source" })
  mocks.room.mockResolvedValue(null)
})

describe("read-only shared window discovery", () => {
  const snapshot = { source, name: "notes.md", format: "markdown", revision: "r1", updatedAt: "2026-10-14T00:00:00Z", content: "Complete source", collaboration: { state: "unavailable", canCommit: false } }
  const room = { id: ORG, org_id: ORG, file_id: FILE, generation: FILE, base_revision: "r1", base_updated_at: snapshot.updatedAt, checkpoint: "\\x0000", checkpoint_sequence: 0, last_sequence: 0, canonical_sequence: 0, recovery_bytes: 0 }

  it("reads only existing rooms under the real session even when saved-source access uses coach scope", async () => {
    const coachClient = { scoped: true }
    mocks.read.mockResolvedValue(snapshot); mocks.room.mockResolvedValue(room)
    mocks.access.mockResolvedValue({ orgId: ORG, supabase: coachClient, role: "admin" })
    expect(await loadDocumentWindowView({ source })).toEqual({ viewerId: ORG, snapshot, shared: { state: "ready", room } })
    expect(mocks.read).toHaveBeenCalledWith(coachClient, source)
    expect(mocks.room).toHaveBeenCalledWith(client, source)
    expect(client.auth.getUser).toHaveBeenCalledOnce()
  })

  it("preserves complete saved source without bootstrapping a missing shared room", async () => {
    mocks.read.mockResolvedValue(snapshot)
    expect(await loadDocumentWindowView({ source })).toEqual({ viewerId: ORG, snapshot, shared: { state: "absent" } })
    expect(mocks.read).toHaveBeenCalledOnce(); expect(mocks.room).toHaveBeenCalledOnce()
  })

  it("labels direct-RLS errors and stale room metadata as saved-file fallback", async () => {
    mocks.read.mockResolvedValue(snapshot); mocks.room.mockRejectedValueOnce(new Error("Forbidden"))
    expect((await loadDocumentWindowView({ source })).shared).toEqual({ state: "unavailable" })
    mocks.room.mockResolvedValueOnce({ ...room, base_updated_at: "2026-10-13T00:00:00Z" })
    expect((await loadDocumentWindowView({ source })).shared).toEqual({ state: "unavailable" })
  })
})

describe("explicit document open authorization", () => {
  it("includes the verified viewer without a second auth or source read",async()=>{
    expect(await loadDocumentFileView({source})).toEqual({viewerId:ORG,snapshot:{content:"Full source"}})
    expect(client.auth.getUser).toHaveBeenCalledOnce();expect(mocks.read).toHaveBeenCalledOnce()
  })
  it("reuses the active authorized organization and performs one logical load", async () => {
    await expect(loadDocumentEditing({ source })).resolves.toEqual({ content: "Full source" })
    expect(client.auth.getUser).toHaveBeenCalledOnce()
    expect(mocks.access).toHaveBeenCalledOnce()
    expect(mocks.read).toHaveBeenCalledWith(client, source)
    expect(mocks.read).toHaveBeenCalledOnce()
  })
  it("rejects malformed identity before requesting a session or file", async () => {
    await expect(loadDocumentEditing({ source: { ...source, fileId: "private/storage/path" } })).rejects.toThrow()
    expect(mocks.client).not.toHaveBeenCalled()
    expect(mocks.read).not.toHaveBeenCalled()
  })
  it("rejects unsigned access before resolving organization or storage", async () => {
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    await expect(loadDocumentEditing({ source })).rejects.toThrow("Sign in")
    expect(mocks.access).not.toHaveBeenCalled()
    expect(mocks.read).not.toHaveBeenCalled()
  })
  it("checks explicit access when the requested organization is not active", async () => {
    mocks.access.mockResolvedValueOnce({ orgId: FILE, supabase: client, role: "admin" }).mockResolvedValueOnce({ error: "Forbidden" })
    await expect(loadDocumentEditing({ source })).rejects.toThrow("access")
    expect(mocks.access).toHaveBeenLastCalledWith(client, ORG, ORG)
    expect(mocks.read).not.toHaveBeenCalled()
  })
  it("does not use a scoped client belonging to a different organization", async () => {
    mocks.access.mockResolvedValue({ orgId: FILE, supabase: client, role: "admin" })
    await expect(loadDocumentEditing({ source })).rejects.toThrow("access")
    expect(mocks.read).not.toHaveBeenCalled()
  })
  it("does not substitute a local writer or download for an unimplemented Drive adapter", async () => {
    await expect(loadDocumentEditing({ source: { provider: "google_drive", organizationId: ORG, attachmentId: FILE } })).rejects.toThrow("provider collaboration adapter")
    expect(mocks.read).not.toHaveBeenCalled()
  })
})
