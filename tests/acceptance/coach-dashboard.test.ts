import "./test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildActivityDays } from "@/features/coach-dashboard/lib"
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  from: vi.fn(),
  tasks: vi.fn(),
}))
vi.mock("@/lib/admin/auth", () => ({ requirePlatformCapability: mocks.auth }))
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: mocks.from }),
}))
vi.mock("@/features/member-workspace", () => ({
  loadMemberWorkspaceTasksPage: mocks.tasks,
}))
import { loadCoachDashboard } from "@/features/coach-dashboard/server/actions"
const queries: { table: string; calls: [string, unknown[]][] }[] = []
let activityFails = false
function query(table: string) {
  const calls: [string, unknown[]][] = []
  queries.push({ table, calls })
  const rows = () => {
    if (table === "profiles")
      return {
        data: {
          full_name: "Coach",
          email: "coach@example.org",
          avatar_url: null,
        },
        error: null,
      }
    if (table === "organization_coach_assignments")
      return { data: [{ organization_id: "assigned-org" }], error: null }
    if (table === "organizations")
      return {
        data: [
          {
            user_id: "assigned-org",
            profile: { name: "Assigned organization" },
          },
        ],
        error: null,
      }
    if (table === "organization_projects")
      return {
        data: [
          {
            id: "project",
            name: "Real project",
            org_id: "assigned-org",
            end_date: "2026-10-01",
            status: "active",
          },
        ],
        count: 12,
        error: null,
      }
    return activityFails
      ? { data: null, error: { code: "42P01" } }
      : { data: [], error: null, count: 0 }
  }
  const chain: Record<string, unknown> = {}
  for (const name of [
    "select",
    "eq",
    "in",
    "neq",
    "not",
    "gte",
    "order",
    "limit",
  ])
    chain[name] = (...args: unknown[]) => {
      calls.push([name, args])
      return chain
    }
  chain.maybeSingle = async () => rows()
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(rows()).then(resolve)
  return chain
}
describe("coach dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queries.length = 0
    activityFails = false
    mocks.auth.mockResolvedValue({ userId: "coach", accessLevel: "coach" })
    mocks.from.mockImplementation(query)
    mocks.tasks.mockResolvedValue({
      taskGroups: [
        {
          tasks: [
            {
              id: "task",
              title: "My task",
              endDate: "2026-10-01",
              status: "todo",
              projectId: "project",
              organizationName: "Assigned organization",
            },
            { id: "done", status: "done", endDate: "2026-09-01" },
          ],
        },
      ],
    })
  })
  it("authorizes before reading any dashboard data", async () => {
    mocks.auth.mockRejectedValue(new Error("forbidden"))
    await expect(loadCoachDashboard()).rejects.toThrow("forbidden")
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it("scopes organization/project/activity queries to the coach assignments and uses personal task loader", async () => {
    const result = await loadCoachDashboard()
    expect(mocks.auth).toHaveBeenCalledWith("organizations")
    expect(result.organizationCount).toBe(1)
    expect(result.projectCount).toBe(12)
    expect(
      queries.find((q) => q.table === "organization_projects")?.calls
    ).toContainEqual(["neq", ["created_source", "starter_seed"]])
    expect(result.taskCount).toBe(1)
    for (const q of queries.filter((q) =>
      [
        "organization_projects",
        "organization_project_activity_events",
      ].includes(q.table)
    ))
      expect(q.calls).toContainEqual(["in", ["org_id", ["assigned-org"]]])
    expect(
      queries.find((q) => q.table === "organization_coach_assignments")?.calls
    ).toContainEqual(["eq", ["coach_user_id", "coach"]])
  })
  it("does not widen coach scope when all organizations is requested", async () => {
    const result = await loadCoachDashboard("all")
    expect(result.scope).toBe("assigned")
    expect(queries.filter((q) => q.table === "organizations")).toHaveLength(1)
    expect(
      queries.find((q) => q.table === "organizations")?.calls
    ).toContainEqual(["in", ["user_id", ["assigned-org"]]])
  })
  it("allows developers to explicitly view all organizations", async () => {
    mocks.auth.mockResolvedValue({ userId: "admin", accessLevel: "developer" })
    const result = await loadCoachDashboard("all")
    expect(result.scope).toBe("all")
    expect(result.organizations[0]?.href).toContain("coach=all")
    expect(queries.filter((q) => q.table === "organizations")).toHaveLength(2)
  })
  it("reports missing activity without replacing it with fake events", async () => {
    activityFails = true
    const result = await loadCoachDashboard()
    expect(result.activity).toEqual([])
    expect(result.issues).toContain("Activity history is unavailable.")
    expect(result.taskCount).toBe(1)
  })
  it("counts recorded activity by day and excludes future/invalid events", () => {
    const days = buildActivityDays(
      [
        "2026-09-20T10:00:00Z",
        "2026-09-20T11:00:00Z",
        "2026-09-21T10:00:00Z",
        "invalid",
      ],
      new Date("2026-09-20T12:00:00Z")
    )
    expect(days.reduce((sum, day) => sum + day.count, 0)).toBe(2)
    expect(days.length % 7).toBe(0)
  })
})
