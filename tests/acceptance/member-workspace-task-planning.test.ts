import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ actor: vi.fn(), auth: vi.fn(), rpc: vi.fn(), admin: vi.fn(), revalidate: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/features/member-workspace/server/member-workspace-actor-context", () => ({ resolveMemberWorkspaceActorContext: mocks.actor }))
vi.mock("@/lib/auth/request-context", () => ({ resolveAuthenticatedAppContext: mocks.auth }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))

import { moveMemberWorkspaceTaskAction, scheduleMemberWorkspaceTaskAction } from "@/features/member-workspace/server/task-planning-actions"

const taskId = "10000000-0000-4000-8000-000000000001"
const projectId = "10000000-0000-4000-8000-000000000002"
const neighborTaskId = "10000000-0000-4000-8000-000000000003"
const schedule = { taskId, projectId, startDate: "2026-10-21", expectedStartDate: "2026-10-20", expectedEndDate: "2026-10-24" }
const move = { taskId, projectId, neighborTaskId, placement: "before" as const, expectedSortOrder: 3, expectedNeighborSortOrder: 1, expectedUpdatedAt: "2026-10-20T12:00:00Z", expectedNeighborUpdatedAt: "2026-10-20T12:01:00Z" }

function actor(overrides: Record<string, unknown> = {}) {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: projectId, org_id: "org-a", task_count: 3, project_kind: "standard", created_source: "user" }, error: null }) }
  return { userId: "verified-user", isAdmin: false, canEdit: true, hasMemberWorkspaceAccess: true, activeOrg: { orgId: "org-a", role: "editor" }, supabase: { from: vi.fn().mockReturnValue(query) }, ...overrides }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.actor.mockResolvedValue(actor())
  mocks.auth.mockResolvedValue({ profileAudience: { platformAccessLevel: null }, activeOrg: { orgId: "org-a" } })
  mocks.admin.mockReturnValue({ rpc: mocks.rpc })
  mocks.rpc.mockResolvedValue({ data: { ok: true, startDate: schedule.startDate, endDate: schedule.expectedEndDate }, error: null })
})

describe("narrow task planning actions", () => {
  it.each(["2026-02-29", "2026-13-01", "2026-04-31", "10/21/2026", "2026-10-21T00:00:00Z"])("rejects invalid calendar date %s before authenticated data access", async (startDate) => {
    expect(await scheduleMemberWorkspaceTaskAction({ ...schedule, startDate })).toHaveProperty("error")
    expect(mocks.actor).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("uses only expected schedule fields without replacing assignments, title, or status", async () => {
    expect(await scheduleMemberWorkspaceTaskAction(schedule)).toEqual({ ok: true, taskId, startDate: schedule.startDate, endDate: schedule.expectedEndDate })
    expect(mocks.admin).toHaveBeenCalledWith({ actorId: "verified-user" })
    expect(mocks.rpc).toHaveBeenCalledWith("schedule_organization_task_transition", {
      p_actor_id: "verified-user", p_task_id: taskId, p_project_id: projectId, p_expected_org_id: "org-a",
      p_start_date: schedule.startDate, p_expected_start_date: schedule.expectedStartDate, p_expected_end_date: schedule.expectedEndDate,
    })
    expect(mocks.revalidate).toHaveBeenCalledWith("/tasks")
    expect(mocks.revalidate).toHaveBeenCalledWith(`/projects/${projectId}`)
  })

  it("clears a start date without inventing a deadline", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, startDate: null, endDate: null }, error: null })
    expect(await scheduleMemberWorkspaceTaskAction({ ...schedule, startDate: "", expectedEndDate: "" })).toEqual({ ok: true, taskId, startDate: "", endDate: "" })
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_start_date: null, p_expected_end_date: null })
  })

  it("rejects a read-only actor before elevated access", async () => {
    mocks.actor.mockResolvedValue(actor({ canEdit: false }))
    expect(await scheduleMemberWorkspaceTaskAction(schedule)).toHaveProperty("error")
    expect(await moveMemberWorkspaceTaskAction(move)).toHaveProperty("error")
    expect(mocks.admin).not.toHaveBeenCalled()
  })

  it("rejects another organization's project without task writes", async () => {
    mocks.actor.mockResolvedValue(actor({ activeOrg: { orgId: "org-b", role: "editor" } }))
    expect(await scheduleMemberWorkspaceTaskAction(schedule)).toHaveProperty("error")
    expect(await moveMemberWorkspaceTaskAction(move)).toHaveProperty("error")
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("uses verified platform scope even when a support workspace is selected", async () => {
    mocks.auth.mockResolvedValue({ profileAudience: { platformAccessLevel: "developer" }, activeOrg: { orgId: "unrelated-support-org", supportAccess: true } })
    mocks.actor.mockResolvedValue(actor({ isAdmin: true, canEdit: false }))
    expect(await scheduleMemberWorkspaceTaskAction(schedule)).toHaveProperty("ok", true)
    expect(mocks.actor).toHaveBeenCalledWith("platform")
  })

  it.each(["stale", "invalid_dates", "invalid_task", "task_not_found"])("returns %s rejection without success revalidation", async (code) => {
    mocks.rpc.mockResolvedValue({ data: { ok: false, code }, error: null })
    expect(await scheduleMemberWorkspaceTaskAction(schedule)).toHaveProperty("error")
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })

  it("sends relative neighbor and both versions, never a filtered project list", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, projectId }, error: null })
    expect(await moveMemberWorkspaceTaskAction(move)).toEqual({ ok: true, projectId })
    expect(mocks.rpc).toHaveBeenCalledWith("move_organization_task_transition", {
      p_actor_id: "verified-user", p_task_id: taskId, p_project_id: projectId, p_expected_org_id: "org-a",
      p_neighbor_task_id: neighborTaskId, p_placement: "before", p_expected_sort_order: 3, p_expected_neighbor_sort_order: 1,
      p_expected_updated_at: move.expectedUpdatedAt, p_expected_neighbor_updated_at: move.expectedNeighborUpdatedAt,
    })
  })

  it("rejects a task as its own neighbor before data access", async () => {
    expect(await moveMemberWorkspaceTaskAction({ ...move, neighborTaskId: taskId })).toHaveProperty("error")
    expect(mocks.actor).not.toHaveBeenCalled()
  })

  it("does not report uncertain RPC failure or stale order as saved", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "08006" } })
    expect(await moveMemberWorkspaceTaskAction(move)).toHaveProperty("error")
    mocks.rpc.mockResolvedValue({ data: { ok: false, code: "stale" }, error: null })
    expect(await moveMemberWorkspaceTaskAction(move)).toHaveProperty("error")
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })

  it("rejects incomplete or mismatched success receipts without reporting saved", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true }, error: null })
    expect(await scheduleMemberWorkspaceTaskAction(schedule)).toHaveProperty("error")
    expect(await moveMemberWorkspaceTaskAction(move)).toHaveProperty("error")
    mocks.rpc.mockResolvedValue({ data: { ok: true, projectId: neighborTaskId }, error: null })
    expect(await moveMemberWorkspaceTaskAction(move)).toHaveProperty("error")
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
})
