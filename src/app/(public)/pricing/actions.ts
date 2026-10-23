"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { isRedirectError } from "next/dist/client/components/redirect-error"
import Stripe from "stripe"

import { getSubscriptionPeriodEndIso } from "@/lib/billing/subscription-period"

import { requireServerSession } from "@/lib/auth"
import { resolveDevtoolsAudience, resolveTesterMetadata } from "@/lib/devtools/audience"
import {
  collectStripeCheckoutPriceDiagnostics,
} from "@/lib/billing/stripe-checkout-diagnostics"
import {
  resolveStripePriceIdForPlan,
  resolveStripeRuntimeConfigForAudience,
} from "@/lib/billing/stripe-runtime"
import { resolveActiveOrganization } from "@/lib/organization/active-org"
import type { Database } from "@/lib/supabase"

const REUSABLE_STRIPE_SUBSCRIPTION_STATUSES = new Set(["trialing", "active", "past_due"])

type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"]
type SubscriptionInsert = Database["public"]["Tables"]["subscriptions"]["Insert"]
type SubscriptionLookupRow = {
  id: string
  stripe_subscription_id: string
  stripe_customer_id: string | null
  status: SubscriptionStatus
  metadata: Record<string, string> | null
}

function isNextRedirectError(error: unknown) {
  if (isRedirectError(error)) return true
  if (error instanceof Error && error.message.startsWith("redirect:")) return true
  if (typeof error === "object" && error && "digest" in error) {
    const digest = String((error as { digest?: unknown }).digest ?? "")
    if (digest.startsWith("NEXT_REDIRECT")) return true
  }
  return false
}

function toSubscriptionStatus(value: string): SubscriptionStatus {
  const allowed: SubscriptionStatus[] = [
    "trialing",
    "active",
    "past_due",
    "canceled",
    "incomplete",
    "incomplete_expired",
  ]
  return allowed.includes(value as SubscriptionStatus) ? (value as SubscriptionStatus) : "trialing"
}

function redirectCheckoutError({
  planTier,
  code,
  source = "billing",
}: {
  planTier: "organization" | "operations_support"
  code:
    | "stripe_unavailable"
    | "operations_unavailable"
    | "missing_price"
    | "session_url_missing"
    | "checkout_failed"
  source?: string
}): never {
  const params = new URLSearchParams()
  params.set("paywall", "organization")
  params.set("plan", planTier)
  params.set("checkout_error", code)
  params.set("source", source)
  redirect(`/organization?${params.toString()}`)
}

