"use server"

import { headers } from "next/headers"
import { logger } from "@/lib/logger"
import { requireServerSession } from "@/lib/auth"
import { resolveDevtoolsAudience, resolveTesterMetadata } from "@/lib/devtools/audience"
import { resolveStripeRuntimeConfigsForFallback } from "@/lib/billing/stripe-runtime"
import { resolveActiveOrganization } from "@/lib/organization/active-org"

export async function createBillingPortalSession() {
  const { supabase, session } = await requireServerSession("/billing")
  const user = session.user

  const fallbackIsTester = resolveTesterMetadata(user.user_metadata ?? null)
  const audience = await resolveDevtoolsAudience({
    supabase,
    userId: user.id,
    fallbackIsTester,
  })
  const stripeConfigs = resolveStripeRuntimeConfigsForFallback({
    preferTester: audience.isTester,
  })
  if (stripeConfigs.length === 0) return { error: "Billing portal not available yet." }

  let orgId = user.id
  try {
    const resolved = await resolveActiveOrganization(supabase, user.id)
    if (resolved.supportAccess) return { error: "Exit the support workspace to manage your own billing. Organization billing stays with its owner." }
    orgId = resolved.orgId
  } catch {
    orgId = user.id
  }

  const baseLookup = supabase
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id, metadata")
    .eq("user_id", orgId)
  const filteredLookup =
    typeof (baseLookup as { not?: unknown }).not === "function"
      ? (baseLookup as { not: (column: string, operator: string, value: string) => unknown }).not(
          "stripe_subscription_id",
          "ilike",
          "stub_%",
        )
      : baseLookup
  const orderedLookup =
    typeof (filteredLookup as { order?: unknown }).order === "function"
      ? (filteredLookup as { order: (column: string, options?: { ascending?: boolean }) => unknown }).order(
          "created_at",
          { ascending: false },
        )
      : filteredLookup
  const limitedLookup =
    typeof (orderedLookup as { limit?: unknown }).limit === "function"
      ? (orderedLookup as { limit: (count: number) => unknown }).limit(1)
      : orderedLookup
  const lookupResult =
    typeof (limitedLookup as { maybeSingle?: unknown }).maybeSingle === "function"
      ? await (limitedLookup as {
          maybeSingle: <T>() => Promise<{ data: T | null; error: unknown | null }>
        }).maybeSingle<{
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          metadata: Record<string, string> | null
        }>()
      : { data: null, error: null }
  const { data: subscription, error } = lookupResult

  if (error) {
    logger.error("billing_portal_subscription_lookup_failed", error, { userId: user.id })
    return { error: "Unable to locate your subscription." }
  }

  const headerStore = await headers()
  const origin = headerStore.get("origin") ?? "https://coachhouse.local"

  const modeHint = typeof subscription?.metadata?.stripe_mode === "string"
    ? subscription.metadata.stripe_mode
    : null
  const orderedConfigs = modeHint
    ? [
        ...stripeConfigs.filter((config) => config.mode === modeHint),
        ...stripeConfigs.filter((config) => config.mode !== modeHint),
      ]
    : stripeConfigs

  let customerId = subscription?.stripe_customer_id ?? null
  const subscriptionId = subscription?.stripe_subscription_id ?? null
  let lastPortalError: unknown = null
  for (const config of orderedConfigs) {
    try {
      if (!customerId && subscriptionId) {
        const stripeSubscription = await config.client.subscriptions.retrieve(
          subscriptionId,
        )
        customerId =
          typeof stripeSubscription.customer === "string"
            ? stripeSubscription.customer
            : null
      }

      if (!customerId) {
        continue
      }

      const portalSession = await config.client.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/billing`,
      })

      logger.info("billing_portal_session_created", {
        userId: user.id,
        stripeMode: config.mode,
      })

      return { url: portalSession.url }
    } catch (portalError) {
      lastPortalError = portalError
    }
  }

  if (!customerId) {
    return { error: "No Stripe customer linked to this account yet." }
  }

  logger.error("billing_portal_session_failed", lastPortalError, { userId: user.id })
  return { error: "We couldn't open the billing portal. Contact support." }
}
