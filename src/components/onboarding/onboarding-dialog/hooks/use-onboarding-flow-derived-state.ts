"use client"

import * as React from "react"

import { usePublicHandleAvailability } from "@/features/public-profiles/client"
import {
  filterOnboardingSteps,
  resolveEffectiveVisibleStepIds,
} from "@/components/onboarding/onboarding-flow-support"
import {
  isOnboardingAccountStepReady,
  type OnboardingAccountValues,
} from "../state-helpers"
import type {
  IntentFocus,
  OnboardingFlowMode,
  OnboardingFlowVisibleStepId,
} from "../types"
import { useOnboardingDefaults } from "./use-onboarding-defaults"
import { buildInitialAccountValues } from "./use-onboarding-flow-state-sync"
import { resolveOnboardingStepProgress } from "../step-position"

export function useEffectiveOnboardingStepIds(
  mode: OnboardingFlowMode,
  visibleStepIds?: OnboardingFlowVisibleStepId[]
) {
  return React.useMemo(
    () => resolveEffectiveVisibleStepIds({ mode, visibleStepIds }),
    [mode, visibleStepIds]
  )
}

export function buildAccountValuesFromDefaults(
  defaults: ReturnType<typeof useOnboardingDefaults>
) {
  return buildInitialAccountValues({
    firstName: defaults.initialFirstName,
    lastName: defaults.initialLastName,
    personHandle: defaults.initialPersonHandle,
    phone: defaults.initialPhone,
    publicEmail: defaults.initialPublicEmail,
    title: defaults.initialTitle,
    linkedin: defaults.initialLinkedin,
    optInUpdates: defaults.initialOptInUpdates,
    newsletterOptIn: defaults.initialNewsletterOptIn,
  })
}

export function useResolvedOnboardingSteps({
  intentFocus,
  visibleStepIds,
  step,
}: {
  intentFocus: IntentFocus | ""
  visibleStepIds?: OnboardingFlowVisibleStepId[]
  step: number
}) {
  const steps = React.useMemo(
    () => filterOnboardingSteps({ intentFocus, visibleStepIds }),
    [intentFocus, visibleStepIds]
  )
  return {
    steps,
    currentStep: steps[Math.max(0, Math.min(step, steps.length - 1))],
    stepProgress: resolveOnboardingStepProgress(step, steps.length),
  }
}

export function useOnboardingAccountSetupState({
  open,
  initialValues,
  initialPersonHandle,
}: {
  open: boolean
  initialValues: OnboardingAccountValues
  initialPersonHandle: string
}) {
  const [accountValues, setAccountValues] = React.useState(initialValues)
  const [accountFieldsReady, setAccountFieldsReady] = React.useState(() =>
    isOnboardingAccountStepReady(initialValues)
  )
  const { status, hint } = usePublicHandleAvailability({
    open,
    handleValue: accountValues.personHandle,
    currentHandle: initialPersonHandle,
  })

  return {
    accountValues,
    setAccountValues,
    setAccountStepReady: setAccountFieldsReady,
    accountStepReady: accountFieldsReady && status === "available",
    personHandleStatus: status,
    personHandleHint: hint,
  }
}
