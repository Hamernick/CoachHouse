import type { Metadata } from "next"
import { redirect } from "next/navigation"
import CalendarClockIcon from "lucide-react/dist/esm/icons/calendar-clock"
import CheckCircle2Icon from "lucide-react/dist/esm/icons/check-circle-2"
import CircleDotIcon from "lucide-react/dist/esm/icons/circle-dot"
import CoinsIcon from "lucide-react/dist/esm/icons/coins"
import SparklesIcon from "lucide-react/dist/esm/icons/sparkles"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createSupabaseServerClient } from "@/lib/supabase"
import { resolveActiveOrganization } from "@/lib/organization/active-org"
import { resolvePricingPlanTier } from "@/lib/billing/plan-tier"
import {
  resolveStripeRuntimeConfigForAudience,
} from "@/lib/billing/stripe-runtime"
import type { Json } from "@/lib/supabase"
import { StripePoweredBadge } from "@/components/billing/stripe-powered-badge"
import {
  resolveDevtoolsAudience,
  resolveTesterMetadata,
} from "@/lib/devtools/audience"

import { BillingPlanCard } from "./_components/billing-plan-card"
import { BillingPortalCard } from "./_components/billing-portal-card"

export const metadata: Metadata = {
  title: "Billing",
  description: "Manage your Coach House plan, subscriptions, and coaching credits.",
}


function formatDate(dateValue: string | null) {
  if (!dateValue) return null
  const parsed = new Date(dateValue)
  if (!Number.isFinite(parsed.getTime())) return null
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed)
}

export default async function BillingPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?redirect=/billing")
  }

  const fallbackIsTester = resolveTesterMetadata(user.user_metadata ?? null)
  const audience = await resolveDevtoolsAudience({
    supabase,
    userId: user.id,
    fallbackIsTester,
  })
  const stripeConfig = resolveStripeRuntimeConfigForAudience({
    isTester: audience.isTester,
  })
  const { orgId } = await resolveActiveOrganization(supabase, user.id)
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select(
      "status, metadata, current_period_end, cancel_at, canceled_at, stripe_customer_id, stripe_subscription_id",
    )
    .eq("user_id", orgId)
    .in("status", ["active", "trialing", "past_due", "incomplete"])
    .not("stripe_subscription_id", "ilike", "stub_%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      status: string | null
      metadata: Json | null
      current_period_end: string | null
      cancel_at: string | null
      canceled_at: string | null
      stripe_customer_id: string | null
      stripe_subscription_id: string | null
    }>()

  const currentPlanTier = resolvePricingPlanTier(subscription ?? null)
  const periodEnd = formatDate(subscription?.current_period_end ?? null)
  const cancelAt = formatDate(subscription?.cancel_at ?? subscription?.canceled_at ?? null)
  const subscriptionIsCanceling = Boolean(subscription?.cancel_at || subscription?.canceled_at)

  const organizationIsCurrent = currentPlanTier === "organization"
  const operationsIsCurrent = currentPlanTier === "operations_support"
  const hasPaidPlan = organizationIsCurrent || operationsIsCurrent
  const portalReady = Boolean(stripeConfig)
  const checkoutOrganizationReady = Boolean(stripeConfig?.organizationPriceId)
  const checkoutOperationsReady = Boolean(stripeConfig?.operationsSupportPriceId)
  const hasPortalReference = Boolean(
    subscription?.stripe_customer_id || subscription?.stripe_subscription_id,
  )

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6">
      <Card className="overflow-hidden border-border/70">
        <div className="h-1 w-full bg-gradient-to-r from-foreground/30 via-primary/40 to-foreground/30" aria-hidden />
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full border border-border/70 bg-muted/50">
              Billing
            </Badge>
            <Badge variant="secondary" className="rounded-full border border-border/70 bg-muted/50">
              Current plan:{" "}
              {operationsIsCurrent ? "Operations Support" : organizationIsCurrent ? "Organization" : "Free"}
            </Badge>
            {subscriptionIsCanceling ? (
              <Badge variant="secondary" className="rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                Canceling
              </Badge>
            ) : null}
            <StripePoweredBadge className="ml-auto" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl tracking-tight">Billing and plan management</CardTitle>
            <CardDescription className="max-w-2xl text-sm leading-relaxed">
              Upgrade or downgrade between Organization and Operations Support from inside your workspace.
              Manage payment methods, invoices, cancelation, and renewal through the Stripe billing portal.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Plan status</p>
            <p className="mt-1 inline-flex items-center gap-2 font-medium text-foreground">
              <CheckCircle2Icon className="h-4 w-4" aria-hidden />
              {hasPaidPlan ? "Paid plan active" : "Free plan active"}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Billing cycle</p>
            <p className="mt-1 inline-flex items-center gap-2 font-medium text-foreground">
              <CalendarClockIcon className="h-4 w-4" aria-hidden />
              {cancelAt
                ? `Access through ${cancelAt}`
                : periodEnd
                  ? `Next renewal ${periodEnd}`
                  : "No renewal date yet"}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Actions</p>
            <p className="mt-1 inline-flex items-center gap-2 font-medium text-foreground">
              <CoinsIcon className="h-4 w-4" aria-hidden />
              Upgrade, downgrade, or manage billing
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <BillingPlanCard
          title="Organization"
          description="$20/month. Team seats, accelerator access, and collaboration workflows."
          icon={CircleDotIcon}
          bullets={[
            "Unlimited Admin & Staff Seats",
            "Asynchronous Accelerator Access",
            "Fundability Lens + weekly support sessions",
          ]}
          plan="organization"
          checkoutReady={checkoutOrganizationReady}
          buttonLabel={
            operationsIsCurrent
              ? "Downgrade to Organization"
              : "Upgrade to Organization"
          }
          current={organizationIsCurrent}
          currentBadgeLabel="Current"
          unavailableLabel="Organization checkout unavailable"
        />

        <BillingPlanCard
          title="Operations Support"
          description="$58/month. Coaching plus expert-network access for operational execution."
          icon={SparklesIcon}
          bullets={[
            "One hour monthly 1:1 coaching",
            "Access expert network (bookkeeping, grant writing, accounting)",
            "Expanded delivery and operations support",
          ]}
          plan="operations_support"
          checkoutReady={checkoutOperationsReady}
          buttonLabel={
            organizationIsCurrent
              ? "Upgrade to Operations Support"
              : "Choose Operations Support"
          }
          current={operationsIsCurrent}
          currentBadgeLabel="Current"
          unavailableLabel="Operations plan unavailable"
          variant="secondary"
          highlighted
        />
      </div>

      <BillingPortalCard
        portalReady={portalReady}
        hasPortalReference={hasPortalReference}
        hasPaidPlan={hasPaidPlan}
      />
    </div>
  )
}
