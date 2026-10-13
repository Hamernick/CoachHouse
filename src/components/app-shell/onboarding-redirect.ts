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
  return "/onboarding?source=onboarding"
}
