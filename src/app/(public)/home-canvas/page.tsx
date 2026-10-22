import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { HomeCanvasPreview } from "@/components/public/home-canvas-preview"
import { resolvePublicAuthCallbackHref } from "@/components/public/public-auth-callback"
import { PricingSurface } from "@/components/public/pricing-surface"
import {
  DEFAULT_POST_AUTH_REDIRECT,
  getSafeRedirectPath,
} from "@/lib/auth/redirects"
import { getPublicMapboxToken } from "@/lib/mapbox/token"
import {
  resolveSignupBuilderPlanTier,
  resolveSignupBuilderPlanTierFromRedirect,
  resolveSignupIntentFocus,
} from "@/lib/onboarding/signup-plan"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Home Canvas Preview",
  description:
    "A homepage preview that mirrors the internal canvas and side navigation model.",
  robots: { index: false, follow: false },
}

export const runtime = "nodejs"
export const revalidate = 86400

type HomeCanvasPreviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function readStringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined
}

export default async function HomeCanvasPreviewPage({
  searchParams,
}: HomeCanvasPreviewPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const searchParamsObject = new URLSearchParams()
  for (const [key, value] of Object.entries(resolvedSearchParams ?? {})) {
    if (typeof value === "string") {
      searchParamsObject.set(key, value)
      continue
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        searchParamsObject.append(key, item)
      }
    }
  }
  const authCallbackHref = resolvePublicAuthCallbackHref({
    pathname: "/home-canvas",
    searchParams: searchParamsObject,
  })
  if (authCallbackHref) {
    redirect(authCallbackHref)
  }
  const initialSection = readStringParam(resolvedSearchParams?.section)
  if (initialSection === "pricing") {
    searchParamsObject.delete("section")
    searchParamsObject.delete("embed")
    const query = searchParamsObject.toString()
    redirect(query ? `/pricing?${query}` : "/pricing")
  }
  const loginRedirectTo = getSafeRedirectPath(
    readStringParam(resolvedSearchParams?.redirect)
  )
  const signupPlanTier =
    resolveSignupBuilderPlanTier(readStringParam(resolvedSearchParams?.plan)) ??
    resolveSignupBuilderPlanTierFromRedirect(loginRedirectTo)
  const signupIntentFocus = resolveSignupIntentFocus(
    readStringParam(resolvedSearchParams?.intent)
  )
  if (initialSection === "login") {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) redirect(DEFAULT_POST_AUTH_REDIRECT)
  }

  return (
    <HomeCanvasPreview
      initialSection={initialSection}
      loginRedirectTo={loginRedirectTo}
      mapboxToken={getPublicMapboxToken()}
      pricingPanel={<PricingSurface embedded />}
      signupIntentFocus={signupIntentFocus}
      signupPlanTier={signupPlanTier}
    />
  )
}
