import { Fragment } from "react"

import Check from "lucide-react/dist/esm/icons/check"
import Minus from "lucide-react/dist/esm/icons/minus"
import X from "lucide-react/dist/esm/icons/x"

import { FEATURE_GROUP_ICONS, FeatureStateIcon, PRICING_FEATURE_GROUPS } from "@/components/public/pricing-surface-sections/shared"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

export function PricingFeatureMatrixSection() {
  return (
    <Card className="relative min-w-0 overflow-hidden rounded-3xl border-border/70 shadow-none">
      <div className="overflow-x-auto focus-ring" role="region" aria-label="Plan comparison" tabIndex={0}>
        <table className="w-full min-w-[780px] border-collapse text-sm text-left [&_th]:text-left [&_td]:text-left">
          <thead>
            <tr className="text-left">
              <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase text-muted-foreground">
                Features
              </th>
              <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase text-muted-foreground">
                Individual
              </th>
              <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase text-foreground bg-foreground/5 dark:bg-background/5">
                Organization
              </th>
              <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase text-muted-foreground">
                Operations Support
              </th>
            </tr>
          </thead>
          <tbody>
            {PRICING_FEATURE_GROUPS.map((group) => {
              const Icon = FEATURE_GROUP_ICONS[group.title]

              return (
                <Fragment key={group.title}>
                  <tr>
                    <th
                      scope="rowgroup"
                      colSpan={4}
                      className="px-6 py-4 align-middle text-xs font-semibold uppercase text-muted-foreground bg-foreground/5 dark:bg-background/5"
                    >
                      <span className="inline-flex items-center gap-2">
                        {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
                        <span className="leading-none">{group.title}</span>
                      </span>
                    </th>
                  </tr>
                  {group.rows.map((row, rowIndex) => (
                    <tr key={`${group.title}-${row.label}-${row.labelBadge ?? "none"}-${rowIndex}`} className="border-t border-border/60">
                      <th scope="row" className="px-6 py-4 font-medium text-foreground">
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span>{row.label}</span>
                          {row.labelBadge ? (
                            <Badge
                              variant="secondary"
                              className="rounded-full border border-border/70 bg-muted/60 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                            >
                              {row.labelBadge}
                            </Badge>
                          ) : null}
                        </span>
                      </th>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <FeatureStateIcon state={row.tier1} />
                          <span className="sr-only">{row.tier1}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 bg-foreground/5 dark:bg-background/5">
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <FeatureStateIcon state={row.tier2} />
                          <span className="sr-only">{row.tier2}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <FeatureStateIcon state={row.tier3} />
                          <span className="sr-only">{row.tier3}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-6 py-4 text-xs text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">Note:</span> Strategic Roadmap is always private and
          internal. Organizational Profile is private on Individual and can be made public on paid tiers. Operations
          Support includes expert network access so teams can hire specialists as needed.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4 text-foreground" aria-hidden /> Included
          </span>
          <span className="inline-flex items-center gap-2">
            <X className="h-4 w-4 text-muted-foreground" aria-hidden /> Not included
          </span>
          <span className="inline-flex items-center gap-2">
            <Minus className="h-4 w-4 text-muted-foreground" aria-hidden /> Not applicable
          </span>
        </div>
      </div>
    </Card>
  )
}
