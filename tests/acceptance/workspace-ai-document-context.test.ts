import { beforeEach, describe, expect, it, vi } from "vitest"
import { listAiDocuments, loadAiDocument, loadAiDocumentSource } from "@/features/workspace-ai/server/document-context"
import { readWorkspaceAiProposal } from "@/features/workspace-ai/server/actions"
import { assertAiDocumentSources } from "@/features/workspace-ai/server/document-source-access"
import { loadAiRevisionContext } from "@/features/workspace-ai/server/revision-context"
const mocks = vi.hoisted(() => ({ copies: vi.fn(), rpc: vi.fn(), read: vi.fn(), client: vi.fn(), org: vi.fn(), storage: vi.fn(), query: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: (name: string, args: unknown) => name === "read_workspace_ai_document_copy_sources" ? mocks.copies(args) : mocks.rpc(name, args) }) }))
vi.mock("@/features/ai-credits", () => ({ readAiRun: mocks.read }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }))
vi.mock("@/lib/organization/active-org", () => ({ resolveActiveOrganization: mocks.org, canEditOrganization: (role: string) => role === "owner" }))
vi.mock("@/lib/organization/document-storage-access", () => ({ requireOrganizationDocumentStorage: mocks.storage }))
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const scope = { userId: id(1), organizationId: id(2) }
const revision = "2026-10-22T12:00:00Z"
let profile: Record<string, unknown>
beforeEach(() => {
  vi.clearAllMocks()
  mocks.copies.mockReset().mockResolvedValue({ data: { blockedSectionIds: [], complete: false }, error: null })
  mocks.rpc.mockReset().mockResolvedValue({ data: { sources: [{ runId: id(3), sectionId: "vision", kind: "editor" }], complete: false }, error: null })
  profile = { roadmap: { sections: [{ id: "vision", title: "Vision", content: "<p>Safe community spaces.</p>", lastUpdated: revision }] } }
  const query = { select: vi.fn().mockReturnThis(), eq: mocks.query, single: async () => ({ data: { profile }, error: null }) }
  mocks.query.mockReturnValue(query)
  mocks.client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: scope.userId } }, error: null }) }, from: () => query })
  mocks.org.mockResolvedValue({ orgId: scope.organizationId, role: "owner" })
  mocks.storage.mockResolvedValue({ allowed: true })
})
describe("selected AI document context", () => {
  it("lists metadata only in the current organization and loads a selected saved revision", async () => {
    const options = await listAiDocuments(scope)
    expect(options).toContainEqual({ sectionId: "vision", title: "Vision", revision })
    expect(JSON.stringify(options)).not.toContain("Safe community")
    expect(options.some(item => ["budget", "calendar"].includes(item.sectionId))).toBe(false)
    const loaded = await loadAiDocument({ ...scope, sectionId: "vision", title: "Client title", revision })
    expect(loaded.section.content).toBe("<p>Safe community spaces.</p>")
    expect(loaded.section.title).toBe("Vision")
    expect(mocks.query).toHaveBeenCalledWith("user_id", scope.organizationId)
  })
  it("blocks forged users, other organizations, read-only members and missing storage access", async () => {
    await expect(listAiDocuments({ ...scope, userId: id(3) })).rejects.toThrow("Sign in")
    await expect(listAiDocuments({ ...scope, organizationId: id(3) })).rejects.toThrow("current organization")
    mocks.org.mockResolvedValueOnce({ orgId: scope.organizationId, role: "viewer" })
    await expect(listAiDocuments(scope)).rejects.toThrow("current organization")
    mocks.storage.mockResolvedValueOnce({ error: "Storage access required" })
    await expect(listAiDocuments(scope)).rejects.toThrow("Storage access required")
    expect(mocks.query).not.toHaveBeenCalled()
  })
  it("rejects stale revisions, unknown documents and oversized bodies", async () => {
    const target = { ...scope, sectionId: "vision", title: "Vision", revision }
    await expect(loadAiDocument({ ...target, revision: "stale" })).rejects.toThrow("changed")
    await expect(loadAiDocument({ ...target, sectionId: "not-a-document" })).rejects.toThrow("editable core document")
    profile = { roadmap: { sections: [{ id: "vision", title: "Vision", content: "x".repeat(60001), lastUpdated: revision }] } }
    await expect(loadAiDocument(target)).rejects.toThrow("context limit")
  })
})

