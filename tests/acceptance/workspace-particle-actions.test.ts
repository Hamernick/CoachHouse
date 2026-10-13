import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Json } from "@/lib/supabase"
import type { WorkspaceBoardState } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-types"
import { buildDefaultBoardState } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-layout"
import {
  batch,
  graph,
  ID,
  NOW,
  particle,
  WORKSPACE,
} from "./fixtures/particle-fixtures"

const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  canEdit: vi.fn(),
  persist: vi.fn(),
  admin: vi.fn(),
  revalidate: vi.fn(),
  read: vi.fn(),
}))
vi.mock(
  "@/app/(dashboard)/my-organization/_lib/workspace-actions-support",
  () => ({ resolveActor: mocks.actor, canEditWorkspaceLayout: mocks.canEdit })
)
vi.mock(
  "@/app/(dashboard)/my-organization/_lib/workspace-board-state-write",
  () => ({ persistWorkspaceBoardState: mocks.persist })
)
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.admin,
}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))
import {
  applyWorkspaceParticleBatchAction,
  loadWorkspaceParticleGraphAction,
} from "@/app/(dashboard)/my-organization/_lib/workspace-particle-actions"

const request = batch(100, [
  { kind: "put_particle", particle: particle(3), expectedRevision: null },
])
beforeEach(() => {
  vi.resetAllMocks()
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: mocks.read,
  }
  mocks.actor.mockResolvedValue({
    user: { id: ID(888) },
    activeOrg: { orgId: WORKSPACE, role: "owner" },
    supabase: { from: vi.fn(() => query) },
  })
  mocks.canEdit.mockResolvedValue(true)
  mocks.admin.mockReturnValue({})
  mocks.read.mockResolvedValue({
    data: { state: { particleGraph: graph() } },
    error: null,
  })
  mocks.persist.mockImplementation(
    async (args: {
      buildState: (stored: WorkspaceBoardState) => WorkspaceBoardState
      updateParticleGraph: (stored: Json) => Json
    }) => ({
      ok: true,
      boardState: {
        ...args.buildState(buildDefaultBoardState()),
        particleGraph: args.updateParticleGraph(graph()),
      },
    })
  )
})

describe("authenticated Particle action boundary", () => {
  it("rejects signed-out actors, viewers and other organization IDs before a write", async () => {
    mocks.actor.mockResolvedValueOnce({ error: "You must be signed in." })
    expect(await applyWorkspaceParticleBatchAction(request)).toMatchObject({
      ok: false,
      code: "scope",
    })
    mocks.canEdit.mockResolvedValueOnce(false)
    expect(await applyWorkspaceParticleBatchAction(request)).toMatchObject({
      ok: false,
      code: "scope",
    })
    expect(
      await applyWorkspaceParticleBatchAction({
        ...request,
        workspaceId: ID(777),
      })
    ).toMatchObject({ ok: false, code: "scope" })
    expect(mocks.persist).not.toHaveBeenCalled()
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("writes only through the authorized board adapter and revalidates on success", async () => {
    const result = await applyWorkspaceParticleBatchAction(request)
    expect(result).toMatchObject({
      ok: true,
      value: { graph: { revision: 1 }, replayed: false },
    })
    expect(mocks.persist).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: WORKSPACE, userId: ID(888) })
    )
    expect(mocks.revalidate).toHaveBeenCalledWith("/workspace")
  })
  it("returns invalid-operation and storage errors without claiming a save", async () => {
    expect(
      await applyWorkspaceParticleBatchAction({ ...request, operations: [] })
    ).toMatchObject({ ok: false, code: "invalid" })
    mocks.persist.mockResolvedValueOnce({
      error: "Unable to save workspace layout.",
    })
    expect(await applyWorkspaceParticleBatchAction(request)).toMatchObject({
      ok: false,
      code: "unavailable",
    })
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it("reads only the active workspace and does not replace an unsupported stored graph", async () => {
    expect(await loadWorkspaceParticleGraphAction()).toMatchObject({
      ok: true,
      value: { workspaceId: WORKSPACE },
    })
    mocks.read.mockResolvedValueOnce({
      data: { state: { particleGraph: { schemaVersion: 99, updatedAt: NOW } } },
      error: null,
    })
    expect(await loadWorkspaceParticleGraphAction()).toMatchObject({
      ok: false,
      code: "unsupported",
    })
    expect(mocks.persist).not.toHaveBeenCalled()
  })
})
