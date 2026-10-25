import type { Metadata } from "next"
import { AuthCard } from "@/components/auth/auth-card"
import { AuthScreenShell } from "@/components/auth/auth-screen-shell"
import {
  UpdatePasswordForm,
  type UpdatePasswordFormStatus,
  type UpdatePasswordRecoveryError,
} from "@/components/auth/update-password-form"
import { DEFAULT_POST_AUTH_REDIRECT, getSafeRedirectPath } from "@/lib/auth/redirects"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Update Your Password",
  description: "Choose a new password for your Coach House account.",
}


type SearchParams = Record<string, string | string[] | undefined>

type UpdatePasswordPageProps = {
  searchParams?: Promise<SearchParams>
}

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function getSafeRecoveryError(value: unknown): UpdatePasswordRecoveryError | null {
  return value === "invalid_or_expired" || value === "missing_code" ? value : null
}

export function resolveUpdatePasswordPageState(
  searchParams: SearchParams,
  options: { hasServerUser: boolean },
) {
  const redirect = getSafeRedirectPath(getFirstSearchParam(searchParams.redirect))
  const recoveryError = getSafeRecoveryError(getFirstSearchParam(searchParams.recovery_error))

  let initialStatus: UpdatePasswordFormStatus = "checking"
  if (recoveryError) {
    initialStatus = "retry"
  } else if (options.hasServerUser) {
    initialStatus = "ready"
  }

  return {
    redirect,
    recoveryError,
    initialStatus,
  }
}

export default async function UpdatePasswordPage({ searchParams }: UpdatePasswordPageProps) {
  const resolved = searchParams ? await searchParams : {}
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const pageState = resolveUpdatePasswordPageState(resolved, {
    hasServerUser: Boolean(user),
  })
  const retryHref = pageState.redirect
    ? `/forgot-password?redirect=${encodeURIComponent(pageState.redirect)}`
    : "/forgot-password"

  return (
    <AuthScreenShell>
      <AuthCard
        title="Choose a new password"
        description="Passwords must be at least 8 characters."
      >
        <UpdatePasswordForm
          redirectTo={pageState.redirect ?? DEFAULT_POST_AUTH_REDIRECT}
          initialStatus={pageState.initialStatus}
          recoveryError={pageState.recoveryError}
          retryHref={retryHref}
        />
      </AuthCard>
    </AuthScreenShell>
  )
}