const driveSource = { provider: "google_drive", fileId: "drive-document-123", name: "Drive source", webViewLink: "https://docs.google.com/document/d/drive-document-123/edit" }
it.each([
  ["legacy editor", {}, true],
  ["explicit editor with retained Drive", { documentSource: "editor", driveSource }, true],
  ["legacy Drive", { driveSource }, false],
  ["explicit Drive", { documentSource: "google_drive", driveSource }, false],
  ["missing Drive", { documentSource: "google_drive" }, false],
  ["invalid Drive", { documentSource: "google_drive", driveSource: { ...driveSource, webViewLink: "https://example.com/private" } }, false],
] as const)("uses only the selected source for %s", async (_name, source, editable) => {
  profile = { roadmap: { sections: [{ id: "vision", title: "Vision", content: "Editor body", lastUpdated: revision, ...source }] } }
  expect((await listAiDocuments(scope)).some(item => item.sectionId === "vision")).toBe(editable)
  const sourceResult = loadAiDocumentSource({ ...scope, sectionId: "vision", title: "Vision", revision: "older" })
  if (editable) expect((await sourceResult).section.content).toBe("Editor body")
  else await expect(sourceResult).rejects.toThrow("editable core document")
  const result = loadAiDocument({ ...scope, sectionId: "vision", title: "Vision", revision })
  if (editable) expect((await result).section.content).toBe("Editor body")
  else await expect(result).rejects.toThrow("editable core document")
})


it("rechecks real profile source selection on saved proposal recovery, including stale drafts", async () => {
  const target = { ...scope, sectionId: "vision", title: "Vision", revision }
  mocks.read.mockResolvedValue({ id: id(3), actor_id: scope.userId, org_id: scope.organizationId,
    target: { ...target, content: "Prior editor body" }, status: "succeeded", proposal: "Private draft", charged_credits: 1, max_credits: 10 })
  await expect(readWorkspaceAiProposal(id(3), target)).resolves.toMatchObject({ content: "Private draft" })
  profile = { roadmap: { sections: [{ id: "vision", title: "Vision", content: "Prior editor body", lastUpdated: revision, documentSource: "google_drive", driveSource }] } }
  await expect(readWorkspaceAiProposal(id(3), target)).rejects.toThrow("editable core document")
  // Retained Drive metadata is not the selected source after an explicit switch back.
  profile = { roadmap: { sections: [{ id: "vision", title: "Vision", content: "Edited", lastUpdated: "new revision", documentSource: "editor", driveSource }] } }
  await expect(readWorkspaceAiProposal(id(3), target)).resolves.toMatchObject({ content: "Private draft" })
  // Ordinary editing may be reviewed; current storage and actor authority may not be bypassed.
  mocks.storage.mockResolvedValueOnce({ error: "Storage access required" })
  await expect(readWorkspaceAiProposal(id(3), target)).rejects.toThrow("Storage access required")
})


