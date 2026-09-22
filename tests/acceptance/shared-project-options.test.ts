import "./test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ actor: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }))
vi.mock("@/features/member-workspace/server/member-workspace-actor-context", () => ({ resolveMemberWorkspaceActorContext: mocks.actor }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))
import { loadSharedProjectOptions, manageSharedProjectOption } from "@/features/member-workspace/server/shared-project-option-actions"
const option = { id: "00000000-0000-4000-8000-000000000003", label: "Outreach", color: "#2563eb", updatedAt: "2026-09-20T12:00:00Z" }
describe("shared project option authorization and persistence", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.actor.mockResolvedValue({ userId: "staff", isAdmin: false, canAccessOrganizations: true }) })
  it("loads one shared catalog without project-specific overrides", async () => {
    mocks.rpc.mockResolvedValue({ data: { tags: [option], sprintTypes: [] }, error: null })
    expect(await loadSharedProjectOptions()).toEqual({ settings: { tags: [option], sprintTypes: [] } })
    expect(mocks.rpc).toHaveBeenCalledWith("load_shared_project_options", {})
  })
  it("rejects nonstaff before reading or mutating the catalog", async () => {
    mocks.actor.mockResolvedValue({ isAdmin: false })
    expect(await loadSharedProjectOptions()).toHaveProperty("error")
    expect(await manageSharedProjectOption({ action: "delete", kind: "tag", option })).toHaveProperty("error")
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("keeps member project editing available without exposing the shared directory", async () => {
    mocks.actor.mockResolvedValue({ isAdmin: false, hasMemberWorkspaceAccess: true })
    expect(await loadSharedProjectOptions()).toEqual({ settings: { tags: [], sprintTypes: [] } })
    expect(await manageSharedProjectOption({ action: "save", kind: "tag", option })).toHaveProperty("error")
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("sends a revision and refreshes both directories after mutation", async () => {
    mocks.rpc.mockResolvedValue({ data: { option }, error: null })
    expect(await manageSharedProjectOption({ action: "save", kind: "sprintType", option })).toEqual({ option })
    expect(mocks.rpc).toHaveBeenCalledWith("manage_shared_project_option", expect.objectContaining({ p_actor_id: "staff", p_expected_updated_at: option.updatedAt }))
    expect(mocks.revalidate).toHaveBeenCalledWith("/projects", "layout")
    expect(mocks.revalidate).toHaveBeenCalledWith("/organizations", "layout")
  })
  it("does not hide conflicts or claim success without migration", async () => {
    mocks.rpc.mockResolvedValue({ data: { error: "This option changed." }, error: null })
    expect(await manageSharedProjectOption({ action: "delete", kind: "tag", option })).toEqual({ error: "This option changed." })
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } })
    expect(await loadSharedProjectOptions()).toEqual({ error: expect.stringContaining("migration") })
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it("rejects invalid colors before writing", async () => {
    expect(await manageSharedProjectOption({ action: "save", kind: "tag", option: { ...option, color: "url(unsafe)" } })).toHaveProperty("error")
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
