import Stripe from "stripe"

import { resolvePaidPlanTierFromMetadata } from "@/lib/billing/plan-tier"

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export function getSafeRedirect(value: string | string[] | undefined) {
  const raw = getFirstParam(value)
  if (typeof raw !== "string") return null
  if (!raw.startsWith("/")) return null
  if (raw.startsWith("//")) return null
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null
  return raw
}

export function appendInternalRedirectParams(
  target: string,
  params: Record<string, string | null | undefined>,
) {
  const url = new URL(target, "https://coachhouse.internal")
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length > 0) {
      url.searchParams.set(key, value)
    }
  }
  return `${url.pathname}${url.search}`
}

export function appendSuccessfulPricingReturn(
  redirectTarget: string,
  planTier: "organization" | "operations_support",
) {
  return appendInternalRedirectParams(redirectTarget, {
    checkout: "success",
    plan: planTier,
  })
}

export function resolveSuccessfulCheckoutPlanTier(checkout: Stripe.Checkout.Session) {
  return resolvePaidPlanTierFromMetadata(checkout.metadata ?? null) ?? "organization"
}

export function canTreatCheckoutAsSuccessfulSubscriptionReturn(
  checkout: Stripe.Checkout.Session,
) {
  if (checkout.mode !== "subscription") return false
  if (checkout.status !== "complete") return false
  return checkout.payment_status === "paid" || checkout.payment_status === "no_payment_required"
}

export async function resolveCheckoutSubscription({
  checkout,
  stripeClient,
}: {
  checkout: Stripe.Checkout.Session
  stripeClient: Stripe
}) {
  if (!checkout.subscription) return null
  if (typeof checkout.subscription !== "string") {
    return checkout.subscription
  }

  return stripeClient.subscriptions.retrieve(checkout.subscription)
}