describe("retained document source authorization", () => {
  const target = { ...scope, sectionId: "vision", title: "Vision", revision }
  const source = { runId: id(3), sectionId: "vision", kind: "editor" }
  it("checks a retained revision chain against the current RLS profile without demanding an unchanged revision", async () => {
    mocks.rpc.mockResolvedValue({ data: { sources: [source, { ...source, runId: id(4) }], complete: false }, error: null })
    await expect(assertAiDocumentSources(id(3), { ...target, revision: "old" }, false)).resolves.toBeUndefined()
    expect(mocks.rpc).toHaveBeenCalledWith("read_workspace_ai_document_sources", { p_org_id: scope.organizationId, p_actor_id: scope.userId, p_run_id: id(3) })
    expect(mocks.query).toHaveBeenCalledOnce()
    profile = { roadmap: { sections: [{ id: "vision", documentSource: "google_drive", driveSource }] } }
    await expect(assertAiDocumentSources(id(3), target, false)).rejects.toThrow("editable core document")
  })
  it.each([
    null, { sources: [], complete: false }, { sources: [source], complete: true },
    { sources: [{ ...source, runId: id(8) }], complete: false },
    { sources: [source, source], complete: false },
    { sources: [source, { ...source, runId: id(4), sectionId: "mission" }], complete: false },
    { sources: [source], complete: false, body: "Unwanted content" },
  ])("fails closed on malformed or mismatched retained records %#", async data => {
    mocks.rpc.mockResolvedValue({ data, error: null })
    await expect(assertAiDocumentSources(id(3), target, false)).rejects.toThrow("sources could not be verified")
    expect(mocks.query).not.toHaveBeenCalled()
  })
  it("does not fall back to the mutable target on a failed source read", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Unavailable" } })
    await expect(assertAiDocumentSources(id(3), target, false)).rejects.toThrow("sources could not be verified")
    mocks.rpc.mockRejectedValue(new Error("Timeout"))
    await expect(assertAiDocumentSources(id(3), target, false)).rejects.toThrow("Timeout")
    expect(mocks.query).not.toHaveBeenCalled()
  })
  it("rejects changing an editor draft into a selection to skip its source check", async () => {
    await expect(assertAiDocumentSources(id(3), target, true)).rejects.toThrow("sources could not be verified")
    expect(mocks.query).not.toHaveBeenCalled()
  })
  it("allows retained explicit selections without loading a stored core document", async () => {
    const selected = { ...target, sectionId: `selection:${id(5)}` }
    mocks.rpc.mockResolvedValue({ data: { sources: [{ ...source, sectionId: selected.sectionId, kind: "selection" }], complete: false }, error: null })
    await expect(assertAiDocumentSources(id(3), selected, true)).resolves.toBeUndefined()
    expect(mocks.query).not.toHaveBeenCalled()
  })
  it("does not reuse an earlier draft when its retained sources become unavailable", async () => {
    mocks.read.mockResolvedValue({ id: id(3), actor_id: scope.userId, org_id: scope.organizationId,
      target: { ...target, content: "Original" }, status: "succeeded", proposal: "Private draft", charged_credits: 1, max_credits: 10 })
    await expect(loadAiRevisionContext(id(3), target)).resolves.toMatchObject({ content: "Private draft" })
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Missing ancestor" } })
    await expect(loadAiRevisionContext(id(3), target)).rejects.toThrow("sources could not be verified")
  })
})


it("rechecks saved-copy lineage before listing, generation, recovery and revision without mutating the profile", async () => {
  const target = { ...scope, sectionId: "vision", title: "Vision", revision }
  const original = structuredClone(profile)
  mocks.read.mockResolvedValue({ id: id(3), actor_id: scope.userId, org_id: scope.organizationId,
    target: { ...target, content: "Original" }, status: "succeeded", proposal: "Private draft", charged_credits: 1, max_credits: 10 })
  expect(await listAiDocuments(scope)).toHaveLength(1)
  mocks.copies.mockResolvedValue({ data: { blockedSectionIds: ["vision"], complete: false }, error: null })
  expect(await listAiDocuments(scope)).toEqual([])
  await expect(loadAiDocument(target)).rejects.toThrow("sources are unavailable")
  await expect(readWorkspaceAiProposal(id(3), target)).rejects.toThrow("sources are unavailable")
  await expect(loadAiRevisionContext(id(3), target)).rejects.toThrow("sources are unavailable")
  expect(mocks.copies).toHaveBeenLastCalledWith({ p_org_id: scope.organizationId, p_actor_id: scope.userId, p_section_ids: ["vision"] })
  expect(profile).toEqual(original)
  mocks.copies.mockResolvedValue({ data: { blockedSectionIds: [], complete: false }, error: null })
  expect((await loadAiDocument(target)).section.content).toContain("Safe community")
  mocks.copies.mockResolvedValue({ data: null, error: { message: "Private detail" } })
  await expect(listAiDocuments(scope)).rejects.toThrow("sources could not be verified")
  await expect(loadAiDocument(target)).rejects.toThrow("sources could not be verified")
})
