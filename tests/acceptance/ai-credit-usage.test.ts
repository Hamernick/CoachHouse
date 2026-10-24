import { beforeEach, expect, it, vi } from "vitest"
import { loadAiUsageHistory } from "@/features/ai-credits/usage-actions"
const mocks = vi.hoisted(() => ({ context: vi.fn(), rpc: vi.fn() }))
vi.mock("@/features/ai-credits/server/credit-context", () => ({ requireCreditOrganization: mocks.context }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
const org = "74000000-0000-4000-8000-000000000001", member = "74000000-0000-4000-8000-000000000002"
const data = { canFilterMembers: true, members: [], rows: [], hasMore: false }
beforeEach(() => { vi.clearAllMocks(); mocks.context.mockResolvedValue({ orgId: org, actorId: org }); mocks.rpc.mockResolvedValue({ data, error: null }) })
it("uses verified scope and forwards exact keyset timestamps without losing precision", async () => {
  const before = { id: member, at: "2026-10-23T12:00:00.123456+00:00" }
  expect(await loadAiUsageHistory({ organizationId: org, memberId: member, task: "plan", before })).toEqual(data)
  expect(mocks.rpc).toHaveBeenCalledWith("read_workspace_ai_usage", { p_org_id: org, p_actor_id: org, p_member_id: member, p_task: "plan", p_before_at: before.at, p_before_id: member })
})
it("rejects member impersonation and caller-selected actors before database access", async () => {
  mocks.context.mockResolvedValue({ orgId: org, actorId: member })
  await expect(loadAiUsageHistory({ organizationId: org, memberId: org })).rejects.toThrow("own AI usage")
  await expect(loadAiUsageHistory({ organizationId: org, actorId: org } as never)).rejects.toThrow()
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it("rejects malformed filters/cursors and changed organization sessions", async () => {
  for (const input of [{ task: "all" }, { before: { at: "bad", id: member } }, { before: { at: "2026-10-23T12:00:00Z" } }]) {
    await expect(loadAiUsageHistory({ organizationId: org, ...input } as never)).rejects.toThrow()
  }
  mocks.context.mockRejectedValue(new Error("Organization changed"))
  await expect(loadAiUsageHistory({ organizationId: org })).rejects.toThrow("Organization changed")
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it("hides internal errors and drops unrequested private fields", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "private database details" } })
  await expect(loadAiUsageHistory({ organizationId: org })).rejects.toThrow("Unable to load AI usage")
  mocks.rpc.mockResolvedValueOnce({ data: { ...data, prompt: "private" }, error: null })
  expect(await loadAiUsageHistory({ organizationId: org })).toEqual(data)
})
