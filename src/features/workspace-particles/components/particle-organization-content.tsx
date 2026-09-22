"use client"

import Building2Icon from "lucide-react/dist/esm/icons/building-2"

import { Progress } from "@/components/ui/progress"
import type { ParticleOrganization } from "../types"

const currency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

export function ParticleOrganizationContent({
  organization,
  large,
}: {
  organization: ParticleOrganization
  large: boolean
}) {
  const progress = organization.fundingGoalCents
    ? Math.min(
        100,
        Math.round(
          (organization.raisedCents / organization.fundingGoalCents) * 100
        )
      )
    : 0

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-xl">
          <Building2Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="font-medium">{organization.title}</p>
          {organization.subtitle ? (
            <p className="text-muted-foreground mt-1 line-clamp-3 text-xs leading-5">
              {organization.subtitle}
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <OrganizationMetric
          label="Programs"
          value={organization.programsCount}
        />
        <OrganizationMetric label="People" value={organization.peopleCount} />
      </div>
      {large && organization.fundingGoalCents > 0 ? (
        <div className="mt-auto space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">Funding progress</span>
            <span className="font-medium tabular-nums">
              {currency.format(organization.raisedCents / 100)} of{" "}
              {currency.format(organization.fundingGoalCents / 100)}
            </span>
          </div>
          <Progress value={progress} aria-label={`${progress}% funded`} />
        </div>
      ) : null}
    </div>
  )
}

function OrganizationMetric({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="bg-muted/40 rounded-lg border px-3 py-2">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}
