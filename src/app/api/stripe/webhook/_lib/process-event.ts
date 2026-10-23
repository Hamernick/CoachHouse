import Stripe from "stripe"
import { processAiCreditPurchase } from "@/features/ai-credits"

import { isElectiveAddOnModuleSlug } from "@/lib/accelerator/elective-modules"
import {
  extractOrganizationUserIdFromMetadata,
  extractUserIdFromMetadata,
  getCancelAtIso,
  getCanceledAtIso,
  getCurrentPeriodEndIso,
  toStatus,
} from "./metadata"
import {
  upsertAcceleratorPurchase,
  upsertElectivePurchase,
  upsertSubscription,
} from "./persistence"
import {
  handleAcceleratorMonthlyInstallmentInvoice,
  maybeStartOrganizationSubscription,
  shouldRollToOrganizationPlan,
  WEBHOOK_BILLING_CONSTANTS,
} from "./subscription-lifecycle"
import { processCoachingCheckoutSession } from "../../../../../features/coaching-booking/server/stripe"

export async function processStripeWebhookEvent({
  event,
  stripeClient,
  stripeMode,
  organizationPriceId,
}: {
  event: Stripe.Event
  stripeClient: Stripe
  stripeMode: "live" | "test"
  organizationPriceId: string | null
}) {
  if (await processAiCreditPurchase(event, stripeClient, stripeMode)) return
  if (event.type === "checkout.session.async_payment_succeeded") {
    if (await processCoachingCheckoutSession(event.data.object as Stripe.Checkout.Session)) return
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const coachingHandled = await processCoachingCheckoutSession(session)
    if (coachingHandled) return

    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : undefined
    const userId = session.client_reference_id ?? undefined
    const sessionMetadata = session.metadata ?? {}

    if (session.mode === "payment" && session.metadata?.kind === "accelerator") {
      const resolvedUserId =
        userId ?? extractUserIdFromMetadata(session.metadata) ?? undefined
      if (resolvedUserId) {
        const customerId =
          typeof session.customer === "string" ? session.customer : null
        const variant =
          session.metadata?.accelerator_variant === "without_coaching"
            ? "without_coaching"
            : "with_coaching"
        const coachingIncluded =
          session.metadata?.coaching_included != null
            ? session.metadata.coaching_included === "true"
            : variant === "with_coaching"
        await upsertAcceleratorPurchase({
          userId: resolvedUserId,
          checkoutSessionId: session.id,
          paymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : null,
          customerId,
          coachingIncluded,
          status: "active",
        })

        if (customerId) {
          await maybeStartOrganizationSubscription({
            stripeClient,
            stripeMode,
            organizationPriceId,
            userId: resolvedUserId,
            customerId,
            idempotencyKey: `accelerator_bundle_${session.id}`,
            trialPeriodDays:
              WEBHOOK_BILLING_CONSTANTS.ACCELERATOR_PLATFORM_INCLUDED_TRIAL_DAYS,
            context: "accelerator_bundle_one_time",
          })
        }
      }
    }

    if (session.mode === "payment" && session.metadata?.kind === "elective") {
      const resolvedUserId =
        userId ?? extractUserIdFromMetadata(session.metadata) ?? undefined
      const moduleSlug = session.metadata?.elective_module_slug ?? ""

      if (resolvedUserId && isElectiveAddOnModuleSlug(moduleSlug)) {
        await upsertElectivePurchase({
          userId: resolvedUserId,
          moduleSlug,
          checkoutSessionId: session.id,
          paymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : null,
          customerId:
            typeof session.customer === "string" ? session.customer : null,
          status: "active",
        })
      }
    }

    if (subscriptionId) {
      const subscriptionOwnerId =
        extractOrganizationUserIdFromMetadata(sessionMetadata) ??
        extractUserIdFromMetadata(sessionMetadata) ??
        userId
      if (subscriptionOwnerId) {
        const subscription =
          await stripeClient.subscriptions.retrieve(subscriptionId)
        const subscriptionMetadata =
          subscription.metadata && Object.keys(subscription.metadata).length > 0
            ? (subscription.metadata as Record<string, string>)
            : (sessionMetadata as Record<string, string>)
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : typeof session.customer === "string"
              ? session.customer
              : null

        await upsertSubscription({
          userId: subscriptionOwnerId,
          customerId,
          subscriptionId,
          status: toStatus(subscription.status),
          currentPeriodEnd: getCurrentPeriodEndIso(subscription),
          cancelAt: getCancelAtIso(subscription),
          canceledAt: getCanceledAtIso(subscription),
          metadata:
            Object.keys(subscriptionMetadata).length > 0
              ? ({
                  ...subscriptionMetadata,
                  stripe_mode: subscriptionMetadata.stripe_mode ?? stripeMode,
                } as Record<string, string>)
              : {
                  planName: sessionMetadata.planName ?? null,
                  stripe_mode: stripeMode,
                },
        })
      }
    }
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice
    await handleAcceleratorMonthlyInstallmentInvoice({
      invoice,
      stripeClient,
    })
  }

  if (event.type.startsWith("customer.subscription")) {
    const subscription = event.data.object as Stripe.Subscription
    const userId =
      extractOrganizationUserIdFromMetadata(subscription.metadata) ??
      extractUserIdFromMetadata(subscription.metadata)

    if (userId) {
      await upsertSubscription({
        userId,
        customerId:
          typeof subscription.customer === "string" ? subscription.customer : null,
        subscriptionId: subscription.id,
        status: toStatus(subscription.status),
        currentPeriodEnd: getCurrentPeriodEndIso(subscription),
        cancelAt: getCancelAtIso(subscription),
        canceledAt: getCanceledAtIso(subscription),
        metadata: {
          ...(subscription.metadata as Record<string, string>),
          stripe_mode:
            typeof subscription.metadata?.stripe_mode === "string"
              ? subscription.metadata.stripe_mode
              : stripeMode,
        },
      })

      if (
        typeof subscription.customer === "string" &&
        shouldRollToOrganizationPlan({
          eventType: event.type,
          subscriptionStatus: subscription.status,
          metadata: subscription.metadata as Record<string, string | undefined>,
          fallbackLimit:
            WEBHOOK_BILLING_CONSTANTS.ACCELERATOR_MONTHLY_INSTALLMENT_LIMIT,
        })
      ) {
        await maybeStartOrganizationSubscription({
          stripeClient,
          stripeMode,
          organizationPriceId,
          userId,
          customerId: subscription.customer,
          idempotencyKey: `accelerator_rollover_${subscription.id}_${event.id}`,
          context: "accelerator_rollover",
        })
      }
    }
  }
}
