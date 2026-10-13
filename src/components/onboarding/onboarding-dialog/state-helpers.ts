import type { PricingPlanTier } from "@/lib/billing/plan-tier"

import { resolveOnboardingSteps } from "./constants"
import {
  isFormationStatus,
  isIntentFocus,
  isRoleInterest,
  slugify,
} from "./helpers"
import type {
  FormationStatus,
  IntentFocus,
  OnboardingStepId,
  OnboardingSlugStatus,
  RoleInterest,
} from "./types"

export type OnboardingAccountValues = {
  firstName: string
  lastName: string
  personHandle: string
  phone: string
  publicEmail: string
  title: string
  linkedin: string
  optInUpdates: boolean
  newsletterOptIn: boolean
}

export type OnboardingOrganizationValues = {
  orgName: string
  orgSlug: string
}

export function buildOnboardingCarryForwardFieldMap({
  intentFocus,
  roleInterest,
  formationStatus,
  organizationValues,
  accountValues,
}: {
  intentFocus: IntentFocus | ""
  roleInterest: RoleInterest | ""
  formationStatus: FormationStatus | ""
  organizationValues: OnboardingOrganizationValues
  accountValues: OnboardingAccountValues
}) {
  const fieldMap: Record<string, string> = {
    intentFocus,
    roleInterest,
    formationStatus,
    orgName: organizationValues.orgName,
    orgSlug: organizationValues.orgSlug,
    firstName: accountValues.firstName,
    lastName: accountValues.lastName,
    personHandle: accountValues.personHandle,
    phone: accountValues.phone,
    publicEmail: accountValues.publicEmail,
    title: accountValues.title,
    linkedin: accountValues.linkedin,
  }

  if (accountValues.optInUpdates) {
    fieldMap.optInUpdates = "on"
  }

  if (accountValues.newsletterOptIn) {
    fieldMap.newsletterOptIn = "on"
  }

  return fieldMap
}

function upsertHiddenInput(form: HTMLFormElement, name: string, value: string) {
  let input = form.querySelector<HTMLInputElement>(
    `input[type="hidden"][name="${name}"]`
  )

  if (!input) {
    input = document.createElement("input")
    input.type = "hidden"
    input.name = name
    form.appendChild(input)
  }

  input.value = value
}

function removeHiddenInput(form: HTMLFormElement, name: string) {
  form
    .querySelectorAll<HTMLInputElement>(`input[type="hidden"][name="${name}"]`)
    .forEach((input) => input.remove())
}

export function syncOnboardingCarryForwardInputs({
  form,
  intentFocus,
  roleInterest,
  formationStatus,
  organizationValues,
  accountValues,
}: {
  form: HTMLFormElement | null
  intentFocus: IntentFocus | ""
  roleInterest: RoleInterest | ""
  formationStatus: FormationStatus | ""
  organizationValues: OnboardingOrganizationValues
  accountValues: OnboardingAccountValues
}) {
  if (!form) return

  const fieldMap = buildOnboardingCarryForwardFieldMap({
    intentFocus,
    roleInterest,
    formationStatus,
    organizationValues,
    accountValues,
  })

  Object.entries(fieldMap).forEach(([name, value]) => {
    upsertHiddenInput(form, name, value)
  })

  if (!accountValues.optInUpdates) removeHiddenInput(form, "optInUpdates")
  if (!accountValues.newsletterOptIn) {
    removeHiddenInput(form, "newsletterOptIn")
  }
}

export function readOnboardingAccountValues(
  form: FormData
): OnboardingAccountValues {
  return {
    firstName: String(form.get("firstName") ?? ""),
    lastName: String(form.get("lastName") ?? ""),
    personHandle: String(form.get("personHandle") ?? ""),
    phone: String(form.get("phone") ?? ""),
    publicEmail: String(form.get("publicEmail") ?? ""),
    title: String(form.get("title") ?? ""),
    linkedin: String(form.get("linkedin") ?? ""),
    optInUpdates: form.has("optInUpdates"),
    newsletterOptIn: form.has("newsletterOptIn"),
  }
}

export function readOnboardingOrganizationValues(
  form: FormData
): OnboardingOrganizationValues {
  const orgName = String(form.get("orgName") ?? "")
  const orgSlug = slugify(String(form.get("orgSlug") ?? "").trim() || orgName)

  return {
    orgName,
    orgSlug,
  }
}

type ResolveOnboardingDefaultsArgs = {
  defaultEmail?: string | null
  defaultOrgName?: string | null
  defaultOrgSlug?: string | null
  defaultFormationStatus?: FormationStatus | null
  defaultIntentFocus?: IntentFocus | null
  defaultRoleInterest?: RoleInterest | null
  defaultFirstName?: string | null
  defaultLastName?: string | null
  defaultPersonHandle?: string | null
  defaultPhone?: string | null
  defaultPublicEmail?: string | null
  defaultTitle?: string | null
  defaultLinkedin?: string | null
  defaultAvatarUrl?: string | null
  defaultOptInUpdates?: boolean | null
  defaultNewsletterOptIn?: boolean | null
}

