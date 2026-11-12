import { beforeEach, expect, it, vi } from "vitest"
import { particleSourceReferences, mergeCanvasSourceReferences, emptyCanvasSourceReferences, canvasSourceReferencesSchema } from "@/lib/workspace/canvas-source-references"
import { graph, particle, ID, WORKSPACE, NOW } from "./fixtures/particle-fixtures"
import { createLibraryDocumentParticle } from "@/features/workspace-particles/lib/particle-library-document"
import { revalidateWorkspaceCanvasAccess } from "@/features/workspace-management/canvas-access-actions"

const mocks = vi.hoisted(() => ({ context: vi.fn(), admin: vi.fn(), rpc: vi.fn(), profile: vi.fn() }))
vi.mock("@/lib/auth/request-context", () => ({ resolveOptionalAuthenticatedAppContext: mocks.context }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
const orgId = "10000000-0000-4000-8000-000000000001", viewerId = "10000000-0000-4000-8000-000000000002", canvasId = "10000000-0000-4000-8000-000000000003"
const context = { user: { id: viewerId }, activeOrg: { orgId, role: "staff" }, profileAudience: { isAdmin: false } }
const board = { state: { privateBody: "Never returned", workspaceCatalog: { version: 1, defaultName: "Main", entries: [
  { id: canvasId, name: "Finance", state: { secret: "Never returned either" }, createdAt: "2026-11-08T00:00:00Z", updatedAt: "2026-11-08T00:00:00Z" },
] } } }
beforeEach(() => {
  vi.resetAllMocks(); mocks.context.mockResolvedValue(context)
  const query = { select: () => query, eq: () => query, abortSignal: () => query, maybeSingle: mocks.profile }
  mocks.admin.mockReturnValue({ rpc: mocks.rpc, from: () => query }); mocks.rpc.mockResolvedValue({ data: board, error: null })
})
it.each([null, canvasId])("checks fresh actor and exact canvas %s without returning content", async canvasId => {
  expect(await revalidateWorkspaceCanvasAccess({ orgId, canvasId })).toEqual({ allowed: true, viewerId, role: "staff", canEdit: true })
  expect(mocks.admin).toHaveBeenCalledWith({ actorId: viewerId, requestTimeoutMs: 10000 })
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("read_workspace_canvas_projection", { p_org_id: orgId, p_actor_id: viewerId })
})
it("uses current roles including owner retention and read-only members", async () => {
  for (const role of ["owner", "board", "member"]) {
    mocks.context.mockResolvedValue({ ...context, activeOrg: { orgId, role } })
    expect(await revalidateWorkspaceCanvasAccess({ orgId, canvasId })).toEqual({ allowed: true, viewerId, role, canEdit: role === "owner" })
  }
})
it("rejects injected identity, malformed scope, signed-out and changed organization before the RPC", async () => {
  expect(await revalidateWorkspaceCanvasAccess({ orgId, canvasId, actorId: viewerId })).toEqual({ allowed: false })
  expect(await revalidateWorkspaceCanvasAccess({ orgId: "invalid", canvasId })).toEqual({ allowed: false })
  expect(mocks.context).not.toHaveBeenCalled()
  mocks.context.mockResolvedValue(null)
  expect(await revalidateWorkspaceCanvasAccess({ orgId, canvasId })).toEqual({ allowed: false })
  mocks.context.mockResolvedValue({ ...context, activeOrg: { orgId: viewerId } })
  expect(await revalidateWorkspaceCanvasAccess({ orgId, canvasId })).toEqual({ allowed: false })
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it.each([
  { data: { state: { workspaceCatalog: { version: 1, defaultName: "Main", defaultDeleted: true, entries: [] } } }, error: null },
  { data: board, error: { code: "42501", message: "Private detail" } },
  { data: { state: [] }, error: null },
  { data: { state: {} }, error: null },
])("retires hidden, deleted, malformed and failed canvas reads", async response => {
  mocks.rpc.mockResolvedValue(response)
  expect(await revalidateWorkspaceCanvasAccess({ orgId, canvasId })).toEqual({ allowed: false })
})
it("fails closed on transport errors and allows only real starter canvases for absent boards", async () => {
  mocks.rpc.mockRejectedValueOnce(Error("Private detail"))
  expect(await revalidateWorkspaceCanvasAccess({ orgId, canvasId })).toEqual({ allowed: false })
  mocks.rpc.mockResolvedValue({ data: null, error: null })
  expect(await revalidateWorkspaceCanvasAccess({ orgId, canvasId })).toEqual({ allowed: false })
  expect(await revalidateWorkspaceCanvasAccess({ orgId, canvasId: null })).toMatchObject({ allowed: true })
})

function sourceAuthority({ deniedFiles = [] as string[], deniedDocuments = [] as string[], retained = false } = {}) {
  mocks.profile.mockResolvedValue({ data: { profile: { roadmap: { sections: [
    { id: "document-id", slug: "document-slug", title: "Secret title", content: "Secret body" },
  ] } } }, error: null })
  mocks.rpc.mockImplementation(async (name: string, args: { p_file_ids?: string[]; p_record_ids?: string[] }) => {
    if (name === "read_workspace_canvas_projection") return { data: board, error: null }
    if (name === "read_workspace_particle_ai_files") return { data: retained ? [{ id: args.p_record_ids![0], fileIds: [ID(70)], complete: false }] : [], error: null }
    if (name === "read_workspace_particle_ai_documents") return { data: retained ? [{ id: args.p_record_ids![0], documentIds: ["document-id"], complete: false }] : [], error: null }
    if (name === "filter_document_file_audience") return { data: args.p_file_ids?.filter(id => !deniedFiles.includes(id)), error: null }
    if (name === "read_workspace_ai_document_copy_sources") return { data: { blockedSectionIds: deniedDocuments, complete: false }, error: null }
    throw Error(`Unexpected RPC ${name}`)
  })
}
it.each(["file", "document", "retained-file", "retained-document"])("retires revoked %s while canvas admission still succeeds", async kind => {
  sourceAuthority({ deniedFiles: kind.endsWith("file") ? [ID(70)] : [], deniedDocuments: kind.endsWith("document") ? ["document-id"] : [], retained: kind.startsWith("retained") })
  const sources = { records: [`particle:${ID(1)}`], files: kind === "file" ? [ID(70)] : [], documents: kind === "document" ? ["document-slug"] : [] }
  expect(await revalidateWorkspaceCanvasAccess({ orgId, canvasId, sources })).toEqual({ allowed: false })
  expect(mocks.rpc).toHaveBeenCalledWith("read_workspace_canvas_projection", { p_org_id: orgId, p_actor_id: viewerId })
  sourceAuthority({ retained: true })
  const result = await revalidateWorkspaceCanvasAccess({ orgId, canvasId, sources })
  expect(result).toEqual({ allowed: true, viewerId, role: "staff", canEdit: true })
  expect(JSON.stringify(result)).not.toMatch(/Secret|document-id|fileIds/)
})
it("validates bounded, body-free references before authentication; never queries sources after parent denial", async () => {
  for (const sources of [{ records: [], files: ["invalid"], documents: [] }, { records: [], files: [], documents: Array(2001).fill("id") }, { records: [], files: [], documents: [], body: "secret" }])
    expect(await revalidateWorkspaceCanvasAccess({ orgId, canvasId, sources })).toEqual({ allowed: false })
  expect(mocks.context).not.toHaveBeenCalled()
  mocks.rpc.mockResolvedValue({ data: null, error: Error("Denied") })
  expect(await revalidateWorkspaceCanvasAccess({ orgId, canvasId, sources: { records: [`particle:${ID(1)}`], files: [ID(70)], documents: [] } })).toEqual({ allowed: false })
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
})
it("fails closed on unverifiable source reads and missing editor documents", async () => {
  const sources = { records: [`particle:${ID(1)}`], files: [], documents: ["missing"] }
  sourceAuthority()
  expect(await revalidateWorkspaceCanvasAccess({ orgId, canvasId, sources })).toEqual({ allowed: false })
  mocks.profile.mockRejectedValue(Error("Transport failed"))
  expect(await revalidateWorkspaceCanvasAccess({ orgId, canvasId, sources })).toEqual({ allowed: false })
  mocks.rpc.mockImplementation(async (name: string) => name === "read_workspace_canvas_projection" ? { data: board, error: null } : { data: "malformed", error: null })
  expect(await revalidateWorkspaceCanvasAccess({ orgId, canvasId, sources })).toEqual({ allowed: false })
})
it("captures body-free direct and cited sources, retaining detached references for undo and open viewers", () => {
  const file = createLibraryDocumentParticle(WORKSPACE, { name: "Secret file", mimeType: "text/plain", fileId: ID(70) }, ID(1), NOW)
  const document = createLibraryDocumentParticle(WORKSPACE, { name: "Secret editor", mimeType: "text/plain", source: { kind: "roadmap", sectionId: "document-slug" } }, ID(2), NOW)
  const objective = particle(3, "objective")
  if (objective.type !== "objective") throw Error("fixture")
  objective.data.planning = { plans: [{ id: ID(4), revision: 0, title: "Secret plan", particleIds: [ID(1)], sources: [
    { kind: "workspace", id: `file:${ID(71)}`, title: "Secret source", href: "/workspace", revision: null, checkedAt: NOW },
    { kind: "workspace", id: "document:document-id", title: "Secret source", href: "/workspace", revision: null, checkedAt: NOW },
  ] }], proposals: [] }
  const references = particleSourceReferences(graph([file, document, objective]))
  expect(canvasSourceReferencesSchema.safeParse(references).success).toBe(true)
  expect(references.files).toEqual([ID(70), ID(71)])
  expect(references.documents).toEqual(["document-slug", "document-id"])
  expect(references.records).toContain(`particle:${ID(3)}:plan:${ID(4)}`)
  expect(JSON.stringify(references)).not.toMatch(/Secret|href|content/)
  const remembered = mergeCanvasSourceReferences(emptyCanvasSourceReferences(), references)
  expect(mergeCanvasSourceReferences(remembered, particleSourceReferences(graph([])))).toBe(remembered)
  expect(mergeCanvasSourceReferences(remembered, references)).toBe(remembered)
})
