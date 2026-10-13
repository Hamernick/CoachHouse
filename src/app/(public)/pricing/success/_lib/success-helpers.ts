import Stripe from "stripe"

import { getSubscriptionPeriodEndIso } from "@/lib/billing/subscription-period"

import { createSupabaseAdminClient } from "@/lib/supabase"
import type { Database } from "@/lib/supabase"

export async function maybeStartOrganizationTrialFromAccelerator({
  stripeClient,
  organizationPriceId,
  admin,
  userId,
  checkoutSessionId,
  customerId,
}: {
  stripeClient: Stripe
  organizationPriceId: string | null
  admin: ReturnType<typeof createSupabaseAdminClient>
  userId: string
  checkoutSessionId: string
  customerId: string
}) {
  if (!organizationPriceId) return

  const { data: existing } = await admin
    .from("subscriptions" satisfies keyof Database["public"]["Tables"])
    .select("id, status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .limit(1)
    .maybeSingle<{ id: string; status: string }>()

  if (existing) return

  const subscription = await stripeClient.subscriptions.create(
    {
      customer: customerId,
      items: [{ price: organizationPriceId }],
      trial_period_days: 30,
      metadata: {
        user_id: userId,
        planName: "Organization",
        context: "accelerator_bundle",
      },
    },
    { idempotencyKey: `accelerator_bundle_${checkoutSessionId}` },
  )

  const currentPeriodEnd = getSubscriptionPeriodEndIso(subscription)
  const cancelAt = typeof subscription.cancel_at === "number" ? new Date(subscription.cancel_at * 1000).toISOString() : null
  const canceledAt = typeof subscription.canceled_at === "number" ? new Date(subscription.canceled_at * 1000).toISOString() : null

  const allowed: Database["public"]["Enums"]["subscription_status"][] = [
    "trialing",
    "active",
    "past_due",
    "canceled",
    "incomplete",
    "incomplete_expired",
  ]
  const status = allowed.includes(subscription.status as Database["public"]["Enums"]["subscription_status"])
    ? (subscription.status as Database["public"]["Enums"]["subscription_status"])
    : "trialing"

  const upsertPayload: Database["public"]["Tables"]["subscriptions"]["Insert"] = {
    user_id: userId,
    stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : customerId,
    stripe_subscription_id: subscription.id,
    status,
    current_period_end: currentPeriodEnd,
    cancel_at: cancelAt,
    canceled_at: canceledAt,
    metadata: { planName: "Organization", context: "accelerator_bundle" },
  }

  await admin
    .from("subscriptions" satisfies keyof Database["public"]["Tables"])
    .upsert(upsertPayload, { onConflict: "user_id,stripe_subscription_id" })
}
