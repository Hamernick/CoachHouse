import { getSafePostLoginRedirectPath } from "@/lib/auth/redirects"

import type { GoogleAuthMode } from "../types"

export const GOOGLE_AUTH_STAGES = [
  "loading",
  "ready",
  "button_clicked",
  "script_unavailable",
  "initialization_failed",
  "credential_received",
  "provision_failed",
  "link_failed",
  "exchange_failed",
  "signed_in",
  "retry_requested",
] as const
export type GoogleAuthStage = (typeof GOOGLE_AUTH_STAGES)[number]

export type GoogleAuthDiagnostics = {
  reference: string
  timestamp: string
  origin: string
  clientId: string
  release: string
  mode: GoogleAuthMode
  stage: GoogleAuthStage
  lastFailure: GoogleAuthStage | null
}

/** Explicit fields only: never copy a URL, credential, nonce, email, or provider error. */
export function createGoogleAuthDiagnostics(input: {
  reference: string
  timestamp: string
  origin: string
  clientId?: string
  release?: string
  mode: GoogleAuthMode
  stage: GoogleAuthStage
  lastFailure?: GoogleAuthStage | null
}): GoogleAuthDiagnostics {
  let origin = "unavailable"
  try {
    const url = new URL(input.origin)
    if (["http:", "https:"].includes(url.protocol)) origin = url.origin
  } catch {
    /* Keep diagnostics usable when configuration is invalid. */
  }

  return {
    reference: /^[a-zA-Z0-9-]{1,64}$/.test(input.reference)
      ? input.reference
      : "unavailable",
    timestamp: Number.isNaN(Date.parse(input.timestamp))
      ? "unavailable"
      : new Date(input.timestamp).toISOString(),
    origin,
    clientId: /^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(
      input.clientId ?? ""
    )
      ? input.clientId!
      : "unavailable",
    release: /^[a-zA-Z0-9_-]{1,100}$/.test(input.release ?? "")
      ? input.release!
      : "unavailable",
    mode: ["login", "signup", "link"].includes(input.mode)
      ? input.mode
      : "login",
    stage: GOOGLE_AUTH_STAGES.includes(input.stage) ? input.stage : "loading",
    lastFailure:
      input.lastFailure && GOOGLE_AUTH_STAGES.includes(input.lastFailure)
        ? input.lastFailure
        : null,
  }
}

export function formatGoogleAuthDiagnostics(details: GoogleAuthDiagnostics) {
  // Rebuild the allowlist rather than serializing a caller's arbitrary object.
  return JSON.stringify(createGoogleAuthDiagnostics(details), null, 2)
}

export function getCanonicalGoogleLoginHref(redirectTo: string) {
  const destination = getSafePostLoginRedirectPath(redirectTo) ?? "/workspace"
  return `https://coachhouse.app/login?redirect=${encodeURIComponent(destination)}`
}