export async function startCheckout(formData: FormData) {
  const checkoutModeEntry = formData.get("checkoutMode")
  const checkoutMode = typeof checkoutModeEntry === "string" ? checkoutModeEntry.trim().toLowerCase() : "organization"
  const normalizedCheckoutMode =
    checkoutMode === "accelerator" || checkoutMode === "elective" ? "organization" : checkoutMode

  const planNameEntry = formData.get("planName")
  const planName = typeof planNameEntry === "string" ? planNameEntry : undefined
  const planTierEntry = formData.get("planTier")
  const requestedPlanTier =
    typeof planTierEntry === "string" && planTierEntry === "operations_support"
      ? "operations_support"
      : typeof planTierEntry === "string" && planTierEntry === "organization"
        ? "organization"
        : null
  const sourceEntry = formData.get("source")
  const source = typeof sourceEntry === "string" && sourceEntry.trim().length > 0 ? sourceEntry.trim() : "billing"
  const priceIdEntry = formData.get("priceId")
  const explicitPriceId = typeof priceIdEntry === "string" && priceIdEntry.trim().length > 0 ? priceIdEntry.trim() : null

  if (normalizedCheckoutMode !== "organization") {
    redirectCheckoutError({ planTier: "organization", code: "checkout_failed", source })
  }

  const { supabase, session } = await requireServerSession("/pricing")

  const user = session.user
  const fallbackIsTester = resolveTesterMetadata(user.user_metadata ?? null)
  const audience = await resolveDevtoolsAudience({
    supabase,
    userId: user.id,
    fallbackIsTester,
  })
  const forceCheckoutForTester = audience.isTester

  const requestHeaders = await headers()
  const origin =
    requestHeaders.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"

  const userId = user.id
  let orgId = userId
  let supportMode = false
  try {
    const resolved = await resolveActiveOrganization(supabase, userId)
    supportMode = resolved.supportAccess === true
    orgId = resolved.orgId
  } catch {
    orgId = userId
  }

  if (supportMode) redirectCheckoutError({ planTier: "organization", code: "checkout_failed", source })

  const stripeConfig = resolveStripeRuntimeConfigForAudience({ isTester: forceCheckoutForTester })
  if (!stripeConfig) {
    redirectCheckoutError({ planTier: "organization", code: "stripe_unavailable", source })
  }

  let selectedPriceIdForCheckout: string | null = null
  try {
    const stripeClient = stripeConfig.client
    const inferredPlanTier = planName?.toLowerCase().includes("operations")
      ? "operations_support"
      : "organization"
    const planTier = requestedPlanTier ?? inferredPlanTier
    const resolvedPlanName =
      planName ?? (planTier === "operations_support" ? "Operations Support" : "Organization")
    const organizationPriceId =
      explicitPriceId ??
      resolveStripePriceIdForPlan({
        config: stripeConfig,
        planTier,
      })
    selectedPriceIdForCheckout = organizationPriceId

    if (!organizationPriceId) {
      if (planTier === "operations_support") {
        redirectCheckoutError({ planTier, code: "operations_unavailable", source })
      }
      redirectCheckoutError({ planTier: "organization", code: "missing_price", source })
    }

    let existingSubscription: SubscriptionLookupRow | null = null
    try {
      const baseLookup = supabase
        .from("subscriptions")
        .select("id, stripe_subscription_id, stripe_customer_id, status, metadata")
        .eq("user_id", orgId)
        .in("status", ["active", "trialing", "past_due", "incomplete"])
        .not("stripe_subscription_id", "ilike", "stub_%")
      const orderedLookup =
        typeof (baseLookup as { order?: unknown }).order === "function"
          ? (baseLookup as { order: (column: string, options?: { ascending?: boolean }) => unknown }).order(
              "created_at",
              { ascending: false },
            )
          : baseLookup

      const lookupResult = await (orderedLookup as {
        limit: (count: number) => {
          maybeSingle: <T>() => Promise<{ data: T | null; error: { message?: string } | null }>
        }
      })
        .limit(1)
        .maybeSingle<SubscriptionLookupRow>()

      if (!lookupResult.error) {
        existingSubscription = lookupResult.data ?? null
      }
    } catch {
      existingSubscription = null
    }

    if (!forceCheckoutForTester && existingSubscription?.stripe_subscription_id) {
      let existingStripeSubscription: Stripe.Subscription | null = null
      try {
        existingStripeSubscription = await stripeClient.subscriptions.retrieve(
          existingSubscription.stripe_subscription_id,
        )
      } catch {
        existingStripeSubscription = null
      }

      if (existingStripeSubscription) {
        const stripeStatus = existingStripeSubscription.status
        const canReuseExistingSubscription = REUSABLE_STRIPE_SUBSCRIPTION_STATUSES.has(stripeStatus)

        if (!canReuseExistingSubscription) {
          existingStripeSubscription = null
        }
      }

      if (existingStripeSubscription) {
        const currentItem = existingStripeSubscription.items.data[0]
        const currentPriceId = currentItem?.price?.id ?? null

        if (currentItem?.id && currentPriceId !== organizationPriceId) {
          const updated = await stripeClient.subscriptions.update(existingStripeSubscription.id, {
            cancel_at_period_end: false,
            proration_behavior: "create_prorations",
            items: [{ id: currentItem.id, price: organizationPriceId }],
            metadata: {
              ...existingStripeSubscription.metadata,
              kind: "organization",
              user_id: userId,
              org_user_id: orgId,
              planName: resolvedPlanName,
              plan_tier: planTier,
              stripe_mode: stripeConfig.mode,
            },
          })
          const currentPeriodEnd = getSubscriptionPeriodEndIso(updated)
          const updatePayload: SubscriptionInsert = {
            user_id: orgId,
            stripe_customer_id: typeof updated.customer === "string" ? updated.customer : null,
            stripe_subscription_id: updated.id,
            status: toSubscriptionStatus(updated.status),
            current_period_end: currentPeriodEnd,
            cancel_at: null,
            canceled_at: null,
            metadata: {
              ...(updated.metadata ?? {}),
              planName: resolvedPlanName,
              plan_tier: planTier,
              user_id: userId,
              org_user_id: orgId,
              stripe_mode: stripeConfig.mode,
            },
          }
          await supabase
            .from("subscriptions" satisfies keyof Database["public"]["Tables"])
            .upsert(updatePayload, { onConflict: "user_id,stripe_subscription_id" })
          redirect(`/organization?subscription=${toSubscriptionStatus(updated.status)}&plan=${planTier}`)
        }

        if (currentPriceId === organizationPriceId) {
          redirect(`/organization?subscription=${toSubscriptionStatus(existingStripeSubscription.status)}&plan=${planTier}`)
        }
      }
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      allow_promotion_codes: true,
      client_reference_id: userId,
      customer_email: user.email ?? undefined,
      line_items: [
        {
          price: organizationPriceId!,
          quantity: 1,
        },
      ],
      metadata: {
        kind: "organization",
        user_id: userId,
        org_user_id: orgId,
        planName: resolvedPlanName,
        plan_tier: planTier,
        stripe_mode: stripeConfig.mode,
      },
      subscription_data: {
        metadata: {
          kind: "organization",
          user_id: userId,
          org_user_id: orgId,
          planName: resolvedPlanName,
          plan_tier: planTier,
          stripe_mode: stripeConfig.mode,
        },
      },
      success_url: `${origin}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?cancelled=true`,
    }

    const checkout = await stripeClient.checkout.sessions.create(sessionParams)

    if (!checkout.url) {
      redirectCheckoutError({ planTier, code: "session_url_missing", source })
    }

    redirect(checkout.url!)
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error
    }
    const stripeError = error as Stripe.errors.StripeError | null
    const stripePriceDiagnostics =
      stripeError?.type === "StripeInvalidRequestError" &&
      stripeError.code === "resource_missing" &&
      (stripeError.param ?? "").includes("line_items") &&
      selectedPriceIdForCheckout
        ? await collectStripeCheckoutPriceDiagnostics({
            priceId: selectedPriceIdForCheckout,
            selectedConfig: stripeConfig,
            preferTester: forceCheckoutForTester,
          })
        : null
    console.error("Unable to start Stripe checkout", {
      message: error instanceof Error ? error.message : "unknown_error",
      planName,
      source,
      userId,
      orgId,
      fallbackIsTester,
      audienceIsTester: forceCheckoutForTester,
      stripeTarget: stripeConfig.target,
      stripeMode: stripeConfig.mode,
      selectedPriceId: selectedPriceIdForCheckout,
      stripeType: stripeError?.type ?? null,
      stripeCode: stripeError?.code ?? null,
      stripeParam: stripeError?.param ?? null,
      stripePriceDiagnostics,
    })
    redirectCheckoutError({ planTier: "organization", code: "checkout_failed", source })
  }
}
