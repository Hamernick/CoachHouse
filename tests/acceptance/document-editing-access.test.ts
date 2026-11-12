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
let client: { auth: { getUser: ReturnType<typeof vi.fn> }; rpc: ReturnType<typeof vi.fn> }
beforeEach(() => {
  vi.clearAllMocks()
  client = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: ORG } }, error: null })) }, rpc: vi.fn(async () => ({ data: false, error: null })) }
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
    expect(await loadDocumentWindowView({ source })).toEqual({ viewerId: ORG, editable: false, snapshot, shared: { state: "ready", room } })
    expect(mocks.read).toHaveBeenCalledWith(coachClient, source, ORG)
    expect(mocks.room).toHaveBeenCalledWith(client, source)
    expect(client.auth.getUser).toHaveBeenCalledOnce()
  })

  it("preserves complete saved source without bootstrapping a missing shared room", async () => {
    mocks.read.mockResolvedValue(snapshot)
    expect(await loadDocumentWindowView({ source })).toEqual({ viewerId: ORG, editable: false, snapshot, shared: { state: "absent" } })
    expect(mocks.read).toHaveBeenCalledOnce(); expect(mocks.room).toHaveBeenCalledOnce()
  })

  it("enables only current direct editing rights and faithfully supported Markdown", async () => {
    mocks.read.mockResolvedValue(snapshot)
    client.rpc.mockResolvedValue({ data: true, error: null })
    expect((await loadDocumentWindowView({ source })).editable).toBe(true)
    expect(client.rpc).toHaveBeenCalledWith("can_edit_uploaded_document", { p_file_id: FILE })
    mocks.read.mockResolvedValue({ ...snapshot, content: "<script>unsupported</script>" })
    expect((await loadDocumentWindowView({ source })).editable).toBe(false)
    mocks.read.mockResolvedValue(snapshot)
    client.rpc.mockResolvedValue({ data: true, error: { code: "42501" } })
    expect((await loadDocumentWindowView({ source })).editable).toBe(false)
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
    expect(mocks.read).toHaveBeenCalledWith(client, source, ORG)
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


const core = vi.hoisted(() => ({ capabilities: vi.fn(), profile: vi.fn(), copies: vi.fn() }))
vi.mock("@/lib/organization/document-capabilities", () => ({ resolveDocumentCapabilities: core.capabilities }))
vi.mock("@/lib/organization/profile-read", () => ({ readOrganizationProfileForProjection: core.profile }))
vi.mock("@/lib/organization/document-ai-copies", () => ({ filterAiDocumentCopies: core.copies }))
import { revalidateCoreDocuments } from "@/features/document-editing/core-access-actions"

describe("standalone native core document admission", () => {
  const input = { organizationId: ORG, userId: ORG, sectionIds: ["vision"] }
  beforeEach(() => {
    core.capabilities.mockResolvedValue({ access: { orgId: ORG, supabase: client }, capabilities: { canEdit: true } })
    core.profile.mockResolvedValue({ data: { profile: { roadmap: { sections: [{ id: "vision", content: "Never return this body" }] } } }, error: null })
    core.copies.mockImplementation(async entries => entries)
  })
  it("returns only actor-bound capabilities after parent, profile and source checks", async () => {
    expect(await revalidateCoreDocuments(input)).toEqual({ userId: ORG, organizationId: ORG, canEdit: true })
    expect(core.profile).toHaveBeenCalledWith(client, ORG, ORG, expect.any(AbortSignal))
    expect(core.copies).toHaveBeenCalledWith([{ id: "vision" }], ORG, ORG)
  })
  it("rejects malformed or excessive source lists before authentication", async () => {
    for (const sectionIds of [["../secret"], Array(101).fill("vision")]) await expect(revalidateCoreDocuments({ ...input, sectionIds })).rejects.toThrow()
    expect(mocks.client).not.toHaveBeenCalled()
  })
  it("rejects a changed or missing session before elevated source checks", async () => {
    client.auth.getUser.mockResolvedValue({ data: { user: { id: FILE } }, error: null })
    await expect(revalidateCoreDocuments(input)).rejects.toThrow()
    expect(core.capabilities).not.toHaveBeenCalled(); expect(core.profile).not.toHaveBeenCalled()
  })
  it("denies lost organization access and wrong organization scope before profile reads", async () => {
    core.capabilities.mockResolvedValueOnce({ error: "Forbidden" }).mockResolvedValueOnce({ access: { orgId: FILE }, capabilities: { canEdit: true } })
    await expect(revalidateCoreDocuments(input)).rejects.toThrow()
    await expect(revalidateCoreDocuments(input)).rejects.toThrow()
    expect(core.profile).not.toHaveBeenCalled()
  })
  it("fails closed on profile outage or missing organization", async () => {
    core.profile.mockResolvedValueOnce({ error: { code: "42501" }, data: null }).mockResolvedValueOnce({ data: null, error: null })
    await expect(revalidateCoreDocuments(input)).rejects.toThrow()
    await expect(revalidateCoreDocuments(input)).rejects.toThrow()
    expect(core.copies).not.toHaveBeenCalled()
  })
  it("rejects a deleted or replaced native source", async () => {
    await expect(revalidateCoreDocuments({ ...input, sectionIds: ["deleted-custom-section"] })).rejects.toThrow()
    core.profile.mockResolvedValue({ data: { profile: { roadmap: { sections: [{ id: "vision", documentSource: "google_drive", driveSource: { provider: "google_drive", fileId: "file", name: "File", webViewLink: "https://docs.google.com/document/d/file/edit" } }] } } }, error: null })
    await expect(revalidateCoreDocuments(input)).rejects.toThrow()
    expect(core.copies).not.toHaveBeenCalled()
  })
  it("rejects revoked retained-copy access and source-check outages", async () => {
    core.copies.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("Unavailable"))
    await expect(revalidateCoreDocuments(input)).rejects.toThrow()
    await expect(revalidateCoreDocuments(input)).rejects.toThrow()
  })
  it("deduplicates sources and returns current view-only capability", async () => {
    core.capabilities.mockResolvedValue({ access: { orgId: ORG, supabase: client }, capabilities: { canEdit: false } })
    expect((await revalidateCoreDocuments({ ...input, sectionIds: ["vision", "vision"] })).canEdit).toBe(false)
    expect(core.copies).toHaveBeenCalledWith([{ id: "vision" }], ORG, ORG)
  })
})
