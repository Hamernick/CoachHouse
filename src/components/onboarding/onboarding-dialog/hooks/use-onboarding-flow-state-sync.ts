"use client"

import { useCallback, useEffect } from "react"

import {
  isOnboardingAccountStepReady,
  readOnboardingAccountValues,
  readOnboardingOrganizationValues,
  type OnboardingAccountValues,
  type OnboardingOrganizationValues,
} from "@/components/onboarding/onboarding-dialog/state-helpers"

export function buildInitialAccountValues({
  firstName,
  lastName,
  personHandle,
  phone,
  publicEmail,
  title,
  linkedin,
  optInUpdates,
  newsletterOptIn,
}: {
  firstName: string
  lastName: string
  personHandle: string
  phone: string
  publicEmail: string
  title: string
  linkedin: string
  optInUpdates: boolean
  newsletterOptIn: boolean
}): OnboardingAccountValues {
  return {
    firstName,
    lastName,
    personHandle,
    phone,
    publicEmail,
    title,
    linkedin,
    optInUpdates,
    newsletterOptIn,
  }
}

export function readAccountValuesFromForm(
  form: HTMLFormElement | null
): OnboardingAccountValues | null {
  if (!form) return null
  return readOnboardingAccountValues(new FormData(form))
}

export function readOrganizationValuesFromForm(form: HTMLFormElement | null) {
  if (!form) return null
  return readOnboardingOrganizationValues(new FormData(form))
}

export function clearResolvedAccountStepErrors({
  previousErrors,
  firstName,
  lastName,
  personHandle,
}: {
  previousErrors: Record<string, string>
  firstName: string
  lastName: string
  personHandle: string
}) {
  if (
    !previousErrors.firstName &&
    !previousErrors.lastName &&
    !previousErrors.personHandle
  ) {
    return previousErrors
  }
  const nextErrors = { ...previousErrors }
  if (firstName) delete nextErrors.firstName
  if (lastName) delete nextErrors.lastName
  if (personHandle) delete nextErrors.personHandle
  return nextErrors
}

function resolvePrimaryFocusSelector(stepId: string) {
  if (stepId === "intent") {
    return '[data-onboarding-step-id="intent"] [data-onboarding-primary-focus="true"]'
  }
  if (stepId === "pricing") {
    return '[data-onboarding-step-id="pricing"] a[href], [data-onboarding-step-id="pricing"] button'
  }
  if (stepId === "org") {
    return 'input[name="orgName"]'
  }
  if (stepId === "account") {
    return '[data-onboarding-step-id="account"] [data-onboarding-primary-focus="true"]'
  }
  return '[data-onboarding-step-id="community"] a[href], [data-onboarding-step-id="community"] button'
}

export function useOnboardingStepFocus({
  open,
  currentStepId,
  formRef,
}: {
  open: boolean
  currentStepId: string
  formRef: React.RefObject<HTMLFormElement | null>
}) {
  useEffect(() => {
    if (!open) return
    const targetSelector = resolvePrimaryFocusSelector(currentStepId)

    const frameId = window.requestAnimationFrame(() => {
      const scrollRegion = formRef.current?.querySelector<HTMLElement>(
        '[data-onboarding-scroll-region="true"]'
      )
      scrollRegion?.scrollTo({ top: 0 })
      const target = formRef.current?.querySelector<HTMLElement>(targetSelector)
      target?.focus()
      target?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [currentStepId, formRef, open])
}

export function useOnboardingAccountStateSync({
  open,
  step,
  formRef,
  syncAccountStateFromForm,
}: {
  open: boolean
  step: number
  formRef: React.RefObject<HTMLFormElement | null>
  syncAccountStateFromForm: () => void
}) {
  useEffect(() => {
    if (!open) return
    const frameId = window.requestAnimationFrame(() => {
      syncAccountStateFromForm()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [formRef, open, step, syncAccountStateFromForm])
}

export function useOnboardingStateSnapshot({
  formRef,
  setAccountStepReady,
  setAccountValues,
  setOrgNameValue,
  setOrgSlugInputValue,
  setSlugValue,
  accountValuesRef,
  organizationValuesRef,
}: {
  formRef: React.RefObject<HTMLFormElement | null>
  setAccountStepReady: React.Dispatch<React.SetStateAction<boolean>>
  setAccountValues: React.Dispatch<
    React.SetStateAction<OnboardingAccountValues>
  >
  setOrgNameValue: React.Dispatch<React.SetStateAction<string>>
  setOrgSlugInputValue: React.Dispatch<React.SetStateAction<string>>
  setSlugValue: React.Dispatch<React.SetStateAction<string>>
  accountValuesRef: React.MutableRefObject<OnboardingAccountValues>
  organizationValuesRef: React.MutableRefObject<OnboardingOrganizationValues>
}) {
  const syncAccountStateFromForm = useCallback(() => {
    const nextValues = readAccountValuesFromForm(formRef.current)
    if (!nextValues) return

    accountValuesRef.current = nextValues

    setAccountValues((previous) => {
      if (
        previous.firstName === nextValues.firstName &&
        previous.lastName === nextValues.lastName &&
        previous.personHandle === nextValues.personHandle &&
        previous.phone === nextValues.phone &&
        previous.publicEmail === nextValues.publicEmail &&
        previous.title === nextValues.title &&
        previous.linkedin === nextValues.linkedin &&
        previous.optInUpdates === nextValues.optInUpdates &&
        previous.newsletterOptIn === nextValues.newsletterOptIn
      ) {
        return previous
      }

      return nextValues
    })

    setAccountStepReady(
      isOnboardingAccountStepReady({
        firstName: nextValues.firstName,
        lastName: nextValues.lastName,
        personHandle: nextValues.personHandle,
      })
    )
  }, [accountValuesRef, formRef, setAccountStepReady, setAccountValues])

  const syncOrganizationStateFromForm = useCallback(() => {
    const nextValues = readOrganizationValuesFromForm(formRef.current)
    if (!nextValues) return

    setOrgNameValue((previous) =>
      previous === nextValues.orgName ? previous : nextValues.orgName
    )
    setOrgSlugInputValue((previous) =>
      previous === nextValues.orgSlug ? previous : nextValues.orgSlug
    )
    setSlugValue((previous) =>
      previous === nextValues.orgSlug ? previous : nextValues.orgSlug
    )
    organizationValuesRef.current = nextValues
  }, [
    formRef,
    organizationValuesRef,
    setOrgNameValue,
    setOrgSlugInputValue,
    setSlugValue,
  ])

  return {
    syncAccountStateFromForm,
    syncOrganizationStateFromForm,
  }
}
