import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import {
  createActivityRefresh,
  startVisibleActivityPolling,
} from "@/features/member-workspace/lib/project-activity-refresh"
import type { OrganizationActivityResult } from "@/features/member-workspace/server/project-activity"

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe("activity refresh", () => {
  it("polls only visible pages, refreshes on focus, and removes timers/listeners", async () => {
    vi.useFakeTimers()
    const document = Object.assign(new EventTarget(), {
      visibilityState: "visible",
    })
    const window = Object.assign(new EventTarget(), {
      setInterval,
      clearInterval,
    })
    vi.stubGlobal("document", document)
    vi.stubGlobal("window", window)
    const refresh = vi.fn().mockResolvedValue(undefined)
    const stop = startVisibleActivityPolling(refresh)
    expect(refresh).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(refresh).toHaveBeenCalledTimes(2)
    document.visibilityState = "hidden"
    await vi.advanceTimersByTimeAsync(60_000)
    expect(refresh).toHaveBeenCalledTimes(2)
    document.visibilityState = "visible"
    document.dispatchEvent(new Event("visibilitychange"))
    window.dispatchEvent(new Event("focus"))
    expect(refresh).toHaveBeenCalledTimes(4)
    stop()
    await vi.advanceTimersByTimeAsync(60_000)
    window.dispatchEvent(new Event("focus"))
    expect(refresh).toHaveBeenCalledTimes(4)
  })
  it("prevents overlapping requests and ignores responses after disposal", async () => {
    let resolve!: (result: OrganizationActivityResult) => void
    const load = vi.fn(
      () =>
        new Promise<OrganizationActivityResult>((done) => {
          resolve = done
        })
    )
    const onResult = vi.fn()
    const onPending = vi.fn()
    const controller = createActivityRefresh({ load, onResult, onPending })
    const pending = controller.refresh()
    await controller.refresh()
    expect(load).toHaveBeenCalledTimes(1)
    controller.dispose()
    resolve({ state: "ready", items: [] })
    await pending
    expect(onResult).not.toHaveBeenCalled()
    await controller.refresh()
    expect(load).toHaveBeenCalledTimes(1)
  })
  it("reports network failures and can retry after failure", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ state: "ready", items: [] })
    const onResult = vi.fn()
    const onPending = vi.fn()
    const controller = createActivityRefresh({ load, onResult, onPending })
    await controller.refresh()
    expect(onResult).toHaveBeenLastCalledWith({ state: "error", items: [] })
    expect(onPending).toHaveBeenLastCalledWith(false)
    await controller.refresh()
    expect(onResult).toHaveBeenLastCalledWith({ state: "ready", items: [] })
  })
})

const accessMocks = vi.hoisted(() => ({ actor: vi.fn(), load: vi.fn() }))
vi.mock(
  "@/features/member-workspace/server/member-workspace-actor-context",
  () => ({ resolveMemberWorkspaceActorContext: accessMocks.actor })
)
vi.mock("@/features/member-workspace/server/project-activity", () => ({
  loadOrganizationProjectActivityResult: accessMocks.load,
}))
import { refreshOrganizationProjectActivity } from "@/features/member-workspace/server/project-activity-actions"

const orgId = "10000000-0000-4000-8000-000000000001"
const projectId = "20000000-0000-4000-8000-000000000002"
describe("activity refresh authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it("rejects malformed IDs before accessing the database", async () => {
    expect(
      await refreshOrganizationProjectActivity({
        orgId,
        projectId: "bad,filter",
      })
    ).toMatchObject({ state: "error" })
    expect(accessMocks.actor).not.toHaveBeenCalled()
  })
  it("denies coaches outside their assignment scope before reading events", async () => {
    const from = vi.fn()
    accessMocks.actor.mockResolvedValue({
      hasMemberWorkspaceAccess: true,
      canAccessOrganizations: true,
      isAdmin: false,
      organizationCoachScope: { mode: "assigned", organizationIds: new Set() },
      supabase: { from },
    })
    expect(
      await refreshOrganizationProjectActivity({ orgId, projectId })
    ).toMatchObject({ state: "forbidden" })
    expect(from).not.toHaveBeenCalled()
    expect(accessMocks.load).not.toHaveBeenCalled()
  })
  it("requires the project to belong to the authorized organization", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const supabase = { from: () => query }
    accessMocks.actor.mockResolvedValue({
      hasMemberWorkspaceAccess: true,
      canAccessOrganizations: true,
      isAdmin: false,
      organizationCoachScope: {
        mode: "assigned",
        organizationIds: new Set([orgId]),
      },
      supabase,
    })
    expect(
      await refreshOrganizationProjectActivity({ orgId, projectId })
    ).toMatchObject({ state: "forbidden" })
    expect(query.eq).toHaveBeenCalledWith("org_id", orgId)
    expect(accessMocks.load).not.toHaveBeenCalled()
    query.maybeSingle.mockResolvedValue({
      data: { id: projectId } as never,
      error: null,
    })
    accessMocks.load.mockResolvedValue({ state: "ready", items: [] })
    expect(
      await refreshOrganizationProjectActivity({ orgId, projectId })
    ).toMatchObject({ state: "ready" })
    expect(accessMocks.load).toHaveBeenCalledWith({
      orgId,
      projectId,
      supabase,
    })
  })
})
