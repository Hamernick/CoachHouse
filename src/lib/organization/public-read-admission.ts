import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// Called after cache lookup and immediately before a public projection returns.
// A cached result, caller-supplied ID, or surviving shared identity is not authority.
export async function currentlyPublicOrganizationIds(ids: readonly string[], audience: "profile" | "roadmap" = "profile"): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const unique = [...new Set(ids)]
  const client = createSupabaseAdminClient({ requestTimeoutMs: 10000 })
  const read = client.rpc.bind(client) as unknown as (
    name: "filter_public_organization_ids",
    args: { p_ids: string[]; p_audience: "profile" | "roadmap" },
  ) => PromiseLike<{ data: unknown; error: unknown }>
  const allowed = new Set<string>()
  for (let offset = 0; offset < unique.length; offset += 500) {
    const requested = unique.slice(offset, offset + 500)
    const { data, error } = await read("filter_public_organization_ids", { p_ids: requested, p_audience: audience })
    if (error || !Array.isArray(data) || data.some((id) => typeof id !== "string" || !requested.includes(id))) return new Set()
    for (const id of data) allowed.add(id)
  }
  return allowed
}
