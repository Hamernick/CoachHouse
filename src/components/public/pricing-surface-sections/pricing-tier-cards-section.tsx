import Link from "next/link"

import { PLATFORM_TIERS } from "@/components/public/pricing-surface-data"
import { TierFeatures } from "@/components/public/pricing-surface-sections/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

const pricingCtaButtonClassName =
  "h-auto min-h-11 w-full whitespace-normal rounded-full text-center shadow-none"

function splitTierEyebrow(eyebrow: string) {
  const match = eyebrow.match(/^(.*?)(\s*\(.*\))$/)

  if (!match) {
    return {
      primary: eyebrow,
      secondary: null,
    }
  }

  return {
    primary: match[1]?.trim() ?? eyebrow,
    secondary: match[2]?.trim() ?? null,
  }
}

export function PricingTierCardsSection() {
  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {PLATFORM_TIERS.map((tier) => {
        const isMailtoCta = tier.ctaHref.startsWith("mailto:")
        const ctaVariant =
          tier.id === "formation" || tier.featured ? "default" : "secondary"
        const eyebrow = splitTierEyebrow(tier.eyebrow)

        return (
          <Card
            key={tier.id}
            role="group"
            aria-label={`${tier.title} plan`}
            className={cn(
              "border-border/70 flex h-full flex-col rounded-3xl border shadow-none",
              tier.featured &&
                "border-primary/30 bg-muted/30"
            )}
          >
            <CardHeader className="space-y-5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-muted-foreground min-w-0 text-xs font-semibold tracking-wide uppercase">
                  <span className="block">{eyebrow.primary}</span>
                  {eyebrow.secondary ? (
                    <span className="mt-0.5 block">{eyebrow.secondary}</span>
                  ) : null}
                </p>
                {tier.badge ? (
                  <Badge variant="secondary" className="rounded-full text-xs">
                    {tier.badge}
                  </Badge>
                ) : null}
              </div>

              <div className="space-y-2">
                <CardTitle className="min-h-10 text-2xl font-medium tracking-tight">
                  {tier.title}
                </CardTitle>
                <div className="flex min-h-11 items-end gap-2">
                  <span className="text-4xl font-normal tracking-tight">
                    {tier.priceLine}
                  </span>
                  {tier.priceNote ? (
                    <span className="text-muted-foreground pb-1 text-sm font-medium">
                      {tier.priceNote}
                    </span>
                  ) : null}
                </div>
                <CardDescription className="text-muted-foreground min-h-20 text-sm leading-relaxed">
                  {tier.subtitle}
                </CardDescription>
              </div>

              <Button
                asChild
                className={pricingCtaButtonClassName}
                variant={ctaVariant}
              >
                {isMailtoCta ? (
                  <a
                    href={tier.ctaHref}
                    className="flex items-center justify-center"
                  >
                    {tier.ctaLabel}
                  </a>
                ) : (
                  <Link
                    href={tier.ctaHref}
                    className="flex items-center justify-center"
                  >
                    {tier.ctaLabel}
                  </Link>
                )}
              </Button>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-5 px-6 pb-6">
              <div className="bg-border/70 h-px w-full" aria-hidden />
              <TierFeatures
                heading={tier.featureHeading}
                items={tier.features}
                tone="muted"
              />
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}
