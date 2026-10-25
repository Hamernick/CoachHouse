"use client"

import Link from "next/link"
import { CircleNotch } from "@phosphor-icons/react/dist/ssr"
import ExternalLinkIcon from "lucide-react/dist/esm/icons/external-link"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import {
  ADMIN_ORGANIZATION_BILLING_PLAN_LABELS,
  formatAdminOrganizationBillingCurrency,
  formatAdminOrganizationBillingDate,
} from "../lib"
import type {
  AdminOrganizationBillingPlan,
  AdminOrganizationBillingState,
  ChangeAdminOrganizationBillingPlanAction,
  RefundLatestAdminOrganizationPaymentAction,
} from "../types"
import { useAdminOrganizationBillingController } from "../hooks/use-admin-organization-billing-controller"

function statusLabel(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function BillingFallback({
  description,
  label,
}: {
  description: string
  label: string
}) {

  return (
    <section

      className="border-border bg-card/80 space-y-3 rounded-lg border p-4"
    >
      <div className="space-y-1">
        <h2 className="text-foreground text-sm font-semibold text-balance">
          Billing
        </h2>
        <p className="text-muted-foreground text-xs leading-5 text-pretty">
          {description}
        </p>
      </div>
      <Button asChild variant="outline" size="sm" className="min-h-11 w-full">
        <Link
          href="https://dashboard.stripe.com/customers"
          target="_blank"
          rel="noreferrer"
        >
          {label}
          <ExternalLinkIcon className="size-4" aria-hidden />
        </Link>
      </Button>
    </section>
  )
}

export function AdminOrganizationBillingPanel({
  billing,
  changePlanAction,
  refundLatestPaymentAction,
}: {
  billing: AdminOrganizationBillingState
  changePlanAction: ChangeAdminOrganizationBillingPlanAction
  refundLatestPaymentAction: RefundLatestAdminOrganizationPaymentAction
}) {
  const orgId = billing.mode === "ready" ? billing.summary.orgId : billing.orgId
  const controller = useAdminOrganizationBillingController({
    changePlanAction,
    orgId,
    refundLatestPaymentAction,
  })

  if (billing.mode === "none") {
    return (
      <BillingFallback
        description="No paid Stripe subscription is linked to this organization."
        label="Open Stripe Customers"
      />
    )
  }
  if (billing.mode === "unavailable") {
    return (
      <BillingFallback
        description={billing.message}
        label="Open Stripe Customers"
      />
    )
  }

  const { summary } = billing
  const planLabel =
    summary.plan === "unknown"
      ? "Unknown Stripe Plan"
      : ADMIN_ORGANIZATION_BILLING_PLAN_LABELS[summary.plan]
  const priceLabel =
    summary.priceAmountCents === null
      ? planLabel
      : `${planLabel} · ${formatAdminOrganizationBillingCurrency({
          amountCents: summary.priceAmountCents,
          currency: summary.currency,
        })}/month`
  const nextPlan: AdminOrganizationBillingPlan | null =
    summary.plan === "organization"
      ? "operations_support"
      : summary.plan === "operations_support"
        ? "organization"
        : null
  const payment = summary.latestPayment
  const refundableAmount = payment?.refundableAmountCents ?? 0
  const changePlanLabel = nextPlan
    ? ADMIN_ORGANIZATION_BILLING_PLAN_LABELS[nextPlan]
    : null
  const periodEndLabel = summary.currentPeriodEnd
    ? formatAdminOrganizationBillingDate({ date: summary.currentPeriodEnd })
    : "Not available"

  return (
    <section

      className="border-border bg-card/80 space-y-4 rounded-lg border p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-foreground text-sm font-semibold text-balance">
            Billing
          </h2>
          <p className="text-muted-foreground text-xs leading-5 text-pretty">
            Live Stripe subscription and payment status.
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 capitalize">
          {statusLabel(summary.status)}
        </Badge>
      </div>

      <dl className="divide-border/70 divide-y text-xs">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2 first:pt-0">
          <dt className="text-muted-foreground">Plan</dt>
          <dd className="text-foreground min-w-0 text-right font-medium tabular-nums">
            {priceLabel}
          </dd>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2">
          <dt className="text-muted-foreground">
            {summary.cancelAtPeriodEnd ? "Access Ends" : "Next Renewal"}
          </dt>
          <dd className="text-foreground text-right font-medium tabular-nums">
            {periodEndLabel}
          </dd>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2 last:pb-0">
          <dt className="text-muted-foreground">Latest Payment</dt>
          <dd className="text-foreground text-right font-medium tabular-nums">
            {payment
              ? `${formatAdminOrganizationBillingCurrency({
                  amountCents: payment.amountCents,
                  currency: payment.currency,
                })} · ${statusLabel(payment.status)}`
              : "None found"}
          </dd>
        </div>
      </dl>

      {controller.error ? (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-xs leading-5"
        >
          {controller.error}
        </p>
      ) : null}

      <div className="grid gap-2">
        {nextPlan ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 w-full"
            onClick={() => controller.setChangePlanTarget(nextPlan)}
          >
            Change to {changePlanLabel}…
          </Button>
        ) : null}
        {payment && refundableAmount > 0 ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="min-h-11 w-full"
            onClick={controller.setRefundOpen}
          >
            Refund{" "}
            {formatAdminOrganizationBillingCurrency({
              amountCents: refundableAmount,
              currency: payment.currency,
            })}
            …
          </Button>
        ) : null}
        <Button asChild variant="outline" size="sm" className="min-h-11 w-full">
          <Link href={summary.dashboardUrl} target="_blank" rel="noreferrer">
            Open Stripe
            <ExternalLinkIcon className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>

      <AlertDialog
        open={controller.changePlanTarget !== null}
        onOpenChange={(open) => {
          if (!open) controller.closeChangePlan()
        }}
      >
        <AlertDialogContent

        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-balance">
              Change Plan to {changePlanLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-pretty">
              The existing subscription changes immediately without proration.
              The new monthly price begins on {periodEndLabel}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {controller.error ? (
            <p role="alert" className="text-destructive text-sm">
              {controller.error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={controller.changePending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={controller.changePending}
              onClick={(event) => {
                event.preventDefault()
                controller.confirmChangePlan()
              }}
            >
              {controller.changePending ? (
                <CircleNotch className="size-4 animate-spin" aria-hidden />
              ) : null}
              Change Plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={controller.refundOpen}
        onOpenChange={(open) => {
          if (!open) controller.closeRefund()
        }}
      >
        <AlertDialogContent

        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-balance">
              Refund the Latest Payment?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-pretty">
              This returns the remaining{" "}
              {payment
                ? formatAdminOrganizationBillingCurrency({
                    amountCents: refundableAmount,
                    currency: payment.currency,
                  })
                : "payment"}{" "}
              to the original payment method. It does not cancel the
              subscription and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {controller.error ? (
            <p role="alert" className="text-destructive text-sm">
              {controller.error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={controller.refundPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={controller.refundPending}
              onClick={(event) => {
                event.preventDefault()
                controller.confirmRefund()
              }}
            >
              {controller.refundPending ? (
                <CircleNotch className="size-4 animate-spin" aria-hidden />
              ) : null}
              Refund Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
