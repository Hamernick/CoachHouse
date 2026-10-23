import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  calendarDay,
  dateOnly,
  navigateTimeline,
  shiftDay,
  timelineGeometry,
} from "@/features/member-workspace/lib/project-timeline"

const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  auth: vi.fn(),
  admin: vi.fn(),
  revalidate: vi.fn(),
  transition: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock(
  "@/features/member-workspace/server/member-workspace-actor-context",
  () => ({ resolveMemberWorkspaceActorContext: mocks.actor })
)
vi.mock("@/lib/auth/request-context", () => ({
  resolveAuthenticatedAppContext: mocks.auth,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.admin,
}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))
vi.mock(
  "@/features/member-workspace/server/project-transition-support",
  () => ({ transitionOrganizationProjectSchedule: mocks.transition })
)
import {
  loadProjectTimelineAction,
  saveProjectTimelineDatesAction,
  saveProjectTimelineStatusAction,
} from "@/features/member-workspace/server/project-timeline-actions"

const projectId = "10000000-0000-4000-8000-000000000001",
  taskId = "10000000-0000-4000-8000-000000000002"
const input = {
  projectId,
  taskId,
  startDate: "2026-10-22",
  endDate: "2026-10-24",
  expectedStartDate: "",
  expectedEndDate: "2026-10-23",
}
function query(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  }
}
const project = query({
  id: projectId,
  org_id: "org-a",
  task_count: 1,
  project_kind: "standard",
  created_source: "user",
})
const schedule = query({
  start_date: null,
  end_date: input.expectedEndDate,
  updated_at: "2026-10-20T00:00:00Z",
  recurrence: "none",
})
const tasks = query([])
const write = query({
  id: taskId,
  start_date: input.startDate,
  end_date: input.endDate,
  status: "done",
})
const rpc = vi.fn()
function actor(overrides: Record<string, unknown> = {}) {
  return {
    userId: "verified-user",
    isAdmin: false,
    canEdit: true,
    hasMemberWorkspaceAccess: true,
    activeOrg: { orgId: "org-a", role: "editor" },
    supabase: {
      rpc,
      from: vi
        .fn()
        .mockImplementation((table) =>
          table === "organization_tasks" ? tasks : project
        ),
    },
    ...overrides,
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  rpc.mockResolvedValue({ data: null, error: null })
  project.maybeSingle.mockResolvedValue({
    data: {
      id: projectId,
      org_id: "org-a",
      task_count: 1,
      project_kind: "standard",
      created_source: "user",
    },
    error: null,
  })
  tasks.range.mockResolvedValue({ data: [], error: null })
  write.maybeSingle.mockResolvedValue({
    data: {
      id: taskId,
      start_date: input.startDate,
      end_date: input.endDate,
      status: "done",
    },
    error: null,
  })
  mocks.actor.mockResolvedValue(actor())
  mocks.auth.mockResolvedValue({
    profileAudience: { platformAccessLevel: null },
  })
  mocks.admin.mockReturnValue({ from: vi.fn().mockReturnValue(write) })
  mocks.transition.mockResolvedValue({ ok: true })
})

