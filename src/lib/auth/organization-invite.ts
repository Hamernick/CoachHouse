import { getSafeRedirectPath } from "./redirects"

// Routing context only. Membership still requires server-side invite validation.
export function getOrganizationInviteRedirect(value: unknown) {
  const path = getSafeRedirectPath(value)
  if (!path) return undefined
  const url = new URL(path, "https://coachhouse.local")
  const tokens = url.searchParams.getAll("token")
  if (url.pathname !== "/join-organization" || tokens.length !== 1 || !tokens[0].trim()) {
    return undefined
  }
  return `/join-organization?token=${encodeURIComponent(tokens[0].trim())}`
}
