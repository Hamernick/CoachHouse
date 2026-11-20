export function resolveAppShellOnboardingRedirectTarget({
  onboardingLocked,
  isAdminContext,
  pathname,
}: {
  onboardingLocked: boolean
  onboardingIntentFocus?: "build" | "find" | "fund" | "support" | null
  isAdminContext: boolean
  pathname: string | null
}) {
  if (!onboardingLocked || isAdminContext) return null
  if (pathname?.startsWith("/onboarding")) return null
  // Invitees must be able to join an existing workspace before owner setup.
  if (pathname === "/access-requests") return null
  return "/onboarding?source=onboarding"
}
