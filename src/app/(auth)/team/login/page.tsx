import type { Metadata } from "next"
import { redirect as redirectTo } from "next/navigation"

import { AuthCard } from "@/components/auth/auth-card"
import { LoginForm } from "@/components/auth/login-form"
import { AuthScreenShell } from "@/components/auth/auth-screen-shell"
import { DEFAULT_POST_AUTH_REDIRECT, getSafeRedirectPath } from "@/lib/auth/redirects"
import { isSupabaseAuthSessionMissingError } from "@/lib/supabase/auth-errors"
import { supabaseErrorToError } from "@/lib/supabase/errors"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Team Sign In",
  description: "Sign in to your Coach House team account.",
}


type SearchParams = Record<string, string | string[] | undefined>

type TeamLoginPageProps = {
  searchParams?: Promise<SearchParams>
}

export default async function TeamLoginPage({ searchParams }: TeamLoginPageProps) {
  const resolved = searchParams ? await searchParams : {}
  const redirectParamRaw = Array.isArray(resolved.redirect) ? resolved.redirect[0] : resolved.redirect
  const redirectParam = getSafeRedirectPath(redirectParamRaw)
  const error = Array.isArray(resolved.error) ? resolved.error[0] : resolved.error
  const plan = Array.isArray(resolved.plan) ? resolved.plan[0] : resolved.plan
  const addon = Array.isArray(resolved.addon) ? resolved.addon[0] : resolved.addon

  const redirectTarget = redirectParam ?? DEFAULT_POST_AUTH_REDIRECT
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError && !isSupabaseAuthSessionMissingError(userError)) {
    throw supabaseErrorToError(userError, "Unable to load user.")
  }
  if (user) {
    redirectTo(redirectTarget)
  }

  const signUpParams = new URLSearchParams()
  signUpParams.set("redirect", redirectTarget)
  if (plan === "organization" || plan === "individual") {
    signUpParams.set("plan", plan)
  }
  if (addon === "accelerator") {
    signUpParams.set("addon", addon)
  }
  const signUpHref = `/sign-up?${signUpParams.toString()}`

  return (
    <AuthScreenShell>
      <AuthCard title="Team sign in" description="Secure access for you and your organization members.">
        <LoginForm
          redirectTo={redirectTarget}
          signUpHref={signUpHref}
          initialError={typeof error === "string" ? error : null}
        />
      </AuthCard>
    </AuthScreenShell>
  )
}
