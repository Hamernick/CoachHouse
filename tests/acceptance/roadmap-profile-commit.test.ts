import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ client: vi.fn(), admin: vi.fn(), rpc: vi.fn(), sources: vi.fn(), scope: vi.fn(), access: vi.fn(), storage: vi.fn(), cleanup: vi.fn(), direct: vi.fn(), revalidate: vi.fn(), sharing: true }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("@/lib/organization/active-org", () => ({ resolveActiveOrganization: mocks.scope, canEditOrganization: (role: string) => ["owner", "admin", "staff"].includes(role) }))
vi.mock("@/lib/organization/document-access", () => ({ resolveOrganizationDocumentAccess: mocks.access }))
vi.mock("@/lib/organization/document-storage-access", () => ({ resolveOrganizationDocumentStorageAccess: mocks.storage, requireOrganizationDocumentStorage: mocks.storage }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate, revalidateTag: mocks.revalidate }))
vi.mock("@/lib/notifications", () => ({ createNotification: async () => ({ ok: true }) }))
vi.mock("@/lib/feature-flags", async importOriginal => ({ ...await importOriginal<object>(), get publicSharingEnabled() { return mocks.sharing } }))
import { saveRoadmapSectionAction, deleteRoadmapSectionAction, setRoadmapHeroImageAction, setRoadmapPublicAction } from "@/actions/roadmap"
import { commitRoadmapProfile } from "@/lib/organization/roadmap-profile-commit"
import { resolveRoadmapSections } from "@/lib/roadmap"

