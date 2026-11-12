import "./test-utils"
const audience=vi.hoisted(()=>vi.fn(async (rows:unknown[])=>rows))
vi.mock("@/lib/organization/document-activity-audience",()=>({filterDocumentActivityAudience:audience}))
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { buildActivityDays } from "@/features/coach-dashboard/lib"
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  from: vi.fn(),
  tasks: vi.fn(),
  scope: vi.fn(),
}))
vi.mock("@/lib/admin/organization-coach-scope", () => ({ loadOrganizationCoachActorScope: mocks.scope }))
vi.mock("@/features/coach-dashboard/hooks/use-coach-dashboard-controller", () => ({ useCoachDashboardController: () => {} }))
vi.mock("@/features/coach-dashboard/components/coach-dashboard-tools", () => ({ CoachDashboardTools: () => null }))
vi.mock("@/features/member-workspace/client", () => ({ PlatformRevenueStat: () => null }))
vi.mock("@/lib/admin/auth", () => ({ requirePlatformCapability: mocks.auth }))
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: mocks.from }),
}))
vi.mock("@/features/member-workspace", () => ({
  loadMemberWorkspaceTasksPage: mocks.tasks,
}))
import { loadCoachDashboard } from "@/features/coach-dashboard/server/actions"
import { CoachDashboardPanel } from "@/features/coach-dashboard/components/coach-dashboard-panel"
const queries: { table: string; calls: [string, unknown[]][] }[] = []
let activityFails = false
let organizationsFail = false
let projectUnassigned = false
let activity: Record<string, unknown>[] = []
let organizations = [{ user_id: "assigned-org", profile: { name: "Assigned organization" } }]
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
      if (organizationsFail) return { data: null, error: { code: "offline" } }
    if (table === "organizations")
      return {
        data: organizations.filter((organization) => {
          const ids = calls.find(([method, args]) => method === "in" && args[0] === "user_id")?.[1][1] as string[] | undefined
          return !ids || ids.includes(organization.user_id)
        }),
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
            organization_unassigned: projectUnassigned,
          },
        ],
        count: 12,
        error: null,
      }
    return activityFails
      ? { data: null, error: { code: "42P01" } }
      : { data: activity, error: null, count: activity.length }
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
    organizationsFail = false
    projectUnassigned = false
    activity = []
    organizations = [{ user_id: "assigned-org", profile: { name: "Assigned organization" } }]
    mocks.scope.mockResolvedValue({ mode: "all" })
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
  it.each(["coach", "developer"])("includes the staff demo throughout the %s dashboard while excluding recording fixtures", async (accessLevel) => {
    const demoId = "fe0fd7c3-c0fd-4c20-9e80-b14d68da5d0c"
    const fixtureId = "886455ec-a664-4f13-83f1-471ddd1f5ffd"
    organizations = [
      { user_id: demoId, profile: { name: "Karissa is a Boss" } },
      { user_id: fixtureId, profile: { name: "Recording fixture" } },
    ]
    mocks.auth.mockResolvedValue({ userId: "staff", accessLevel })
    mocks.scope.mockResolvedValue(accessLevel === "coach"
      ? { mode: "assigned", organizationIds: new Set([demoId, fixtureId]) }
      : { mode: "all" })

    const result = await loadCoachDashboard(accessLevel === "developer" ? "all" : "assigned")

    expect(result.organizationCount).toBe(1)
    expect(result.organizations).toEqual([{ id: demoId, name: "Karissa is a Boss", href: expect.stringContaining("Karissa%20is%20a%20Boss") }])
    const scopedQueries = queries.filter((q) => q.calls.some(([method]) => method === "in"))
    expect(scopedQueries).toHaveLength(4)
    for (const q of scopedQueries) {
      expect(q.calls).toContainEqual(["in", [q.table === "organizations" ? "user_id" : "org_id", [demoId]]])
    }
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
  it("keeps directory links consistent with access to unassigned organizations", async () => {
    mocks.scope.mockResolvedValue({ mode: "assigned", organizationIds: new Set(["assigned-org"]), canAccessUnassigned: true })
    const result = await loadCoachDashboard()
    const markup = renderToStaticMarkup(createElement(CoachDashboardPanel, { input: result }))
    expect(result.directoryCoachFilter).toBe("all")
    expect(markup).toContain('href="/organizations?coach=all"')
    expect(markup).toContain('href="/projects?view=board"')
    expect(markup).toContain("Your assigned and unassigned organizations")
  })
  it("links organization, project, and deleted-project activity to usable destinations", async () => {
    mocks.auth.mockResolvedValue({ userId: "admin", accessLevel: "developer" })
    activity = [
      { id: "org-event", org_id: "assigned-org", project_id: "canonical", project: { project_kind: "organization_admin" } },
      { id: "project-event", org_id: "assigned-org", project_id: "standard", project: { project_kind: "standard" } },
      { id: "document-or-deleted-event", org_id: "assigned-org", project_id: null, project: null },
    ]
    const result = await loadCoachDashboard("all")
    expect(result.activity.map(event => event.href)).toEqual([
      "/organizations/canonical", "/projects/standard", "/organizations?coach=all&search=Assigned%20organization",
    ])
  })
  it("preserves no-organization projects and routes personal tasks through their authorized list", async () => {
    projectUnassigned = true
    mocks.tasks.mockResolvedValue({ taskGroups: [{ tasks: [{ id: "outside", title: "Cross-scope assignment", status: "todo", endDate: "2026-10-01", projectId: "forbidden-parent", canUpdate: false }] }] })
    const result = await loadCoachDashboard()
    expect(result.projects[0]?.organization).toBe("No organization")
    const markup = renderToStaticMarkup(createElement(CoachDashboardPanel, { input: result }))
    expect(markup).toMatch(/href="\/tasks"[^>]*>[\s\S]*?Cross-scope assignment/)
    expect(markup).not.toContain('/projects/forbidden-parent')
  })
  it("reports organization load failure without presenting an empty successful directory", async () => {
    organizationsFail = true
    const result = await loadCoachDashboard()
    expect(result.organizationCount).toBeNull()
    expect(result.issues).toContain("Organizations could not be loaded.")
  })
  it("filters private titles and contribution dates, and withholds failed audience reads", async () => {
    activity=[{id:"private",title:"Private file",org_id:"assigned-org",project_id:null,entity_type:"file",occurred_at:"2026-11-06T12:00:00Z"}]
    audience.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    const hidden=await loadCoachDashboard()
    expect(hidden.activity).toEqual([]);expect(hidden.personalActivity).toEqual([])
    expect(audience).toHaveBeenCalledWith(activity,"coach")
    audience.mockRejectedValueOnce(new Error("private failure")).mockRejectedValueOnce(new Error("private failure"))
    const denied=await loadCoachDashboard()
    expect(denied.activity).toEqual([]);expect(denied.personalActivity).toEqual([])
    expect(denied.issues).toContain("Activity history is unavailable.")
    expect(JSON.stringify(denied)).not.toContain("Private file")
  })

})
