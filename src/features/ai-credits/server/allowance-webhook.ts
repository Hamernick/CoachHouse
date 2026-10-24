import "server-only"
import type Stripe from "stripe"
import { allowanceSetup, findAllowanceBinding, grantAllowance } from "./allowance-store"
import { AllowanceIneligible, monthlyAllowanceSubscription, stripeId, verifyAllowancePeriod } from "./allowance-verification"

export async function processAiAllowanceInvoice(event: Stripe.Event, stripe: Stripe, mode: "test" | "live") {
  if (process.env.WORKSPACE_AI_ALLOWANCES_ENABLED !== "true" || event.type !== "invoice.paid") return
  if (event.livemode !== (mode === "live")) throw new Error("Allowance event mode mismatch.")
  const incoming = event.data.object as Stripe.Invoice
  if (!incoming.id) throw new Error("Allowance invoice identity missing.")
  const subscriptionId = stripeId(incoming.parent?.subscription_details?.subscription)
  if (!subscriptionId) return
  const binding = await findAllowanceBinding(subscriptionId, mode)
  // Never infer an organization from the payer's active workspace or metadata.
  if (!binding) return
  const setup = await allowanceSetup(binding.org_id, binding.owner_id, mode)
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const eligible = monthlyAllowanceSubscription(subscription, binding.owner_id, binding.customer_id, mode, setup.rules)
  if (!eligible) return
  try {
    const period = await verifyAllowancePeriod(subscription, eligible.rule, incoming.id, stripe)
    await grantAllowance(binding, eligible.rule, period)
  } catch (error) {
    if (!(error instanceof AllowanceIneligible)) throw error
    // No trial, failed renewal, annual, proration, comped or expired-period grant.
    // Transient provider/DB failures above still retry through the webhook owner.
  }
}