const org = "11111111-1111-4111-8111-111111111111", actor = "22222222-2222-4222-8222-222222222222"
const revision = "2026-11-06T12:00:00.123456+00:00"
let profile: Record<string, unknown>, currentRevision: string, missing: boolean
const input = { sectionId: "custom-fixture", expectedOrganizationId: org, expectedUserId: actor, expectedLastUpdated: revision, content: "<p>Edited</p>" }
const save = () => saveRoadmapSectionAction(input)
const remove = () => deleteRoadmapSectionAction(input.sectionId)
const hero = () => setRoadmapHeroImageAction(null)
beforeEach(() => {
  vi.clearAllMocks(); mocks.sharing = true; missing = false; currentRevision = revision
  profile = { name: "Retained organization", unrelated: { collaborator: "Keep" }, roadmap: { heroUrl: null, sections: [
    { id: input.sectionId, title: "Custom fixture", content: "<p>Original</p>", lastUpdated: revision },
    { id: "another-fixture", title: "Collaborator", content: "<p>Keep this</p>" },
  ] } }
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: async () => ({ data: missing ? null : { profile: structuredClone(profile), updated_at: currentRevision, public_slug: null }, error: null }), update: mocks.direct, insert: mocks.direct }
  const client = { auth: { getUser: async () => ({ data: { user: { id: actor } }, error: null }) }, from: () => query, storage: { from: () => ({ remove: mocks.cleanup }) } }
  mocks.client.mockResolvedValue(client)
  mocks.access.mockResolvedValue({ orgId: org, role: "admin", supportAccess: true, supabase: client })
  mocks.scope.mockResolvedValue({ orgId: org, role: "staff" })
  mocks.storage.mockResolvedValue({ hasStorageAccess: true, ok: true })
  mocks.sources.mockResolvedValue({ data: { blockedSectionIds: [], complete: false }, error: null })
  mocks.admin.mockReturnValue({ rpc: (name: string, args: unknown) => name === "read_workspace_ai_document_copy_sources" ? mocks.sources(name, args) : mocks.rpc(name, args) })
  mocks.rpc.mockImplementation(async (_name, args) => {
    if (!missing && args.p_expected_updated_at !== currentRevision) return { data: false, error: null }
    profile = args.p_profile
    return { data: true, error: null }
  })
})
describe("canonical roadmap profile writes", () => {
  it.each([
    ["save", save], ["delete", remove],
    ["stale conflict", () => saveRoadmapSectionAction({ ...input, expectedLastUpdated: "old" })],
    ["creation replay", () => saveRoadmapSectionAction({ ...input, createOnly: true, expectedLastUpdated: null })],
  ])("withholds blocked saved content before %s, cleanup or commit", async (_label, action) => {
    const before = structuredClone(profile)
    mocks.sources.mockResolvedValue({ data: { blockedSectionIds: [input.sectionId], complete: false }, error: null })
    expect(await action()).toEqual({ error: "Document access changed. Reopen the document before saving." })
    expect(mocks.sources).toHaveBeenCalledWith("read_workspace_ai_document_copy_sources", {
      p_org_id: org, p_actor_id: actor, p_section_ids: [input.sectionId],
    })
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.cleanup).not.toHaveBeenCalled()
    expect(mocks.revalidate).not.toHaveBeenCalled()
    expect(profile).toEqual(before)
  })
  it("fails closed on source outage without disclosing private error details", async () => {
    mocks.sources.mockRejectedValue(new Error("private database detail"))
    expect(await save()).toEqual({ error: "Document sources could not be verified. Try again." })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("rechecks on retry and preserves other documents through revoke and recovery", async () => {
    const before = structuredClone(profile)
    mocks.sources.mockResolvedValueOnce({ data: { blockedSectionIds: [input.sectionId], complete: false }, error: null })
    expect(await save()).toHaveProperty("error")
    expect(profile).toEqual(before)
    expect(await save()).toHaveProperty("section")
    expect(resolveRoadmapSections(profile).find(section => section.id === "another-fixture")?.content).toBe("<p>Keep this</p>")
    expect(mocks.sources).toHaveBeenCalledTimes(2)
    expect(mocks.rpc).toHaveBeenCalledOnce()
  })

  it.each([save, remove, hero])("uses verified identity and precise profile CAS for %s", async action => {
    expect(await action()).not.toHaveProperty("error")
    expect(mocks.admin).toHaveBeenCalledWith({ actorId: actor, requestTimeoutMs: 15000 })
    expect(mocks.rpc).toHaveBeenCalledWith("commit_roadmap_profile", expect.objectContaining({ p_org: org, p_expected_updated_at: revision, p_support: false, p_require_storage: true }))
    expect(profile.unrelated).toEqual({ collaborator: "Keep" })
    expect(resolveRoadmapSections(profile).find(section => section.id === "another-fixture")?.content).toBe("<p>Keep this</p>")
    expect(mocks.direct).not.toHaveBeenCalled()
  })
  it("reopens a saved document and preserves unrelated content after deletion", async () => {
    expect(await save()).toHaveProperty("section")
    expect(resolveRoadmapSections(profile).find(section => section.id === input.sectionId)?.content).toBe(input.content)
    expect(await remove()).toEqual({ ok: true })
    expect(resolveRoadmapSections(profile).some(section => section.id === input.sectionId)).toBe(false)
    expect(profile.unrelated).toEqual({ collaborator: "Keep" })
  })
  it.each([save, remove, hero])("rejects changed permission without cleanup or success invalidation for %s", async action => {
    const before = structuredClone(profile)
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } })
    expect(await action()).toHaveProperty("error", "Document access changed. Reopen the document before saving.")
    expect(profile).toEqual(before)
    expect(mocks.cleanup).not.toHaveBeenCalled()
    expect(mocks.revalidate).not.toHaveBeenCalled()
    expect(mocks.rpc).toHaveBeenCalledOnce()
  })
  it.each([save, remove, hero])("reports a profile conflict without retry for %s", async action => {
    mocks.rpc.mockResolvedValue({ data: false, error: null })
    expect(await action()).toHaveProperty("error")
    expect(mocks.rpc).toHaveBeenCalledOnce()
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it("retains the collaborator version on conflict instead of replaying a stale whole profile", async () => {
    mocks.rpc.mockImplementation(async () => {
      profile = { ...profile, otherConcurrentField: "New value" }
      return { data: null, error: { code: "40001" } }
    })
    expect(await save()).toMatchObject({ code: "conflict", currentSection: { content: "<p>Original</p>" } })
    expect(profile.otherConcurrentField).toBe("New value")
    expect(mocks.rpc).toHaveBeenCalledOnce()
  })
  it("passes support only from resolved server access", async () => {
    mocks.scope.mockResolvedValue({ orgId: org, role: "admin", supportAccess: true })
    expect(await save()).toHaveProperty("section")
    expect(mocks.rpc).toHaveBeenCalledWith("commit_roadmap_profile", expect.objectContaining({ p_support: true }))
  })
  it.each([save, remove, hero])("rejects read-only membership before an elevated write for %s", async action => {
    mocks.scope.mockResolvedValue({ orgId: org, role: "member" })
    expect(await action()).toEqual({ error: "Forbidden" })
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("uses create CAS when initializing a missing owner profile", async () => {
    missing = true
    expect(await saveRoadmapSectionAction({ content: "<p>First</p>" })).toHaveProperty("section")
    expect(mocks.rpc).toHaveBeenCalledWith("commit_roadmap_profile", expect.objectContaining({ p_expected_updated_at: null }))
    expect(mocks.direct).not.toHaveBeenCalled()
  })
  it.each([null, {}, "true", 1])("does not interpret an invalid acknowledgment as success: %j", async data => {
    mocks.rpc.mockResolvedValue({ data, error: null })
    expect(await save()).toHaveProperty("error", "Unable to confirm this save. Reload before trying again.")
    expect(mocks.rpc).toHaveBeenCalledOnce()
  })
  it("does not retry an unknown result or throw away the caller's edits", async () => {
    mocks.rpc.mockRejectedValue(new Error("Response lost"))
    expect(await save()).toHaveProperty("error", "Unable to confirm this save. Reload before trying again.")
    expect(mocks.rpc).toHaveBeenCalledOnce()
    expect(input.content).toBe("<p>Edited</p>")
  })
  it("defaults storage enforcement on at the internal adapter", async () => {
    expect(await commitRoadmapProfile({ actorId: actor, organizationId: org, expectedUpdatedAt: revision, profile, supportAccess: false })).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenCalledWith("commit_roadmap_profile", expect.objectContaining({ p_require_storage: true }))
  })
})


describe("roadmap publication authority", () => {
  beforeEach(() => {
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { status: "active", updated_at: revision, public_slug: "reviewed-roadmap" }, error: null }), upsert: mocks.direct }
    mocks.client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: actor } }, error: null }) }, from: () => query })
    mocks.rpc.mockResolvedValue({ data: true, error: null })
  })
  it.each([true, false])("changes only visibility using exact server revision and actor: %s", async next => {
    expect(await setRoadmapPublicAction(next)).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("commit_roadmap_publication", {
      p_org: org, p_expected_updated_at: revision, p_public: next, p_support: false,
    })
    expect(mocks.admin).toHaveBeenCalledWith({ actorId: actor, requestTimeoutMs: 15000 })
    expect(mocks.direct).not.toHaveBeenCalled()
    expect(mocks.revalidate).toHaveBeenCalledWith("/reviewed-roadmap/roadmap")
  })
  it("retains the launch gate", async () => {
    mocks.sharing = false
    expect(await setRoadmapPublicAction(true)).toHaveProperty("error", "Public sharing is disabled until launch.")
    expect(mocks.client).not.toHaveBeenCalled()
  })
  it("rejects non-boolean wire input", async () => {
    expect(await setRoadmapPublicAction("true" as unknown as boolean)).toHaveProperty("error", "Invalid sharing setting.")
    expect(mocks.client).not.toHaveBeenCalled()
  })
  it("rejects read-only access", async () => {
    mocks.scope.mockResolvedValue({ orgId: org, role: "member" })
    expect(await setRoadmapPublicAction(true)).toHaveProperty("error", "Forbidden")
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("passes resolved support access without granting it from the client", async () => {
    mocks.scope.mockResolvedValue({ orgId: org, role: "admin", supportAccess: true })
    expect(await setRoadmapPublicAction(true)).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenCalledWith("commit_roadmap_publication", expect.objectContaining({ p_support: true }))
  })
  it.each([
    [false, null, "This roadmap changed. Reload before changing sharing."],
    [null, { code: "40001" }, "This roadmap changed. Reload before changing sharing."],
    [null, { code: "42501" }, "Roadmap access changed. Reload before changing sharing."],
    [null, { code: "57014" }, "Unable to confirm this change. Reload before trying again."],
    [null, null, "Unable to confirm this change. Reload before trying again."],
    [{ ok: true }, null, "Unable to confirm this change. Reload before trying again."],
    ["true", null, "Unable to confirm this change. Reload before trying again."],
  ])("withholds success and never retries an unconfirmed write: %j", async (data, error, message) => {
    mocks.rpc.mockResolvedValue({ data, error })
    expect(await setRoadmapPublicAction(true)).toEqual({ error: message })
    expect(mocks.rpc).toHaveBeenCalledOnce()
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it("does not retry after a lost response", async () => {
    mocks.rpc.mockRejectedValue(new Error("lost response"))
    expect(await setRoadmapPublicAction(true)).toHaveProperty("error", "Unable to confirm this change. Reload before trying again.")
    expect(mocks.rpc).toHaveBeenCalledOnce()
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it.each([null, { public_slug: "missing-revision" }])("requires an existing versioned organization: %j", async data => {
    const client = await mocks.client()
    client.from = (table: string) => {
      const query = { select: () => query, eq: () => query, order: () => query, limit: () => query,
        maybeSingle: async () => ({ data: table === "subscriptions" ? { status: "active" } : data, error: null }) }
      return query
    }
    expect(await setRoadmapPublicAction(true)).toHaveProperty("error", "Unable to load this roadmap. Reload before changing sharing.")
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
