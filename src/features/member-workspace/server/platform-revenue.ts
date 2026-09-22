"use server"

import { createCoachingPaymentMatcher } from "./platform-revenue-coaching"
import { createRevenueChargeResolver, isMonkeypodPayment } from "./platform-revenue-sources"
import { createPlatformSubscriptionMatcher } from "./platform-revenue-subscriptions"
import { unstable_cache } from "next/cache"
import { requirePlatformCapability } from "@/lib/admin/auth"
import { resolveStripeRuntimeConfigForAudience } from "@/lib/billing/stripe-runtime"

const readRevenue = unstable_cache(async (month: string, scope: "all" | "subscriptions" | "coaching", coach: string) => {
  const runtime = resolveStripeRuntimeConfigForAudience({ isTester: false })
  if (!runtime || runtime.mode !== "live") return null
  const start = new Date(`${month}-01T00:00:00Z`)
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
  const totals: Record<string, number> = {}
  const resolveCharge = createRevenueChargeResolver(runtime.client)
  const isCoaching = createCoachingPaymentMatcher(runtime.client, resolveCharge)
  const isSubscription = createPlatformSubscriptionMatcher(runtime.client,
    [runtime.organizationPriceId, runtime.operationsSupportPriceId].filter((id): id is string => Boolean(id)), resolveCharge
  )
  for await (const transaction of runtime.client.balanceTransactions.list({
    created: { gte: start.getTime() / 1000, lt: end.getTime() / 1000 },
    limit: 100,
  })) {
    const included = ["charge", "refund", "partial_capture_reversal", "refund_failure", "charge_failure"].includes(transaction.reporting_category)
    if (!included) continue
    if (isMonkeypodPayment(await resolveCharge(transaction))) continue
    if (scope === "coaching" && !await isCoaching(transaction, coach)) continue
    if (scope === "subscriptions" && !await isSubscription(transaction)) continue
    totals[transaction.currency] = (totals[transaction.currency] ?? 0) + transaction.amount
  }
  if (scope === "coaching" && Object.keys(totals).length === 0) {
    const account = await runtime.client.accounts.retrieve()
    if (!account.default_currency) throw new Error("Missing account currency")
    totals[account.default_currency] = 0
  }
  return { totals, updatedAt: new Date().toISOString() }
}, ["platform-collected-revenue-v5"], { revalidate: 60 })

export async function loadPlatformRevenue(scope: "all" | "subscriptions" | "coaching" = "all", coach = "all") {
  await requirePlatformCapability("organizations")
  if (!["all", "subscriptions", "coaching"].includes(scope) || !["all", "joel", "paula"].includes(coach)) return null
  const month = new Date().toISOString().slice(0, 7)
  try {
    const result = await readRevenue(month, scope, coach)
    return result ? { ...result, month, scope, coach } : null
  } catch {
    return null
  }
}
