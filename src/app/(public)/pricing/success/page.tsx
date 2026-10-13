import { isRedirectError } from "next/dist/client/components/redirect-error"
import { redirect } from "next/navigation"
import type Stripe from "stripe"

import { requireServerSession } from "@/lib/auth"
import { resolveDevtoolsAudience, resolveTesterMetadata } from "@/lib/devtools/audience"
import { resolveStripeRuntimeConfigsForFallback } from "@/lib/billing/stripe-runtime"
import { createSupabaseAdminClient } from "@/lib/supabase"
import { isElectiveAddOnModuleSlug } from "@/lib/accelerator/elective-modules"
import { persistCheckoutSubscription } from "./_lib/subscription-persistence"
import { maybeStartOrganizationTrialFromAccelerator } from "./_lib/success-helpers"
import {
  trackSuccessfulSubscriptionCheckout,
} from "./_lib/telemetry"
import {
  appendSuccessfulPricingReturn,
  getSafeRedirect,
  resolveCheckoutSubscription,
} from "./_lib/onboarding-return"
import type { Database } from "@/lib/supabase"
import { CheckoutActivationStatus } from "./_components/checkout-activation-status"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function isNextRedirectError(error: unknown) {
  if (isRedirectError(error)) return true
  if (error instanceof Error && error.message.startsWith("redirect:")) return true
  if (typeof error === "object" && error && "digest" in error) {
    const digest = String((error as { digest?: unknown }).digest ?? "")
    if (digest.startsWith("NEXT_REDIRECT")) return true
  }
  return false
}

export default async function PricingSuccessPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ? await searchParams : {}
  const sessionId = typeof params?.session_id === "string" ? params.session_id : undefined
  const redirectTarget = getSafeRedirect(params?.redirect)

  const { supabase, session } = await requireServerSession("/pricing/success")
  const user = session.user
  const userId = user.id

  const fallbackIsTester = resolveTesterMetadata(user.user_metadata ?? null)
  const audience = await resolveDevtoolsAudience({
    supabase,
    userId,
    fallbackIsTester,
  })
  const stripeConfigs = resolveStripeRuntimeConfigsForFallback({ preferTester: audience.isTester })
  if (stripeConfigs.length === 0) {
    redirect("/organization?paywall=organization&plan=organization&checkout_error=stripe_unavailable&source=billing")
  }

  if (sessionId) {
    let paymentRequired = false
    try {
      let checkout: Stripe.Checkout.Session | null = null
      let checkoutStripeConfig = stripeConfigs[0]
      for (const config of stripeConfigs) {
        try {
          checkout = await config.client.checkout.sessions.retrieve(sessionId, {
            expand: ["subscription"],
          })
          checkoutStripeConfig = config
          break
        } catch {
          checkout = null
        }
      }
      if (!checkout) {
        throw new Error("checkout_session_not_found_in_available_stripe_modes")
      }

      const checkoutUserId = checkout.client_reference_id ?? checkout.metadata?.user_id ?? null
      if (!checkoutUserId || checkoutUserId !== userId) {
        redirect("/pricing?cancelled=true")
      }

      const shouldShowWelcome = checkout.metadata?.context === "onboarding"
      const welcomeQuery = shouldShowWelcome ? "&welcome=1" : ""

      if (checkout.mode === "payment" && checkout.metadata?.kind === "accelerator") {
        const admin = createSupabaseAdminClient()
        const variant =
          checkout.metadata?.accelerator_variant === "without_coaching"
            ? "without_coaching"
            : "with_coaching"
        const coachingIncluded =
          checkout.metadata?.coaching_included != null
            ? checkout.metadata.coaching_included === "true"
            : variant === "with_coaching"
        const payload: Database["public"]["Tables"]["accelerator_purchases"]["Insert"] = {
          user_id: userId,
          stripe_checkout_session_id: checkout.id,
          stripe_payment_intent_id: typeof checkout.payment_intent === "string" ? checkout.payment_intent : null,
          stripe_customer_id: typeof checkout.customer === "string" ? checkout.customer : null,
          coaching_included: coachingIncluded,
          status: "active",
        }

        await admin
          .from("accelerator_purchases" satisfies keyof Database["public"]["Tables"])
          .upsert(payload, { onConflict: "stripe_checkout_session_id" })

        const customerId = typeof checkout.customer === "string" ? checkout.customer : null
        if (customerId) {
          await maybeStartOrganizationTrialFromAccelerator({
            stripeClient: checkoutStripeConfig.client,
            organizationPriceId: checkoutStripeConfig.organizationPriceId,
            admin,
            userId,
            checkoutSessionId: checkout.id,
            customerId,
          })
        }

        redirect(`/organization?purchase=accelerator${welcomeQuery}`)
      }

      if (checkout.mode === "payment" && checkout.metadata?.kind === "elective") {
        const admin = createSupabaseAdminClient()
        const moduleSlugCandidate = checkout.metadata?.elective_module_slug ?? ""
        if (!isElectiveAddOnModuleSlug(moduleSlugCandidate)) {
          redirect("/pricing?plan=electives&cancelled=true")
        }

        const payload: Database["public"]["Tables"]["elective_purchases"]["Insert"] = {
          user_id: userId,
          module_slug: moduleSlugCandidate,
          stripe_checkout_session_id: checkout.id,
          stripe_payment_intent_id: typeof checkout.payment_intent === "string" ? checkout.payment_intent : null,
          stripe_customer_id: typeof checkout.customer === "string" ? checkout.customer : null,
          status: "active",
        }

        await admin
          .from("elective_purchases" satisfies keyof Database["public"]["Tables"])
          .upsert(payload, { onConflict: "user_id,module_slug" })

        redirect(`/organization?purchase=elective&elective=${encodeURIComponent(moduleSlugCandidate)}${welcomeQuery}`)
      }

      if (checkout.mode === "subscription") {
        const subscription = await resolveCheckoutSubscription({
          checkout,
          stripeClient: checkoutStripeConfig.client,
        })
        if (subscription) {
          const {
            status,
            subscriptionOwnerId,
            resolvedPlanTier,
            kind,
          } = await persistCheckoutSubscription({
            checkout,
            subscription,
            stripeMode: checkoutStripeConfig.mode,
            userId,
            redirectTarget,
          })

          const isSuccessfulSubscriptionState =
            status === "trialing" || status === "active"

          if (isSuccessfulSubscriptionState) {
            await trackSuccessfulSubscriptionCheckout({
              userId,
              orgId: subscriptionOwnerId,
              checkout,
              subscriptionId: subscription.id,
              subscriptionStatus: status,
              planTier: resolvedPlanTier,
              stripeMode: checkoutStripeConfig.mode,
              kind,
              redirectTarget,
            })
          }

          if (!isSuccessfulSubscriptionState) {
            paymentRequired = true
          } else {
            if (kind === "accelerator") {
              redirect(`/organization?purchase=accelerator${welcomeQuery}`)
            }
            if (redirectTarget) {
              redirect(appendSuccessfulPricingReturn(redirectTarget, resolvedPlanTier))
            }
            redirect(`/organization?subscription=${status}${welcomeQuery}`)
          }
        }
      }
    } catch (error) {
      if (isNextRedirectError(error)) {
        throw error
      }
      console.warn("Unable to read Stripe checkout session", error)
    }
    return <CheckoutActivationStatus returnHref={redirectTarget ?? "/workspace"} paymentRequired={paymentRequired} />
  }

  if (redirectTarget) {
    redirect(redirectTarget)
  }

  redirect("/workspace")
}
