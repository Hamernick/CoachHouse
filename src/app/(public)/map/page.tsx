import { permanentRedirect } from "next/navigation"

import { buildFindHref } from "@/lib/find/routes"

type LegacyMapPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function LegacyMapPage({
  searchParams,
}: LegacyMapPageProps) {
  const resolved = searchParams ? await searchParams : undefined
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(resolved ?? {})) {
    if (typeof value === "string") params.append(key, value)
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item)
    }
  }

  permanentRedirect(buildFindHref(params))
}
