import { getSafeRedirectPath } from "@/lib/auth/redirects"

export function getPasswordRecoveryPath(destination?: string | null) {
  const safePath = getSafeRedirectPath(destination)
  const recoveryUrl = new URL("/update-password", "https://coachhouse.local")
  if (safePath) {
    const destinationUrl = new URL(safePath, recoveryUrl.origin)
    if (destinationUrl.pathname === "/update-password") return safePath
    if (safePath !== "/") recoveryUrl.searchParams.set("redirect", safePath)
  }
  return `${recoveryUrl.pathname}${recoveryUrl.search}`
}

/** The destination must already have passed the confirmation origin allowlist. */
export function resolvePasswordRecoveryDestination(
  destination: string,
  recoveryError?: "invalid_or_expired" | "missing_code",
) {
  const destinationUrl = new URL(destination, "https://coachhouse.local")
  const recoveryUrl = new URL(
    getPasswordRecoveryPath(`${destinationUrl.pathname}${destinationUrl.search}${destinationUrl.hash}`),
    destinationUrl.origin,
  )
  if (recoveryError) recoveryUrl.searchParams.set("recovery_error", recoveryError)
  return destination.startsWith("/")
    ? `${recoveryUrl.pathname}${recoveryUrl.search}${recoveryUrl.hash}`
    : recoveryUrl.toString()
}
