import "./test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { guidedProjectOverview, guidedProjectSchema, type GuidedProjectInput } from "@/features/member-workspace/lib/guided-project"

const mocks = vi.hoisted(() => ({ actor: vi.fn(), people: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }))
vi.mock("@/features/member-workspace/server/member-workspace-actor-context", () => ({ resolveMemberWorkspaceActorContext: mocks.actor }))
vi.mock("@/features/member-workspace/server/person-options", () => ({ loadMemberWorkspacePersonOptionsForOrganizations: mocks.people }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))
import { createGuidedProjectAction, loadGuidedProjectPeople } from "@/features/member-workspace/server/guided-project-actions"

const org = "00000000-0000-4000-8000-000000000001"
const owner = "00000000-0000-4000-8000-000000000002"
const input: GuidedProjectInput = {
  requestId: "00000000-0000-4000-8000-000000000003", organizationId: org,
  name: "Clinic launch", description: "<script>alert(1)</script>", outcomes: "Open two clinics", startDate: "2026-09-01", endDate: "2026-09-30", ownerId: owner, contributorIds: [],
  tasks: [{ title: "Prepare clinic", startDate: "2026-09-02", endDate: "2026-09-10", assigneeId: owner, workstream: "Launch" }],
  files: [{ id: "real_drive_file_id", name: "Program plan" }],
}

describe("guided project creation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: org }, error: null }) }
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query)
    mocks.actor.mockResolvedValue({ userId: owner, isAdmin: true, canEdit: true, supabase: { from: () => query } })
    mocks.people.mockResolvedValue([{ id: owner, name: "Real Coach" }])
    mocks.rpc.mockResolvedValue({ data: { ok: true, projectId: "project-1" }, error: null })
  })
  it("saves dates, actual person IDs, outcomes, tasks and files in one atomic RPC", async () => {
    await expect(createGuidedProjectAction(input)).resolves.toEqual({ ok: true, id: "project-1" })
    expect(mocks.rpc).toHaveBeenCalledWith("create_guided_organization_project", expect.objectContaining({ p_setup: input, p_request_id: input.requestId, p_member_labels: ["Real Coach"], p_org_id: org }))
    expect(mocks.revalidate).toHaveBeenCalledWith("/tasks")
    expect(guidedProjectOverview(input)).toContain("Open two clinics")
    expect(guidedProjectOverview(input)).not.toContain("<script>")
  })
  it("loads only the platform team for staff assignment", async () => {
    await loadGuidedProjectPeople(org)
    expect(mocks.people).toHaveBeenCalledWith(expect.objectContaining({ orgIds: [], includePlatformAdmins: true }))
  })
  it("validates staff assignments against the same platform directory", async () => {
    await createGuidedProjectAction(input)
    expect(mocks.people).toHaveBeenCalledWith(expect.objectContaining({ orgIds: [], includePlatformAdmins: true }))
  })
  it("rejects dates outside project bounds and impossible dates", () => {
    expect(guidedProjectSchema.safeParse({ ...input, tasks: [{ ...input.tasks[0], endDate: "2026-10-01" }] }).success).toBe(false)
    expect(guidedProjectSchema.safeParse({ ...input, startDate: "2026-02-30" }).success).toBe(false)
  })
  it("rejects malformed Drive references", () => {
    expect(guidedProjectSchema.safeParse({ ...input, files: [{ id: "../evil?x=", name: "File" }] }).success).toBe(false)
  })
  it("rejects foreign organization access before loading people or writing", async () => {
    mocks.actor.mockResolvedValue({ userId: owner, isAdmin: false, canEdit: true, activeOrg: { orgId: "another-org" } })
    expect(await createGuidedProjectAction(input)).toHaveProperty("error")
    expect(mocks.people).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("rejects stale or fabricated assignee IDs", async () => {
    mocks.people.mockResolvedValue([])
    expect(await createGuidedProjectAction(input)).toHaveProperty("error")
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("reports missing migration without pretending creation succeeded", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } })
    expect(await createGuidedProjectAction(input)).toEqual({ error: expect.stringContaining("migration") })
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
})
