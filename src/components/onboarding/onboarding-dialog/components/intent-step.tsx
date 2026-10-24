"use client"

import { useId } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { INTENT_OPTIONS } from "../constants"
import type { IntentFocus } from "../types"

type IntentStepProps = {
  step: number
  attemptedStep: number | null
  errors: Record<string, string>
  intentFocus: IntentFocus | ""
  onSelectIntent: (value: IntentFocus) => void
}

export function IntentStep({ step, attemptedStep, errors, intentFocus, onSelectIntent }: IntentStepProps) {
  const id = useId()
  const errorId = `${id}-error`
  const showError = attemptedStep === step && Boolean(errors.intentFocus)

  return (
    <Field className="gap-1.5 pt-4" data-onboarding-step-id="intent" data-invalid={showError || undefined}>
      <FieldLabel htmlFor={id}>Your focus</FieldLabel>
      <Select value={intentFocus} onValueChange={(value) => onSelectIntent(value as IntentFocus)}>
        <SelectTrigger

          id={id}
          data-onboarding-primary-focus="true"
          aria-invalid={showError}
          aria-describedby={showError ? errorId : undefined}
          className="w-full rounded-lg data-[size=default]:h-11"
        >
          <SelectValue placeholder="Choose your focus" />
        </SelectTrigger>
        <SelectContent >
          <SelectGroup>
            {INTENT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value} disabled={!option.available}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {showError ? <p id={errorId} className="text-destructive text-xs" role="alert">{errors.intentFocus}</p> : null}
    </Field>
  )
}
