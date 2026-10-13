"use client"

import CheckIcon from "lucide-react/dist/esm/icons/check"
import XIcon from "lucide-react/dist/esm/icons/x"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"

import { OrganizationFormationStatusSummary } from "@/components/organization/organization-formation-status-summary"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { FORMATION_OPTIONS } from "../constants"
import type { FormationStatus } from "../types"

type OrganizationStepProps = {
  compact?: boolean
  hideFormationStatus?: boolean
  step: number
  attemptedStep: number | null
  errors: Record<string, string>
  initialOrgName: string
  initialOrgSlug: string
  slugStatus: "idle" | "checking" | "available" | "unavailable"
  slugHint: string | null
  formationStatus: FormationStatus | ""
  onOrgNameChange: (value: string) => void
  onOrgSlugChange: (value: string) => string
  onFormationStatusSelect: (value: FormationStatus) => void
}

export function OrganizationStep({
  compact = false,
  hideFormationStatus = false,
  step,
  attemptedStep,
  errors,
  initialOrgName,
  initialOrgSlug,
  slugStatus,
  slugHint,
  formationStatus,
  onOrgNameChange,
  onOrgSlugChange,
  onFormationStatusSelect,
}: OrganizationStepProps) {
  const orgNameHintId = "onboarding-org-name-hint"
  const orgNameErrorId = "onboarding-org-name-error"
  const orgSlugHintId = "onboarding-org-slug-hint"
  const orgSlugErrorId = "onboarding-org-slug-error"
  const orgSlugStatusId = "onboarding-org-slug-status"
  const formationLabelId = "onboarding-formation-status-label"
  const formationErrorId = "onboarding-formation-status-error"
  const showOrgNameError = attemptedStep === step && Boolean(errors.orgName)
  const showOrgSlugError = attemptedStep === step && Boolean(errors.orgSlug)
  const showFormationError =
    attemptedStep === step && Boolean(errors.formationStatus)
  const orgSlugDescription = [
    showOrgSlugError ? orgSlugErrorId : null,
    !showOrgSlugError && slugHint ? orgSlugHintId : null,
    slugStatus !== "idle" || showOrgSlugError
      ? orgSlugStatusId
      : null,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div className={cn("space-y-5 py-5", compact && "space-y-4 py-0")} data-onboarding-step-id="org">
      <div className="grid gap-2">
        <Label htmlFor="orgName">Organization name</Label>
        <Input
          id="orgName"
          name="orgName"
          maxLength={120}
          data-onboarding-primary-focus="true"
          autoComplete="organization"
          className="h-11 rounded-lg"
          placeholder="Your organization’s name…"
          defaultValue={initialOrgName}
          aria-invalid={attemptedStep === step && Boolean(errors.orgName)}
          aria-describedby={showOrgNameError ? orgNameErrorId : compact ? undefined : orgNameHintId}
          onChange={(event) => {
            onOrgNameChange(event.currentTarget.value)
          }}
        />
        {!compact ? <p id={orgNameHintId} className="text-muted-foreground text-xs">
          Use the name people know. Your profile link can be different.
        </p> : null}
        {attemptedStep === step && errors.orgName ? (
          <p
            id={orgNameErrorId}
            className="text-destructive text-xs"
            role="alert"
          >
            {errors.orgName}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="orgSlug">Organization URL</Label>
        <div className="border-border/70 bg-background focus-within:border-ring focus-within:ring-ring/50 flex min-w-0 items-center gap-1 rounded-lg border p-1 focus-within:ring-[3px]">
          <span className="text-muted-foreground shrink-0 px-1 text-sm">
            coachhouse.app/
          </span>
          <Input
            id="orgSlug"
            name="orgSlug"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            placeholder="your-organization…"
            defaultValue={initialOrgSlug}
            className="h-9 min-w-0 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
            aria-invalid={showOrgSlugError || slugStatus === "unavailable"}
            aria-describedby={orgSlugDescription || undefined}
            onChange={(event) => {
              const normalized = onOrgSlugChange(event.currentTarget.value)
              event.currentTarget.value = normalized
            }}
          />
          {slugStatus === "available" && !showOrgSlugError ? (
            <span
              id={orgSlugStatusId}
              className={cn("inline-flex shrink-0 items-center text-[11px] text-emerald-700 dark:text-emerald-300", compact ? "size-5 justify-center" : "gap-1 px-1")}
              role="status"
            >
              <CheckIcon className="h-3 w-3" aria-hidden />
              <span className={compact ? "sr-only" : undefined}>Available</span>
            </span>
          ) : slugStatus === "unavailable" || showOrgSlugError ? (
            <span id={orgSlugStatusId} role="status"
              className={cn("inline-flex shrink-0 items-center text-[11px] text-destructive", compact ? "size-5 justify-center" : "gap-1 px-1")}>
              <XIcon className="h-3 w-3" aria-hidden />
              <span className={compact ? "sr-only" : undefined}>Unavailable</span>
            </span>
          ) : slugStatus === "checking" ? (
            <span
              id={orgSlugStatusId}
              className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-1 text-[11px] font-medium"
              role="status"
            >
              Checking…
            </span>
          ) : null}
        </div>
        {attemptedStep === step && errors.orgSlug ? (
          <p
            id={orgSlugErrorId}
            className="text-destructive text-right text-xs"
            role="alert"
          >
            {errors.orgSlug}
          </p>
        ) : null}
        {!showOrgSlugError && slugHint ? (
          <p id={orgSlugHintId} role="status" className={cn("text-right text-xs", slugStatus === "unavailable" ? "text-destructive" : "text-muted-foreground")}>
            {slugHint}
          </p>
        ) : null}
      </div>

      {!hideFormationStatus ? <div className="grid gap-2">
        <Label id={formationLabelId}>Formation status</Label>
        {compact ? (
          <Select value={formationStatus} onValueChange={(value) => onFormationStatusSelect(value as FormationStatus)}>
            <SelectTrigger aria-labelledby={formationLabelId} aria-invalid={showFormationError} aria-describedby={showFormationError ? formationErrorId : undefined} className="w-full rounded-lg data-[size=default]:h-11">
              <SelectValue placeholder="Choose your status" />
            </SelectTrigger>
            <SelectContent><SelectGroup>
              {FORMATION_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectGroup></SelectContent>
          </Select>
        ) : <ToggleGroupPrimitive.Root
          type="single"
          value={formationStatus || undefined}
          onValueChange={(value) => {
            if (!value) return
            onFormationStatusSelect(value as FormationStatus)
          }}
          aria-labelledby={formationLabelId}
          aria-describedby={showFormationError ? formationErrorId : undefined}
          data-slot="toggle-group"
          className="box-border grid w-full max-w-full min-w-0 items-stretch gap-2 sm:grid-cols-3"
        >
          {FORMATION_OPTIONS.map((option) => {
            const selected = formationStatus === option.value
            return (
              <ToggleGroupPrimitive.Item
                key={option.value}
                value={option.value}
                data-slot="toggle-group-item"
                className={cn(
                  "flex h-full w-full min-w-0 items-stretch justify-start rounded-2xl border p-0 text-left whitespace-normal shadow-none transition-colors outline-none",
                  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50",
                  "data-[state=on]:border-primary/60 data-[state=on]:bg-primary/5 data-[state=on]:text-foreground",
                  selected
                    ? "border-primary/60 bg-primary/5"
                    : "border-border/70 bg-background/60 text-foreground hover:bg-background"
                )}
              >
                <OrganizationFormationStatusSummary
                  formationStatus={option}
                  contained={false}
                  className="flex h-full w-full min-w-0 flex-col gap-2 rounded-2xl p-3 text-left"
                />
              </ToggleGroupPrimitive.Item>
            )
          })}
        </ToggleGroupPrimitive.Root>}
        {showFormationError ? (
          <p
            id={formationErrorId}
            className="text-destructive text-xs"
            role="alert"
          >
            {errors.formationStatus}
          </p>
        ) : null}
      </div> : null}
    </div>
  )
}
