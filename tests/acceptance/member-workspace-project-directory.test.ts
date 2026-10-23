import "./test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ actor: vi.fn(), organizations: vi.fn(), canonical: vi.fn(), people: vi.fn(), workstreams: vi.fn() }))
vi.mock("@/features/member-workspace/server/member-workspace-actor-context", () => ({ resolveMemberWorkspaceActorContext: mocks.actor }))
vi.mock("@/features/member-workspace/server/admin-organization-overview", () => ({ loadAdminOrganizationSummaries: mocks.organizations, mapAdminOrganizationSummaryToProject: vi.fn() }))
vi.mock("@/features/member-workspace/server/admin-projects", () => ({ ensureCanonicalAdminProjects: mocks.canonical, attachCanonicalProjectIdsToOrganizations: ({ organizations }: { organizations: unknown[] }) => organizations }))
vi.mock("@/features/member-workspace/server/person-options", () => ({ loadMemberWorkspacePersonOptionsForOrganizations: mocks.people }))
vi.mock("@/features/member-workspace/server/admin-workstreams", () => ({ loadPlatformAdminWorkstreamConfiguration: mocks.workstreams }))

import { loadMemberWorkspaceProjectsPage } from "@/features/member-workspace/server/project-loaders"
import { computeMemberWorkspaceProjectFilterCounts, filterMemberWorkspaceProjects } from "@/features/member-workspace/components/projects/member-workspace-project-filters"
import { DEFAULT_MEMBER_WORKSPACE_PROJECT_VIEW_OPTIONS } from "@/features/member-workspace/components/projects/member-workspace-project-view-options"

function fixtureQuery(data: unknown, error: unknown = null) {
  const query = { select: vi.fn(), in: vi.fn(), eq: vi.fn(), neq: vi.fn(), order: vi.fn(), returns: vi.fn().mockResolvedValue({ data, error }) }
  for (const method of [query.select, query.in, query.eq, query.neq, query.order]) method.mockReturnValue(query)
  return query
}