export type OnboardingDefaultValues = {
  initialOrgName: string
  initialOrgSlug: string
  initialFormationStatus: FormationStatus | ""
  initialIntentFocus: IntentFocus | ""
  initialRoleInterest: RoleInterest | ""
  initialFirstName: string
  initialLastName: string
  initialPersonHandle: string
  initialPhone: string
  initialPublicEmail: string
  initialTitle: string
  initialLinkedin: string
  initialAvatarUrl: string | null
  initialOptInUpdates: boolean
  initialNewsletterOptIn: boolean
}

export function resolveOnboardingDefaultValues({
  defaultEmail,
  defaultOrgName,
  defaultOrgSlug,
  defaultFormationStatus,
  defaultIntentFocus,
  defaultRoleInterest,
  defaultFirstName,
  defaultLastName,
  defaultPersonHandle,
  defaultPhone,
  defaultPublicEmail,
  defaultTitle,
  defaultLinkedin,
  defaultAvatarUrl,
  defaultOptInUpdates,
  defaultNewsletterOptIn,
}: ResolveOnboardingDefaultsArgs): OnboardingDefaultValues {
  const initialOrgName = (defaultOrgName ?? "").trim()
  const initialOrgSlug = slugify(
    (defaultOrgSlug ?? "").trim() || initialOrgName
  )

  return {
    initialOrgName,
    initialOrgSlug,
    initialFormationStatus: isFormationStatus(defaultFormationStatus)
      ? defaultFormationStatus
      : "",
    initialIntentFocus: isIntentFocus(defaultIntentFocus)
      ? defaultIntentFocus
      : "build",
    initialRoleInterest: isRoleInterest(defaultRoleInterest)
      ? defaultRoleInterest
      : "",
    initialFirstName: (defaultFirstName ?? "").trim(),
    initialLastName: (defaultLastName ?? "").trim(),
    initialPersonHandle: (defaultPersonHandle ?? "").trim().toLowerCase(),
    initialPhone: (defaultPhone ?? "").trim(),
    initialPublicEmail: (defaultPublicEmail ?? defaultEmail ?? "").trim(),
    initialTitle: (defaultTitle ?? "").trim(),
    initialLinkedin: (defaultLinkedin ?? "").trim(),
    initialAvatarUrl: (defaultAvatarUrl ?? "").trim() || null,
    initialOptInUpdates: defaultOptInUpdates ?? true,
    initialNewsletterOptIn: defaultNewsletterOptIn ?? true,
  }
}

export function resolveDraftFieldValue(
  defaults: Record<string, string>,
  key: string,
  draftValue: unknown
) {
  const value = typeof draftValue === "string" ? draftValue : ""
  if (typeof draftValue === "string") return value
  return defaults[key] ?? value
}

export function validateOnboardingStep({
  stepIndex,
  stepId,
  form,
  formationStatus,
  intentFocus,
  slugStatus,
  slugHint,
  personHandleStatus,
  personHandleHint,
  builderPlanTier,
}: {
  stepIndex?: number
  stepId?: OnboardingStepId | null
  form: FormData
  formationStatus: FormationStatus | ""
  intentFocus: IntentFocus | ""
  slugStatus: OnboardingSlugStatus
  slugHint: string | null
  personHandleStatus: OnboardingSlugStatus
  personHandleHint: string | null
  builderPlanTier: PricingPlanTier
}) {
  const simpleProfile = form.get("onboardingVersion") === "workspace_profile" && form.get("onboardingMode") === "post_signup_access"
  const nextErrors: Record<string, string> = {}
  const active =
    stepId ??
    (typeof stepIndex === "number"
      ? resolveOnboardingSteps(intentFocus)[stepIndex]?.id
      : null)

  if (active === "intent") {
    const intent = String(form.get("intentFocus") ?? "").trim()
    if (!isIntentFocus(intent)) {
      nextErrors.intentFocus = "Select a focus to continue"
    }
  }

  const includesOrganizationBasics = active === "intent" && intentFocus === "build" && form.get("onboardingMode") === "post_signup_access"
  if (active === "org" || includesOrganizationBasics) {
    const orgName = String(form.get("orgName") ?? "").trim()
    const orgSlug = slugify(String(form.get("orgSlug") ?? "").trim())
    if (!orgName) nextErrors.orgName = "Organization name is required"
    if (!orgSlug) nextErrors.orgSlug = "Organization URL is required"
    if (!formationStatus && !simpleProfile) {
      nextErrors.formationStatus = "Choose your formation status"
    }
    if (slugStatus !== "available") {
      nextErrors.orgSlug = slugHint ?? "Choose an available URL"
    }
  }

  if (active === "account") {
    const firstName = String(form.get("firstName") ?? "").trim()
    const lastName = String(form.get("lastName") ?? "").trim()
    const personHandle = String(form.get("personHandle") ?? "").trim()
    if (!simpleProfile && !firstName) nextErrors.firstName = "First name is required"
    if (!simpleProfile && !lastName) nextErrors.lastName = "Last name is required"
    if (!personHandle) nextErrors.personHandle = "Username is required"
    else if (personHandleStatus !== "available") {
      nextErrors.personHandle =
        personHandleHint ?? "Choose an available username"
    }
  }

  return nextErrors
}

export function isOnboardingAccountStepReady({
  firstName,
  lastName,
  personHandle,
}: {
  firstName: string
  lastName: string
  personHandle: string
}) {
  return (
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    personHandle.trim().length > 0
  )
}
