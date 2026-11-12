import { beforeEach, expect, it, vi } from "vitest"
import { graph, ID, NOW, particle, WORKSPACE } from "./fixtures/particle-fixtures"
import { createLibraryDocumentParticle } from "@/features/workspace-particles/lib/particle-library-document"
import type { ResearchContext } from "@/features/workspace-ai/server/research-context"

const mocks = vi.hoisted(() => ({ admin: vi.fn(), rpc: vi.fn(), profile: vi.fn(), eq: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
import { retainedParticleDocuments } from "@/lib/organization/particle-ai-origins"
import { projectParticleGraphAudience, assertParticleAudienceMutation } from "@/features/workspace-particles/server/particle-audience"
import { authorizeResearchFileContext, initialResearchParticleIds } from "@/features/workspace-ai/server/knowledge-particle-files"
import { knowledgeLoader } from "@/features/workspace-ai/server/knowledge-records"

const member = ID(90)
let retainedDocuments: Array<{ id: string; documentIds: string[]; complete: false }> = []
let revoked = true
beforeEach(() => {
  vi.clearAllMocks(); revoked = true; retainedDocuments = []
  const query = { select: () => query, eq: mocks.eq.mockImplementation(() => query),
    abortSignal: () => query, maybeSingle: mocks.profile }
  mocks.admin.mockReturnValue({ from: () => query, rpc: mocks.rpc })
  mocks.profile.mockResolvedValue({ data: { profile: { roadmap: { sections: [
    { id: "private-section", slug: "private-slug", title: "Private document", content: "Private content" },
  ] } } }, error: null })
  mocks.rpc.mockImplementation(async (name: string, args: { p_actor_id?: string; p_file_ids?: string[]; p_section_ids?: string[] }) => {
    if (name === "filter_workspace_ai_sources") return { data: { fileIds: args.p_file_ids ?? [], sectionIds: (args.p_section_ids ?? []).filter(id => !revoked || args.p_actor_id === WORKSPACE || id !== "private-section") }, error: null }
    if (name === "read_workspace_particle_ai_documents") return { data: retainedDocuments, error: null }
    if (name === "read_workspace_particle_ai_files") return { data: [], error: null }
    if (name === "filter_document_file_audience") return { data: args.p_file_ids, error: null }
    if (name === "read_workspace_ai_document_copy_sources") return {
      data: { blockedSectionIds: revoked && args.p_actor_id !== WORKSPACE ? ["private-section"] : [], complete: false }, error: null,
    }
    throw new Error(`Unexpected RPC ${name}`)
  })
})
function fixture() {
  const document = createLibraryDocumentParticle(WORKSPACE, { name: "Private title", mimeType: "text/plain",
    source: { kind: "roadmap", sectionId: "private-slug" } }, ID(1), NOW)
  const objective = particle(2, "objective")
  if (objective.type !== "objective") throw new Error("fixture")
  objective.title = "Private plan owner"
  objective.data.planning = { plans: [{ id: ID(20), revision: 0, title: "Private plan", particleIds: [document.id] }], proposals: [] }
  return graph([document, objective, particle(3)])
}
function context(value = fixture()): ResearchContext {
  return { user: { id: member }, graph: value, canvasId: null,
    target: { mode: "new_objective", organizationId: WORKSPACE, canvasId: null, revision: 0 },
  } as ResearchContext
}
it("withholds referenced titles and dependent plans, resolves slugs to canonical IDs, and preserves canonical state", async () => {
  const value = fixture(), original = structuredClone(value)
  expect((await projectParticleGraphAudience(value, member)).particles.map(item => item.id)).toEqual([ID(3)])
  expect(mocks.rpc).toHaveBeenCalledWith("read_workspace_ai_document_copy_sources", {
    p_org_id: WORKSPACE, p_actor_id: member, p_section_ids: ["private-section"],
  })
  expect(mocks.eq).toHaveBeenCalledWith("user_id", WORKSPACE)
  expect(value).toEqual(original)
})
it("rechecks grants and revocation while retaining owner access", async () => {
  const value = fixture()
  revoked = false
  expect(await projectParticleGraphAudience(value, member)).toBe(value)
  revoked = true
  expect((await projectParticleGraphAudience(value, member)).particles).toHaveLength(1)
  expect(await projectParticleGraphAudience(value, WORKSPACE)).toBe(value)
  revoked = false
  expect(await projectParticleGraphAudience(value, member)).toBe(value)
})
it.each(["edit", "remove", "detach"])("rejects %s of a denied reference but preserves unrelated edits", async kind => {
  const before = fixture(), next = structuredClone(before)
  if (kind === "edit") next.particles[0].title = "Changed"
  if (kind === "remove") next.particles.shift()
  if (kind === "detach" && next.particles[0].type === "activity") next.particles[0].data.widget = undefined
  await expect(assertParticleAudienceMutation(before, next, member)).rejects.toMatchObject({ code: "scope" })
  const other = structuredClone(before); other.particles[2].title = "Allowed"
  expect((await assertParticleAudienceMutation(before, other, member)).particles[0].title).toBe("Allowed")
})
it("does not reveal inaccessible documents through AI search, exact reads or implicit context", async () => {
  const current = context(), load = knowledgeLoader(current)
  expect((await load("particle", "")).map(item => item.id)).toEqual([`particle:${ID(3)}`])
  expect(await load("particle", "", `particle:${ID(2)}:plan:${ID(20)}`)).toEqual([])
  expect(initialResearchParticleIds(await authorizeResearchFileContext(current))).toEqual([])
  const objective = current.graph.particles[1]
  if (objective.type !== "objective") throw new Error("fixture")
  await expect(authorizeResearchFileContext({ ...current, objective })).rejects.toThrow("context is unavailable")
  revoked = false
  expect(await load("particle", "", `particle:${ID(1)}`)).toHaveLength(1)
  expect(initialResearchParticleIds(await authorizeResearchFileContext(current))).toEqual([`particle:${ID(2)}`])
})
it.each(["document", "roadmap"])("propagates %s citations to generated members and transitive references", async prefix => {
  const generated = particle(4), objective = particle(5, "objective"), reference = particle(6, "workflow")
  if (objective.type !== "objective" || reference.type !== "workflow") throw new Error("fixture")
  objective.data.planning = { plans: [{ id: ID(50), revision: 0, title: "Private plan", particleIds: [generated.id],
    researchRunId: ID(51), sources: [{ kind: "workspace", id: `${prefix}:private-section`, title: "Private citation", href: "/workspace", revision: null, checkedAt: NOW }] }], proposals: [] }
  reference.data.steps = [{ id: ID(60), title: "Private reference", order: 0, status: "backlog", particleId: generated.id }]
  const value = graph([generated, objective, reference, particle(7)])
  expect((await projectParticleGraphAudience(value, member)).particles.map(item => item.id)).toEqual([ID(7)])
  // An independently authored member is not treated as generated from citations.
  delete objective.data.planning.plans[0].researchRunId
  expect((await projectParticleGraphAudience(value, member)).particles.map(item => item.id)).toEqual([ID(4), ID(6), ID(7)])
})
it("withholds missing and inactive editor references without reviving their content", async () => {
  revoked = false
  for (const sections of [[], [{ id: "private-section", slug: "private-slug", documentSource: "google_drive", content: "Inactive body" }]]) {
    mocks.profile.mockResolvedValue({ data: { profile: { roadmap: { sections } } }, error: null })
    expect((await projectParticleGraphAudience(fixture(), member)).particles.map(item => item.id)).toEqual([ID(3)])
  }
})
it("fails closed on profile or source authority failure without exposing private error details", async () => {
  mocks.profile.mockResolvedValue({ data: null, error: { message: "Private detail" } })
  await expect(projectParticleGraphAudience(fixture(), member)).rejects.toThrow("Document sources could not be verified")
  expect(mocks.rpc.mock.calls.some(([name]) => name === "read_workspace_ai_document_copy_sources")).toBe(false)
})
it("skips profile reads for graphs without document references", async () => {
  const value = graph([particle(9)])
  expect(await projectParticleGraphAudience(value, member)).toBe(value)
  expect(mocks.profile).not.toHaveBeenCalled()
})

it("keeps detached generated content restricted after citations and run bindings are removed", async () => {
  const copied = particle(8), unrelated = particle(9)
  copied.title = "Copied document details"
  retainedDocuments = [{ id: `particle:${copied.id}`, documentIds: ["private-section"], complete: false }]
  const value = graph([copied, unrelated]), original = structuredClone(value)
  expect((await projectParticleGraphAudience(value, member)).particles).toEqual([unrelated])
  expect(await projectParticleGraphAudience(value, WORKSPACE)).toBe(value)
  expect(value).toEqual(original)
  const next = structuredClone(value); next.particles[0].title = "Edited hidden copy"
  await expect(assertParticleAudienceMutation(value, next, member)).rejects.toMatchObject({ code: "scope" })
  const load = knowledgeLoader(context(value))
  expect(await load("particle", "", `particle:${copied.id}`)).toEqual([])
  revoked = false
  expect(await projectParticleGraphAudience(value, member)).toBe(value)
})
it("checks retained plan identities without a current research binding", async () => {
  const value = fixture(), objective = value.particles[1]
  if (objective.type !== "objective") throw new Error("fixture")
  value.particles = [objective, particle(3)]
  objective.data.planning!.plans[0].particleIds = []
  retainedDocuments = [{ id: `particle:${objective.id}:plan:${ID(20)}`, documentIds: ["private-section"], complete: false }]
  expect((await projectParticleGraphAudience(value, member)).particles.map(item => item.id)).toEqual([ID(3)])
})
it.each(["", "deleted-section"])("withholds malformed or deleted retained document %s", async source => {
  const value = graph([particle(9)])
  retainedDocuments = [{ id: `particle:${ID(9)}`, documentIds: [source], complete: false }]
  expect((await projectParticleGraphAudience(value, WORKSPACE)).particles).toEqual([])
})
it("fails closed when retained document metadata cannot be read", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "Private source detail" } })
  await expect(projectParticleGraphAudience(graph([particle(9)]), member)).rejects.toThrow("could not be verified")
})

it("batches retained document reads and rejects foreign, duplicate or malformed results", async () => {
  const ids = Array.from({ length: 501 }, (_, i) => `particle:${i}`)
  expect((await retainedParticleDocuments(WORKSPACE, member, ids)).size).toBe(0)
  expect(mocks.rpc.mock.calls.map(([, args]) => args.p_record_ids.length)).toEqual([500, 1])
  for (const data of [null, [{ id: "foreign", documentIds: [], complete: false }],
    [{ id: ids[0], documentIds: [], complete: true }],
    [{ id: ids[0], documentIds: [null], complete: false }],
    Array(2).fill({ id: ids[0], documentIds: [], complete: false })]) {
    mocks.rpc.mockResolvedValue({ data, error: null })
    await expect(retainedParticleDocuments(WORKSPACE, member, ids.slice(0, 1))).rejects.toThrow("could not be verified")
  }
})
