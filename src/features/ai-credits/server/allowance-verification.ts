import "server-only"
import type Stripe from "stripe"
import type { AllowanceRule } from "./allowance-store"

export class AllowanceIneligible extends Error {}
export function stripeId(value: string | { id?: string } | null | undefined) { return typeof value === "string" ? value : value?.id ?? null }
export function monthlyAllowanceSubscription(subscription: Stripe.Subscription, ownerId: string, customerId: string, mode: "test" | "live", rules: AllowanceRule[]) {
  if (subscription.livemode !== (mode === "live") || stripeId(subscription.customer) !== customerId) throw new Error("Subscription identity mismatch.")
  const owner = subscription.metadata.org_user_id ?? subscription.metadata.user_id ?? subscription.metadata.userId
  if (owner !== ownerId) throw new Error("Subscription payer mismatch.")
  if (subscription.status !== "active" || subscription.pause_collection || subscription.items.has_more || subscription.items.data.length !== 1) return null
  const item = subscription.items.data[0]
  const rule = rules.find(rule => rule.enabled && rule.mode === mode && rule.price_id === item.price.id)
  if (!rule || item.quantity !== 1 || item.price.recurring?.interval !== "month" || item.price.recurring.interval_count !== 1) return null
  if (item.price.unit_amount !== rule.amount || item.price.currency !== rule.currency || item.price.livemode !== subscription.livemode) throw new Error("Allowance price mismatch.")
  return { rule, item }
}
export async function verifyAllowancePeriod(subscription: Stripe.Subscription, rule: AllowanceRule, invoiceId: string, stripe: Stripe) {
  const invoice = await stripe.invoices.retrieve(invoiceId)
  if (invoice.id !== invoiceId || stripeId(invoice.parent?.subscription_details?.subscription) !== subscription.id ||
      stripeId(invoice.customer) !== stripeId(subscription.customer) || invoice.livemode !== subscription.livemode || invoice.currency !== rule.currency)
    throw new Error("Allowance invoice identity mismatch.")
  if (invoice.status !== "paid" || invoice.amount_paid <= 0 || invoice.amount_paid < invoice.total ||
      !["subscription_create", "subscription_cycle"].includes(invoice.billing_reason ?? "") || invoice.pre_payment_credit_notes_amount || invoice.post_payment_credit_notes_amount)
    throw new AllowanceIneligible("This invoice does not establish an eligible paid monthly allowance.")
  if (!rule.allow_discounted && ((invoice.total_discount_amounts ?? []).some(discount => discount.amount > 0) || invoice.amount_paid < rule.amount))
    throw new AllowanceIneligible("Discounted allowance policy has not been enabled for this plan.")
  const lines = await stripe.invoices.listLineItems(invoice.id, { limit: 2 })
  const line = lines.data[0], item = subscription.items.data[0]
  if (lines.has_more || lines.data.length !== 1 || line.parent?.type !== "subscription_item_details" || line.parent.subscription_item_details?.proration ||
      line.parent.subscription_item_details?.subscription !== subscription.id || line.parent.subscription_item_details.subscription_item !== item.id ||
      line.pricing?.price_details?.price !== rule.price_id || line.quantity !== 1 || line.amount !== rule.amount)
    throw new AllowanceIneligible("This invoice needs allowance review; no credits were added.")
  const now = Date.now() / 1000
  const duration = line.period.end - line.period.start
  if (line.period.start !== item.current_period_start || line.period.end !== item.current_period_end || line.period.start > now || line.period.end <= now || duration < 27 * 86400 || duration > 32 * 86400)
    throw new AllowanceIneligible("This monthly allowance period is not current.")
  const payments = await stripe.invoicePayments.list({ invoice: invoice.id, limit: 100 })
  if (payments.has_more) throw new Error("Invoice payment reconciliation is incomplete.")
  let paid = 0
  for (const payment of payments.data) {
    if (payment.status !== "paid") continue
    if (stripeId(payment.invoice) !== invoice.id || payment.livemode !== invoice.livemode || payment.currency !== invoice.currency ||
        payment.payment.type !== "payment_intent" || !stripeId(payment.payment.payment_intent)) throw new AllowanceIneligible("This payment needs allowance review.")
    const intent = await stripe.paymentIntents.retrieve(stripeId(payment.payment.payment_intent)!, { expand: ["latest_charge"] })
    if (intent.status !== "succeeded" || intent.livemode !== invoice.livemode || intent.currency !== invoice.currency ||
        stripeId(intent.customer) !== stripeId(subscription.customer) || (payment.amount_paid ?? 0) > intent.amount_received) throw new Error("Allowance payment mismatch.")
    const charge = intent.latest_charge
    if (!charge || typeof charge === "string" || !charge.paid || charge.refunded || charge.disputed || charge.amount_refunded > 0)
      throw new AllowanceIneligible("This payment is not eligible for an allowance.")
    paid += payment.amount_paid ?? 0
  }
  if (paid < invoice.amount_paid) throw new AllowanceIneligible("A verified Stripe payment is required for this allowance.")
  return { invoiceId: invoice.id, start: line.period.start, end: line.period.end }
}
