import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type Stripe from "stripe"
import { createCreditCheckout } from "@/features/ai-credits/server/purchase-checkout"
import { processAiCreditPurchase } from "@/features/ai-credits/server/purchase-webhook"
import type { PurchaseOrder } from "@/features/ai-credits/server/purchase-store"
import { startCreditPurchase } from "@/features/ai-credits/purchase-actions"

const store = vi.hoisted(() => ({ bindCheckout: vi.fn(), readPurchase: vi.fn(), fulfillPurchase: vi.fn(), preparePurchase: vi.fn(), readPurchases: vi.fn() }))
const restrictions = vi.hoisted(() => ({ processAiCreditReversal: vi.fn(), syncCreditPaymentRestrictions: vi.fn(), verifyCreditPayment: vi.fn() }))
vi.mock("@/features/ai-credits/server/payment-restrictions", () => restrictions)
const auth = vi.hoisted(() => ({ getUser: vi.fn(), active: vi.fn(), runtime: vi.fn() }))
vi.mock("@/features/ai-credits/server/purchase-store", () => store)
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: auth.getUser } }) }))
vi.mock("@/lib/organization/active-org", () => ({ resolveActiveOrganization: auth.active }))
vi.mock("@/lib/billing/stripe-runtime", () => ({ resolveStripeRuntimeConfigForAudience: auth.runtime }))
vi.mock("@/lib/devtools/audience", () => ({ resolveDevtoolsAudience: async () => ({ isTester: true }), resolveTesterMetadata: () => true }))
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "http://localhost:3008" } }))
vi.mock("@/features/ai-credits/server/accounting", () => ({ readAiAccount: vi.fn() }))
const order: PurchaseOrder = { id: "71000000-0000-4000-8000-000000000001", org_id: "71000000-0000-4000-8000-000000000002", actor_id: "71000000-0000-4000-8000-000000000002",
  pack_key: "fixture", mode: "test", price_id: "price_fixture", credits: 1000, amount: 1000, currency: "usd", return_url: "http://localhost:3008/workspace",
  created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60 * 60_000).toISOString(), checkout_session_id: null, paid_at: null }
const payment = { id: "pi_fixture", status: "succeeded", amount_received: 1000, currency: "usd", livemode: false, metadata: { kind: "ai_credit_pack", order_id: order.id } }
const session = { id: "cs_fixture", mode: "payment", status: "open", payment_status: "paid", livemode: false, client_reference_id: order.id, amount_total: 1000, currency: "usd",
  payment_intent: payment, metadata: { kind: "ai_credit_pack", order_id: order.id, organization_id: order.org_id }, url: "https://checkout.stripe.com/c/pay/fixture" }
