import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ context: vi.fn(), admin: vi.fn(), scope: vi.fn(), organizations: vi.fn(), canonical: vi.fn(), people: vi.fn(), workstreams: vi.fn() }))
vi.mock("@/lib/auth/request-context", () => ({ resolveAuthenticatedAppContext: mocks.context }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("@/lib/admin/organization-coach-scope", () => ({ loadOrganizationCoachActorScope: mocks.scope }))
vi.mock("@/features/member-workspace/server/admin-organization-overview", () => ({ loadAdminOrganizationSummaries: mocks.organizations, mapAdminOrganizationSummaryToProject: (org: { name: string }) => ({ name: org.name }) }))
vi.mock("@/features/member-workspace/server/admin-projects", () => ({ ensureCanonicalAdminProjects: mocks.canonical, attachCanonicalProjectIdsToOrganizations: ({ organizations }: { organizations: unknown[] }) => organizations }))
vi.mock("@/features/member-workspace/server/person-options", () => ({ loadMemberWorkspacePersonOptionsForOrganizations: mocks.people }))
vi.mock("@/features/member-workspace/server/admin-workstreams", () => ({ loadPlatformAdminWorkstreamConfiguration: mocks.workstreams }))

import { resolveMemberWorkspaceActorContext } from "@/features/member-workspace/server/member-workspace-actor-context"
import { loadMemberWorkspaceProjectsPage } from "@/features/member-workspace/server/project-loaders"

const workspaceClient = { from: vi.fn(() => { throw new Error("Workspace projects must not feed the platform directory") }) }
const adminClient = { from: vi.fn(), rpc: vi.fn() }
function context(level: "developer" | "coach" | null = "developer") {
  return { supabase: workspaceClient, user: { id: "staff", user_metadata: { role: "admin" } },
    profileAudience: { isAdmin: level === "developer", isPlatformStaff: level !== null, platformAccessLevel: level },
    activeOrg: { orgId: "support-org", role: "admin", supportAccess: true } }
}

describe("platform directories while a support workspace is selected", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.context.mockResolvedValue(context())
    mocks.admin.mockReturnValue(adminClient)
    mocks.scope.mockResolvedValue({ mode: "all" })
    mocks.organizations.mockResolvedValue([{ orgId: "org-1", name: "Real organization" }])
    mocks.canonical.mockResolvedValue([{ id: "org-card", org_id: "org-1", canonical_org_id: "org-1", project_kind: "organization_admin", name: "Real organization", status: "active", priority: "medium", tags: [], member_labels: [], task_count: 0, progress: 0 }])
    mocks.people.mockResolvedValue([])
    mocks.workstreams.mockResolvedValue(null)
  })

  it("loads organization cards instead of the active support organization's internal projects", async () => {
    const page = await loadMemberWorkspaceProjectsPage({ directory: "organizations", actorScope: "platform" })
    expect(page.scope).toBe("platform-admin")
    expect(page.projects.map(({ name, projectKind }) => ({ name, projectKind }))).toEqual([{ name: "Real organization", projectKind: "organization_admin" }])
    expect(workspaceClient.from).not.toHaveBeenCalled()
    expect(mocks.organizations).toHaveBeenCalledWith({ supabase: adminClient })
    expect(mocks.canonical).toHaveBeenCalledWith(expect.objectContaining({ supabase: adminClient }))
  })

  it("preserves the coach's assigned-organization boundary", async () => {
    mocks.context.mockResolvedValue(context("coach"))
    mocks.scope.mockResolvedValue({ mode: "assigned", organizationIds: new Set(["org-1"]) })
    mocks.organizations.mockResolvedValue([{ orgId: "org-1", name: "Allowed" }, { orgId: "private", name: "Private" }])
    const page = await loadMemberWorkspaceProjectsPage({ directory: "organizations", actorScope: "platform" })
    expect(page.organizationOptions).toEqual([{ orgId: "org-1", name: "Allowed" }])
    expect(mocks.canonical.mock.calls[0][0].organizations).toEqual([{ orgId: "org-1", name: "Allowed" }])
  })

  it("loads the Projects directory and authorized fiscal assignments through the staff context", async () => {
    mocks.organizations.mockResolvedValue([])
    adminClient.rpc.mockResolvedValue({ data: [{ id: "fiscal-project", org_id: "private-host", name: "Application", project_kind: "standard", tags: [], member_labels: [] }], error: null })
    const page = await loadMemberWorkspaceProjectsPage({ directory: "projects", actorScope: "platform" })
    expect(page.projects.map(({ id }) => id)).toEqual(["fiscal-project"])
    expect(adminClient.rpc).toHaveBeenCalledWith("list_fiscal_guest_projects", { p_user_id: "staff" })
    expect(workspaceClient.from).not.toHaveBeenCalled()
    expect(mocks.canonical).not.toHaveBeenCalled()
  })

  it("keeps ordinary support workspace reads and edits on the restricted client", async () => {
    const actor = await resolveMemberWorkspaceActorContext()
    expect(actor.supabase).toBe(workspaceClient)
    expect(actor.isAdmin).toBe(false)
    expect(actor.isPlatformStaff).toBe(false)
    expect(actor.canAccessOrganizations).toBe(false)
    expect(actor.activeOrg.supportAccess).toBe(true)
  })

  it("rejects platform mode without server-verified directory capability", async () => {
    mocks.context.mockResolvedValue(context(null))
    await expect(resolveMemberWorkspaceActorContext("platform")).rejects.toThrow("platform directory")
    expect(mocks.admin).not.toHaveBeenCalled()
    expect(mocks.organizations).not.toHaveBeenCalled()
  })
})
