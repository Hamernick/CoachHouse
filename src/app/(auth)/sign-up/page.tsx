import type { Metadata } from "next"
import { AuthCard } from "@/components/auth/auth-card"
import { AuthScreenShell } from "@/components/auth/auth-screen-shell"
import { SignUpForm } from "@/components/auth/sign-up-form"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { isSupabaseAuthSessionMissingError } from "@/lib/supabase/auth-errors"
import { supabaseErrorToError } from "@/lib/supabase/errors"
import { redirect as redirectTo } from "next/navigation"
import { getSafeRedirectPath } from "@/lib/auth/redirects"
import { getOrganizationInviteRedirect } from "@/lib/auth/organization-invite"
import {
  buildPostSignupBuilderRedirect,
  resolveSignupBuilderPlanTier,
  resolveSignupIntentFocus,
} from "@/lib/onboarding/signup-plan"

export const metadata: Metadata = {
  title: "Create Your Account",
  description: "Create a Coach House account to save resources and build your nonprofit.",
}


type SearchParams = Record<string, string | string[] | undefined>

type SignUpPageProps = {
  searchParams?: Promise<SearchParams>
}

function buildCanonicalSignUpHref(searchParams: SearchParams) {
  const nextParams = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "plan" && value === "individual") continue

    if (typeof value === "string") {
      nextParams.set(key, value)
      continue
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        nextParams.append(key, item)
      }
    }
  }

  const query = nextParams.toString()
  return query ? `/sign-up?${query}` : "/sign-up"
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const resolved = searchParams ? await searchParams : {}
  if (resolved.plan === "individual") {
    redirectTo(buildCanonicalSignUpHref(resolved))
  }

  const redirect = getSafeRedirectPath(resolved.redirect)
  const inviteRedirect = getOrganizationInviteRedirect(redirect)
  const explicitIntent = resolveSignupIntentFocus(resolved.intent)
  const plan = typeof resolved.plan === "string" ? resolved.plan : undefined
  const tier = typeof resolved.tier === "string" ? resolved.tier : undefined
  const addon = typeof resolved.addon === "string" ? resolved.addon : undefined
  const selectedBuilderPlanTier = inviteRedirect ? null :
    resolveSignupBuilderPlanTier(plan) ??
    resolveSignupBuilderPlanTier(tier) ??
    null
  const selectedAddon = addon === "accelerator" ? "accelerator" : null
  const defaultIntentFocus = inviteRedirect ? "support" : explicitIntent ?? "build"

  const fallbackParams = new URLSearchParams()
  if (selectedBuilderPlanTier) fallbackParams.set("plan", selectedBuilderPlanTier)
  if (selectedAddon) fallbackParams.set("addon", selectedAddon)

  const fallbackQuery = fallbackParams.toString()
  const builderRedirectTarget =
    redirect ??
    buildPostSignupBuilderRedirect({
      planTier: selectedBuilderPlanTier,
      source: "signup",
    })
  const memberRedirectTarget =
    redirect ??
    (fallbackQuery
      ? `/onboarding?source=signup&${fallbackQuery}`
      : `/onboarding?source=signup`)

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error && !isSupabaseAuthSessionMissingError(error)) {
    throw supabaseErrorToError(error, "Unable to load user.")
  }
  if (user) {
    const destination =
      defaultIntentFocus === "build"
        ? builderRedirectTarget
        : memberRedirectTarget
    redirectTo(destination)
  }
  const loginHref = `/login`

  return (
    <AuthScreenShell showBrand>
      <AuthCard
        title="Create your account"
        description={inviteRedirect
          ? "Use the invited email address. After verification, join your team’s existing workspace."
          : "After email verification, Coach House will continue to your next step."}
      >
        <SignUpForm
          loginHref={loginHref}
          defaultIntentFocus={defaultIntentFocus}
          lockedIntentFocus={inviteRedirect ? "support" : selectedBuilderPlanTier ? "build" : null}
          builderRedirectTo={builderRedirectTarget}
          memberRedirectTo={memberRedirectTarget}
          signUpMetadata={
            selectedBuilderPlanTier
              ? { onboarding_selected_builder_plan_tier: selectedBuilderPlanTier }
              : undefined
          }
        />
      </AuthCard>
    </AuthScreenShell>
  )
}
