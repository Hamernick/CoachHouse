import "./test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { canAccessProjectOrg } from "@/app/api/account/project-assets/route-support"

const mocks = vi.hoisted(() => ({ actor: vi.fn(), review: vi.fn(), host: vi.fn(), people: vi.fn(), currentUser: vi.fn() }))
vi.mock("@/features/member-workspace/server/member-workspace-actor-context", () => ({ resolveMemberWorkspaceActorContext: mocks.actor }))
vi.mock("@/features/fiscal-sponsorship", () => ({ loadGuestFiscalProjectReview: mocks.review }))
vi.mock("@/features/member-workspace/server/admin-organization-overview", () => ({ loadAdminOrganizationSummaryById: mocks.host }))
vi.mock("@/features/member-workspace/server/person-options", () => ({ loadMemberWorkspacePersonOptionsForOrganizations: mocks.people, loadMemberWorkspaceCurrentUser: mocks.currentUser }))
import { loadPlatformAdminOrganizationProjectDetailPage } from "@/features/member-workspace/server/project-detail-loader"
import { refreshOrganizationProjectActivity } from "@/features/member-workspace/server/project-activity-actions"

const id = "20000000-0000-4000-8000-000000000001"
const project = {
  id, org_id: "private-host", project_kind: "standard", name: "Applicant project", status: "planned", priority: "medium",
  progress: 0, start_date: null, end_date: null, tags: [], member_labels: [], task_count: 0,
  description: null, created_source: "system", starter_seed_key: null, created_at: "2026-10-15T00:00:00Z", updated_at: "2026-10-15T00:00:00Z",
  option_settings: { tags: [], sprintTypes: [], fiscalSponsorshipEnabled: true },
}
const review = { projectId: id, projectName: "Applicant project", application: { projectName: "Applicant project", applicantFullName: "Applicant", projectDescription: "The applicant's own overview." }, workflow: { applicationStatus: "submitted" }, emailDelivery: null }
function query(table: string) {
  return {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: table === "organization_projects" ? project : null, error: null }),
    returns: vi.fn().mockResolvedValue({ data: [], error: null }),
  }
}
let tables: Map<string, ReturnType<typeof query>>
let rpc: ReturnType<typeof vi.fn>
let from: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.clearAllMocks()
  tables = new Map()
  rpc = vi.fn().mockResolvedValue({ data: true, error: null })
  from = vi.fn((table: string) => { if (!tables.has(table)) tables.set(table, query(table)); return tables.get(table)! })
  mocks.actor.mockResolvedValue({ userId: "reviewer", isAdmin: true, canAccessOrganizations: true, hasMemberWorkspaceAccess: true, activeOrg: { orgId: "different-org" }, supabase: { rpc, from } })
  mocks.review.mockResolvedValue(review)
  mocks.currentUser.mockResolvedValue({ id: "reviewer", name: "Reviewer" })
})
describe("fiscal applications use the existing project detail data contract", () => {
  it("loads shared project details without host identity, people or organization-wide activity", async () => {
    const result = await loadPlatformAdminOrganizationProjectDetailPage({ projectId: id, userId: "reviewer" })
    expect(result).toMatchObject({ state: "ready", scope: "fiscal-intake", fiscalReview: review, organizationSummary: { name: "Applicant project", ownerName: "Applicant", profile: {}, members: [], publicSlug: null } })
    if (result.state !== "ready") throw Error("Expected shared details")
    expect(result.project.id).toBe(id)
    expect(result.project.overviewDocument).toContain("applicant's own overview")
    expect(mocks.host).not.toHaveBeenCalled()
    expect(mocks.people).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalledWith("organizations")
    expect(from).not.toHaveBeenCalledWith("organization_memberships")
    for (const name of ["organization_tasks", "organization_project_notes", "organization_project_quick_links", "organization_project_assets", "organization_project_overview_documents", "organization_project_activity_events"]) {
      expect(tables.get(name)?.eq).toHaveBeenCalledWith("project_id", id)
      expect(tables.get(name)?.eq).toHaveBeenCalledWith("org_id", "private-host")
    }
    expect(tables.get("organization_project_activity_events")?.or).not.toHaveBeenCalled()
  })
  it.each([false, undefined])("denies revoked or indeterminate fiscal access before private reads (%s)", async (data) => {
    rpc.mockResolvedValue({ data, error: null })
    expect(await loadPlatformAdminOrganizationProjectDetailPage({ projectId: id, userId: "reviewer" })).toEqual({ state: "not-found" })
    expect(mocks.review).not.toHaveBeenCalled()
    expect(mocks.host).not.toHaveBeenCalled()
    expect(tables.has("organization_tasks")).toBe(false)
  })
  it("does not fall through to host data after the second authorization denies access", async () => {
    mocks.review.mockResolvedValue(null)
    expect(await loadPlatformAdminOrganizationProjectDetailPage({ projectId: id, userId: "reviewer" })).toEqual({ state: "not-found" })
    expect(mocks.host).not.toHaveBeenCalled()
    expect(tables.has("organization_tasks")).toBe(false)
  })
  it("denies caller identity mismatch before querying", async () => {
    expect(await loadPlatformAdminOrganizationProjectDetailPage({ projectId: id, userId: "another-person" })).toEqual({ state: "not-found" })
    expect(from).not.toHaveBeenCalled()
  })
  it("returns a recoverable state without reading host or child data for an incomplete application", async () => {
    mocks.review.mockResolvedValue({ error: "Unavailable" })
    await expect(loadPlatformAdminOrganizationProjectDetailPage({ projectId: id, userId: "reviewer" })).resolves.toEqual({ state: "fiscal-review-unavailable", message: "Unavailable" })
    expect(tables.has("organization_tasks")).toBe(false)
    expect(mocks.host).not.toHaveBeenCalled()
  })
  it("allows authorized fiscal asset reads while retaining write denial", async () => {
    const client = { rpc, from } as unknown as Parameters<typeof canAccessProjectOrg>[0]["supabase"]
    expect(await canAccessProjectOrg({ projectId: id, orgId: "private-host", userId: "reviewer", requireEdit: false, supabase: client })).toBe(true)
    expect(await canAccessProjectOrg({ projectId: id, orgId: "private-host", userId: "reviewer", requireEdit: true, supabase: client })).toBe(false)
    expect(from).not.toHaveBeenCalled()
    rpc.mockResolvedValue({ data: false, error: null })
    expect(await canAccessProjectOrg({ projectId: id, orgId: "private-host", userId: "reviewer", requireEdit: false, supabase: client })).toBe(false)
  })
  it("keeps activity refresh scoped to the authorized project and rejects mismatched organization IDs", async () => {
    const orgId = "20000000-0000-4000-8000-000000000002"
    expect(await refreshOrganizationProjectActivity({ projectId: id, orgId })).toEqual({ state: "ready", items: [] })
    expect(tables.get("organization_projects")?.eq).toHaveBeenCalledWith("org_id", orgId)
    expect(tables.get("organization_project_activity_events")?.eq).toHaveBeenCalledWith("project_id", id)
    expect(tables.get("organization_project_activity_events")?.or).not.toHaveBeenCalled()
    tables.get("organization_projects")!.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await refreshOrganizationProjectActivity({ projectId: id, orgId })).toEqual({ state: "forbidden", items: [] })
  })
})
