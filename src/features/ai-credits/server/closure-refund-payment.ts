import "server-only"
import type Stripe from "stripe"
import { accessClosureRefund, recordClosureRefund, type ClosureRefund, type ClosureRefundTarget } from "./closure-refund-store"
import { syncCreditPaymentRestrictions, verifyCreditPayment } from "./payment-restrictions"

const options = { timeout: 5000, maxNetworkRetries: 0 }
const providerId = (value: string | { id: string } | null) => typeof value === "string" ? value : value?.id
function verifyRefund(refund: Stripe.Refund, value: ClosureRefund) {
  const intent = value.intent!
  if (providerId(refund.payment_intent) !== intent.payment_intent_id || refund.amount !== intent.amount || refund.currency !== intent.currency ||
      refund.metadata?.kind !== "organization_closure_refund" || refund.metadata.closure_refund_id !== intent.id ||
      refund.metadata.order_id !== intent.order_id || refund.metadata.closure_request_id !== intent.closure_request_id ||
      (intent.refund_id && intent.refund_id !== refund.id) || !refund.status)
    throw new Error("Closure refund provider identity mismatch.")
  return { id: refund.id, status: refund.status, amount: refund.amount, currency: refund.currency, created: refund.created }
}
async function inventory(value: ClosureRefund, stripe: Stripe, mode: "test" | "live") {
  const paymentId = value.order.payment_intent_id
  if (!paymentId) throw new Error("Verified payment unavailable.")
  const payment = await stripe.paymentIntents.retrieve(paymentId, options)
  verifyCreditPayment(value.order, payment, mode)
  if (payment.status !== "succeeded") throw new Error("Payment is not settled.")
  // Existing canonical adjustment history owns holds and verified provider results.
  // Reuse the evidence identity so a failed first inventory can resolve its
  // hold. Later reads do not reopen that terminal hold; any read failure still
  // exits before claim, and an already dispatched intent can never claim again.
  return syncCreditPaymentRestrictions(value.order, paymentId, stripe,
    { key: `closure-review:${value.intent!.id}`, created: Math.floor(Date.now() / 1000) }, options)
}
async function recover(value: ClosureRefund, stripe: Stripe, mode: "test" | "live") {
  const intent = value.intent!
  const current = await inventory(value, stripe, mode)
  const matches = current.refunds.filter(refund => refund.id === intent.refund_id || refund.metadata?.closure_refund_id === intent.id)
  if (matches.length !== 1) {
    if (matches.length > 1) throw new Error("Multiple closure refunds require manual reconciliation.")
    // Absence is not proof that a previously dispatched request failed. This
    // path never creates again, including after Stripe's idempotency retention.
    return recordClosureRefund(intent, null)
  }
  return recordClosureRefund(intent, verifyRefund(matches[0], value))
}

/** Service-only backend, intentionally not attached to a route/cron/UI. The
 * configured runtime supplies Stripe; tests use only a controlled mock client.
 * Recovery remains available with dispatch disabled. Never retry refund create. */
export async function processOrganizationClosureRefund(target: ClosureRefundTarget, stripe: Stripe, mode: "test" | "live") {
  let value = await accessClosureRefund("read", target)
  if (value.order.mode !== mode) throw new Error("Closure refund mode mismatch.")
  if (value.intent && value.intent.state !== "ready") return recover(value, stripe, mode)
  if (process.env.WORKSPACE_AI_CLOSURE_REFUNDS_ENABLED !== "true") return { ...value, reason: "dispatch_disabled" }
  value = await accessClosureRefund("prepare", target)
  if (!value.intent) return value
  if (value.intent.state !== "ready") return recover(value, stripe, mode)
  await inventory(value, stripe, mode)
  value = await accessClosureRefund("claim", target)
  if (!value.dispatchAllowed || !value.intent) return value
  const intent = value.intent
  try {
    const refund = await stripe.refunds.create({ payment_intent: intent.payment_intent_id, amount: intent.amount,
      metadata: { kind: "organization_closure_refund", closure_refund_id: intent.id, order_id: intent.order_id, closure_request_id: intent.closure_request_id },
    }, { ...options, idempotencyKey: `closure-refund:${intent.mode}:${intent.id}` })
    return await recordClosureRefund(intent, verifyRefund(refund, value))
  } catch {
    // Includes lost provider replies and DB acknowledgements. Keep the durable
    // claim even when recording uncertainty fails; the next call only recovers.
    return recordClosureRefund(intent, null)
  }
}
