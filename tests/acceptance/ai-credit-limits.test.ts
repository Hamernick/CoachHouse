import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadAiCreditLimits, saveAiCreditLimit } from "@/features/ai-credits/limit-actions"
const mocks = vi.hoisted(() => ({ context: vi.fn(), rpc: vi.fn() }))
vi.mock("@/features/ai-credits/server/credit-context", () => ({ requireCreditOrganization: mocks.context }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
const org = "72000000-0000-4000-8000-000000000001"
const member = "72000000-0000-4000-8000-000000000002"
const revision = "72000000-0000-4000-8000-000000000003"
const result = { canManage: true, resetsAt: "2026-11-01T00:00:00Z", organization: { limit: 100, used: 20, revision }, members: [] }
const input = { organizationId: org, memberId: null, limit: 100, revision, operationId: "72000000-0000-4000-8000-000000000004" }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.context.mockResolvedValue({ orgId: org, actorId: org })
  mocks.rpc.mockResolvedValue({ data: result, error: null })
})
describe("owner credit limit actions", () => {
  it("reads only the verified active organization and validates returned accounting data", async () => {
    expect(await loadAiCreditLimits(org)).toEqual(result)
    expect(mocks.context).toHaveBeenCalledWith(org)
    expect(mocks.rpc).toHaveBeenCalledWith("read_ai_credit_limits", { p_org_id: org, p_actor_id: org })
    mocks.rpc.mockResolvedValueOnce({ data: { ...result, organization: { ...result.organization, used: -1 } }, error: null })
    await expect(loadAiCreditLimits(org)).rejects.toThrow()
  })
  it("forwards a fixed operation identity and expected revision without permitting actor injection", async () => {
    expect(await saveAiCreditLimit(input)).toEqual(result)
    expect(mocks.rpc).toHaveBeenCalledWith("set_ai_credit_limit", { p_org_id: org, p_actor_id: org, p_member_id: null, p_limit: 100, p_revision: revision, p_operation_id: input.operationId })
    await expect(saveAiCreditLimit({ ...input, actorId: member } as typeof input)).rejects.toThrow()
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })
  it("does not let an editor change their own cap", async () => {
    mocks.context.mockResolvedValue({ orgId: org, actorId: member })
    await expect(saveAiCreditLimit({ ...input, memberId: member })).rejects.toThrow("Only the organization owner")
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("permits explicit pause/removal but rejects negative, fractional and unsafe limits", async () => {
    await saveAiCreditLimit({ ...input, limit: 0 })
    await saveAiCreditLimit({ ...input, limit: null } as unknown as typeof input)
    for (const limit of [-1, 1.5, Number.MAX_SAFE_INTEGER, NaN]) await expect(saveAiCreditLimit({ ...input, limit })).rejects.toThrow()
    expect(mocks.rpc).toHaveBeenCalledTimes(2)
  })
  it("propagates authentication/scope failure without reading or writing the wallet", async () => {
    mocks.context.mockRejectedValue(new Error("Your organization changed"))
    await expect(saveAiCreditLimit(input)).rejects.toThrow("organization changed")
    await expect(loadAiCreditLimits(org)).rejects.toThrow("organization changed")
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("reports stale edits distinctly while hiding internal database failures", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "Spending limit changed. Reload usage before saving" } })
    await expect(saveAiCreditLimit(input)).rejects.toThrow("Reload limits")
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "private database diagnostics" } })
    await expect(saveAiCreditLimit(input)).rejects.toThrow("Your changes are still here")
  })
})
