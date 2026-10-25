import { beforeEach, describe, expect, it, vi } from "vitest"
import type Stripe from "stripe"
import { processAiCreditReversal, syncCreditPaymentRestrictions, verifyCreditPayment } from "@/features/ai-credits/server/payment-restrictions"
import type { PurchaseOrder } from "@/features/ai-credits/server/purchase-store"
const mocks = vi.hoisted(() => ({ find: vi.fn(), record: vi.fn(), read: vi.fn() }))
vi.mock("@/features/ai-credits/server/payment-restriction-store", () => ({ findCreditPayment: mocks.find, recordPaymentRestriction: mocks.record }))
vi.mock("@/features/ai-credits/server/purchase-store", () => ({ readPurchase: mocks.read }))
const order = { id: "73000000-0000-4000-8000-000000000001", mode: "test", amount: 1000, currency: "usd", credits: 1000, payment_intent_id: "pi_fixture" } as PurchaseOrder
const payment = { id: "pi_fixture", amount_received: 1000, currency: "usd", livemode: false, metadata: { kind: "ai_credit_pack", order_id: order.id } } as unknown as Stripe.PaymentIntent
const stripeMock = { refunds: { list: vi.fn() }, disputes: { list: vi.fn() }, paymentIntents: { retrieve: vi.fn() }, charges: { retrieve: vi.fn() } }
const stripe = stripeMock as unknown as Stripe
const event = { id: "evt_refund", created: 100, livemode: false, type: "refund.updated", data: { object: { id: "re_fixture", payment_intent: "pi_fixture" } } } as Stripe.Event
beforeEach(() => {
  vi.clearAllMocks()
  mocks.find.mockResolvedValue(order); mocks.read.mockResolvedValue(order); mocks.record.mockResolvedValue(undefined)
  stripeMock.paymentIntents.retrieve.mockResolvedValue(payment)
  stripeMock.refunds.list.mockResolvedValue({ has_more: false, data: [] }); stripeMock.disputes.list.mockResolvedValue({ has_more: false, data: [] })
})
describe("AI credit payment adjustments", () => {
  it("records a fail-closed hold before provider reads and keeps it if verification fails", async () => {
    stripeMock.paymentIntents.retrieve.mockRejectedValueOnce(new Error("provider offline"))
    await expect(processAiCreditReversal(event, stripe, "test")).rejects.toThrow("provider offline")
    expect(mocks.record).toHaveBeenCalledWith(order, "pi_fixture", expect.objectContaining({ kind: "verification", status: "pending" }))
    expect(mocks.record.mock.invocationCallOrder[0]).toBeLessThan(stripeMock.paymentIntents.retrieve.mock.invocationCallOrder[0])
    expect(mocks.record.mock.calls.some(call => call[2].status === "resolved")).toBe(false)
  })
  it("uses current refund and dispute facts instead of the webhook's old status", async () => {
    stripeMock.refunds.list.mockResolvedValue({ has_more: false, data: [{ id: "re_fixture", payment_intent: "pi_fixture", status: "succeeded", amount: 250, currency: "usd" }] })
    stripeMock.disputes.list.mockResolvedValue({ has_more: false, data: [{ id: "du_fixture", payment_intent: "pi_fixture", status: "won", amount: 1000, currency: "usd", livemode: false }] })
    expect(await processAiCreditReversal(event, stripe, "test")).toBe(true)
    expect(mocks.record).toHaveBeenCalledWith(order, "pi_fixture", expect.objectContaining({ kind: "refund", status: "succeeded", amount: 250 }))
    expect(mocks.record).toHaveBeenCalledWith(order, "pi_fixture", expect.objectContaining({ kind: "dispute", status: "won" }))
    expect(mocks.record.mock.calls.at(-1)?.[2]).toMatchObject({ kind: "verification", status: "resolved" })
  })
  it("recovers an adjustment arriving before checkout fulfillment from the verified payment binding", async () => {
    mocks.find.mockResolvedValue(null)
    expect(await processAiCreditReversal(event, stripe, "test")).toBe(true)
    expect(mocks.read).toHaveBeenCalledWith(order.id)
  })
  it("ignores unrelated payment events without altering credit data", async () => {
    mocks.find.mockResolvedValue(null)
    stripeMock.paymentIntents.retrieve.mockResolvedValue({ ...payment, metadata: { kind: "coaching_booking" } })
    expect(await processAiCreditReversal(event, stripe, "test")).toBe(false)
    expect(mocks.record).not.toHaveBeenCalled()
    expect(await processAiCreditReversal({ ...event, type: "invoice.paid" } as Stripe.Event, stripe, "test")).toBe(false)
  })
  it("rejects wrong mode, currency and payment/order binding", async () => {
    await expect(processAiCreditReversal({ ...event, livemode: true } as Stripe.Event, stripe, "test")).rejects.toThrow("mode mismatch")
    expect(mocks.record).not.toHaveBeenCalled()
    for (const patch of [{ currency: "eur" }, { amount_received: 1 }, { metadata: { kind: "ai_credit_pack", order_id: "foreign" } }, { id: "pi_other" }])
      expect(() => verifyCreditPayment(order, { ...payment, ...patch } as Stripe.PaymentIntent, "test")).toThrow()
  })
  it("refuses incomplete or mismatched provider lists, preserving the hold", async () => {
    stripeMock.refunds.list.mockResolvedValueOnce({ has_more: true, data: [] })
    await expect(syncCreditPaymentRestrictions(order, "pi_fixture", stripe, { key: "evt_scan", created: 100 })).rejects.toThrow("manual reconciliation")
    stripeMock.refunds.list.mockResolvedValueOnce({ has_more: false, data: [{ id: "re_foreign", payment_intent: "pi_other", currency: "usd", status: "succeeded", amount: 1000 }] })
    await expect(syncCreditPaymentRestrictions(order, "pi_fixture", stripe, { key: "evt_scan", created: 100 })).rejects.toThrow("identity mismatch")
    expect(mocks.record.mock.calls.some(call => call[2].status === "resolved")).toBe(false)
  })
})
