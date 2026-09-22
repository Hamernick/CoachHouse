import type Stripe from "stripe"

// Verified from the Monkeypod-origin charges in this platform's Stripe account.
const MONKEYPOD_APPLICATION = "ca_E9CoyLM1eLmhTH75XdbjgEsFdT5flQyc"

export function isMonkeypodPayment(charge: Stripe.Charge) {
  const application = typeof charge.application === "string" ? charge.application : charge.application?.id
  if (application === MONKEYPOD_APPLICATION) return true
  return [charge.metadata?.url, charge.metadata?.monkeypod_link].some((value) => {
    if (!value) return false
    try {
      const host = new URL(value).hostname.toLowerCase()
      return host === "monkeypod.io" || host.endsWith(".monkeypod.io")
    } catch { return false }
  })
}

export function createRevenueChargeResolver(stripe: Stripe) {
  const charges = new Map<string, Promise<Stripe.Charge>>()
  const sources = new Map<string, Promise<Stripe.Charge>>()
  return (transaction: Stripe.BalanceTransaction) => {
    const source = transaction.source
    if (!source) throw new Error("Missing payment source")
    const id = typeof source === "string" ? source : source.id
    if (!sources.has(id)) sources.set(id, (async () => {
      const refund = id.startsWith("re_") || id.startsWith("pyr_") ? await stripe.refunds.retrieve(id) : null
      const chargeId = refund ? typeof refund.charge === "string" ? refund.charge : refund.charge?.id : id
      if (!chargeId) throw new Error("Missing original charge")
      if (!charges.has(chargeId)) charges.set(chargeId, stripe.charges.retrieve(chargeId))
      return charges.get(chargeId)!
    })())
    return sources.get(id)!
  }
}
