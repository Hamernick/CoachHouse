import type Stripe from "stripe"

import { getSubscriptionPeriodEndIso } from "@/lib/billing/subscription-period"

import { resolvePaidPlanTierFromMetadata } from "@/lib/billing/plan-tier"
import { createSupabaseAdminClient } from "@/lib/supabase"
import type { Database } from "@/lib/supabase"

type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"]

const ALLOWED_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
]

type PersistCheckoutSubscriptionInput = {
  checkout: Stripe.Checkout.Session
  subscription: Stripe.Subscription
  stripeMode: string
  userId: string
  redirectTarget: string | null
}

function resolveSubscriptionStatus(status: string): SubscriptionStatus {
  return ALLOWED_SUBSCRIPTION_STATUSES.includes(status as SubscriptionStatus)
    ? (status as SubscriptionStatus)
    : "incomplete"
}

export async function persistCheckoutSubscription({
  checkout,
  subscription,
  stripeMode,
  userId,
  redirectTarget,
}: PersistCheckoutSubscriptionInput) {
  const status = resolveSubscriptionStatus(subscription.status)
  const currentPeriodEnd = getSubscriptionPeriodEndIso(subscription)
  const cancelAt = typeof subscription.cancel_at === "number" ? new Date(subscription.cancel_at * 1000).toISOString() : null
  const canceledAt = typeof subscription.canceled_at === "number" ? new Date(subscription.canceled_at * 1000).toISOString() : null
  const metadataWithMode: Record<string, string> = {
    ...checkout.metadata,
    ...subscription.metadata,
    stripe_mode: stripeMode,
  }
  const subscriptionOwnerId =
    typeof metadataWithMode?.org_user_id === "string" && metadataWithMode.org_user_id.length > 0
      ? metadataWithMode.org_user_id
      : userId
  const resolvedPlanTier = resolvePaidPlanTierFromMetadata(metadataWithMode) ?? "organization"
  const planName = typeof metadataWithMode?.planName === "string" ? metadataWithMode.planName : null
  const kind = typeof metadataWithMode?.kind === "string" ? metadataWithMode.kind : null

  const upsertPayload: Database["public"]["Tables"]["subscriptions"]["Insert"] = {
    user_id: subscriptionOwnerId,
    stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : null,
    stripe_subscription_id: subscription.id,
    status,
    current_period_end: currentPeriodEnd,
    cancel_at: cancelAt,
    canceled_at: canceledAt,
    metadata:
      metadataWithMode && Object.keys(metadataWithMode).length > 0
        ? metadataWithMode
        : planName
          ? { planName, stripe_mode: stripeMode }
          : null,
  }

  try {
    const admin = createSupabaseAdminClient()
    const { error } = await admin
      .from("subscriptions" satisfies keyof Database["public"]["Tables"])
      .upsert(upsertPayload, { onConflict: "user_id,stripe_subscription_id" })
    if (error) throw error
  } catch (error) {
    console.error("Unable to persist subscription after checkout", {
      sessionId: checkout.id,
      subscriptionId: subscription.id,
      subscriptionOwnerId,
      redirectTarget,
      error,
    })
    throw new Error("Subscription activation is pending", { cause: error })
  }

  return {
    status,
    subscriptionOwnerId,
    resolvedPlanTier,
    kind,
  }
}