const stripeMock = { prices: { retrieve: vi.fn() }, checkout: { sessions: { create: vi.fn(), retrieve: vi.fn(), listLineItems: vi.fn() } } }
const stripe = stripeMock as unknown as Stripe
const event = { type: "checkout.session.completed", data: { object: session } } as unknown as Stripe.Event
beforeEach(() => {
  vi.clearAllMocks()
  restrictions.processAiCreditReversal.mockResolvedValue(false)
  restrictions.syncCreditPaymentRestrictions.mockResolvedValue(undefined)
  auth.getUser.mockResolvedValue({ data: { user: { id: order.actor_id, user_metadata: {} } } })
  auth.active.mockResolvedValue({ orgId: order.org_id, role: "owner" })
  auth.runtime.mockReturnValue({ mode: "test", client: stripe })
  store.preparePurchase.mockResolvedValue({ ...order })
  store.readPurchase.mockResolvedValue({ ...order })
  store.bindCheckout.mockResolvedValue(undefined); store.fulfillPurchase.mockResolvedValue(undefined)
  stripeMock.prices.retrieve.mockResolvedValue({ active: true, type: "one_time", unit_amount: 1000, currency: "usd", livemode: false })
  stripeMock.checkout.sessions.create.mockResolvedValue({ ...session })
  stripeMock.checkout.sessions.retrieve.mockResolvedValue({ ...session })
  stripeMock.checkout.sessions.listLineItems.mockResolvedValue({ has_more: false, data: [{ quantity: 1, price: { id: "price_fixture" }, amount_total: 1000 }] })
})
afterEach(() => vi.unstubAllEnvs())
describe("credit purchase server action boundary", () => {
  const input = { organizationId: order.org_id, id: order.id, pack: order.pack_key }
  it("stays off by default and never calls Stripe", async () => {
    vi.stubEnv("WORKSPACE_AI_PURCHASES_ENABLED", "false")
    await expect(startCreditPurchase(input)).rejects.toThrow("not enabled")
    expect(store.preparePurchase).not.toHaveBeenCalled()
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it("rejects signed-out, changed-organization, and non-owner purchases before creating an order", async () => {
    vi.stubEnv("WORKSPACE_AI_PURCHASES_ENABLED", "true")
    auth.getUser.mockResolvedValueOnce({ data: { user: null } })
    await expect(startCreditPurchase(input)).rejects.toThrow("Sign in")
    auth.active.mockResolvedValueOnce({ orgId: "71000000-0000-4000-8000-000000000003", role: "owner" })
    await expect(startCreditPurchase(input)).rejects.toThrow("organization changed")
    auth.getUser.mockResolvedValueOnce({ data: { user: { id: "71000000-0000-4000-8000-000000000003" } } })
    await expect(startCreditPurchase(input)).rejects.toThrow("Only the organization owner")
    expect(store.preparePurchase).not.toHaveBeenCalled()
  })
  it("binds verified actor and organization; rejects caller-supplied price and credits", async () => {
    vi.stubEnv("WORKSPACE_AI_PURCHASES_ENABLED", "true")
    await expect(startCreditPurchase({ ...input, amount: 1 } as typeof input)).rejects.toThrow()
    await startCreditPurchase(input)
    expect(store.preparePurchase).toHaveBeenCalledWith(expect.objectContaining({ actorId: order.actor_id, orgId: order.org_id,
      mode: "test", pack: order.pack_key, returnUrl: "http://localhost:3008/workspace" }))
  })
})
describe("bound AI credit checkout", () => {
  it("uses the stored quote and stable provider idempotency; never grants on checkout creation", async () => {
    await createCreditCheckout(order, stripe)
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ mode: "payment", client_reference_id: order.id,
      line_items: [{ price: order.price_id, quantity: 1 }], success_url: order.return_url, payment_method_types: ["card"] }), { idempotencyKey: `ai-credit-checkout:test:${order.id}` })
    expect(store.bindCheckout).toHaveBeenCalledWith(order.id, "cs_fixture")
    expect(store.fulfillPurchase).not.toHaveBeenCalled()
  })
  it("reuses recorded checkout and never creates again", async () => {
    await createCreditCheckout({ ...order, checkout_session_id: "cs_fixture" }, stripe)
    expect(stripeMock.checkout.sessions.retrieve).toHaveBeenCalledWith("cs_fixture")
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it("refuses old uncertain orders and mismatched prices before provider mutation", async () => {
    await expect(createCreditCheckout({ ...order, expires_at: new Date().toISOString() }, stripe)).rejects.toThrow("recovery")
    stripeMock.prices.retrieve.mockResolvedValue({ active: true, type: "one_time", unit_amount: 1000, currency: "usd", livemode: true })
    await expect(createCreditCheckout(order, stripe)).rejects.toThrow("unavailable")
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it("preserves the idempotency key when DB binding fails after Stripe creates checkout", async () => {
    store.bindCheckout.mockRejectedValueOnce(new Error("database offline"))
    await expect(createCreditCheckout(order, stripe)).rejects.toThrow("database offline")
    await createCreditCheckout(order, stripe)
    expect(stripeMock.checkout.sessions.create.mock.calls[0]).toEqual(stripeMock.checkout.sessions.create.mock.calls[1])
  })
})
describe("verified credit payment fulfillment", () => {
  it("ignores unrelated checkout and unpaid sessions", async () => {
    expect(await processAiCreditPurchase({ ...event, data: { object: { ...session, metadata: { kind: "coaching_booking" } } } } as unknown as Stripe.Event, stripe, "test")).toBe(false)
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({ ...session, payment_status: "unpaid" })
    expect(await processAiCreditPurchase(event, stripe, "test")).toBe(true)
    expect(store.fulfillPurchase).not.toHaveBeenCalled()
  })
  it("credits only after current payment and exact line item verification, including delayed success", async () => {
    expect(await processAiCreditPurchase({ ...event, type: "checkout.session.async_payment_succeeded" } as Stripe.Event, stripe, "test")).toBe(true)
    expect(store.fulfillPurchase).toHaveBeenCalledWith(order, "cs_fixture", "pi_fixture")
    expect(stripeMock.checkout.sessions.listLineItems.mock.invocationCallOrder[0]).toBeLessThan(store.fulfillPurchase.mock.invocationCallOrder[0])
    expect(restrictions.syncCreditPaymentRestrictions.mock.invocationCallOrder[0]).toBeLessThan(store.fulfillPurchase.mock.invocationCallOrder[0])
  })
  it("does not grant credits if reversal reconciliation cannot finish", async () => {
    restrictions.syncCreditPaymentRestrictions.mockRejectedValueOnce(new Error("Payment review pending"))
    await expect(processAiCreditPurchase(event, stripe, "test")).rejects.toThrow("review pending")
    expect(store.fulfillPurchase).not.toHaveBeenCalled()
  })
  it.each([
    { client_reference_id: "other" }, { livemode: true }, { amount_total: 1 }, { currency: "eur" },
    { payment_intent: { ...payment, status: "processing" } }, { payment_intent: { ...payment, amount_received: 1 } },
    { metadata: { ...session.metadata, organization_id: "other" } },
  ])("rejects mismatched provider facts: %j", async patch => {
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({ ...session, ...patch })
    await expect(processAiCreditPurchase(event, stripe, "test")).rejects.toThrow()
    expect(store.fulfillPurchase).not.toHaveBeenCalled()
  })
  it("rejects a different product even if its price is identical", async () => {
    stripeMock.checkout.sessions.listLineItems.mockResolvedValue({ has_more: false, data: [{ quantity: 1, price: { id: "price_other" }, amount_total: 1000 }] })
    await expect(processAiCreditPurchase(event, stripe, "test")).rejects.toThrow("product mismatch")
    expect(store.fulfillPurchase).not.toHaveBeenCalled()
  })
  it("propagates ledger failures so the signed webhook retries instead of acknowledging a lost grant", async () => {
    store.fulfillPurchase.mockRejectedValueOnce(new Error("database offline"))
    await expect(processAiCreditPurchase(event, stripe, "test")).rejects.toThrow("database offline")
  })
})
