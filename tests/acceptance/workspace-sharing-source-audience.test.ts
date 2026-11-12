import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadSavedPageSources } from "@/features/workspace-sharing/server/page-context"
import type { PageActor } from "@/features/workspace-sharing/server/page-context"
import { graph, particle, WORKSPACE, ID, NOW } from "./fixtures/particle-fixtures"
const mocks = vi.hoisted(() => ({ board: vi.fn(), project: vi.fn() }))
vi.mock("@/lib/organization/particle-board-read", () => ({ readWorkspaceBoardForProjection: mocks.board }))
vi.mock("@/features/workspace-particles/server", () => ({ projectStoredParticleGraphAudience: mocks.project }))
const organization = { profile: { name: "Team" }, public_slug: "team", updated_at: NOW }
const supabase = { from: vi.fn(() => ({ select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: async () => ({ data: organization, error: null }) }) }) }) })) }
const actor = { orgId: WORKSPACE, actorId: ID(70), supabase } as unknown as PageActor
beforeEach(() => { vi.resetAllMocks(); mocks.project.mockImplementation(async value => value) })
describe("shared page source projection", () => {
  it("filters root content while preserving the exact canonical CAS input", async () => {
    const canonical = graph([particle(1), { ...particle(2), title: "Restricted" }])
    const visible = { ...canonical, particles: [canonical.particles[0]] }
    mocks.board.mockResolvedValue({ data: { state: { particleGraph: canonical } }, error: null })
    mocks.project.mockResolvedValue(visible)
    const result = await loadSavedPageSources(actor)
    expect(mocks.board).toHaveBeenCalledWith(supabase, WORKSPACE, ID(70), expect.any(AbortSignal))
    expect(mocks.project).toHaveBeenCalledWith(canonical, WORKSPACE, ID(70))
    expect(result.graph).toEqual(visible)
    expect(result.canonicalGraph).toEqual(canonical)
    expect(canonical.particles).toHaveLength(2)
  })
  it("projects the exact named canvas, including on repeated permission checks", async () => {
    const named = graph([particle(3)])
    mocks.board.mockResolvedValue({ data: { state: { particleGraph: graph(), workspaceCatalog: { version: 1, defaultName: "Main", entries: [
      { id: ID(80), name: "Named", createdAt: NOW, updatedAt: NOW, state: { particleGraph: named } },
    ] } } }, error: null })
    expect((await loadSavedPageSources(actor, ID(80))).graph).toEqual(named)
    mocks.project.mockResolvedValue({ ...named, particles: [] })
    expect((await loadSavedPageSources(actor, ID(80))).graph.particles).toEqual([])
    expect(mocks.project).toHaveBeenLastCalledWith(named, WORKSPACE, ID(70))
  })
  it("withholds content when board or audience authority cannot be verified", async () => {
    mocks.board.mockResolvedValue({ data: null, error: { code: "42501" } })
    await expect(loadSavedPageSources(actor)).rejects.toThrow("Unable to load")
    expect(mocks.project).not.toHaveBeenCalled()
    mocks.board.mockResolvedValue({ data: { state: { particleGraph: graph() } }, error: null })
    mocks.project.mockRejectedValue(new Error("Permission unavailable"))
    await expect(loadSavedPageSources(actor)).rejects.toThrow("Permission unavailable")
  })
})
