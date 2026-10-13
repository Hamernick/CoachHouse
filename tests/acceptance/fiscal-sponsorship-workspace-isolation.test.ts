import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), actor: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock("@/features/member-workspace", () => ({ buildProjectAssetOpenPath: () => "/asset" }))
vi.mock("@/features/member-workspace/server/member-workspace-actor-context", () => ({ resolveMemberWorkspaceActorContext: mocks.actor }))
import { isOrdinaryWorkspaceProject } from "@/lib/workspace/ordinary-project-access"
import { createMemberWorkspaceProjectNoteAction } from "@/features/member-workspace/server/project-detail-actions"
import { loadProjectOptionSettings } from "@/features/member-workspace/server/project-option-actions"
import { loadProjectAssetFolders } from "@/features/member-workspace/server/project-asset-folder-actions"
import { enableProjectFiscalSponsorshipAction } from "@/features/member-workspace/server/project-fiscal-sponsorship-actions"
import { refreshOrganizationProjectActivity } from "@/features/member-workspace/server/project-activity-actions"
import { updateMemberWorkspaceProjectStatusAction } from "@/features/member-workspace/server/project-actions"
import { canAccessProjectOrg } from "@/app/api/account/project-assets/route-support"

const projectId = "00000000-0000-4000-8000-000000000001"
const userId = "00000000-0000-4000-8000-000000000002"
const orgId = "00000000-0000-4000-8000-000000000003"
const client = { rpc: mocks.rpc, from: mocks.from } as unknown as Parameters<typeof canAccessProjectOrg>[0]["supabase"]
beforeEach(() => {
 vi.resetAllMocks()
 mocks.actor.mockResolvedValue({ supabase: client, userId, isAdmin: true, canAccessOrganizations: true, hasMemberWorkspaceAccess: true, activeOrg: { orgId, role: "owner" }, canEdit: true })
})
describe("guest applications stay outside general host workspace tools", () => {
 it("recognizes only explicit ordinary-project scope; it grants no workspace permission", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: null })
  expect(await isOrdinaryWorkspaceProject({ supabase: client, userId, projectId })).toBe(true)
  expect(mocks.rpc).toHaveBeenCalledWith("fiscal_guest_project_reviewer_access", { p_project_id: projectId, p_user_id: userId })
  expect(mocks.from).not.toHaveBeenCalled()
 })
 it.each([{ data: true, error: null }, { data: false, error: null }, { data: null, error: { code: "unavailable" } }, { data: undefined, error: null }])("blocks guest or unknown scope even with broad staff/host permissions: %j", async (scope) => {
  mocks.rpc.mockResolvedValue(scope)
  expect(await loadProjectOptionSettings(projectId)).toHaveProperty("error")
  expect(await createMemberWorkspaceProjectNoteAction({ projectId, title: "Private", content: "No write" })).toHaveProperty("error")
  expect(await loadProjectAssetFolders(projectId)).toHaveProperty("error")
  expect(await enableProjectFiscalSponsorshipAction(projectId)).toHaveProperty("error")
  expect(await refreshOrganizationProjectActivity({ projectId, orgId })).toEqual({ state: "forbidden", items: [] })
  expect(await updateMemberWorkspaceProjectStatusAction(projectId,"active")).toHaveProperty("error")
  expect(await canAccessProjectOrg({ projectId, orgId, requireEdit: false, supabase: client, userId })).toBe(false)
  expect(mocks.from).not.toHaveBeenCalled()
 })
})
