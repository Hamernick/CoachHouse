import "./test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ actor: vi.fn(), organizations: vi.fn(), canonical: vi.fn(), people: vi.fn(), workstreams: vi.fn() }))
vi.mock("@/features/member-workspace/server/member-workspace-actor-context", () => ({ resolveMemberWorkspaceActorContext: mocks.actor }))
vi.mock("@/features/member-workspace/server/admin-organization-overview", () => ({ loadAdminOrganizationSummaries: mocks.organizations, mapAdminOrganizationSummaryToProject: vi.fn() }))
vi.mock("@/features/member-workspace/server/admin-projects", () => ({ ensureCanonicalAdminProjects: mocks.canonical, attachCanonicalProjectIdsToOrganizations: ({ organizations }: { organizations: unknown[] }) => organizations }))
vi.mock("@/features/member-workspace/server/person-options", () => ({ loadMemberWorkspacePersonOptionsForOrganizations: mocks.people }))
vi.mock("@/features/member-workspace/server/admin-workstreams", () => ({ loadPlatformAdminWorkstreamConfiguration: mocks.workstreams }))

import { loadMemberWorkspaceProjectsPage } from "@/features/member-workspace/server/project-loaders"

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
  it("loads standard database projects without creating canonical organization cards", async () => {
    const query = fixtureQuery([{
      id: "project-1", org_id: "org-1", project_kind: "standard", name: "Clinic launch",
      start_date: "2026-09-01", end_date: "2026-09-30", status: "active", priority: "medium",
      task_count: 2, progress: 25, tags: [], member_labels: [], created_source: "user",
    }])
    mocks.actor.mockResolvedValue({ isAdmin: true, supabase: { from: () => query } })
    const result = await loadMemberWorkspaceProjectsPage({ directory: "projects" })
    expect(result.projects).toHaveLength(1)
    expect(result.projects[0]).toMatchObject({ id: "project-1", name: "Clinic launch", client: "Legal Wellness", organizationId: "org-1" })
    expect(query.in).toHaveBeenCalledWith("org_id", ["org-1"])
    expect(query.eq).toHaveBeenCalledWith("project_kind", "standard")
    expect(query.neq).toHaveBeenCalledWith("created_source", "starter_seed")
    expect(mocks.canonical).not.toHaveBeenCalled()
    expect(result.canCreateProjects).toBe(true)
  })
  it("limits project queries and creation choices to the coach's organization scope", async () => {
    mocks.organizations.mockResolvedValue([{ orgId: "allowed", name: "Allowed" }, { orgId: "private", name: "Private" }])
    const query = fixtureQuery([])
    mocks.actor.mockResolvedValue({ isAdmin: false, canAccessOrganizations: true, organizationCoachScope: { mode: "assigned", organizationIds: new Set(["allowed"]) }, supabase: { from: () => query } })
    const result = await loadMemberWorkspaceProjectsPage({ directory: "projects" })
    expect(query.in).toHaveBeenCalledWith("org_id", ["allowed"])
    expect(result.organizationOptions).toEqual([{ orgId: "allowed", name: "Allowed" }])
  })
  it("does not substitute organization cards when project storage is unavailable", async () => {
    const query = fixtureQuery(null, { code: "42P01", message: 'relation "organization_projects" does not exist' })
    mocks.actor.mockResolvedValue({ isAdmin: true, supabase: { from: () => query } })
    const result = await loadMemberWorkspaceProjectsPage({ directory: "projects" })
    expect(result.projects).toEqual([])
    expect(result.canCreateProjects).toBe(false)
    expect(mocks.canonical).not.toHaveBeenCalled()
  })
})
