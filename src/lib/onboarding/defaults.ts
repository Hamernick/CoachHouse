type OnboardingMetadata = Record<string, unknown> | null
type OnboardingProfile = Record<string, unknown> | null

type FormationStatus = "pre_501c3" | "in_progress" | "approved"
type IntentFocus = "build" | "find" | "fund" | "support"
type RoleInterest = "staff" | "operator" | "volunteer" | "board_member"
type PricingPlanTier = "free" | "organization" | "operations_support"

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

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function buildOnboardingFlowDefaults({
  userId,
  organizationId = userId,
  email,
  displayName,
  avatarUrl,
  profileTitle = null,
  userMetadata,
  orgProfile,
  orgSlug,
  personHandle = null,
  builderPlanTier = null,
}: {
  userId: string
  organizationId?: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
  profileTitle?: string | null
  userMetadata: OnboardingMetadata
  orgProfile: OnboardingProfile
  orgSlug: string | null
  personHandle?: string | null
  builderPlanTier?: PricingPlanTier | null
}): OnboardingFlowDefaults {
  const normalizedDisplayName = normalizeString(displayName) ||
    normalizeString(userMetadata?.full_name) || normalizeString(userMetadata?.name) ||
    [normalizeString(userMetadata?.given_name), normalizeString(userMetadata?.family_name)].filter(Boolean).join(" ")
  const parsedDisplayParts = normalizedDisplayName
    ? normalizedDisplayName.split(/\s+/)
    : []
  const fallbackFirstName = parsedDisplayParts[0] ?? ""
  const fallbackLastName = parsedDisplayParts.slice(1).join(" ")
  const metadataIntentFocus = normalizeString(
    userMetadata?.onboarding_intent_focus
  )
  const metadataRoleInterest = normalizeString(
    userMetadata?.onboarding_role_interest
  )
  const metadataPhone = normalizeString(userMetadata?.phone)
  const metadataFirstName = normalizeString(userMetadata?.first_name)
  const metadataLastName = normalizeString(userMetadata?.last_name)
  const metadataOptInUpdates =
    typeof userMetadata?.marketing_opt_in === "boolean"
      ? userMetadata.marketing_opt_in
      : null
  const metadataNewsletterOptIn =
    typeof userMetadata?.newsletter_opt_in === "boolean"
      ? userMetadata.newsletter_opt_in
      : null
  const orgPeople = Array.isArray(orgProfile?.org_people)
    ? (orgProfile.org_people as Array<Record<string, unknown>>)
    : []
  const currentEmail = normalizeString(email).toLowerCase()
  const ownerPerson =
    orgPeople.find((person) => normalizeString(person?.id) === userId) ??
    orgPeople.find(
      (person) => normalizeString(person?.email).toLowerCase() === currentEmail
    ) ??
    null

  const formationStatus = normalizeString(orgProfile?.formationStatus)
  const ownerTitle = normalizeString(ownerPerson?.title)
  const ownerLinkedin = normalizeString(ownerPerson?.linkedin)
  const ownerEmail = normalizeString(ownerPerson?.email)
  const orgEmail = normalizeString(orgProfile?.email)
  const orgPhone = normalizeString(orgProfile?.phone)
  const orgLinkedin = normalizeString(orgProfile?.linkedin)
  const orgName = normalizeString(orgProfile?.name)
  const defaultPhone = metadataPhone || orgPhone || null

  return {
    draftScope: `${userId}:${organizationId}`,
    defaultEmail: normalizeString(email) || null,
    defaultOrgName: orgName || null,
    defaultOrgSlug: normalizeString(orgSlug) || null,
    defaultFormationStatus:
      formationStatus === "pre_501c3" ||
      formationStatus === "in_progress" ||
      formationStatus === "approved"
        ? formationStatus
        : null,
    defaultIntentFocus:
      metadataIntentFocus === "build" ||
      metadataIntentFocus === "find" ||
      metadataIntentFocus === "fund" ||
      metadataIntentFocus === "support"
        ? metadataIntentFocus
        : null,
    defaultRoleInterest:
      metadataRoleInterest === "staff" ||
      metadataRoleInterest === "operator" ||
      metadataRoleInterest === "volunteer" ||
      metadataRoleInterest === "board_member"
        ? metadataRoleInterest
        : null,
    defaultFirstName: metadataFirstName || fallbackFirstName || null,
    defaultLastName: metadataLastName || fallbackLastName || null,
    defaultPersonHandle: normalizeString(personHandle) || null,
    defaultPhone,
    defaultPublicEmail:
      orgEmail || ownerEmail || normalizeString(email) || null,
    defaultTitle: normalizeString(profileTitle) || ownerTitle || normalizeString(userMetadata?.headline) || normalizeString(userMetadata?.title) || null,
    defaultLinkedin: orgLinkedin || ownerLinkedin || null,
    defaultAvatarUrl: normalizeString(avatarUrl) || normalizeString(userMetadata?.avatar_url) || normalizeString(userMetadata?.picture) || null,
    defaultOptInUpdates: metadataOptInUpdates,
    defaultNewsletterOptIn: metadataNewsletterOptIn,
    defaultBuilderPlanTier: builderPlanTier,
  }
}
