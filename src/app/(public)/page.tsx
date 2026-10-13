import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { PublicHomeLanding } from "@/features/build-collect-navigation"
import { resolvePublicAuthCallbackHref } from "@/components/public/public-auth-callback"

export const metadata: Metadata = {
  title: "The platform for nonprofits",
  description: "Find, save, and share nonprofits. Build and run your organization with a shared Workspace, guided training, and Executive Coaches.",
  alternates: { canonical: "/" },
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    if (typeof value === "string") params.append(key, value)
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item)
    }
  }
  const callbackHref = resolvePublicAuthCallbackHref({
    pathname: "/",
    searchParams: params,
  })
  if (callbackHref) redirect(callbackHref)

  return <PublicHomeLanding />
}
