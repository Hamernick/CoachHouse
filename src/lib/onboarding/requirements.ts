type OnboardingRequirementsInput = {
  userId: string
  organizationId: string
  isPlatformStaff: boolean
  userMetadata: Record<string, unknown> | null
  organizationProfile: Record<string, unknown> | null
  publicSlug: string | null
}

export function normalizeOrganizationFormationStatus(value: unknown) {
  return value === "pre_501c3" ||
    value === "in_progress" ||
    value === "approved"
    ? value
    : null
}

export function hasRequiredOrganizationSetup(
  profile: Record<string, unknown> | null,
  publicSlug: string | null
) {
  return Boolean(
    typeof profile?.name === "string" &&
    profile.name.trim() &&
    publicSlug?.trim()
  )
}

// Formation status is collected later. Completion still requires saved name and URL.
export function resolveOnboardingRequirements({
  userId,
  organizationId,
  isPlatformStaff,
  userMetadata,
  organizationProfile,
  publicSlug,
}: OnboardingRequirementsInput) {
  const completed = userMetadata?.onboarding_completed === true
  const builder = userMetadata?.onboarding_intent_focus === "build"
  const setupComplete = hasRequiredOrganizationSetup(
    organizationProfile,
    publicSlug
  )
  const stage = userMetadata?.workspace_onboarding_stage
  const accessSelected =
    completed ||
    (typeof stage === "number" && Number.isInteger(stage) && stage >= 2)
  const mode =
    builder && accessSelected
      ? ("workspace_setup" as const)
      : ("post_signup_access" as const)
  const exempt = isPlatformStaff || organizationId !== userId
  return {
    required: !exempt && (!completed || (builder && !setupComplete)),
    mode,
    organizationSetupComplete: setupComplete,
  }
}
