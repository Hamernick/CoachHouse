import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthScreenShell } from "@/components/auth/auth-screen-shell"
import { LoginPanel } from "@/components/auth/login-panel"
import { DEFAULT_POST_AUTH_REDIRECT, getSafePostLoginRedirectPath } from "@/lib/auth/redirects"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type SearchParams = Record<string, string | string[] | undefined>

export const metadata: Metadata = {
  description: "Sign in to your Coach House account and continue your work.",
  title: "Sign in",
  robots: { index: false, follow: false },
}

export default async function LoginPage({
  searchParams,
}: { searchParams?: Promise<SearchParams> }) {
  const resolved = searchParams ? await searchParams : {}
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value
  const redirectTo = getSafePostLoginRedirectPath(first(resolved.redirect)) ?? DEFAULT_POST_AUTH_REDIRECT
  const { data: { user } } = await (await createSupabaseServerClient()).auth.getUser()
  if (user) redirect(redirectTo)

  const signupParams = new URLSearchParams({ redirect: redirectTo })
  const plan = first(resolved.plan)
  if (plan === "organization" || plan === "individual") signupParams.set("plan", plan)
  if (first(resolved.addon) === "accelerator") signupParams.set("addon", "accelerator")

  return (
    <AuthScreenShell showBrand>
      <LoginPanel
        redirectTo={redirectTo}
        initialError={first(resolved.error)}
        signUpHref={`/sign-up?${signupParams.toString()}`}
        className="mx-auto max-sm:[&_input]:min-h-11 max-sm:[&_input]:pr-14 max-sm:[&_button]:min-h-11 max-sm:[&_button]:min-w-11 max-sm:[&_a]:inline-flex max-sm:[&_a]:min-h-11 max-sm:[&_a]:items-center"
      />
    </AuthScreenShell>
  )
}