describe("timeline calendar geometry", () => {
  it("uses calendar days across daylight saving and leap dates", () => {
    expect(shiftDay("2026-03-08", 1)).toBe("2026-03-09")
    expect(shiftDay("2024-02-28", 1)).toBe("2024-02-29")
    expect(calendarDay("2026-02-29")).toBeNull()
    expect(dateOnly(new Date("2026-10-20T00:00:00Z"))).toBe("2026-10-20")
    expect(navigateTimeline("2026-01-31", "Month", 1)).toBe("2026-02-01")
    expect(navigateTimeline("2026-10-20", "Quarter", 1)).toBe("2027-01-01")
  })
  it("keeps partial, single-day, undated and clipped records distinct", () => {
    expect(timelineGeometry("", "", "2026-10-20", 7, 40)).toBeNull()
    expect(
      timelineGeometry("", "2026-10-20", "2026-10-20", 7, 40)
    ).toMatchObject({ left: 0, width: 40 })
    expect(
      timelineGeometry("2026-10-20", "", "2026-10-20", 7, 40)
    ).toMatchObject({ left: 0, width: 40 })
    expect(
      timelineGeometry("2026-10-19", "2026-10-28", "2026-10-20", 7, 40)
    ).toEqual({
      outside: false,
      left: 0,
      width: 280,
      clippedStart: true,
      clippedEnd: true,
    })
    expect(
      timelineGeometry("2026-10-19", "2026-10-19", "2026-10-20", 7, 40)
    ).toMatchObject({ outside: true })
  })
})
describe("authenticated timeline actions", () => {
  it.each(["2026-02-29", "2026-13-01", "2026-10-25"])(
    "rejects invalid or reversed date %s before data access",
    async (startDate) => {
      expect(
        await saveProjectTimelineDatesAction({ ...input, startDate })
      ).toHaveProperty("error")
      expect(mocks.actor).not.toHaveBeenCalled()
    }
  )
  it("denies wrong organization and readonly writes before elevated access", async () => {
    for (const overrides of [
      { activeOrg: { orgId: "org-b" } },
      { canEdit: false },
      { hasMemberWorkspaceAccess: false },
    ]) {
      mocks.actor.mockResolvedValue(actor(overrides))
      expect(await saveProjectTimelineDatesAction(input)).toHaveProperty(
        "error"
      )
      expect(
        await saveProjectTimelineStatusAction({
          projectId,
          taskId,
          status: "done",
          expectedStatus: "todo",
        })
      ).toHaveProperty("error")
    }
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it.each([true, false])(
    "keeps fiscal scope %s out of ordinary timeline access",
    async (data) => {
      rpc.mockResolvedValue({ data, error: null })
      expect(await loadProjectTimelineAction(projectId)).toHaveProperty("error")
      expect(await saveProjectTimelineDatesAction(input)).toHaveProperty(
        "error"
      )
      expect(mocks.admin).not.toHaveBeenCalled()
    }
  )
  it("retains verified staff scope with a selected support workspace", async () => {
    mocks.auth.mockResolvedValue({
      profileAudience: { platformAccessLevel: "developer" },
      activeOrg: { orgId: "unrelated-support-org", supportAccess: true },
    })
    mocks.actor.mockResolvedValue(actor({ isAdmin: true, canEdit: false }))
    expect(await saveProjectTimelineDatesAction(input)).toHaveProperty(
      "ok",
      true
    )
    expect(mocks.actor).toHaveBeenCalledWith("platform")
  })
  it("writes only dates and actor with exact project/org/version and non-system guards", async () => {
    expect(await saveProjectTimelineDatesAction(input)).toMatchObject({
      ok: true,
      startDate: input.startDate,
      endDate: input.endDate,
    })
    expect(write.update).toHaveBeenCalledWith({
      start_date: input.startDate,
      end_date: input.endDate,
      updated_by: "verified-user",
    })
    expect(write.eq).toHaveBeenCalledWith("project_id", projectId)
    expect(write.eq).toHaveBeenCalledWith("org_id", "org-a")
    expect(write.eq).toHaveBeenCalledWith("id", taskId)
    expect(write.is).toHaveBeenCalledWith("start_date", null)
    expect(write.eq).toHaveBeenCalledWith("end_date", input.expectedEndDate)
    expect(write.neq).toHaveBeenCalledWith("created_source", "system")
  })
  it("does not overwrite a concurrent status or report a zero-row save as successful", async () => {
    write.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(
      await saveProjectTimelineStatusAction({
        projectId,
        taskId,
        status: "done",
        expectedStatus: "waiting",
      })
    ).toHaveProperty("error")
    expect(write.update).toHaveBeenCalledWith({
      status: "done",
      updated_by: "verified-user",
    })
    expect(write.eq).toHaveBeenCalledWith("status", "waiting")
    expect(await saveProjectTimelineDatesAction(input)).toHaveProperty("error")
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it("returns load failures and paginates all tasks without granting system edits", async () => {
    const task = {
      id: taskId,
      project_id: projectId,
      title: "Real task",
      status: "todo",
      start_date: null,
      end_date: null,
      created_source: "system",
    }
    tasks.range
      .mockResolvedValueOnce({ data: Array(500).fill(task), error: null })
      .mockResolvedValueOnce({ data: [task], error: null })
    const result = await loadProjectTimelineAction(projectId)
    expect(result).toHaveProperty("tasks.length", 501)
    if (!("error" in result))
      expect(result.tasks[0]).toMatchObject({
        canEdit: false,
        startDate: "",
        endDate: "",
      })
    expect(tasks.range).toHaveBeenNthCalledWith(2, 500, 999)
    tasks.range.mockResolvedValue({ data: null, error: { message: "failure" } })
    expect(await loadProjectTimelineAction(projectId)).toHaveProperty("error")
  })
  it("uses the atomic project transition and rejects stale client dates", async () => {
    const scopedActor = actor()
    scopedActor.supabase.from
      .mockReturnValueOnce(project)
      .mockReturnValueOnce(schedule)
    mocks.actor.mockResolvedValue(scopedActor)
    expect(
      await saveProjectTimelineDatesAction({ ...input, taskId: undefined })
    ).toHaveProperty("ok", true)
    expect(mocks.transition).toHaveBeenCalledWith({
      actorId: "verified-user",
      projectId,
      expectedOrgId: "org-a",
      expectedUpdatedAt: "2026-10-20T00:00:00Z",
      startDate: input.startDate,
      endDate: input.endDate,
    })
    scopedActor.supabase.from
      .mockReturnValueOnce(project)
      .mockReturnValueOnce(schedule)
    expect(
      await saveProjectTimelineDatesAction({
        ...input,
        taskId: undefined,
        expectedStartDate: "2026-10-20",
      })
    ).toHaveProperty("error")
    expect(mocks.transition).toHaveBeenCalledTimes(1)
  })
})
