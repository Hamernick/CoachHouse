"use client"

import { RadioGroupItem } from "@/components/ui/radio-group"
import type { FormationStatusOption } from "@/lib/organization/formation-status"
import { cn } from "@/lib/utils"

type FormationSummaryProps = {
  formationStatus: FormationStatusOption
  className?: string
  contained?: boolean
  ein?: string | null
  radioId?: string
}

export function OrganizationFormationStatusSummary({
  formationStatus,
  className,
  contained = true,
  radioId,
  ein,
}: FormationSummaryProps) {
  return (
    <div
      className={cn(
        "flex h-full w-full min-w-0 flex-col items-start gap-2 rounded-2xl p-3 text-left",
        contained && "border border-primary/60 bg-primary/5",
        className,
      )}
    >
      {!radioId ? (
        <span aria-hidden className="flex size-4 shrink-0 items-center justify-center rounded-full border border-primary">
          {contained ? <span className="size-2 rounded-full bg-primary" /> : null}
        </span>
      ) : (
        <RadioGroupItem
          id={radioId}
          value={formationStatus.value}
          aria-label={formationStatus.label}
          className="shadow-none"
        />
      )}
      <span className="w-full">
        <span className="block text-sm font-medium text-foreground">
          {formationStatus.label}
        </span>
        {formationStatus.value === "approved" && ein?.trim() ? (
          <span className="mt-0.5 block text-xs text-foreground">EIN: {ein.trim()}</span>
        ) : null}
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {formationStatus.description}
        </span>
      </span>
    </div>
  )
}
