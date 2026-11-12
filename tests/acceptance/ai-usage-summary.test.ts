import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadCurrentAiUsage } from "@/features/ai-credits/usage-summary-actions"
import { creditSummary } from "@/features/ai-credits/lib/usage-summary"

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), active: vi.fn(), account: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser } }) }))
vi.mock("@/lib/organization/active-org", () => ({ resolveActiveOrganization: mocks.active }))
vi.mock("@/features/ai-credits/server/accounting", () => ({ readAiAccount: mocks.account }))
beforeEach(() => vi.clearAllMocks())

describe("current workspace usage", () => {
  it("rejects anonymous reads before resolving workspace or credit data", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    await expect(loadCurrentAiUsage()).rejects.toThrow("Sign in")
    expect(mocks.active).not.toHaveBeenCalled()
    expect(mocks.account).not.toHaveBeenCalled()
  })
  it("uses only the authenticated actor and server-selected workspace", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "actor" } } })
    mocks.active.mockResolvedValue({ orgId: "active-workspace" })
    const account = { enabled: true, lots: [], history: [] }
    mocks.account.mockResolvedValue(account)
    await expect(loadCurrentAiUsage()).resolves.toEqual({ organizationId: "active-workspace", account })
    expect(mocks.account).toHaveBeenCalledWith("active-workspace", "actor")
  })
  it("keeps failed reads as errors rather than a zero balance", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "actor" } } })
    mocks.active.mockResolvedValue({ orgId: "active-workspace" })
    mocks.account.mockRejectedValue(new Error("Unavailable"))
    await expect(loadCurrentAiUsage()).rejects.toThrow("Unavailable")
  })
  it("uses available included credits and excludes expired/restricted allowances", () => {
    const result = creditSummary({ enabled: true, history: [], lots: [
      { kind: "included", credits: 100, spent: 20, reserved: 10, expiresAt: "2026-12-01" },
      { kind: "included", credits: 1000, spent: 0, reserved: 0, expiresAt: "2026-10-01", expired: true },
      { kind: "included", credits: 1000, spent: 0, reserved: 0, expiresAt: "2026-11-15", restricted: true },
      { kind: "purchased", credits: 50, spent: 5, reserved: 0, expiresAt: null },
    ] })
    expect(result).toMatchObject({ allowance: 100, included: 70, percent: 70, purchased: 45, reserved: 10, available: 115, expires: "2026-12-01" })
  })
  it("does not invent a percentage or reset date when no allowance exists", () => {
    expect(creditSummary({ enabled: true, history: [], lots: [] })).toMatchObject({ percent: null, expires: undefined, available: 0 })
  })
})