describe("Projects directory", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.organizations.mockResolvedValue([{ orgId: "org-1", name: "Legal Wellness" }])
    mocks.people.mockResolvedValue([])
    mocks.workstreams.mockResolvedValue(null)
  })
  it("filters authorized fiscal projects by current reviewers without changing memberships or duplicating projects", async () => {
    const project = {
      id: "fiscal-1", org_id: "private-host", project_kind: "standard", name: "Application",
      start_date: null, end_date: null, status: "active", priority: "medium",
      task_count: 0, progress: 0, tags: [], member_labels: ["Former reviewer"], created_source: "system",
    }
    mocks.people.mockResolvedValue([
      { id: "fs", name: "Karissa", groupKey: "platform-admins" },
      { id: "joel", name: "Joel", groupKey: "platform-admins" },
      { id: "other", name: "Other staff", groupKey: "platform-admins" },
      { id: "host-member", name: "Host member", groupKey: "organization" },
    ])
    const reviewerData = { data: [
      { project_id: "fiscal-1", user_id: "fs" },
      { project_id: "fiscal-1", user_id: "fs" },
      { project_id: "fiscal-1", user_id: "joel" },
      { project_id: "fiscal-1", user_id: "revoked" },
      { project_id: "fiscal-1", user_id: "host-member" },
      { project_id: "inaccessible-project", user_id: "other" },
    ], error: null }
    const reviewerQuery = {
      select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
      then: Promise.resolve(reviewerData).then.bind(Promise.resolve(reviewerData)),
    }
    const standardQuery = fixtureQuery([])
    const from = vi.fn((table: string) => {
      if (table === "organization_projects") return standardQuery
      if (table === "fiscal_project_reviewers") return reviewerQuery
      throw new Error(`Unexpected table: ${table}`)
    })
    const rpc = vi.fn().mockResolvedValue({ data: [project], error: null })
    mocks.actor.mockResolvedValue({ userId: "fs", isAdmin: false, canAccessOrganizations: true, supabase: { from, rpc } })

    const result = await loadMemberWorkspaceProjectsPage({ directory: "projects" })
    expect(rpc).toHaveBeenCalledWith("list_fiscal_guest_projects", { p_user_id: "fs" })
    expect(reviewerQuery.select).toHaveBeenCalledWith("project_id, user_id")
    expect(reviewerQuery.in.mock.calls).toEqual([
      ["project_id", ["fiscal-1"]], ["user_id", ["fs", "joel", "other"]],
    ])
    expect(result.projects).toHaveLength(1)
    expect(result.projects[0].members).toEqual(["Joel", "Karissa"])
    expect(project.member_labels).toEqual(["Former reviewer"])
    expect(from.mock.calls.map(([table]) => table)).toEqual(["organization_projects", "fiscal_project_reviewers"])
    const options = { directory: "projects" as const, projects: result.projects, viewOptions: DEFAULT_MEMBER_WORKSPACE_PROJECT_VIEW_OPTIONS }
    for (const name of ["Karissa", "Joel"]) {
      expect(filterMemberWorkspaceProjects({ ...options, filters: [{ key: "Member", value: name }] }).map(({ id }) => id)).toEqual(["fiscal-1"])
    }
    for (const name of ["Former reviewer", "Host member", "Other staff", "No member"]) {
      expect(filterMemberWorkspaceProjects({ ...options, filters: [{ key: "Member", value: name }] })).toEqual([])
    }
    expect(computeMemberWorkspaceProjectFilterCounts({ ...options, filters: [] }).members).toEqual({ joel: 1, karissa: 1 })
  })

  it("does not query reviewer assignments when fiscal project authorization fails", async () => {
    mocks.organizations.mockResolvedValue([])
    const from = vi.fn()
    mocks.actor.mockResolvedValue({ userId: "denied", isAdmin: true, supabase: {
      from, rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "Denied", code: "42501" } }),
    } })
    await expect(loadMemberWorkspaceProjectsPage({ directory: "projects" })).rejects.toThrow()
    expect(from).not.toHaveBeenCalled()
  })

  it("surfaces reviewer lookup failure instead of showing an unassigned fiscal project", async () => {
    mocks.organizations.mockResolvedValue([])
    mocks.people.mockResolvedValue([{ id: "fs", name: "Karissa", groupKey: "platform-admins" }])
    const failure = Promise.resolve({ data: null, error: { message: "Unavailable" } })
    const query = { select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), then: failure.then.bind(failure) }
    mocks.actor.mockResolvedValue({ isAdmin: true, supabase: {
      from: vi.fn(() => query), rpc: vi.fn().mockResolvedValue({ data: [{ id: "fiscal-1" }], error: null }),
    } })
    await expect(loadMemberWorkspaceProjectsPage({ directory: "projects" })).rejects.toThrow()
  })
  it("loads standard database projects without creating canonical organization cards", async () => {
    const query = fixtureQuery([{
      id: "project-1", org_id: "org-1", project_kind: "standard", name: "Clinic launch",
      start_date: "2026-09-01", end_date: "2026-09-30", status: "active", priority: "medium",
      task_count: 2, progress: 25, tags: [], member_labels: [], created_source: "user",
    }])
    mocks.actor.mockResolvedValue({ isAdmin: true, supabase: { from: () => query, rpc: vi.fn().mockResolvedValue({ data: [], error: null }) } })
    const result = await loadMemberWorkspaceProjectsPage({ directory: "projects" })
    expect(result.projects).toHaveLength(1)
    expect(result.projects[0]).toMatchObject({ id: "project-1", name: "Clinic launch", client: "Legal Wellness", organizationId: "org-1" })
    expect(query.in).toHaveBeenCalledWith("org_id", ["org-1"])
    expect(query.eq).toHaveBeenCalledWith("project_kind", "standard")
    expect(query.neq).toHaveBeenCalledWith("created_source", "starter_seed")
    expect(query.order.mock.calls).toEqual([["created_at", { ascending: false }]])
    expect(mocks.canonical).not.toHaveBeenCalled()
    expect(result.canCreateProjects).toBe(true)
  })
  it("limits project queries and creation choices to the coach's organization scope", async () => {
    mocks.organizations.mockResolvedValue([{ orgId: "allowed", name: "Allowed" }, { orgId: "private", name: "Private" }])
    const query = fixtureQuery([])
    mocks.actor.mockResolvedValue({ isAdmin: false, canAccessOrganizations: true, organizationCoachScope: { mode: "assigned", organizationIds: new Set(["allowed"]) }, supabase: { from: () => query, rpc: vi.fn().mockResolvedValue({ data: [], error: null }) } })
    const result = await loadMemberWorkspaceProjectsPage({ directory: "projects" })
    expect(query.in).toHaveBeenCalledWith("org_id", ["allowed"])
    expect(result.organizationOptions).toEqual([{ orgId: "allowed", name: "Allowed" }])
  })
  it("shows only canonical organization cards in the Organizations directory", async () => {
    const query = fixtureQuery([{
      id: "project-1", org_id: "org-1", project_kind: "standard", name: "Clinic launch",
      start_date: "2026-09-01", end_date: "2026-09-30", status: "active", priority: "medium",
      task_count: 2, progress: 25, tags: [], member_labels: [], created_source: "user",
    }])
    const from = vi.fn(() => query)
    mocks.actor.mockResolvedValue({ isAdmin: true, supabase: { from } })
    mocks.canonical.mockResolvedValue([{
      id: "org-card", org_id: "org-1", canonical_org_id: "org-1",
      project_kind: "organization_admin", name: "Legal Wellness",
      start_date: "2026-09-01", end_date: "2026-09-30", status: "planned", priority: "medium",
      task_count: 0, progress: 0, tags: [], member_labels: [], created_source: "system",
    }])

    const result = await loadMemberWorkspaceProjectsPage({ directory: "organizations" })

    expect(result.projects.map(({ id }) => id)).toEqual(["org-card"])
    expect(result.projects[0].projectKind).toBe("organization_admin")
    expect(from).not.toHaveBeenCalled()
    expect(mocks.canonical).toHaveBeenCalledOnce()
  })
  it("does not substitute organization cards when project storage is unavailable", async () => {
    const query = fixtureQuery(null, { code: "42P01", message: 'relation "organization_projects" does not exist' })
    mocks.actor.mockResolvedValue({ isAdmin: true, supabase: { from: () => query, rpc: vi.fn().mockResolvedValue({ data: [], error: null }) } })
    const result = await loadMemberWorkspaceProjectsPage({ directory: "projects" })
    expect(result.projects).toEqual([])
    expect(result.canCreateProjects).toBe(false)
    expect(mocks.canonical).not.toHaveBeenCalled()
  })

  describe.each(["organizations", "projects"] as const)("%s demo visibility", (directory) => {
    it.each(["admin", "assigned coach", "unassigned coach"])("preserves staff demo visibility and scope for %s", async (role) => {
      const demo = { orgId: "fe0fd7c3-c0fd-4c20-9e80-b14d68da5d0c", name: "Karissa is a Boss" }
      const fixture = { orgId: "886455ec-a664-4f13-83f1-471ddd1f5ffd", name: "Recording fixture" }
      const query = fixtureQuery([])
      const supabase = { from: vi.fn(() => query), rpc: vi.fn().mockResolvedValue({ data: [], error: null }) }
      mocks.organizations.mockResolvedValue([demo, fixture])
      mocks.canonical.mockResolvedValue([])
      mocks.actor.mockResolvedValue({
        isAdmin: role === "admin",
        canAccessOrganizations: true,
        organizationCoachScope: role === "admin"
          ? { mode: "all" }
          : { mode: "assigned", organizationIds: new Set(role === "assigned coach" ? [demo.orgId, fixture.orgId] : [fixture.orgId]) },
        supabase,
      })

      const result = await loadMemberWorkspaceProjectsPage({ directory })
      const expected = role === "unassigned coach" ? [] : [demo]

      expect(result.organizationOptions).toEqual(expected)
      if (directory === "organizations") {
        expect(mocks.canonical).toHaveBeenCalledWith({ organizations: expected, supabase })
      } else if (expected.length) {
        expect(query.in).toHaveBeenCalledWith("org_id", [demo.orgId])
      } else {
        expect(supabase.from).not.toHaveBeenCalled()
      }
    })
  })
})
