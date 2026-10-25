import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ client: vi.fn(), organization: vi.fn(), file: vi.fn(), update: vi.fn(), from: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }))
vi.mock("@/lib/organization/active-org", () => ({ resolveActiveOrganization: mocks.organization, canEditOrganization: (role: string) => role === "owner" }))
vi.mock("@/features/google-drive", () => ({ getSelectedGoogleDriveFile: mocks.file }))
import { saveRoadmapSectionAction } from "@/actions/roadmap"

const input = { sectionId: "vision", expectedUserId: "user-a", expectedOrganizationId: "org-a", expectedLastUpdated: "2026-09-20", driveFileId: "selected_file_123" }
beforeEach(() => {
  vi.clearAllMocks()
  const row = { profile: { roadmap: { sections: [{ id: "vision", title: "Vision", content: "<p>Draft</p>", lastUpdated: "2026-09-20" }] } }, public_slug: null, updated_at: "2026-09-20" }
  const read = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }) }
  const write = { eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: "org-a" }, error: null }) }
  mocks.update.mockReturnValue(write)
  const subscription = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { status: "active", metadata: { plan_tier: "organization" } }, error: null }),
  }
  mocks.from.mockImplementation((table: string) => table === "subscriptions" ? subscription : { ...read, update: mocks.update })
  mocks.client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "user-a" } }, error: null }) }, from: mocks.from })
  mocks.organization.mockResolvedValue({ orgId: "org-a", role: "owner" })
  mocks.file.mockResolvedValue({ id: "selected_file_123", name: "Different Google title", webViewLink: "https://docs.google.com/document/d/selected_file_123/edit", status: "available" })
})

describe("Core Document source authorization", () => {
  it("validates the caller's selected file and preserves the existing title", async () => {
    const result = await saveRoadmapSectionAction({ ...input, title: "Wrong replacement title" })
    expect(mocks.file).toHaveBeenCalledWith("user-a", input.driveFileId)
    expect(result).toMatchObject({ section: { title: "Vision", content: "<p>Draft</p>", documentSource: "google_drive" } })
    expect(mocks.update).toHaveBeenCalledOnce()
  })
  it.each([
    { expectedOrganizationId: "org-b" },
    { expectedUserId: "user-b" },
    { expectedLastUpdated: "old-version" },
    { expectedOrganizationId: undefined },
  ])("rejects stale or missing scope before provider access: %j", async (override) => {
    expect(await saveRoadmapSectionAction({ ...input, ...override })).toHaveProperty("error")
    expect(mocks.file).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it("rejects read-only organization membership", async () => {
    mocks.organization.mockResolvedValue({ orgId: "org-a", role: "board" })
    expect(await saveRoadmapSectionAction(input)).toEqual({ error: "Forbidden" })
    expect(mocks.file).not.toHaveBeenCalled()
  })
  it("leaves the existing document intact when Google rejects access", async () => {
    mocks.file.mockRejectedValue(new Error("file_not_authorized"))
    expect(await saveRoadmapSectionAction(input)).toHaveProperty("error")
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it("clears the slot without any Google API call", async () => {
    expect(await saveRoadmapSectionAction({ ...input, driveFileId: null, content: "", status: "not_started" })).toMatchObject({ section: { title: "Vision", driveSource: null, content: "", status: "not_started" } })
    expect(mocks.file).not.toHaveBeenCalled()
  })
})

describe("Create-only core document writes", () => {
  it("returns the existing document without overwriting edits or publication on replay", async () => {
    const result = await saveRoadmapSectionAction({ sectionId: "vision", createOnly: true,
      expectedUserId: "user-a", expectedOrganizationId: "org-a", expectedLastUpdated: null,
      title: "Replacement", content: "<p>Replacement</p>", isPublic: false, status: "in_progress" })
    expect(result).toMatchObject({ section: { id: "vision", title: "Vision", content: "<p>Draft</p>" } })
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it.each([{ sectionId: undefined }, { expectedOrganizationId: undefined }, { expectedUserId: undefined },
    { expectedLastUpdated: undefined }, { driveFileId: "selected_file_123" }, { aiRunId: "fake" }])("rejects unsafe create-only scope: %j", async override => {
    expect(await saveRoadmapSectionAction({ sectionId: "application-123", createOnly: true,
      expectedUserId: "user-a", expectedOrganizationId: "org-a", expectedLastUpdated: null, ...override })).toHaveProperty("error")
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
