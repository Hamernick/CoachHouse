import { beforeEach, describe, expect, it, vi } from "vitest"
import type Stripe from "stripe"
import { AllowanceIneligible, monthlyAllowanceSubscription, verifyAllowancePeriod } from "@/features/ai-credits/server/allowance-verification"
import { processAiAllowanceInvoice } from "@/features/ai-credits/server/allowance-webhook"
import type { AllowanceRule } from "@/features/ai-credits/server/allowance-store"
const store = vi.hoisted(() => ({ allowanceSetup: vi.fn(), findAllowanceBinding: vi.fn(), grantAllowance: vi.fn() }))
vi.mock("@/features/ai-credits/server/allowance-store", () => store)
const owner = "75000000-0000-4000-8000-000000000001"
const rule: AllowanceRule = { key: "monthly", mode: "test", price_id: "price_monthly", label: "Monthly", credits: 500, amount: 2000, currency: "usd", enabled: true, allow_discounted: false }
const start = Math.floor(Date.now() / 1000) - 86400, end = start + 30 * 86400
function fixtures() {
  const subscription = { id: "sub_one", customer: "cus_one", livemode: false, status: "active", pause_collection: null, metadata: { user_id: owner },
    items: { has_more: false, data: [{ id: "si_one", quantity: 1, current_period_start: start, current_period_end: end,
      price: { id: "price_monthly", unit_amount: 2000, currency: "usd", livemode: false, recurring: { interval: "month", interval_count: 1 } } }] } } as unknown as Stripe.Subscription
  const invoice = { id: "in_one", parent: { subscription_details: { subscription: "sub_one" } }, customer: "cus_one", livemode: false, currency: "usd",
    status: "paid", amount_paid: 2000, total: 2000, billing_reason: "subscription_cycle", pre_payment_credit_notes_amount: 0, post_payment_credit_notes_amount: 0, total_discount_amounts: [] } as unknown as Stripe.Invoice
  const line = { parent: { type: "subscription_item_details", subscription_item_details: { subscription: "sub_one", subscription_item: "si_one", proration: false } },
    pricing: { price_details: { price: "price_monthly" } }, quantity: 1, amount: 2000, period: { start, end } }
  const payment = { invoice: "in_one", status: "paid", amount_paid: 2000, currency: "usd", livemode: false, payment: { type: "payment_intent", payment_intent: "pi_one" } }
  const intent = { status: "succeeded", customer: "cus_one", amount_received: 2000, currency: "usd", livemode: false,
    latest_charge: { id: "ch_one", paid: true, refunded: false, disputed: false, amount_refunded: 0 } }
  const client = { invoices: { retrieve: vi.fn().mockResolvedValue(invoice), listLineItems: vi.fn().mockResolvedValue({ data: [line], has_more: false }) },
    invoicePayments: { list: vi.fn().mockResolvedValue({ data: [payment], has_more: false }) }, paymentIntents: { retrieve: vi.fn().mockResolvedValue(intent) },
    subscriptions: { retrieve: vi.fn().mockResolvedValue(subscription) } }
  return { subscription, invoice, line, payment, intent, client, stripe: client as unknown as Stripe }
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("WORKSPACE_AI_ALLOWANCES_ENABLED", "true") })
describe("verified monthly allowances", () => {
  it("uses the configured price and the current paid line period", async () => {
    const f = fixtures()
    expect(monthlyAllowanceSubscription(f.subscription, owner, "cus_one", "test", [rule])?.rule).toEqual(rule)
    expect(await verifyAllowancePeriod(f.subscription, rule, "in_one", f.stripe)).toEqual({ invoiceId: "in_one", start, end })
  })
  it("does not treat paid-like, annual, multiplied or paused subscriptions as eligible", () => {
    for (const status of ["past_due", "incomplete", "trialing", "canceled"]) {
      const f = fixtures(); f.subscription.status = status as Stripe.Subscription.Status
      expect(monthlyAllowanceSubscription(f.subscription, owner, "cus_one", "test", [rule])).toBeNull()
    }
    const f = fixtures(); f.subscription.items.data[0].price.recurring!.interval = "year"
    expect(monthlyAllowanceSubscription(f.subscription, owner, "cus_one", "test", [rule])).toBeNull()
    f.subscription.items.data[0].price.recurring!.interval = "month"; f.subscription.items.data[0].quantity = 2
    expect(monthlyAllowanceSubscription(f.subscription, owner, "cus_one", "test", [rule])).toBeNull()
  })
  it("rejects foreign payer/customer/mode and changed commercial terms", () => {
    const f = fixtures()
    for (const args of [["other", "cus_one", "test"], [owner, "cus_other", "test"], [owner, "cus_one", "live"]] as const)
      expect(() => monthlyAllowanceSubscription(f.subscription, args[0], args[1], args[2], [rule])).toThrow()
    expect(() => monthlyAllowanceSubscription(f.subscription, owner, "cus_one", "test", [{ ...rule, amount: 999 }])).toThrow("price mismatch")
  })
  it("rejects unpaid, comped, proration and credit-note invoices", async () => {
    for (const change of [{ status: "open" }, { amount_paid: 0, total: 0 }, { billing_reason: "subscription_update" }, { post_payment_credit_notes_amount: 100 }]) {
      const f = fixtures(); Object.assign(f.invoice, change)
      await expect(verifyAllowancePeriod(f.subscription, rule, "in_one", f.stripe)).rejects.toBeInstanceOf(AllowanceIneligible)
    }
  })
  it("requires explicit discount policy and real payment proof", async () => {
    const f = fixtures(); f.invoice.total_discount_amounts = [{ amount: 100, discount: "di_one" }]; f.invoice.amount_paid = 1900; f.invoice.total = 1900
    await expect(verifyAllowancePeriod(f.subscription, rule, "in_one", f.stripe)).rejects.toThrow("Discounted")
    expect(await verifyAllowancePeriod(f.subscription, { ...rule, allow_discounted: true }, "in_one", f.stripe)).toHaveProperty("invoiceId", "in_one")
    f.client.invoicePayments.list.mockResolvedValue({ data: [], has_more: false })
    await expect(verifyAllowancePeriod(f.subscription, { ...rule, allow_discounted: true }, "in_one", f.stripe)).rejects.toThrow("verified Stripe payment")
  })
  it("rejects foreign, refunded, disputed and incomplete payment evidence", async () => {
    for (const change of [{ refunded: true }, { disputed: true }, { amount_refunded: 10 }]) {
      const f = fixtures(); Object.assign(f.intent.latest_charge, change)
      await expect(verifyAllowancePeriod(f.subscription, rule, "in_one", f.stripe)).rejects.toBeInstanceOf(AllowanceIneligible)
    }
    const f = fixtures(); f.payment.invoice = "in_other"
    await expect(verifyAllowancePeriod(f.subscription, rule, "in_one", f.stripe)).rejects.toThrow("review")
    f.client.invoicePayments.list.mockResolvedValue({ data: [f.payment], has_more: true })
    await expect(verifyAllowancePeriod(f.subscription, rule, "in_one", f.stripe)).rejects.toThrow("incomplete")
  })
  it("rejects mixed invoices and stale periods rather than assigning a fresh month", async () => {
    const f = fixtures(); f.line.period.end = start - 1
    await expect(verifyAllowancePeriod(f.subscription, rule, "in_one", f.stripe)).rejects.toThrow("not current")
    f.client.invoices.listLineItems.mockResolvedValue({ data: [f.line, f.line], has_more: false })
    await expect(verifyAllowancePeriod(f.subscription, rule, "in_one", f.stripe)).rejects.toThrow("review")
  })
  it("rejects short or prorated periods before creating an assignment", async () => {
    const f = fixtures(); f.line.period.end = start + 2 * 86400; f.subscription.items.data[0].current_period_end = f.line.period.end
    await expect(verifyAllowancePeriod(f.subscription, rule, "in_one", f.stripe)).rejects.toBeInstanceOf(AllowanceIneligible)
    f.line.parent.subscription_item_details.proration = true
    await expect(verifyAllowancePeriod(f.subscription, rule, "in_one", f.stripe)).rejects.toThrow("review")
  })
})
describe("subscription invoice webhook", () => {
  const event = { id: "evt_one", type: "invoice.paid", livemode: false, data: { object: { id: "in_one", parent: { subscription_details: { subscription: "sub_one" } } } } } as Stripe.Event
  it("does nothing until enabled and explicitly bound", async () => {
    const f = fixtures(); vi.stubEnv("WORKSPACE_AI_ALLOWANCES_ENABLED", "false")
    await processAiAllowanceInvoice(event, f.stripe, "test"); expect(store.findAllowanceBinding).not.toHaveBeenCalled()
    vi.stubEnv("WORKSPACE_AI_ALLOWANCES_ENABLED", "true"); store.findAllowanceBinding.mockResolvedValue(null)
    await processAiAllowanceInvoice(event, f.stripe, "test"); expect(f.client.subscriptions.retrieve).not.toHaveBeenCalled()
    expect(store.grantAllowance).not.toHaveBeenCalled()
  })
  it("uses the stored organization binding and lets transient failures retry", async () => {
    const f = fixtures(), binding = { org_id: owner, owner_id: owner, customer_id: "cus_one", subscription_id: "sub_one", mode: "test" }
    store.findAllowanceBinding.mockResolvedValue(binding); store.allowanceSetup.mockResolvedValue({ rules: [rule] })
    await processAiAllowanceInvoice(event, f.stripe, "test")
    expect(store.grantAllowance).toHaveBeenCalledWith(binding, rule, { invoiceId: "in_one", start, end })
    f.client.paymentIntents.retrieve.mockRejectedValue(new Error("provider offline"))
    await expect(processAiAllowanceInvoice(event, f.stripe, "test")).rejects.toThrow("provider offline")
    expect(store.grantAllowance).toHaveBeenCalledTimes(1)
    f.client.paymentIntents.retrieve.mockResolvedValue(f.intent); f.invoice.status = "open"
    await processAiAllowanceInvoice(event, f.stripe, "test"); expect(store.grantAllowance).toHaveBeenCalledTimes(1)
  })
})
