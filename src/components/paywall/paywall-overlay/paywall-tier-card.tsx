import { TierFeatures } from "@/components/public/pricing-surface-sections/shared"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { PricingPlanTier } from "@/lib/billing/plan-tier"
import { cn } from "@/lib/utils"

import {
  buildStripeCheckoutPath,
  resolveTierLabel,
  type OverlayTier,
} from "@/components/paywall/paywall-overlay/config"

type PaywallTierCardProps = {
  tier: OverlayTier
  currentPlanTier: PricingPlanTier
  source: string | null
  redirectTarget?: string | null
  cancelTarget?: string | null
}

export function PaywallTierCard({
  tier,
  currentPlanTier,
  source,
  redirectTarget,
  cancelTarget,
}: PaywallTierCardProps) {
  const details = resolveTierLabel({ tier, currentPlanTier })
  const paidPlan = tier.id === "free" ? null : tier.id
  const eyebrow = tier.eyebrow.match(/^(.*?)(\s*\(.*\))$/)

  return (
    <Card
      role="group"
      aria-label={`${tier.title} plan`}
      className={cn(
        "border-border/70 flex h-full flex-col rounded-3xl border",
        tier.featured && "border-primary/30 ring-primary/15 shadow-md ring-1",
      )}
    >
      <CardHeader className="flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-muted-foreground min-w-0 text-xs font-semibold tracking-wide uppercase">
            <span className="block">{eyebrow?.[1]?.trim() ?? tier.eyebrow}</span>
            {eyebrow?.[2] ? <span className="mt-0.5 block">{eyebrow[2].trim()}</span> : null}
          </p>
          {details.badge ? (
            <Badge variant="secondary" className="rounded-full text-xs">
              {details.badge}
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-col gap-3">
          <CardTitle className="min-h-10 text-3xl font-semibold tracking-tight">{tier.title}</CardTitle>
          <div className="flex min-h-11 items-end gap-2">
            <span className="text-4xl font-semibold tracking-tight">{tier.priceLine}</span>
            {tier.priceNote ? <span className="text-muted-foreground pb-1 text-sm font-medium">{tier.priceNote}</span> : null}
          </div>
          <CardDescription className="text-muted-foreground min-h-20 text-sm leading-relaxed">{tier.subtitle}</CardDescription>
        </div>
        <div className="flex flex-col gap-2">
          {details.cta && tier.planName && paidPlan ? (
            <Button
              type="button"
              className="h-auto min-h-9 w-full whitespace-normal rounded-xl text-center"
              variant={tier.id === "organization" ? "default" : "secondary"}
              onClick={() =>
                window.location.assign(
                  buildStripeCheckoutPath({
                    plan: paidPlan,
                    source,
                    redirectTarget,
                    cancelTarget,
                  }),
                )
              }
            >
              {details.cta}
            </Button>
          ) : (
            <p className="rounded-xl border border-border/70 bg-muted/35 px-3 py-2 text-center text-xs font-medium text-muted-foreground">
              {details.note}
            </p>
          )}
          {details.cta ? <p className="text-xs leading-relaxed text-muted-foreground">{details.note}</p> : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5 px-6 pb-6">
        <div className="bg-border/70 h-px w-full" aria-hidden />
        <TierFeatures heading="Includes" items={tier.features} tone="muted" />
      </CardContent>
    </Card>
  )
}
