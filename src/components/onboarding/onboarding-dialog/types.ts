import type { PricingPlanTier } from "@/lib/billing/plan-tier"

export type FormationStatus = "pre_501c3" | "in_progress" | "approved"
export type IntentFocus = "build" | "find" | "fund" | "support"
export type RoleInterest = "staff" | "operator" | "volunteer" | "board_member"

export type OnboardingStepId =
  | "intent"
  | "pricing"
  | "org"
  | "account"
  | "community"
export type OnboardingSlugStatus =
  | "idle"
  | "checking"
  | "available"
  | "unavailable"

export type Step = {
  id: OnboardingStepId
  title: string
  description: string
}

export type OnboardingDraftValues = Record<string, string>

export type OnboardingDraftFlags = {
  optInUpdates?: boolean
  newsletterOptIn?: boolean
}

export type OnboardingDraft = {
  savedAt?: number
  step?: number
  stepId?: OnboardingStepId
  formationStatus?: FormationStatus | ""
  intentFocus?: IntentFocus | ""
  roleInterest?: RoleInterest | ""
  slugEdited?: boolean
  avatar?: string | null
  values?: OnboardingDraftValues
  flags?: OnboardingDraftFlags
}

export type OnboardingFlowDefaults = {
  draftScope?: string | null
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
  defaultBuilderPlanTier?: PricingPlanTier | null
}

export type OnboardingFlowVisibleStepId = OnboardingStepId
export type OnboardingFlowMode =
  | "full"
  | "post_signup_access"
  | "workspace_setup"

export type OnboardingDialogProps = OnboardingFlowDefaults & {
  open: boolean
  onSubmit: (form: FormData) => Promise<void>
  presentation?: "dialog" | "inline"
}
