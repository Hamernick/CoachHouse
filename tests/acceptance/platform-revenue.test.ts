import { beforeEach, describe, expect, it, vi } from "vitest"
const { auth, config, list, bookingLookup } = vi.hoisted(() => ({ auth: vi.fn(), config: vi.fn(), list: vi.fn(), bookingLookup: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: () => ({ select: () => ({ eq: (_: string, id: string) => ({ maybeSingle: () => bookingLookup(id) }) }) }) }) }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock("@/lib/admin/auth", () => ({ requirePlatformCapability: auth }))
vi.mock("@/lib/billing/stripe-runtime", () => ({ resolveStripeRuntimeConfigForAudience: config }))
import { isMonkeypodPayment } from "@/features/member-workspace/server/platform-revenue-sources"
import { loadPlatformRevenue } from "@/features/member-workspace/server/platform-revenue"

describe("live platform revenue", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    auth.mockResolvedValue({})
    config.mockReturnValue({ mode: "live", client: { balanceTransactions: { list }, charges: { retrieve: vi.fn(async (id: string) => ({ id, metadata: {} })) } } })
  })
  it("sums payments and refunds by currency, excluding fees and payouts", async () => {
    list.mockReturnValue((async function* () {
      yield { source: "ch_plain", type: "charge", reporting_category: "charge", currency: "usd", amount: 5000 }
      yield { source: "ch_plain", type: "refund", reporting_category: "refund", currency: "usd", amount: -1000 }
      yield { source: "ch_plain", type: "payment", reporting_category: "charge", currency: "eur", amount: 2000 }
      yield { source: "ch_plain", type: "adjustment", reporting_category: "refund_failure", currency: "usd", amount: 100 }
      yield { source: "ch_plain", type: "refund", reporting_category: "partial_capture_reversal", currency: "usd", amount: -50 }
      yield { source: "ch_plain", type: "payment_failure_refund", reporting_category: "charge_failure", currency: "usd", amount: -200 }
      yield { source: "ch_plain", type: "stripe_fee", currency: "usd", amount: -200 }
      yield { source: "ch_plain", type: "payout", currency: "usd", amount: -3000 }
    })())
    expect(await loadPlatformRevenue()).toMatchObject({ totals: { usd: 3850, eur: 2000 } })
    expect(auth).toHaveBeenCalledWith("organizations")
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ created: { gte: expect.any(Number), lt: expect.any(Number) } }))
  })
  it("filters platform subscription payments and their refunds, excluding coaching", async () => {
    const charges = { retrieve: vi.fn(async (id: string) => ({ id, payment_intent: id === "ch_platform" ? "pi_platform" : "pi_coaching" })) }
    const refunds = { retrieve: vi.fn(async () => ({ charge: "ch_platform" })) }
    const invoicePayments = { list: vi.fn(({ payment }) => (async function* () {
      if (payment.payment_intent === "pi_platform") yield { invoice: { parent: { subscription_details: { metadata: { kind: "organization" } } } } }
    })()) }
    config.mockReturnValue({ mode: "live", client: { balanceTransactions: { list }, charges, refunds, invoicePayments } })
    list.mockReturnValue((async function* () {
      yield { source: "ch_platform", reporting_category: "charge", currency: "usd", amount: 5000 }
      yield { source: "ch_coaching", reporting_category: "charge", currency: "usd", amount: 9000 }
      yield { source: "re_platform", reporting_category: "refund", currency: "usd", amount: -1000 }
    })())
    expect(await loadPlatformRevenue("subscriptions")).toMatchObject({ scope: "subscriptions", totals: { usd: 4000 } })
    expect(charges.retrieve).toHaveBeenCalledTimes(2)
    expect(refunds.retrieve).toHaveBeenCalledWith("re_platform")
  })
  it("excludes Monkeypod charges and their refunds from all payments", async () => {
    const charges = { retrieve: vi.fn(async (id: string) => ({ id, metadata: id === "ch_monkeypod" ? { url: "https://example.monkeypod.io/give/campaign" } : {} })) }
    const refunds = { retrieve: vi.fn(async () => ({ charge: "ch_monkeypod" })) }
    config.mockReturnValue({ mode: "live", client: { balanceTransactions: { list }, charges, refunds } })
    list.mockReturnValue((async function* () {
      yield { source: "ch_platform", reporting_category: "charge", currency: "usd", amount: 35800 }
      yield { source: "ch_monkeypod", reporting_category: "charge", currency: "usd", amount: 54693 }
      yield { source: "re_monkeypod", reporting_category: "refund", currency: "usd", amount: -1000 }
    })())
    expect(await loadPlatformRevenue()).toMatchObject({ totals: { usd: 35800 } })
    expect(charges.retrieve).toHaveBeenCalledTimes(2)
  })
  it.each([["all", 28000], ["joel", 18000], ["paula", 10000]])("filters coaching collections for %s with refunds", async (coach, amount) => {
    bookingLookup.mockImplementation(async (id: string) => ({ data: { coach_id: id }, error: null }))
    const charges = { retrieve: vi.fn(async (id: string) => ({ id, payment_intent: id })) }
    const refunds = { retrieve: vi.fn(async () => ({ charge: "ch_joel" })) }
    const checkout = { sessions: { list: ({ payment_intent }: { payment_intent: string }) => (async function* () {
      if (payment_intent !== "ch_subscription") yield { metadata: { kind: "coaching_booking", booking_id: payment_intent.slice(3) } }
    })() } }
    config.mockReturnValue({ mode: "live", client: { balanceTransactions: { list }, charges, refunds, checkout } })
    list.mockReturnValue((async function* () {
      yield { source: "ch_joel", reporting_category: "charge", currency: "usd", amount: 20000 }
      yield { source: "ch_paula", reporting_category: "charge", currency: "usd", amount: 10000 }
      yield { source: "ch_subscription", reporting_category: "charge", currency: "usd", amount: 35800 }
      yield { source: "re_joel", reporting_category: "refund", currency: "usd", amount: -2000 }
    })())
    expect(await loadPlatformRevenue("coaching", String(coach))).toMatchObject({ scope: "coaching", coach, totals: { usd: amount } })
  })
  it("shows a verified zero in the Stripe account currency when no coaching was paid", async () => {
    list.mockReturnValue((async function* () {})())
    config.mockReturnValue({ mode: "live", client: { balanceTransactions: { list }, accounts: { retrieve: async () => ({ default_currency: "usd" }) } } })
    expect(await loadPlatformRevenue("coaching")).toMatchObject({ totals: { usd: 0 } })
  })
  it("rejects unknown filters without reading Stripe", async () => {
    expect(await loadPlatformRevenue("invalid" as "all")).toBeNull()
    expect(config).not.toHaveBeenCalled()
  })
  it("never represents test payments as live revenue", async () => {
    config.mockReturnValue({ mode: "test" })
    expect(await loadPlatformRevenue()).toBeNull()
    expect(list).not.toHaveBeenCalled()
  })
  it("returns unavailable instead of a false zero on provider failure", async () => {
    list.mockImplementation(() => { throw new Error("Unavailable") })
    expect(await loadPlatformRevenue()).toBeNull()
  })
  it("authorizes before reading any cached financial data", async () => {
    auth.mockRejectedValue(new Error("Forbidden"))
    await expect(loadPlatformRevenue()).rejects.toThrow("Forbidden")
    expect(config).not.toHaveBeenCalled()
  })
})

describe("Monkeypod source detection", () => {
  it.each([
    [{ application: "ca_E9CoyLM1eLmhTH75XdbjgEsFdT5flQyc", metadata: {} }, true],
    [{ metadata: { monkeypod_link: "https://coach-house.monkeypod.io/transaction/1" } }, true],
    [{ metadata: { url: "https://monkeypod.io.attacker.example/give" } }, false],
    [{ metadata: { url: "invalid" } }, false],
  ])("recognizes verified sources without matching unrelated URLs", (charge, expected) => {
    expect(isMonkeypodPayment(charge as Parameters<typeof isMonkeypodPayment>[0])).toBe(expected)
  })
})
