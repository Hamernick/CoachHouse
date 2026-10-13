"use client"

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react"
import { useSearchParams } from "next/navigation"

import type { PricingPlanTier } from "@/lib/billing/plan-tier"
import { resolveOnboardingSteps } from "./onboarding-dialog/constants"
import type { SaveOnboardingDraftExtra } from "./onboarding-dialog/draft-writer"
import {
  resolveOnboardingError,
  resolveOnboardingPricingEntryStepId,
} from "./onboarding-dialog/helpers"
import { clearResolvedAccountStepErrors } from "./onboarding-dialog/hooks/use-onboarding-flow-state-sync"
import {
  syncOnboardingCarryForwardInputs,
  type OnboardingAccountValues,
  validateOnboardingStep,
} from "./onboarding-dialog/state-helpers"
import type {
  FormationStatus,
  IntentFocus,
  OnboardingFlowMode,
  OnboardingSlugStatus,
  OnboardingStepId,
  OnboardingFlowVisibleStepId,
  RoleInterest,
} from "./onboarding-dialog/types"

export function resolveOnboardingModeVisibleStepIds(
  mode: OnboardingFlowMode
): OnboardingFlowVisibleStepId[] | undefined {
  if (mode === "post_signup_access") {
    return ["intent", "account"]
  }
  if (mode === "workspace_setup") {
    return ["org", "account", "community"]
  }
  return undefined
}

export function resolveEffectiveVisibleStepIds({
  mode,
  visibleStepIds,
}: {
  mode: OnboardingFlowMode
  visibleStepIds?: OnboardingFlowVisibleStepId[]
}) {
  if (visibleStepIds && visibleStepIds.length > 0) {
    return visibleStepIds
  }
  return resolveOnboardingModeVisibleStepIds(mode)
}

export function filterOnboardingSteps({
  intentFocus,
  visibleStepIds,
}: {
  intentFocus: IntentFocus | ""
  visibleStepIds?: OnboardingFlowVisibleStepId[]
}) {
  const steps = resolveOnboardingSteps(intentFocus)
  if (!visibleStepIds || visibleStepIds.length === 0) return steps
  const allowedStepIds = new Set(visibleStepIds)
  return steps.filter((step) => allowedStepIds.has(step.id))
}

export function useApplyPricingEntryPoint({
  open,
  searchParams,
  mode,
  setIntentFocus,
  setStep,
  visibleStepIds,
}: {
  open: boolean
  searchParams: ReturnType<typeof useSearchParams>
  mode: OnboardingFlowMode
  setIntentFocus: Dispatch<SetStateAction<IntentFocus | "">>
  setStep: Dispatch<SetStateAction<number>>
  visibleStepIds?: OnboardingFlowVisibleStepId[]
}) {
  const pricingEntryAppliedRef = useRef(false)
  useEffect(() => {
    if (!open) return
    if (pricingEntryAppliedRef.current) return
    const entryStepId = resolveOnboardingPricingEntryStepId(searchParams, mode)
    if (!entryStepId) return
    if (entryStepId === "pricing" && visibleStepIds && !visibleStepIds.includes("pricing")) return
    pricingEntryAppliedRef.current = true
    setIntentFocus("build")
    const resolvedSteps = filterOnboardingSteps({
      intentFocus: "build",
      visibleStepIds,
    })
    const pricingStepIndex = resolvedSteps.findIndex(
      (candidate) => candidate.id === entryStepId
    )
    if (pricingStepIndex >= 0) {
      setStep(pricingStepIndex)
      return
    }
    setStep(Math.max(0, resolvedSteps.length - 1))
  }, [mode, open, searchParams, setIntentFocus, setStep, visibleStepIds])
}

export function useSyncOnboardingServerError({
  open,
  searchParams,
  setServerError,
}: {
  open: boolean
  searchParams: ReturnType<typeof useSearchParams>
  setServerError: Dispatch<SetStateAction<string | null>>
}) {
  useEffect(() => {
    if (!open) return
    const msg = resolveOnboardingError(searchParams.get("error"))
    setServerError(msg)
  }, [open, searchParams, setServerError])
}

