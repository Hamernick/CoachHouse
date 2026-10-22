import { redirect } from "next/navigation"

type SearchParams = Record<string, string | string[] | undefined>

export default async function RetiredTesterLoginPage({
  searchParams,
}: { searchParams?: Promise<SearchParams> }) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams ? await searchParams : {})) {
    if (typeof value === "string") params.append(key, value)
    else if (Array.isArray(value)) for (const item of value) params.append(key, item)
  }
  const query = params.toString()
  redirect(query ? `/login?${query}` : "/login")
}
