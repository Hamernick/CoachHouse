import { permanentRedirect } from "next/navigation"

type SearchParams = Record<string, string | string[] | undefined>

export default async function RetiredMarketplacePage({
  searchParams,
}: { searchParams?: Promise<SearchParams> }) {
  const resolved = searchParams ? await searchParams : {}
  const params = new URLSearchParams()
  for (const key of ["q", "type", "function", "stage", "cost"]) {
    const value = resolved[key]
    if (typeof value === "string") params.set(key, value)
  }
  const query = params.toString()
  permanentRedirect(`/documentation/marketplace${query ? `?${query}` : ""}`)
}
