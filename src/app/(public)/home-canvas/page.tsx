import { redirect } from "next/navigation"

import { resolvePublicAuthCallbackHref } from "@/components/public/public-auth-callback"

type SearchParams = Record<string, string | string[] | undefined>

export default async function RetiredHomeCanvasPage({
  searchParams,
}: { searchParams?: Promise<SearchParams> }) {
  const resolved = searchParams ? await searchParams : {}
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === "string") params.append(key, value)
    else if (Array.isArray(value)) for (const item of value) params.append(key, item)
  }
  const callback = resolvePublicAuthCallbackHref({ pathname: "/home-canvas", searchParams: params })
  if (callback) redirect(callback)

  const section = params.get("section")
  const target = section === "login" ? "/login" : section === "signup" ? "/sign-up" : section === "pricing" ? "/pricing" : "/"
  params.delete("section")
  params.delete("embed")
  const query = params.toString()
  redirect(query ? `${target}?${query}` : target)
}
