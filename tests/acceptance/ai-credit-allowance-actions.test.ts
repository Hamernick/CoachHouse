import { beforeEach, expect, it, vi } from "vitest"
import { assignAiAllowance, loadAiAllowance } from "@/features/ai-credits/allowance-actions"
const mocks = vi.hoisted(() => ({ context: vi.fn(), setup: vi.fn(), bind: vi.fn(), grant: vi.fn(), monthly: vi.fn(), verify: vi.fn(), retrieve: vi.fn(), single: vi.fn(), list: vi.fn() }))
vi.mock("@/features/ai-credits/server/billing-context", () => ({ creditBillingContext: mocks.context }))
vi.mock("@/features/ai-credits/server/allowance-store", () => ({ allowanceSetup: mocks.setup, bindAllowance: mocks.bind, grantAllowance: mocks.grant }))
vi.mock("@/features/ai-credits/server/allowance-verification", () => ({ monthlyAllowanceSubscription: mocks.monthly, verifyAllowancePeriod: mocks.verify, stripeId: (value: string) => value }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => {
  const query = { select: () => query, eq: () => query, contains: () => query, maybeSingle: mocks.single, limit: mocks.list }
  return { from: () => query }
} }))
const org = "75000000-0000-4000-8000-000000000001", member = "75000000-0000-4000-8000-000000000002"
const input = { organizationId: org, subscriptionId: "sub_one", operationId: member }
const rule = { key: "monthly", label: "Monthly", credits: 500 }
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("WORKSPACE_AI_ALLOWANCES_ENABLED", "true")
  mocks.context.mockResolvedValue({ orgId: org, actorId: org, runtime: { mode: "test", client: { subscriptions: { retrieve: mocks.retrieve } } } })
  mocks.setup.mockResolvedValue({ rules: [rule], binding: null, grant: null, organizationName: "Fixture org" })
  const source = { stripe_subscription_id: "sub_one", stripe_customer_id: "cus_one" }
  mocks.single.mockResolvedValue({ data: source, error: null }); mocks.list.mockResolvedValue({ data: [source], error: null })
  mocks.retrieve.mockResolvedValue({ id: "sub_one", latest_invoice: "in_one" }); mocks.monthly.mockReturnValue({ rule })
  mocks.verify.mockResolvedValue({ invoiceId: "in_one", start: 1, end: 2 })
})
it("stays default-off and hides payer controls from members", async () => {
  vi.stubEnv("WORKSPACE_AI_ALLOWANCES_ENABLED", "false")
  expect(await loadAiAllowance(org)).toBeNull(); expect(mocks.context).not.toHaveBeenCalled()
  await expect(assignAiAllowance(input)).rejects.toThrow("not enabled")
  vi.stubEnv("WORKSPACE_AI_ALLOWANCES_ENABLED", "true"); mocks.context.mockResolvedValue({ orgId: org, actorId: member })
  expect(await loadAiAllowance(org)).toBeNull()
  await expect(assignAiAllowance(input)).rejects.toThrow("Only the organization owner")
  expect(mocks.bind).not.toHaveBeenCalled()
})
it("lists only server-configured subscriptions and avoids provider reads for an existing grant", async () => {
  expect((await loadAiAllowance(org))?.options).toEqual([{ id: "sub_one", label: "Monthly", credits: 500 }])
  mocks.retrieve.mockClear(); mocks.setup.mockResolvedValue({ rules: [rule], organizationName: "Fixture org", binding: { subscription_id: "sub_one" }, grant: { label: "Monthly", credits: 500, expiresAt: "2026-11-01T00:00:00Z" } })
  expect((await loadAiAllowance(org))?.grant?.credits).toBe(500)
  expect(mocks.retrieve).not.toHaveBeenCalled()
})
it("verifies payment before assigning, and assigns before issuing a grant", async () => {
  await assignAiAllowance(input)
  expect(mocks.bind).toHaveBeenCalledWith({ mode: "test", subscription_id: "sub_one", customer_id: "cus_one", owner_id: org, org_id: org }, member)
  expect(mocks.verify.mock.invocationCallOrder[0]).toBeLessThan(mocks.bind.mock.invocationCallOrder[0])
  expect(mocks.bind.mock.invocationCallOrder[0]).toBeLessThan(mocks.grant.mock.invocationCallOrder[0])
})
it("does not bind on payment failure or grant after an assignment conflict", async () => {
  mocks.verify.mockRejectedValueOnce(new Error("Payment not confirmed"))
  await expect(assignAiAllowance(input)).rejects.toThrow("Payment not confirmed")
  expect(mocks.bind).not.toHaveBeenCalled()
  mocks.bind.mockRejectedValueOnce(new Error("Already assigned"))
  await expect(assignAiAllowance(input)).rejects.toThrow("Already assigned")
  expect(mocks.grant).not.toHaveBeenCalled()
})
it("preserves the same operation on recovery after a failed grant", async () => {
  mocks.grant.mockRejectedValueOnce(new Error("Confirmation pending"))
  await expect(assignAiAllowance(input)).rejects.toThrow("Confirmation pending")
  await assignAiAllowance(input)
  expect(mocks.bind.mock.calls[0]).toEqual(mocks.bind.mock.calls[1])
})
it("rejects foreign subscriptions, actor/credit injection and changed organization sessions", async () => {
  mocks.single.mockResolvedValueOnce({ data: null, error: null })
  await expect(assignAiAllowance(input)).rejects.toThrow("belonging to you")
  await expect(assignAiAllowance({ ...input, credits: 9999 } as never)).rejects.toThrow()
  mocks.context.mockRejectedValueOnce(new Error("Organization changed"))
  await expect(assignAiAllowance(input)).rejects.toThrow("Organization changed")
  expect(mocks.bind).not.toHaveBeenCalled(); expect(mocks.grant).not.toHaveBeenCalled()
})
