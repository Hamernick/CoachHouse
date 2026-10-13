import Stripe from "stripe"

import {
  ACCELERATOR_MONTHLY_INSTALLMENT_LIMIT,
  ACCELERATOR_PLATFORM_INCLUDED_TRIAL_DAYS,
} from "@/lib/accelerator/billing"
import {
  resolveNextInstallmentProgress,
  shouldRollToOrganizationPlan,
} from "@/lib/accelerator/billing-lifecycle"
import { createSupabaseAdminClient } from "@/lib/supabase"
import { supabaseErrorToError } from "@/lib/supabase/errors"
import {
  extractUserIdFromMetadata,
  getCancelAtIso,
  getCanceledAtIso,
  getCurrentPeriodEndIso,
  toStatus,
} from "./metadata"
import { upsertSubscription } from "./persistence"

export const WEBHOOK_BILLING_CONSTANTS = {
  ACCELERATOR_MONTHLY_INSTALLMENT_LIMIT,
  ACCELERATOR_PLATFORM_INCLUDED_TRIAL_DAYS,
}

export async function maybeStartOrganizationSubscription({
  stripeClient,
  stripeMode,
  organizationPriceId,
  userId,
  customerId,
  idempotencyKey,
  trialPeriodDays,
  context,
}: {
  stripeClient: Stripe
  stripeMode: "live" | "test"
  organizationPriceId: string | null
  userId: string
  customerId: string
  idempotencyKey: string
  trialPeriodDays?: number
  context: "accelerator_bundle_one_time" | "accelerator_rollover"
}) {
  if (!organizationPriceId) {
    return
  }

  const admin = createSupabaseAdminClient()
  const { data: existing, error } = await admin
    .from("subscriptions")
    .select("id, status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .limit(1)
    .maybeSingle<{ id: string; status: string }>()

  if (error) {
    throw supabaseErrorToError(error, "Stripe webhook: unable to load subscription.")
  }

  if (existing) {
    return
  }

  const subscriptionParams: Stripe.SubscriptionCreateParams = {
    customer: customerId,
    items: [{ price: organizationPriceId }],
    metadata: {
      user_id: userId,
      planName: "Organization",
      context,
      stripe_mode: stripeMode,
    },
  }

  if (trialPeriodDays && trialPeriodDays > 0) {
    subscriptionParams.trial_period_days = trialPeriodDays
  }

  const subscription = await stripeClient.subscriptions.create(subscriptionParams, {
    idempotencyKey,
  })

  const currentPeriodEnd = getCurrentPeriodEndIso(subscription)

  await upsertSubscription({
    userId,
    customerId,
    subscriptionId: subscription.id,
    status: toStatus(subscription.status),
    currentPeriodEnd,
    cancelAt: getCancelAtIso(subscription),
    canceledAt: getCanceledAtIso(subscription),
    metadata: { planName: "Organization", context, stripe_mode: stripeMode },
  })
}

export async function handleAcceleratorMonthlyInstallmentInvoice({
  invoice,
  stripeClient,
}: {
  invoice: Stripe.Invoice
  stripeClient: Stripe
}) {
  const billingReason = invoice.billing_reason ?? ""

  const parentSubscription = invoice.parent?.subscription_details?.subscription
  const invoiceSubscription = (
    invoice as Stripe.Invoice & {
      subscription?: string | Stripe.Subscription | null
    }
  ).subscription
  const subscriptionId =
    typeof parentSubscription === "string"
      ? parentSubscription
      : parentSubscription &&
            typeof parentSubscription === "object" &&
            "id" in parentSubscription
        ? String(parentSubscription.id)
        : typeof invoiceSubscription === "string"
          ? invoiceSubscription
          : invoiceSubscription &&
                typeof invoiceSubscription === "object" &&
                "id" in invoiceSubscription
            ? String(invoiceSubscription.id)
            : null
  if (!subscriptionId) return

  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId)
  const metadata = subscription.metadata as Record<string, string | undefined>
  const installmentProgress = resolveNextInstallmentProgress({
    billingReason,
    metadata,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    fallbackLimit: ACCELERATOR_MONTHLY_INSTALLMENT_LIMIT,
  })
  if (!installmentProgress.eligible) return

  const userId = extractUserIdFromMetadata(subscription.metadata)
  if (!userId) return

  const { installmentLimit, nextInstallmentsPaid, shouldSetCancelAtPeriodEnd } =
    installmentProgress

  let effectiveSubscription = subscription
  const needsMetadataUpdate =
    metadata.accelerator_installment_limit !== String(installmentLimit) ||
    metadata.accelerator_installments_paid !== String(nextInstallmentsPaid)

  if (needsMetadataUpdate || shouldSetCancelAtPeriodEnd) {
    effectiveSubscription = await stripeClient.subscriptions.update(subscription.id, {
      metadata: {
        ...metadata,
        accelerator_installment_limit: String(installmentLimit),
        accelerator_installments_paid: String(nextInstallmentsPaid),
      },
      ...(shouldSetCancelAtPeriodEnd ? { cancel_at_period_end: true } : {}),
    })
  }

  await upsertSubscription({
    userId,
    customerId:
      typeof effectiveSubscription.customer === "string"
        ? effectiveSubscription.customer
        : null,
    subscriptionId: effectiveSubscription.id,
    status: toStatus(effectiveSubscription.status),
    currentPeriodEnd: getCurrentPeriodEndIso(effectiveSubscription),
    cancelAt: getCancelAtIso(effectiveSubscription),
    canceledAt: getCanceledAtIso(effectiveSubscription),
    metadata: effectiveSubscription.metadata as Record<string, string> | null,
  })
}

export { shouldRollToOrganizationPlan }
