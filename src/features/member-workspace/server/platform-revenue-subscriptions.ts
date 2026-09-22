import type Stripe from "stripe"
import { createRevenueChargeResolver } from "./platform-revenue-sources"

// Resolve refunds through the original payment, including older-month payments.
export function createPlatformSubscriptionMatcher(stripe: Stripe, priceIds: string[] = [], resolveCharge = createRevenueChargeResolver(stripe)) {
  const charges = new Map<string, Promise<boolean>>()
  return async (transaction: Stripe.BalanceTransaction) => {
    const charge = await resolveCharge(transaction)
    const chargeId = charge.id
    if (!charges.has(chargeId)) {
      charges.set(chargeId, (async () => {
        const intent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id
        if (!intent) return false
        for await (const payment of stripe.invoicePayments.list({
          payment: { type: "payment_intent", payment_intent: intent },
          expand: ["data.invoice"], limit: 100,
        })) {
          const invoice = typeof payment.invoice === "string"
            ? await stripe.invoices.retrieve(payment.invoice) : payment.invoice
          if (invoice.deleted) continue
          const subscription = invoice.parent?.subscription_details
          if (subscription?.metadata?.kind === "organization") return true
          if (subscription && priceIds.length) {
            if (!invoice.id) throw new Error("Missing subscription invoice")
            for await (const line of stripe.invoices.listLineItems(invoice.id, { limit: 100 })) {
              if (priceIds.includes(line.pricing?.price_details?.price ?? "")) return true
            }
          }
        }
        return false
      })())
    }
    return charges.get(chargeId)!
  }
}
