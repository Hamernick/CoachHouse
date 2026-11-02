import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ context: vi.fn(), manage: vi.fn(), admin: vi.fn(), rpc: vi.fn() }))
vi.mock("@/lib/auth/request-context", () => ({ resolveAuthenticatedAppContext: mocks.context }))
vi.mock("@/lib/workspace/workspace-finance-access", () => ({ canManageWorkspaceFinance: mocks.manage }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
import { reorderWorkspaceOpportunities } from "@/actions/workspace-opportunity-order"
const org = "00000000-0000-4000-8000-000000000001", a = "00000000-0000-4000-8000-000000000002", b = "00000000-0000-4000-8000-000000000003"
const input = { organizationId: org, previous: [a,b], ordered: [b,a] }
beforeEach(() => { vi.clearAllMocks(); mocks.context.mockResolvedValue({ activeOrg: { orgId: org }, supabase: {}, user: { id: org } }); mocks.manage.mockResolvedValue(true); mocks.admin.mockReturnValue({ rpc: mocks.rpc }) })
it("rejects malformed orders before privileged access", async () => {
  for (const invalid of [{ ordered:[a,a] }, { ordered:[a] }, { ordered:[a,org] }, { organizationId:"invalid" }]) expect(await reorderWorkspaceOpportunities({ ...input, ...invalid })).toHaveProperty("error")
  expect(mocks.context).not.toHaveBeenCalled(); expect(mocks.admin).not.toHaveBeenCalled()
})
it("rejects signed-out, foreign-organization and read-only actors", async () => {
  mocks.context.mockRejectedValueOnce(new Error("signed out")); expect(await reorderWorkspaceOpportunities(input)).toHaveProperty("error")
  expect(await reorderWorkspaceOpportunities({ ...input, organizationId:a })).toHaveProperty("error")
  mocks.manage.mockResolvedValue(false); expect(await reorderWorkspaceOpportunities(input)).toHaveProperty("error")
  expect(mocks.admin).not.toHaveBeenCalled()
})
it("uses the authorized organization and returns persisted ranks", async () => {
  const items=[{id:b,feedPosition:10,updatedAt:"2026-10-26T16:00:00Z"},{id:a,feedPosition:20,updatedAt:"2026-10-26T16:00:00Z"}]
  mocks.rpc.mockResolvedValue({data:items,error:null}); expect(await reorderWorkspaceOpportunities(input)).toEqual({items})
  expect(mocks.rpc).toHaveBeenCalledWith("reorder_opportunity_feed", {p_org_id:org,p_previous:[a,b],p_ordered:[b,a]})
  mocks.rpc.mockResolvedValue({data:null,error:{message:"stale order"}}); expect(await reorderWorkspaceOpportunities(input)).toHaveProperty("error")
})
