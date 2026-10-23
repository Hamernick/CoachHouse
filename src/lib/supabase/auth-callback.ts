import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"

import { DEFAULT_POST_AUTH_REDIRECT, getSafeRedirectPath } from "@/lib/auth/redirects"
import { getPasswordRecoveryPath } from "@/lib/auth/password-recovery"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"

export type RecoveryCallbackError = "invalid_or_expired" | "missing_code"

const UPDATE_PASSWORD_PATH = "/update-password"

function getSafeType(type?: string | null): EmailOtpType | null {
  if (!type) return null
  const normalized = type.toLowerCase()
  switch (normalized) {
    case "signup":
    case "invite":
    case "magiclink":
    case "recovery":
    case "email_change":
    case "email":
      return normalized
    default:
      return null
  }
}

function isPkceVerifierMissingError(message?: string | null) {
  if (!message) return false
  const normalized = message.toLowerCase()
  return (
    normalized.includes("pkce code verifier") ||
    normalized.includes("code verifier not found in storage")
  )
}

function toLoginUrl(
  requestUrl: URL,
  options: {
    redirect?: string | null
    error?: string | null
    notice?: string | null
  } = {},
) {
  const loginUrl = new URL("/login", requestUrl.origin)
  if (options.redirect) {
    loginUrl.searchParams.set("redirect", options.redirect)
  }
  if (options.error) {
    loginUrl.searchParams.set("error", options.error)
  }
  if (options.notice) {
    loginUrl.searchParams.set("notice", options.notice)
  }
  return loginUrl
}

export function isRecoveryAuthFlow(options: {
  type?: EmailOtpType | null
  redirect?: string | null
}) {
  return (
    options.type === "recovery" ||
    (options.redirect ? new URL(options.redirect, "https://coachhouse.local").pathname === UPDATE_PASSWORD_PATH : false) ||
    false
  )
}

export function toUpdatePasswordUrl(
  requestUrl: URL,
  options: {
    destination?: string | null
    recoveryError?: RecoveryCallbackError | null
  } = {},
) {
  const updatePasswordUrl = new URL(getPasswordRecoveryPath(options.destination), requestUrl.origin)
  if (options.recoveryError) {
    updatePasswordUrl.searchParams.set("recovery_error", options.recoveryError)
  }

  return updatePasswordUrl
}

export async function handleSupabaseAuthCallback(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const tokenHash = requestUrl.searchParams.get("token_hash")
  const type = getSafeType(requestUrl.searchParams.get("type"))
  const redirectParam = getSafeRedirectPath(requestUrl.searchParams.get("redirect"))
  const isRecoveryFlow = isRecoveryAuthFlow({ type, redirect: redirectParam })

  const fallback = isRecoveryFlow ? UPDATE_PASSWORD_PATH : DEFAULT_POST_AUTH_REDIRECT
  const destination = isRecoveryFlow
    ? toUpdatePasswordUrl(requestUrl, { destination: redirectParam })
    : new URL(redirectParam ?? fallback, requestUrl.origin)
  const response = NextResponse.redirect(destination)
  const supabase = createSupabaseRouteHandlerClient(request, response)

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) {
      return response
    }

    if (isRecoveryFlow) {
      return NextResponse.redirect(
        toUpdatePasswordUrl(requestUrl, {
          destination: redirectParam,
          recoveryError: "invalid_or_expired",
        }),
      )
    }

    const message =
      type === "signup"
        ? "This confirmation link is invalid or expired. Request a new confirmation email."
        : "This auth link is invalid or expired. Request a new link and try again."
    return NextResponse.redirect(
      toLoginUrl(requestUrl, {
        redirect: redirectParam,
        error: message,
      }),
    )
  }

  if (tokenHash && !type && isRecoveryFlow) {
    return NextResponse.redirect(
      toUpdatePasswordUrl(requestUrl, {
        destination: redirectParam,
        recoveryError: "invalid_or_expired",
      }),
    )
  }

  if (!code) {
    if (isRecoveryFlow) {
      return NextResponse.redirect(
        toUpdatePasswordUrl(requestUrl, {
          destination: redirectParam,
          recoveryError: "missing_code",
        }),
      )
    }

    return NextResponse.redirect(
      toLoginUrl(requestUrl, {
        redirect: redirectParam,
        error: "Missing verification code. Request a new confirmation link.",
      }),
    )
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    if (isRecoveryFlow) {
      return NextResponse.redirect(
        toUpdatePasswordUrl(requestUrl, {
          destination: redirectParam,
          recoveryError: "invalid_or_expired",
        }),
      )
    }

    if (isPkceVerifierMissingError(error.message)) {
      return NextResponse.redirect(
        toLoginUrl(requestUrl, {
          redirect: redirectParam,
          notice: "email_confirmed_sign_in",
        }),
      )
    }

    const fallbackError = "We couldn't complete sign-in from that link. Please sign in manually."
    return NextResponse.redirect(
      toLoginUrl(requestUrl, {
        redirect: redirectParam,
        error: error.message || fallbackError,
      }),
    )
  }

  // A provider Site URL fallback drops our redirect query. The PKCE verifier
  // still identifies recovery after exchange; retain its session cookies.
  if (data && "redirectType" in data && data.redirectType === "recovery") {
    response.headers.set("location", toUpdatePasswordUrl(requestUrl, { destination: redirectParam }).toString())
  }
  return response
}
