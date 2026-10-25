import "server-only"
import type Stripe from "stripe"
import { z } from "zod"
import { readPurchase, type PurchaseOrder } from "./purchase-store"
import { findCreditPayment, recordPaymentRestriction } from "./payment-restriction-store"

const reversalEvents = new Set(["refund.created", "refund.updated", "refund.failed", "charge.refunded", "charge.refund.updated",
  "charge.dispute.created", "charge.dispute.updated", "charge.dispute.closed", "charge.dispute.funds_withdrawn", "charge.dispute.funds_reinstated"])
function id(value: string | { id: string } | null | undefined) { return typeof value === "string" ? value : value?.id ?? null }
type Evidence = { key: string; created: number }

async function verification(order: PurchaseOrder, payment: string, evidence: Evidence, status: "pending" | "resolved") {
  await recordPaymentRestriction(order, payment, { kind: "verification", providerId: evidence.key, status, amount: 0, currency: order.currency, eventKey: evidence.key, eventCreated: evidence.created })
}
export function verifyCreditPayment(order: PurchaseOrder, payment: Stripe.PaymentIntent, mode: "test" | "live") {
  if (payment.livemode !== (mode === "live") || order.mode !== mode || payment.currency !== order.currency || payment.amount_received !== order.amount ||
      payment.metadata?.kind !== "ai_credit_pack" || payment.metadata.order_id !== order.id ||
      (order.payment_intent_id && order.payment_intent_id !== payment.id)) throw new Error("Credit adjustment payment mismatch.")
}
export async function syncCreditPaymentRestrictions(order: PurchaseOrder, payment: string, stripe: Stripe, evidence: Evidence, options?: Stripe.RequestOptions) {
  // Start with a fail-closed hold. Provider/network/DB failures leave it in place
  // until this same verified event retries successfully; no new charge is made.
  await verification(order, payment, evidence, "pending")
  const [refunds, disputes] = await Promise.all([
    stripe.refunds.list({ payment_intent: payment, limit: 100 }, ...(options ? [options] : [])),
    stripe.disputes.list({ payment_intent: payment, limit: 100 }, ...(options ? [options] : [])),
  ])
  if (refunds.has_more || disputes.has_more) throw new Error("Credit payment needs manual reconciliation.")
  for (const refund of refunds.data) {
    if (id(refund.payment_intent) !== payment || refund.currency !== order.currency || !refund.status) throw new Error("Refund identity mismatch.")
    await recordPaymentRestriction(order, payment, { kind: "refund", providerId: refund.id, status: refund.status,
      amount: refund.amount, currency: refund.currency, eventKey: evidence.key, eventCreated: evidence.created })
  }
  for (const dispute of disputes.data) {
    if (id(dispute.payment_intent) !== payment || dispute.currency !== order.currency || dispute.livemode !== (order.mode === "live")) throw new Error("Dispute identity mismatch.")
    await recordPaymentRestriction(order, payment, { kind: "dispute", providerId: dispute.id, status: dispute.status,
      amount: dispute.amount, currency: dispute.currency, eventKey: evidence.key, eventCreated: evidence.created })
  }
  await verification(order, payment, evidence, "resolved")
}

export async function processAiCreditReversal(event: Stripe.Event, stripe: Stripe, mode: "test" | "live") {
  if (!reversalEvents.has(event.type)) return false
  if (event.livemode !== (mode === "live")) throw new Error("Credit adjustment mode mismatch.")
  const incoming = event.data.object as Stripe.Refund | Stripe.Dispute | Stripe.Charge
  let paymentId = id(incoming.payment_intent)
  if (!paymentId && "charge" in incoming && id(incoming.charge)) paymentId = id((await stripe.charges.retrieve(id(incoming.charge)!)).payment_intent)
  if (!paymentId) return false
  let order = await findCreditPayment(paymentId, mode)
  const evidence = { key: event.id, created: event.created }
  if (order) await verification(order, paymentId, evidence, "pending")
  const payment = await stripe.paymentIntents.retrieve(paymentId)
  if (payment.metadata?.kind !== "ai_credit_pack") {
    if (order) throw new Error("Stored credit payment lost its binding.")
    return false
  }
  order ??= await readPurchase(z.uuid().parse(payment.metadata.order_id))
  verifyCreditPayment(order, payment, mode)
  await syncCreditPaymentRestrictions(order, paymentId, stripe, evidence)
  return true
}
