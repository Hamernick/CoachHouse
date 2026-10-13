"use client"

import { useId } from "react"

import { Label } from "@/components/ui/label"
import { RadioGroup } from "@/components/ui/radio-group"
import { FORMATION_STATUS_OPTIONS, isFormationStatus } from "@/lib/organization/formation-status"
import type { FormationStatus } from "@/lib/organization/org-profile-brand-types"
import { cn } from "@/lib/utils"
import { OrganizationFormationStatusSummary } from "./organization-formation-status-summary"

export function OrganizationFormationStatusPicker({
  value,
  onValueChange,
  labelledBy,
  describedBy,
}: {
  value: FormationStatus | ""
  onValueChange: (value: FormationStatus) => void
  labelledBy: string
  describedBy?: string
}) {
  const id = useId()

  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => { if (isFormationStatus(next)) onValueChange(next) }}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="box-border grid w-full max-w-full min-w-0 items-stretch gap-2 sm:grid-cols-3"
    >
      {FORMATION_STATUS_OPTIONS.map((option) => (
        <Label
          key={option.value}
          htmlFor={`${id}-${option.value}`}
          className={cn(
            "flex h-full min-w-0 cursor-pointer items-stretch rounded-2xl border font-normal transition-colors motion-reduce:transition-none",
            "has-[:focus-visible]:border-ring has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-[3px]",
            value === option.value
              ? "border-primary/60 bg-primary/5"
              : "border-border/70 bg-background/60 hover:bg-muted/50",
          )}
        >
          <OrganizationFormationStatusSummary
            formationStatus={option}
            contained={false}
            radioId={`${id}-${option.value}`}
          />
        </Label>
      ))}
    </RadioGroup>
  )
}
