import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { AuthCard } from "@/components/auth/auth-card"
import { AuthScreenShell } from "@/components/auth/auth-screen-shell"
import { Button } from "@/components/ui/button"
import { resolvePasswordRecoveryDestination } from "@/lib/auth/password-recovery"
import {
  buildLoginUrlWithAuthConfirmationError,
  getSafeEmailOtpType,
  resolvePostAuthConfirmationRedirect,
  resolveAuthConfirmationDestination,
  resolveConfirmedSignupDestination,
} from "@/lib/supabase/auth-confirmation"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Confirm Your Email",
  description: "Verify your email to continue with your Coach House account.",
}


type SearchParams = Promise<Record<string, string | string[] | undefined>>

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

async function resolveRequestOrigin() {
  const headerStore = await headers()
  const proto = headerStore.get("x-forwarded-proto") ?? "https"
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host")
  return host ? `${proto}://${host}` : null
}

async function confirmEmailAction(formData: FormData) {
  "use server"

  const tokenHash = formData.get("token_hash")
  const type = getSafeEmailOtpType(formData.get("type"))
  const requestOrigin = await resolveRequestOrigin()
  const rawDestination = resolveAuthConfirmationDestination(formData.get("destination"), requestOrigin)
  const destination = type === "recovery"
    ? resolvePasswordRecoveryDestination(rawDestination)
    : rawDestination

  if (typeof tokenHash !== "string" || tokenHash.length === 0 || !type) {
    if (type === "recovery") redirect(resolvePasswordRecoveryDestination(destination, "missing_code"))
    redirect(
      buildLoginUrlWithAuthConfirmationError({
        destination,
        message: "This confirmation link is missing verification details. Request a new link.",
      }),
    )
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  })

  if (error) {
    if (type === "recovery") redirect(resolvePasswordRecoveryDestination(destination, "invalid_or_expired"))
    redirect(
      buildLoginUrlWithAuthConfirmationError({
        destination,
        message: "This confirmation link is invalid or expired. Request a new link.",
      }),
    )
  }

  const confirmedDestination = resolveConfirmedSignupDestination({
    destination,
    type,
    userMetadata: data.user?.user_metadata,
  })
  redirect(resolvePostAuthConfirmationRedirect(confirmedDestination, requestOrigin))
}

export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const resolved = searchParams ? await searchParams : {}
  const tokenHash = firstParam(resolved.token_hash)
  const type = getSafeEmailOtpType(firstParam(resolved.type))
  const origin = await resolveRequestOrigin()
  const rawDestination = resolveAuthConfirmationDestination(firstParam(resolved.next), origin)
  const destination = type === "recovery"
    ? resolvePasswordRecoveryDestination(rawDestination)
    : rawDestination
  if (type === "recovery" && !tokenHash) {
    redirect(resolvePasswordRecoveryDestination(destination, "missing_code"))
  }
  const canConfirm = Boolean(tokenHash && type)
  const isRecovery = type === "recovery"

  return (
    <AuthScreenShell>
      <AuthCard
        title={canConfirm ? isRecovery ? "Reset your password" : "Confirm your email" : "Confirmation link unavailable"}
        description={
          canConfirm
            ? isRecovery ? "Continue to choose a new password for your Coach House account." : "Finish securing your Coach House account before continuing."
            : "This link is missing the verification details needed to confirm an account."
        }
      >
        {canConfirm ? (
          <form action={confirmEmailAction} className="space-y-4">
            <input type="hidden" name="token_hash" value={tokenHash ?? ""} />
            <input type="hidden" name="type" value={type ?? ""} />
            <input type="hidden" name="destination" value={destination} />
            <Button type="submit" className="w-full">
              {isRecovery ? "Continue to reset password" : "Confirm email"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {isRecovery ? "Your reset link will be verified before you choose a new password." : "After confirmation, Coach House will continue to your next step."}
            </p>
          </form>
        ) : (
          <div className="space-y-4">
            <Button asChild className="w-full">
              <Link href="/sign-up">Create account</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/login">Go to sign in</Link>
            </Button>
          </div>
        )}
      </AuthCard>
    </AuthScreenShell>
  )
}
