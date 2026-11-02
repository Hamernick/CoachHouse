import type Stripe from "stripe"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { processOrganizationClosureRefund } from "@/features/ai-credits/server/closure-refund-payment"
import type { ClosureRefund } from "@/features/ai-credits/server/closure-refund-store"
const mocks = vi.hoisted(() => ({ access: vi.fn(), record: vi.fn(), adjustment: vi.fn() }))
vi.mock("@/features/ai-credits/server/closure-refund-store", () => ({ accessClosureRefund: mocks.access, recordClosureRefund: mocks.record }))
vi.mock("@/features/ai-credits/server/payment-restriction-store", () => ({ recordPaymentRestriction: mocks.adjustment, findCreditPayment: vi.fn() }))
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const target = { organizationId: id(1), orderId: id(2), actorId: id(1) }
let value: ClosureRefund, refunds: Stripe.Refund[]
const payment = { id: "pi_verified", status: "succeeded", livemode: false, currency: "usd", amount_received: 1000, metadata: { kind: "ai_credit_pack", order_id: id(2) } }
const stripe = { paymentIntents: { retrieve: vi.fn() }, refunds: { create: vi.fn(), list: vi.fn() }, disputes: { list: vi.fn() } }
const client = stripe as unknown as Stripe
function refund(status = "succeeded") { return { id: "re_confirmed", payment_intent: "pi_verified", amount: 999, currency: "usd", created: 100,
  status, metadata: { kind: "organization_closure_refund", closure_refund_id: id(3), order_id: id(2), closure_request_id: id(4) } } as unknown as Stripe.Refund }
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("WORKSPACE_AI_CLOSURE_REFUNDS_ENABLED", "true"); refunds = []
  value = { dispatchAllowed: false, order: { id: id(2), org_id: id(1), actor_id: id(1), pack_key: "original", mode: "test", price_id: "price_original", credits: 20000,
    amount: 1000, currency: "usd", return_url: "https://example.org", expires_at: "2026-09-01", created_at: "2026-08-01", checkout_session_id: "cs_verified", paid_at: "2026-08-01", payment_intent_id: "pi_verified" },
    intent: { id: id(3), org_id: id(1), closure_request_id: id(4), closure_revision: 1, order_id: id(2), payment_intent_id: "pi_verified", mode: "test", currency: "usd", amount: 999,
      paid_minor_units: 1000, purchased_credits: 20000, consumed_credits: 20, state: "ready", refund_id: null, reason: null, started_at: null } }
  mocks.access.mockImplementation(async (action: string) => {
    value.dispatchAllowed = action === "claim" && value.intent?.state === "ready"
    if (value.dispatchAllowed) { value.intent!.state = "dispatching"; value.intent!.started_at = "2026-11-02T00:00:00Z" }
    return structuredClone(value)
  })
  mocks.record.mockImplementation(async (_intent, result) => {
    if (result) { value.intent!.state = result.status; value.intent!.refund_id = result.id }
    else if (value.intent!.state === "dispatching") value.intent!.state = "uncertain"
    value.dispatchAllowed = false
    return structuredClone(value)
  })
  stripe.paymentIntents.retrieve.mockResolvedValue(payment)
  stripe.refunds.list.mockImplementation(async () => ({ has_more: false, data: refunds }))
  stripe.disputes.list.mockResolvedValue({ has_more: false, data: [] })
  stripe.refunds.create.mockImplementation(async () => { const result = refund(); refunds.push(result); return result })
})
afterEach(() => vi.unstubAllEnvs())
describe("closure refunds with controlled Stripe only", () => {
  it("defaults dispatch off without contacting a provider or claiming an intent", async () => {
    vi.stubEnv("WORKSPACE_AI_CLOSURE_REFUNDS_ENABLED", "false")
    expect(await processOrganizationClosureRefund(target, client, "test")).toMatchObject({ reason: "dispatch_disabled", dispatchAllowed: false })
    expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled(); expect(stripe.refunds.create).not.toHaveBeenCalled()
    expect(mocks.access.mock.calls.map(call => call[0])).toEqual(["read"])
  })
  it("uses immutable exact amount, verified payment identity and stable one-shot provider idempotency", async () => {
    expect(await processOrganizationClosureRefund(target, client, "test")).toMatchObject({ intent: { state: "succeeded" } })
    expect(stripe.refunds.create).toHaveBeenCalledWith({ payment_intent: "pi_verified", amount: 999, metadata: refund().metadata },
      { timeout: 5000, maxNetworkRetries: 0, idempotencyKey: `closure-refund:test:${id(3)}` })
    expect(mocks.access.mock.calls.map(call => call[0])).toEqual(["read", "prepare", "claim"])
    expect(mocks.adjustment).toHaveBeenCalledWith(value.order, "pi_verified", expect.objectContaining({ kind: "verification", status: "resolved" }))
  })
  it("recovers a lost successful reply without another create, even with dispatch disabled", async () => {
    stripe.refunds.create.mockImplementationOnce(async () => { refunds.push(refund()); throw new Error("Lost reply") })
    expect(await processOrganizationClosureRefund(target, client, "test")).toMatchObject({ intent: { state: "uncertain" } })
    vi.stubEnv("WORKSPACE_AI_CLOSURE_REFUNDS_ENABLED", "false")
    expect(await processOrganizationClosureRefund(target, client, "test")).toMatchObject({ intent: { state: "succeeded", refund_id: "re_confirmed" } })
    expect(stripe.refunds.create).toHaveBeenCalledTimes(1)
    expect(mocks.adjustment).toHaveBeenCalledWith(value.order, "pi_verified", expect.objectContaining({ kind: "refund", providerId: "re_confirmed", status: "succeeded", amount: 999 }))
  })
  it("never retries an old uncertain request merely because no refund is found", async () => {
    value.intent!.state = "uncertain"; value.intent!.started_at = "2020-01-01T00:00:00Z"
    expect(await processOrganizationClosureRefund(target, client, "test")).toMatchObject({ intent: { state: "uncertain" }, dispatchAllowed: false })
    expect(stripe.refunds.create).not.toHaveBeenCalled(); expect(mocks.access).toHaveBeenCalledTimes(1)
  })
  it("preserves a committed refund when the database acknowledgement is lost", async () => {
    const record = mocks.record.getMockImplementation()!
    mocks.record.mockImplementationOnce(async (intent, result) => { await record(intent, result); throw new Error("Database reply lost") })
    expect(await processOrganizationClosureRefund(target, client, "test")).toMatchObject({ intent: { state: "succeeded" } })
    expect(await processOrganizationClosureRefund(target, client, "test")).toMatchObject({ intent: { state: "succeeded" } })
    expect(stripe.refunds.create).toHaveBeenCalledTimes(1)
  })
  it("fails closed on wrong payment mode, amount or binding before any claim", async () => {
    for (const changed of [{ ...payment, livemode: true }, { ...payment, amount_received: 900 }, { ...payment, metadata: { kind: "ai_credit_pack", order_id: id(8) } }]) {
      stripe.paymentIntents.retrieve.mockResolvedValueOnce(changed)
      await expect(processOrganizationClosureRefund(target, client, "test")).rejects.toThrow("mismatch")
    }
    expect(stripe.refunds.create).not.toHaveBeenCalled(); expect(mocks.access.mock.calls.some(call => call[0] === "claim")).toBe(false)
  })
  it("retains the canonical verification hold for truncated or failed provider inventory and retries its exact identity", async () => {
    stripe.refunds.list.mockResolvedValueOnce({ has_more: true, data: [] })
    await expect(processOrganizationClosureRefund(target, client, "test")).rejects.toThrow("manual reconciliation")
    expect(stripe.refunds.create).not.toHaveBeenCalled()
    await processOrganizationClosureRefund(target, client, "test")
    const holds = mocks.adjustment.mock.calls.filter(call => call[2].kind === "verification")
    expect(new Set(holds.map(call => call[2].providerId)).size).toBe(1)
    expect(holds.map(call => call[2].status)).toEqual(["pending", "pending", "resolved"])
  })
  it("honors a denied transactional claim after provider verification", async () => {
    const previous = mocks.access.getMockImplementation()!
    mocks.access.mockImplementation(async (action, current) => action === "claim" ? { ...structuredClone(value), dispatchAllowed: false, reason: "prior_payment_adjustment" } : previous(action, current))
    expect(await processOrganizationClosureRefund(target, client, "test")).toMatchObject({ dispatchAllowed: false })
    expect(stripe.refunds.create).not.toHaveBeenCalled()
  })
  it("does not accept a mismatched refund or recreate failed provider refunds", async () => {
    stripe.refunds.create.mockResolvedValueOnce({ ...refund(), amount: 1000 })
    expect(await processOrganizationClosureRefund(target, client, "test")).toMatchObject({ intent: { state: "uncertain" } })
    refunds = [refund("failed")]
    expect(await processOrganizationClosureRefund(target, client, "test")).toMatchObject({ intent: { state: "failed" } })
    await processOrganizationClosureRefund(target, client, "test")
    expect(stripe.refunds.create).toHaveBeenCalledTimes(1)
  })
  it("rejects ambiguous provider identity instead of choosing a refund", async () => {
    value.intent!.state = "uncertain"; value.intent!.started_at = "2026-11-02T00:00:00Z"
    refunds = [refund(), { ...refund(), id: "re_duplicate" }]
    await expect(processOrganizationClosureRefund(target, client, "test")).rejects.toThrow("Multiple closure refunds")
    expect(stripe.refunds.create).not.toHaveBeenCalled()
  })
})