export function buildOnboardingFormHandlers({
  step,
  steps,
  attemptedStep,
  formRef,
  syncOrganizationStateFromForm,
  syncAccountStateFromForm,
  saveDraft,
  syncProgress,
  setErrors,
  setAttemptedStep,
  validateStep,
  next,
  setSubmitting,
  intentFocus,
  roleInterest,
  formationStatus,
  organizationValuesRef,
  accountValuesRef,
}: {
  step: number
  steps: Array<{ id: OnboardingStepId }>
  attemptedStep: number | null
  formRef: React.RefObject<HTMLFormElement | null>
  syncOrganizationStateFromForm: () => void
  syncAccountStateFromForm: () => void
  saveDraft: (extra?: SaveOnboardingDraftExtra) => void
  syncProgress: () => void
  setErrors: Dispatch<SetStateAction<Record<string, string>>>
  setAttemptedStep: Dispatch<SetStateAction<number | null>>
  validateStep: (idx: number) => boolean
  next: () => void
  setSubmitting: Dispatch<SetStateAction<boolean>>
  intentFocus: IntentFocus | ""
  roleInterest: RoleInterest | ""
  formationStatus: FormationStatus | ""
  organizationValuesRef: React.MutableRefObject<{
    orgName: string
    orgSlug: string
  }>
  accountValuesRef: React.MutableRefObject<OnboardingAccountValues>
}) {
  const handleFormChange = () => {
    syncOrganizationStateFromForm()
    saveDraft()
    syncProgress()
    syncAccountStateFromForm()
    if (
      steps[step]?.id === "account" &&
      attemptedStep === step &&
      formRef.current
    ) {
      const data = new FormData(formRef.current)
      const firstName = String(data.get("firstName") ?? "").trim()
      const lastName = String(data.get("lastName") ?? "").trim()
      const personHandle = String(data.get("personHandle") ?? "").trim()
      setErrors((previous) =>
        clearResolvedAccountStepErrors({
          previousErrors: previous,
          firstName,
          lastName,
          personHandle,
        })
      )
      if (firstName && lastName && personHandle) {
        setAttemptedStep(null)
      }
    }
  }

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (step !== steps.length - 1) {
      event.preventDefault()
      next()
      return
    }
    syncOrganizationStateFromForm()
    syncAccountStateFromForm()
    syncOnboardingCarryForwardInputs({
      form: formRef.current,
      intentFocus,
      roleInterest,
      formationStatus,
      organizationValues: organizationValuesRef.current,
      accountValues: accountValuesRef.current,
    })
    if (!validateStep(step)) {
      event.preventDefault()
      return
    }
    setSubmitting(true)
    saveDraft({ step })
  }

  return {
    handleFormChange,
    handleFormSubmit,
  }
}

export function buildOnboardingStepControls({
  formRef,
  step,
  steps,
  currentStepId,
  formationStatus,
  intentFocus,
  slugStatus,
  slugHint,
  personHandleStatus,
  personHandleHint,
  builderPlanTier,
  syncOrganizationStateFromForm,
  syncAccountStateFromForm,
  saveDraft,
  setServerError,
  setErrors,
  setAttemptedStep,
  setStep,
}: {
  formRef: React.RefObject<HTMLFormElement | null>
  step: number
  steps: Array<{ id: OnboardingStepId }>
  currentStepId: OnboardingStepId | null
  formationStatus: FormationStatus | ""
  intentFocus: IntentFocus | ""
  slugStatus: OnboardingSlugStatus
  slugHint: string | null
  personHandleStatus: OnboardingSlugStatus
  personHandleHint: string | null
  builderPlanTier: PricingPlanTier
  syncOrganizationStateFromForm: () => void
  syncAccountStateFromForm: () => void
  saveDraft: (extra?: SaveOnboardingDraftExtra) => void
  setServerError: Dispatch<SetStateAction<string | null>>
  setErrors: Dispatch<SetStateAction<Record<string, string>>>
  setAttemptedStep: Dispatch<SetStateAction<number | null>>
  setStep: Dispatch<SetStateAction<number>>
}) {
  const validateStep = (idx: number) => {
    if (!formRef.current) return false
    setAttemptedStep(idx)
    const resolvedCurrentStepId = steps[idx]?.id ?? currentStepId ?? null
    const form = new FormData(formRef.current)
    const nextErrors = validateOnboardingStep({
      stepId: resolvedCurrentStepId,
      form,
      formationStatus,
      intentFocus,
      slugStatus,
      slugHint,
      personHandleStatus,
      personHandleHint,
      builderPlanTier,
    })
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const next = () => {
    setServerError(null)
    syncOrganizationStateFromForm()
    syncAccountStateFromForm()
    if (!validateStep(step)) return
    setErrors({})
    setAttemptedStep(null)
    setStep((previous) => {
      const value = Math.min(previous + 1, steps.length - 1)
      saveDraft({ step: value })
      return value
    })
  }

  const prev = () => {
    setServerError(null)
    setErrors({})
    setAttemptedStep(null)
    setStep((previous) => {
      const value = Math.max(previous - 1, 0)
      saveDraft({ step: value })
      return value
    })
  }

  return {
    validateStep,
    next,
    prev,
  }
}
